import "server-only";

/**
 * Extração de texto de PDF, preservando a página de origem — server-side,
 * sem worker/DOM (usa o build "legacy" do pdfjs-dist, que já é
 * dependência do projeto para o leitor de PDF da trilha).
 *
 * Validado manualmente antes de escrever este arquivo: gerei um PDF de
 * teste de 2 páginas com texto conhecido e confirmei que
 * `getDocument({ data, useWorkerFetch: false, isEvalSupported: false })`
 * extrai o texto correto de cada página sem precisar de
 * `GlobalWorkerOptions.workerSrc` (que só faz sentido no navegador).
 */

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdf {
  pages: ExtractedPage[];
  pageCount: number;
}

/** Abaixo disso, uma página é tratada como "sem texto extraído" (provável PDF escaneado). */
const MIN_CHARS_PER_PAGE_TO_COUNT_AS_TEXT = 20;

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
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
 * Um PDF é considerado "provável escaneado / sem camada de texto" se
 * NENHUMA página tiver uma quantidade mínima de caracteres extraídos —
 * evita marcar como erro um PDF que só tem uma página de capa vazia,
 * mas tem texto de verdade nas demais.
 */
export function looksLikeScannedPdf(extracted: ExtractedPdf): boolean {
  if (extracted.pages.length === 0) return true;
  return extracted.pages.every((p) => p.text.length < MIN_CHARS_PER_PAGE_TO_COUNT_AS_TEXT);
}
