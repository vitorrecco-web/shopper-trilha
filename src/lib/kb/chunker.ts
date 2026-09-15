/**
 * Divide o texto extraído de um PDF (já separado por página) em chunks
 * adequados para busca semântica. Pura — sem I/O, testável com fixtures.
 *
 * Estratégia: concatena o texto de todas as páginas (registrando o
 * intervalo de caracteres de cada página no texto completo), depois
 * faz uma janela deslizante de ~800 caracteres com ~120 de sobreposição
 * sobre esse texto único — preferindo cortar num espaço em vez de no
 * meio de uma palavra. Cada chunk registra `pageStart`/`pageEnd`
 * olhando em que página(s) seu intervalo de caracteres cai: normalmente
 * fica dentro de 1 página só, mas pode atravessar mais de uma se a(s)
 * página(s) forem curtas.
 */

export interface PageInput {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  content: string;
  pageStart: number;
  pageEnd: number;
  tokenCount: number;
}

export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;

export function chunkDocument(pages: PageInput[]): TextChunk[] {
  const nonEmptyPages = pages.filter((p) => p.text.trim().length > 0);
  if (nonEmptyPages.length === 0) return [];

  let fullText = "";
  const pageRanges: { pageNumber: number; start: number; end: number }[] = [];
  for (const p of nonEmptyPages) {
    const start = fullText.length;
    fullText += (fullText ? "\n\n" : "") + p.text;
    pageRanges.push({ pageNumber: p.pageNumber, start, end: fullText.length });
  }

  function pageAtOffset(offset: number): number {
    const clamped = Math.max(0, Math.min(offset, fullText.length - 1));
    const found = pageRanges.find((r) => clamped >= r.start && clamped < r.end);
    return found?.pageNumber ?? pageRanges[pageRanges.length - 1].pageNumber;
  }

  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < fullText.length) {
    let end = Math.min(cursor + CHUNK_SIZE, fullText.length);

    // Corta num espaço em vez de no meio de uma palavra, a menos que
    // isso encolha demais o chunk (ex: texto sem nenhum espaço perto).
    if (end < fullText.length) {
      const lastSpace = fullText.lastIndexOf(" ", end);
      if (lastSpace > cursor + CHUNK_SIZE * 0.5) {
        end = lastSpace;
      }
    }

    const content = fullText.slice(cursor, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        pageStart: pageAtOffset(cursor),
        pageEnd: pageAtOffset(Math.max(cursor, end - 1)),
        tokenCount: Math.ceil(content.length / 4), // estimativa grosseira (~4 caracteres por token)
      });
    }

    if (end >= fullText.length) break;
    // Avança garantindo progresso real mesmo se a sobreposição for
    // maior que o pedaço atual (evita loop infinito em textos curtos).
    cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
  }

  return chunks;
}
