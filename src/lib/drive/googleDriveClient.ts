import "server-only";
import { google } from "googleapis";
import type { DriveItem, DriveLister } from "./types";

/**
 * §4 (Fase 4) do EXECUTION_PLAN: integração server-side com o Drive,
 * pasta raiz por variável de ambiente, credenciais nunca expostas ao
 * cliente. Este arquivo é o único ponto que fala com a API do Google —
 * toda a lógica de "o que fazer com a árvore de pastas" fica em
 * trilhaMapper.ts, que não sabe nada sobre googleapis.
 */

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ausentes. Configure .env.local."
    );
  }

  // No painel da Vercel/no .env, quebras de linha da chave privada costumam
  // vir escapadas como "\n" literal — aqui viram quebra de linha de verdade.
  const privateKey = rawKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
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

  return {
    async listChildren(folderId: string): Promise<DriveItem[]> {
      const items: DriveItem[] = [];
      let pageToken: string | undefined;

      do {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, mimeType)",
          pageSize: 200,
          pageToken,
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
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
  return res.data as unknown as string;
}
