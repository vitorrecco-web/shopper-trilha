import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { embedSingleText } from "./embeddings";

/**
 * Serviço de busca semântica sobre a base de conhecimento — Fase 1: só
 * recuperação, sem geração de resposta por LLM ainda (isso é uma fase
 * futura do Assistente Shopper).
 */

export interface KbSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  arquivo: string;
  caminho: string;
  categoria: string;
  /**
   * Score normalizado: `1 - distância de cosseno` do pgvector.
   * - 1.0 = idêntico (nunca acontece na prática com textos diferentes).
   * - Na prática, com embeddings da OpenAI, textos MUITO relacionados
   *   costumam ficar por volta de 0.5-0.8; textos sem relação nenhuma,
   *   perto de 0.1-0.3 (o "chão" varia por corpus — é por isso que o
   *   limiar de "não encontrei informação suficiente" deve ser
   *   calibrado observando resultados reais da própria base, não um
   *   número universal).
   * - Quanto MAIOR, mais relevante. Pode, em teoria, ser negativo para
   *   textos "opostos" semanticamente, o que é raríssimo em português
   *   natural.
   */
  score: number;
}

interface KbMatchRow {
  chunk_id: string;
  document_id: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  distance: number;
  nome: string;
  caminho: string;
  categoria: string;
}

export async function searchKnowledgeBase(query: string, topK = 8): Promise<KbSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const embedding = await embedSingleText(trimmed);
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc("kb_match_chunks", {
    query_embedding: embedding,
    match_count: topK,
  });
  if (error) throw error;

  return ((data ?? []) as KbMatchRow[]).map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    content: row.content,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    arquivo: row.nome,
    caminho: row.caminho,
    categoria: row.categoria,
    score: 1 - row.distance,
  }));
}
