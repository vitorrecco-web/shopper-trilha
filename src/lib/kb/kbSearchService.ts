import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface KbSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  arquivo: string;
  caminho: string;
  categoria: string;
  score: number;
}

interface KbTextSearchRow {
  chunk_id: string;
  document_id: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  rank: number;
  nome: string;
  caminho: string;
  categoria: string;
}

export async function searchKnowledgeBase(
  query: string,
  topK = 8
): Promise<KbSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc("kb_search_chunks_text", {
    search_query: trimmed,
    match_count: topK,
  });

  if (error) throw error;

  return ((data ?? []) as KbTextSearchRow[]).map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    content: row.content,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    arquivo: row.nome,
    caminho: row.caminho,
    categoria: row.categoria,
    score: row.rank,
  }));
}