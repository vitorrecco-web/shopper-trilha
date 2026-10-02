import "server-only";
import type { Module } from "@/lib/db/types";
import {
  getDriveFileMeta,
  getGoogleDriveLister,
  renameDriveFile,
  trashDriveFile,
  exportDriveFileAsPdf,
  createDriveBinaryFile,
  createDriveJsonFile,
  updateDriveFileContent,
  GOOGLE_SLIDES_MIME,
} from "@/lib/drive/googleDriveClient";
import { PDF_MIME } from "@/lib/drive/types";
import { extractYoutubeVideoId } from "@/lib/drive/validateVideoJson";
import { setModuleMaterial } from "@/lib/repositories/modulesRepository";

/**
 * Admin > Conteúdo — troca o material principal de um módulo pelo app,
 * mantendo Drive e banco no MESMO estado que a sincronização derivaria da
 * pasta (regra §5.1: exatamente 1 material por pasta; título = nome do PDF
 * sem extensão, ou `titulo` do video.json).
 */

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PPTX_BYTES = 50 * 1024 * 1024;

export class ContentError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

/** Título que vira nome de arquivo no Drive: sem caracteres proibidos, 1 a 120 caracteres. */
export function sanitizeMaterialTitle(raw: string): string | null {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.pdf$/i, "")
    .trim()
    .slice(0, 120)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function isMaterialItem(item: { name: string; mimeType: string }): boolean {
  return item.mimeType === PDF_MIME || item.mimeType === GOOGLE_SLIDES_MIME || item.name.toLowerCase() === "video.json";
}

/** Manda para a lixeira do Drive (reversível) todo material da pasta, exceto os ids a manter. perguntas.json nunca é tocado. */
async function trashOtherMaterials(folderId: string, keepIds: string[]): Promise<void> {
  const children = await getGoogleDriveLister().listChildren(folderId);
  for (const item of children) {
    if (keepIds.includes(item.id)) continue;
    if (!isMaterialItem(item)) continue;
    await trashDriveFile(item.id);
  }
}

async function assertFileInModuleFolder(fileId: string, module: Module) {
  const meta = await getDriveFileMeta(fileId);
  if (meta.trashed || !meta.parents.includes(module.drive_folder_id)) {
    throw new ContentError("O arquivo enviado não foi encontrado na pasta deste módulo. Tente enviar de novo.");
  }
  return meta;
}

export async function finalizePdfUpload(module: Module, fileId: string, rawTitle: string): Promise<{ nome: string }> {
  const titulo = sanitizeMaterialTitle(rawTitle);
  if (!titulo) throw new ContentError("Informe um título para o material.");

  const meta = await assertFileInModuleFolder(fileId, module);
  if (meta.mimeType !== PDF_MIME) throw new ContentError("O arquivo enviado não é um PDF.");
  if (meta.size !== null && meta.size > MAX_PDF_BYTES) {
    await trashDriveFile(fileId);
    throw new ContentError("PDF acima do limite de 25 MB.");
  }

  const fileName = `${titulo}.pdf`;
  await renameDriveFile(fileId, fileName);
  await trashOtherMaterials(module.drive_folder_id, [fileId]);
  await setModuleMaterial(module.id, { type: "pdf", nome: titulo, pdf_drive_id: fileId, pdf_nome: fileName });
  return { nome: titulo };
}

export async function finalizePptxUpload(module: Module, slidesFileId: string, rawTitle: string): Promise<{ nome: string }> {
  const titulo = sanitizeMaterialTitle(rawTitle);
  if (!titulo) throw new ContentError("Informe um título para o material.");

  const meta = await assertFileInModuleFolder(slidesFileId, module);
  if (meta.mimeType !== GOOGLE_SLIDES_MIME) {
    throw new ContentError("O arquivo enviado não foi convertido em apresentação pelo Drive. Verifique se é um .pptx válido.");
  }

  let pdf: Buffer;
  try {
    pdf = await exportDriveFileAsPdf(slidesFileId);
  } catch (err) {
    // Limite do Drive para exportação (~10 MB de saída): não deixa a apresentação intermediária solta na pasta.
    await trashDriveFile(slidesFileId).catch(() => undefined);
    console.error("Erro ao exportar apresentação para PDF:", err instanceof Error ? err.message : err);
    throw new ContentError(
      "Não foi possível converter a apresentação em PDF (provavelmente grande demais para a conversão automática). Salve como PDF pelo PowerPoint e envie o PDF."
    );
  }

  const fileName = `${titulo}.pdf`;
  const pdfId = await createDriveBinaryFile(module.drive_folder_id, fileName, PDF_MIME, pdf);
  await trashOtherMaterials(module.drive_folder_id, [pdfId]); // inclui a apresentação intermediária
  await setModuleMaterial(module.id, { type: "pdf", nome: titulo, pdf_drive_id: pdfId, pdf_nome: fileName });
  return { nome: titulo };
}

export async function setYoutubeMaterial(module: Module, url: string, rawTitle: string): Promise<{ nome: string; videoId: string }> {
  const titulo = sanitizeMaterialTitle(rawTitle);
  if (!titulo) throw new ContentError("Informe um título para o vídeo.");

  const videoId = extractYoutubeVideoId(url.trim());
  if (!videoId) {
    throw new ContentError("Link do YouTube inválido. Use um link do tipo youtube.com/watch?v=... ou youtu.be/...");
  }

  const content = JSON.stringify({ tipo: "youtube", url: url.trim(), titulo }, null, 2);

  const children = await getGoogleDriveLister().listChildren(module.drive_folder_id);
  const existing = children.find((c) => c.name.toLowerCase() === "video.json");

  let videoFileId: string;
  if (existing) {
    await updateDriveFileContent(existing.id, content);
    videoFileId = existing.id;
  } else {
    videoFileId = await createDriveJsonFile(module.drive_folder_id, "video.json", content);
  }

  await trashOtherMaterials(module.drive_folder_id, [videoFileId]); // remove o PDF anterior, se houver
  await setModuleMaterial(module.id, {
    type: "youtube",
    nome: titulo,
    video_drive_id: videoFileId,
    video_external_id: videoId,
    video_titulo: titulo,
  });
  return { nome: titulo, videoId };
}
