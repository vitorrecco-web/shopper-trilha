import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface KbDocumentRow {
  id: string;
  drive_file_id: string;
  nome: string;
  caminho: string;
  categoria: string;
  mime_type: string;
  modified_time_drive: string;
  content_hash: string | null;
  page_count: number | null;
  status: "active" | "removed";
  last_indexed_at: string | null;
  last_seen_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAllKbDocuments(): Promise<KbDocumentRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("kb_documents").select("*");
  if (error) throw error;
  return data as KbDocumentRow[];
}

export async function listActiveKbDocuments(): Promise<KbDocumentRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_documents")
    .select("*")
    .eq("status", "active")
    .order("categoria", { ascending: true })
    .order("caminho", { ascending: true });
  if (error) throw error;
  return data as KbDocumentRow[];
}

export interface UpsertKbDocumentInput {
  drive_file_id: string;
  nome: string;
  caminho: string;
  categoria: string;
  mime_type: string;
  modified_time_drive: string;
  content_hash: string | null;
  page_count: number | null;
  status: "active" | "removed";
  error: string | null;
  last_indexed_at: string | null;
}

/** Upsert por `drive_file_id` — cria se não existir, atualiza se já existir. Devolve o id interno. */
export async function upsertKbDocument(input: UpsertKbDocumentInput): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_documents")
    .upsert({ ...input, last_seen_at: new Date().toISOString() }, { onConflict: "drive_file_id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Documento inalterado nesta varredura — só atualiza "ainda existe" sem reprocessar nada. */
export async function touchKbDocumentSeen(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("kb_documents")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Documento que estava "removed" e reapareceu no Drive com o MESMO hash — não precisa reprocessar. */
export async function reactivateKbDocument(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("kb_documents")
    .update({ status: "active", last_seen_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * §9 do que foi pedido: documento removido do Drive some das buscas
 * (status='removed'), mas a linha e os chunks nunca são apagados —
 * histórico preservado, nada destrutivo.
 */
export async function markKbDocumentRemoved(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("kb_documents").update({ status: "removed" }).eq("id", id);
  if (error) throw error;
}

export interface ChunkInsert {
  chunkIndex: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  tokenCount: number;
  embedding: number[] | null;
}

/** Substitui todos os chunks de um documento (usado quando o conteúdo mudou de verdade). */
export async function replaceChunksForDocument(documentId: string, chunks: ChunkInsert[]): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error: deleteError } = await supabase.from("kb_chunks").delete().eq("document_id", documentId);
  if (deleteError) throw deleteError;

  if (chunks.length === 0) return;

  const rows = chunks.map((c) => ({
    document_id: documentId,
    chunk_index: c.chunkIndex,
    content: c.content,
    page_start: c.pageStart,
    page_end: c.pageEnd,
    token_count: c.tokenCount,
    embedding: c.embedding,
  }));

  // Insere em lotes — evita um payload único gigante para documentos
  // com muitos chunks.
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("kb_chunks").insert(batch);
    if (error) throw error;
  }
}

export async function countChunksForDocument(documentId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { count, error } = await supabase
    .from("kb_chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId);
  if (error) throw error;
  return count ?? 0;
}

export async function startKbSync(): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_sync_history")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function completeKbSync(
  id: string,
  status: "completed" | "failed",
  summary: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("kb_sync_history")
    .update({ status, completed_at: new Date().toISOString(), summary })
    .eq("id", id);
  if (error) throw error;
}

export interface KbSyncHistoryRow {
  status: string;
  started_at: string;
  completed_at: string | null;
  summary: unknown;
}

export async function getLastKbSync(): Promise<KbSyncHistoryRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_sync_history")
    .select("status, started_at, completed_at, summary")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
