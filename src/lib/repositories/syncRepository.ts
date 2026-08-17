import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SyncHistory, SyncChange } from "@/lib/db/types";

/**
 * Suporte às tabelas sync_history / sync_changes (§8, usado na Fase 5).
 * Fluxo: Admin -> Sincronizar -> Analisar -> Prévia -> Confirmar -> Aplicar.
 * Este repositório só persiste; o cálculo de diffs (Drive x banco) é
 * responsabilidade da camada de serviço da Fase 5.
 */

export async function startSyncPreview(adminUserId: string | null): Promise<SyncHistory> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_history")
    .insert({ admin_user_id: adminUserId, status: "preview" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SyncHistory;
}

export async function recordSyncChange(input: {
  sync_id: string;
  entity_type: SyncChange["entity_type"];
  entity_drive_id: string | null;
  change_type: SyncChange["change_type"];
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
}): Promise<SyncChange> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_changes")
    .insert({
      sync_id: input.sync_id,
      entity_type: input.entity_type,
      entity_drive_id: input.entity_drive_id,
      change_type: input.change_type,
      old_value: input.old_value ?? null,
      new_value: input.new_value ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SyncChange;
}

export async function listChangesForSync(syncId: string): Promise<SyncChange[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_changes")
    .select("*")
    .eq("sync_id", syncId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as SyncChange[];
}

export async function updateSyncStatus(
  syncId: string,
  status: SyncHistory["status"],
  counts?: Partial<
    Pick<
      SyncHistory,
      "added_count" | "removed_count" | "renamed_count" | "reordered_count" | "warnings_count" | "summary"
    >
  >
): Promise<SyncHistory> {
  const supabase = getSupabaseServerClient();
  const timestamps: Record<string, string> = {};
  if (status === "confirmed") timestamps.confirmed_at = new Date().toISOString();
  if (status === "completed") timestamps.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("sync_history")
    .update({ status, ...timestamps, ...counts })
    .eq("id", syncId)
    .select("*")
    .single();
  if (error) throw error;
  return data as SyncHistory;
}

export async function getLastSync(): Promise<SyncHistory | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_history")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SyncHistory | null;
}
