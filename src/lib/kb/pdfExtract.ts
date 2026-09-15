import "server-only";

/**
 * ExtraÃ§Ã£o de texto de PDF, preservando a pÃ¡gina de origem â€” server-side,
 * sem worker/DOM (usa o build "legacy" do pdfjs-dist, que jÃ¡ Ã©
 * dependÃªncia do projeto para o leitor de PDF da trilha).
 *
 * Validado manualmente antes de escrever este arquivo: gerei um PDF de
 * teste de 2 pÃ¡ginas com texto conhecido e confirmei que
 * `getDocument({ data, useWorkerFetch: false, isEvalSupported: false })`
 * extrai o texto correto de cada pÃ¡gina sem precisar de
 * `GlobalWorkerOptions.workerSrc` (que sÃ³ faz sentido no navegador).
 */

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdf {
  pages: ExtractedPage[];
  pageCount: number;
}

/** Abaixo disso, uma pÃ¡gina Ã© tratada como "sem texto extraÃ­do" (provÃ¡vel PDF escaneado). */
const MIN_CHARS_PER_PAGE_TO_COUNT_AS_TEXT = 20;

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  // O PDF.js usa um "fake worker" no Node. No bundle serverless do
  // Next/Vercel, o import relativo padrão "./pdf.worker.mjs" deixa de
  // apontar para um arquivo existente. Carregamos o worker explicitamente
  // e o disponibilizamos no global antes de importar o PDF.js.
  const { WorkerMessageHandler } = await import(
    "pdfjs-dist/legacy/build/pdf.worker.mjs"
  );

  (
    globalThis as typeof globalThis & {
      pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
    }
  ).pdfjsWorker = { WorkerMessageHandler };

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ pageNumber, text });
  }

  return { pages, pageCount: pdf.numPages };
}

/**
 * Um PDF Ã© considerado "provÃ¡vel escaneado / sem camada de texto" se
 * NENHUMA pÃ¡gina tiver uma quantidade mÃ­nima de caracteres extraÃ­dos â€”
 * evita marcar como erro um PDF que sÃ³ tem uma pÃ¡gina de capa vazia,
 * mas tem texto de verdade nas demais.
 */
export function looksLikeScannedPdf(extracted: ExtractedPdf): boolean {
  if (extracted.pages.length === 0) return true;
  return extracted.pages.every((p) => p.text.length < MIN_CHARS_PER_PAGE_TO_COUNT_AS_TEXT);
}
