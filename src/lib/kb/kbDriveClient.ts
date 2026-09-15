import "server-only";
import { google } from "googleapis";
import { getAuth } from "@/lib/drive/googleDriveClient";

/**
 * Camada de acesso ao Drive EXCLUSIVA da Base de Conhecimento — reaproveita
 * só a autenticação OAuth do módulo da trilha (mesma credencial/conta),
 * mas tem sua própria pasta raiz e sua própria lógica de listagem
 * (precisa de `modifiedTime`/`md5Checksum`, que a listagem da trilha
 * não pede). Isolamento deliberado: `trilhaMapper.ts`/`DriveLister` da
 * trilha não são tocados por nenhuma linha deste arquivo.
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";
const PDF_MIME = "application/pdf";

export function getKbRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_KB_ROOT_FOLDER_ID;
  if (!id) {
    throw new Error("GOOGLE_DRIVE_KB_ROOT_FOLDER_ID ausente. Configure .env.local.");
  }
  return id;
}

export interface KbDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  md5Checksum: string | null;
  /** Caminho completo relativo à raiz de "documentos/", ex: "Liderança/Comunicação/arquivo.pdf". */
  caminho: string;
  /** Primeira subpasta abaixo de "documentos/". */
  categoria: string;
}

interface RawDriveEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  md5Checksum?: string;
}

async function listChildrenRaw(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  driveId: string | null
): Promise<RawDriveEntry[]> {
  const items: RawDriveEntry[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(driveId ? { corpora: "drive" as const, driveId } : {}),
    });
    items.push(...((res.data.files ?? []) as RawDriveEntry[]));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

/**
 * Varre recursivamente toda a árvore abaixo de `rootFolderId` (a pasta
 * "documentos/"), independente da profundidade de subpastas, e retorna
 * só os ARQUIVOS (não pastas) encontrados — com caminho completo e
 * categoria (primeira subpasta) já resolvidos.
 */
export async function listAllFilesRecursively(rootFolderId: string): Promise<KbDriveFile[]> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  let driveId: string | null = null;
  try {
    const res = await drive.files.get({ fileId: rootFolderId, fields: "driveId", supportsAllDrives: true });
    driveId = res.data.driveId ?? null;
  } catch {
    driveId = null;
  }

  const files: KbDriveFile[] = [];

  async function walk(folderId: string, path: string[], categoria: string | null) {
    const entries = await listChildrenRaw(drive, folderId, driveId);
    for (const entry of entries) {
      if (entry.mimeType === FOLDER_MIME) {
        const nextCategoria = categoria ?? entry.name; // a primeira subpasta abaixo da raiz vira a categoria
        await walk(entry.id, [...path, entry.name], nextCategoria);
        continue;
      }
      files.push({
        id: entry.id,
        name: entry.name,
        mimeType: entry.mimeType,
        modifiedTime: entry.modifiedTime ?? new Date(0).toISOString(),
        md5Checksum: entry.md5Checksum ?? null,
        caminho: [...path, entry.name].join("/"),
        categoria: categoria ?? "(raiz)", // arquivo direto em documentos/, sem subpasta — caso de borda, não deveria ser comum
      });
    }
  }

  await walk(rootFolderId, [], null);
  return files;
}

export function isSupportedForIndexing(file: KbDriveFile): boolean {
  return file.mimeType === PDF_MIME;
}
