import "server-only";
import { listAllFilesRecursively, getKbRootFolderId, isSupportedForIndexing } from "./kbDriveClient";
import { fetchDriveFileAsBuffer } from "@/lib/drive/googleDriveClient";
import { extractPdfText, looksLikeScannedPdf } from "./pdfExtract";
import { chunkDocument } from "./chunker";
import { embedTexts } from "./embeddings";
import {
  listAllKbDocuments,
  upsertKbDocument,
  touchKbDocumentSeen,
  reactivateKbDocument,
  markKbDocumentRemoved,
  replaceChunksForDocument,
  startKbSync,
  completeKbSync,
  type KbDocumentRow,
} from "@/lib/repositories/kbRepository";

/**
 * Orquestra a sincronização completa da Base de Conhecimento — isolada
 * por completo da sincronização da trilha (kbDriveClient.ts tem sua
 * própria pasta raiz e lógica de listagem; nenhuma tabela da trilha é
 * lida ou escrita aqui).
 *
 * Incremental por hash: só reprocessa (extrai + gera chunks + gera
 * embeddings) documentos novos ou com conteúdo alterado. Documento
 * sumido da varredura vira `status='removed'` — nunca é apagado.
 */

export interface KbSyncSummary {
  novos: number;
  atualizados: number;
  inalterados: number;
  removidos: number;
  comErro: number;
  naoSuportados: number;
}

function emptySummary(): KbSyncSummary {
  return { novos: 0, atualizados: 0, inalterados: 0, removidos: 0, comErro: 0, naoSuportados: 0 };
}

export async function runKbSync(): Promise<KbSyncSummary> {
  const syncId = await startKbSync();
  const summary = emptySummary();

  try {
    const rootFolderId = getKbRootFolderId();
    const driveFiles = await listAllFilesRecursively(rootFolderId);
    const existingDocs = await listAllKbDocuments();
    const existingByDriveId = new Map<string, KbDocumentRow>(existingDocs.map((d) => [d.drive_file_id, d]));
    const seenDriveIds = new Set<string>();

    for (const file of driveFiles) {
      if (!isSupportedForIndexing(file)) {
        summary.naoSuportados++;
        continue;
      }

      seenDriveIds.add(file.id);
      const existing = existingByDriveId.get(file.id);
      const newHash = file.md5Checksum ?? file.modifiedTime;

      // Hash igual (conteúdo não mudou de verdade) — não reprocessa,
      // só marca que o arquivo ainda existe / reativa se tinha sumido.
      if (existing && existing.content_hash === newHash) {
        if (existing.status !== "active") {
          await reactivateKbDocument(existing.id);
        } else {
          await touchKbDocumentSeen(existing.id);
        }
        summary.inalterados++;
        continue;
      }

      try {
        const buffer = await fetchDriveFileAsBuffer(file.id);
        const extracted = await extractPdfText(buffer);

        if (looksLikeScannedPdf(extracted)) {
          await upsertKbDocument({
            drive_file_id: file.id,
            nome: file.name,
            caminho: file.caminho,
            categoria: file.categoria,
            mime_type: file.mimeType,
            modified_time_drive: file.modifiedTime,
            content_hash: newHash,
            page_count: extracted.pageCount,
            status: "active",
            error: "Nenhum texto extraído — provável PDF escaneado (sem camada de texto). OCR fora de escopo nesta fase.",
            last_indexed_at: null,
          });
          summary.comErro++;
          continue;
        }

        const chunks = chunkDocument(extracted.pages);
        const embeddings = await embedTexts(chunks.map((c) => c.content));

        const documentId = await upsertKbDocument({
          drive_file_id: file.id,
          nome: file.name,
          caminho: file.caminho,
          categoria: file.categoria,
          mime_type: file.mimeType,
          modified_time_drive: file.modifiedTime,
          content_hash: newHash,
          page_count: extracted.pageCount,
          status: "active",
          error: null,
          last_indexed_at: new Date().toISOString(),
        });

        await replaceChunksForDocument(
          documentId,
          chunks.map((c, i) => ({
            chunkIndex: i,
            content: c.content,
            pageStart: c.pageStart,
            pageEnd: c.pageEnd,
            tokenCount: c.tokenCount,
            embedding: embeddings[i],
          }))
        );

        if (existing) summary.atualizados++;
        else summary.novos++;
      } catch (err) {
        // Nunca loga o conteúdo do documento — só caminho e a mensagem
        // de erro (que normalmente vem de bibliotecas/HTTP, não do
        // texto do PDF em si).
        console.error(`Erro ao indexar "${file.caminho}":`, err instanceof Error ? err.message : err);
        await upsertKbDocument({
          drive_file_id: file.id,
          nome: file.name,
          caminho: file.caminho,
          categoria: file.categoria,
          mime_type: file.mimeType,
          modified_time_drive: file.modifiedTime,
          content_hash: newHash,
          page_count: null,
          status: "active",
          error: err instanceof Error ? err.message.slice(0, 500) : "Erro desconhecido ao processar o arquivo.",
          last_indexed_at: null,
        });
        summary.comErro++;
      }
    }

    // Documento que existia e não apareceu nesta varredura — saiu do
    // Drive (ou foi movido pra fora de documentos/). Nunca apaga:
    // só sai das buscas (kbSearchService já filtra status='active').
    for (const doc of existingDocs) {
      if (doc.status === "active" && !seenDriveIds.has(doc.drive_file_id)) {
        await markKbDocumentRemoved(doc.id);
        summary.removidos++;
      }
    }

    await completeKbSync(syncId, "completed", summary as unknown as Record<string, unknown>);
    return summary;
  } catch (err) {
    await completeKbSync(syncId, "failed", {
      ...summary,
      erro: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
