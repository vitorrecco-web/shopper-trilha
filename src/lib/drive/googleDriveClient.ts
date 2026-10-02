import "server-only";
import { google } from "googleapis";
import { Readable } from "stream";
import type { DriveItem, DriveLister } from "./types";

/**
 * §4 (Fase 4) do EXECUTION_PLAN: integração server-side com o Drive,
 * pasta raiz por variável de ambiente, credenciais nunca expostas ao
 * cliente. Este arquivo é o único ponto que fala com a API do Google —
 * toda a lógica de "o que fazer com a árvore de pastas" fica em
 * trilhaMapper.ts, que não sabe nada sobre googleapis.
 *
 * NOTA (V1 — provisório): autenticação via OAuth 2.0 + refresh token de
 * uma conta corporativa, em vez de Service Account. O Workspace da
 * Shopper tem "domain-restricted sharing" ativo, que impede compartilhar
 * pastas com contas de serviço (`...iam.gserviceaccount.com`), por elas
 * não pertencerem a um domínio permitido — a pasta nunca chega a ser
 * compartilhada com a Service Account, então ela nunca teria acesso.
 * OAuth com refresh token contorna isso autenticando como uma pessoa que
 * já tem acesso à pasta, sem compartilhar nada com uma identidade nova.
 *
 * Ver README ("Configurar o acesso ao Google Drive") para o motivo
 * completo e para Domain-Wide Delegation como alternativa de produção.
 */

export function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN ausentes. Configure .env.local."
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  // A lib troca o refresh_token por um access_token novo automaticamente
  // (e o renova sozinha quando expira) em cada chamada à API abaixo.
  return oauth2Client;
}

export function getDriveRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID ausente. Configure .env.local.");
  }
  return id;
}

export function getGoogleDriveLister(): DriveLister {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  // A pasta raiz "Trilha de Liderança" vive dentro de um Shared Drive.
  // Sem os parâmetros abaixo, a Drive API simplesmente não retorna nada
  // de dentro de Shared Drives (foi a causa do preview vir sempre vazio:
  // {"ok":true,"phases":[],"warnings":[]}).
  //
  // driveId é resolvido uma vez, a partir da primeira pasta consultada
  // (que na prática é sempre a pasta raiz — mapTrilhaFromDrive chama
  // listChildren(rootFolderId) antes de qualquer outra) e reaproveitado
  // nas chamadas seguintes, já que todo o conteúdo está no mesmo drive.
  let sharedDriveId: string | null | undefined; // undefined = ainda não resolvido

  async function resolveSharedDriveId(someFolderId: string): Promise<string | null> {
    if (sharedDriveId !== undefined) return sharedDriveId;
    try {
      const res = await drive.files.get({
        fileId: someFolderId,
        fields: "driveId",
        supportsAllDrives: true,
      });
      sharedDriveId = res.data.driveId ?? null;
    } catch {
      // Se essa checagem falhar por qualquer motivo, segue sem driveId —
      // supportsAllDrives/includeItemsFromAllDrives sozinhos já resolvem
      // a maioria dos casos; corpora+driveId é só reforço de precisão.
      sharedDriveId = null;
    }
    return sharedDriveId;
  }

  return {
    async listChildren(folderId: string): Promise<DriveItem[]> {
      const driveId = await resolveSharedDriveId(folderId);

      const items: DriveItem[] = [];
      let pageToken: string | undefined;

      do {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, mimeType)",
          pageSize: 200,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          ...(driveId ? { corpora: "drive", driveId } : {}),
        });

        for (const f of res.data.files ?? []) {
          if (f.id && f.name && f.mimeType) {
            items.push({ id: f.id, name: f.name, mimeType: f.mimeType });
          }
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      return items;
    },
  };
}

/**
 * Usado na Fase 5 (validar perguntas.json) e na Fase 9 (buscar
 * perguntas.json para o quiz). Não usado ainda pela Fase 4, mas já
 * colocado aqui porque é a mesma autenticação — evita duplicar a lógica
 * de credenciais depois.
 */
export async function fetchDriveFileAsText(fileId: string): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" }
  );
  return res.data as unknown as string;
}

/** Usado na Fase 8 para servir o PDF do módulo (binário, não texto). */
export async function fetchDriveFileAsBuffer(fileId: string): Promise<Buffer> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Sobrescreve o CONTEÚDO de um arquivo já existente no Drive (mesmo
 * fileId, mesma pasta/nome) — usado pelo editor visual de perguntas
 * (Admin) para salvar o perguntas.json direto no Drive, sem precisar de
 * download + upload manual. O Drive mantém histórico de versões do
 * arquivo automaticamente, então uma sobrescrita indevida ainda pode
 * ser recuperada pela interface do Drive ("Gerenciar versões").
 */
export async function updateDriveFileContent(fileId: string, content: string): Promise<void> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  await drive.files.update({
    fileId,
    media: { mimeType: "application/json", body: content },
    supportsAllDrives: true,
  });
}

/**
 * Cria um arquivo NOVO dentro de uma pasta de módulo — usado pelo editor
 * visual de perguntas (Admin) quando o módulo ainda não tem nenhum
 * perguntas.json no Drive (ex: trilha nova, cadastrada só com PDF/vídeo).
 * Devolve o fileId recém-criado para ser gravado em
 * `modules.questions_drive_id`.
 */
export async function createDriveJsonFile(folderId: string, name: string, content: string): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType: "application/json" },
    media: { mimeType: "application/json", body: content },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) {
    throw new Error("O Drive não devolveu o id do arquivo recém-criado.");
  }
  return res.data.id;
}

/* ------------------------------------------------------------------ *
 * Conteúdo dos módulos pelo app (Admin > Conteúdo) e estrutura.
 * ------------------------------------------------------------------ */

export const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";
const FIELDS_META = "id, name, mimeType, size, parents, trashed";

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  parents: string[];
  trashed: boolean;
}

export async function getDriveFileMeta(fileId: string): Promise<DriveFileMeta> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get({ fileId, fields: FIELDS_META, supportsAllDrives: true });
  return {
    id: res.data.id!,
    name: res.data.name ?? "",
    mimeType: res.data.mimeType ?? "",
    size: res.data.size ? Number(res.data.size) : null,
    parents: res.data.parents ?? [],
    trashed: Boolean(res.data.trashed),
  };
}

/**
 * Inicia uma sessão de upload RESUMÍVEL no Drive e devolve a URL dela. O
 * navegador envia o arquivo direto para essa URL — assim o conteúdo não
 * passa pela função do servidor (limite de ~4,5 MB por requisição na
 * Vercel). O header `Origin` na criação da sessão é o que libera o CORS
 * para esse site.
 *
 * `targetMimeType` = tipo do arquivo que FICA no Drive. Para PowerPoint,
 * passar `GOOGLE_SLIDES_MIME` com `uploadContentType` = tipo do .pptx: o
 * Drive converte para Google Slides no upload (depois exportado para PDF).
 */
export async function startResumableUpload(args: {
  parentFolderId: string;
  name: string;
  targetMimeType: string;
  uploadContentType: string;
  sizeBytes: number;
  origin: string;
}): Promise<string> {
  const auth = getAuth();
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Não foi possível obter o token de acesso do Drive.");

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": args.uploadContentType,
        "X-Upload-Content-Length": String(args.sizeBytes),
        Origin: args.origin,
      },
      body: JSON.stringify({ name: args.name, parents: [args.parentFolderId], mimeType: args.targetMimeType }),
    }
  );

  if (!res.ok) {
    const err = new Error(`Drive recusou iniciar o upload (${res.status}).`) as Error & { code?: number };
    err.code = res.status;
    throw err;
  }
  const location = res.headers.get("location");
  if (!location) throw new Error("O Drive não devolveu a URL da sessão de upload.");
  return location;
}

export async function trashDriveFile(fileId: string): Promise<void> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
}

export async function renameDriveFile(fileId: string, name: string): Promise<void> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  await drive.files.update({ fileId, requestBody: { name }, supportsAllDrives: true });
}

/** Exporta um Google Slides/Docs para PDF (limite do Drive: ~10 MB de saída). */
export async function exportDriveFileAsPdf(fileId: string): Promise<Buffer> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.export(
    { fileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/** Cria um arquivo binário (ex: PDF) numa pasta. Devolve o fileId. */
export async function createDriveBinaryFile(
  folderId: string,
  name: string,
  mimeType: string,
  content: Buffer
): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType },
    media: { mimeType, body: Readable.from(content) },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("O Drive não devolveu o id do arquivo recém-criado.");
  return res.data.id;
}

/**
 * Lê um arquivo do Drive como STREAM (sem carregar tudo na memória) — usado
 * para servir PDFs grandes ao aluno sem estourar o limite de ~4,5 MB de
 * resposta bufferizada da Vercel.
 */
export async function streamDriveFile(fileId: string): Promise<{ stream: Readable; size: number | null }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" });
  const len = res.headers?.["content-length"];
  return { stream: res.data as unknown as Readable, size: len ? Number(len) : null };
}

/** Cria uma pasta dentro de outra (Admin > Estrutura). Devolve o id da pasta. */
export async function createDriveFolder(parentFolderId: string, name: string): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.create({
    requestBody: { name, parents: [parentFolderId], mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("O Drive não devolveu o id da pasta recém-criada.");
  return res.data.id;
}
