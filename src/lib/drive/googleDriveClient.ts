import "server-only";
import { google } from "googleapis";
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

function getAuth() {
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
 * Usado na Fase 5 (validar perguntas.json) e na Fase 9 (servir o PDF).
 * Não usado ainda pela Fase 4, mas já colocado aqui porque é a mesma
 * autenticação — evita duplicar a lógica de credenciais depois.
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
