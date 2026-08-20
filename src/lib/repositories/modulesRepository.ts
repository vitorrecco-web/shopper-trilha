import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Module } from "@/lib/db/types";

/**
 * §16.1: "módulo atual" não é salvo — é calculado em runtime a partir
 * da lista ordenada de módulos ativos aplicáveis ao usuário. Este
 * repositório só busca dados; o cálculo de bloqueado/atual/concluído
 * vive na camada de serviço (Fase 6/7), não aqui.
 */

export async function listActiveModulesForTrack(trackId: string | null): Promise<Module[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("modules").select("*").eq("active", true);

  // Módulos comuns (track_id null) + módulos específicos da trilha do usuário.
  query = trackId ? query.or(`track_id.is.null,track_id.eq.${trackId}`) : query.is("track_id", null);

  const { data, error } = await query.order("ordem", { ascending: true });
  if (error) throw error;
  return data as Module[];
}

/**
 * Versão em lote de `listActiveModulesForTrack` — busca, numa única
 * consulta, os módulos comuns + os de todas as trilhas informadas
 * (em vez de 1 consulta por trilha/usuário). Usada por `/admin/usuarios`
 * para eliminar o N+1 que existia ali (2 consultas por usuário listado).
 */
export async function listActiveModulesForTrackIds(trackIds: string[]): Promise<Module[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("modules").select("*").eq("active", true);

  query = trackIds.length > 0 ? query.or(`track_id.is.null,track_id.in.(${trackIds.join(",")})`) : query.is("track_id", null);

  const { data, error } = await query.order("ordem", { ascending: true });
  if (error) throw error;
  return data as Module[];
}

export async function getModuleById(id: string): Promise<Module | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("modules").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Module | null;
}

export async function getModuleByDriveFolderId(driveFolderId: string): Promise<Module | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("drive_folder_id", driveFolderId)
    .maybeSingle();
  if (error) throw error;
  return data as Module | null;
}

export async function listModulesByPhase(phaseId: string): Promise<Module[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("phase_id", phaseId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data as Module[];
}

/** Inclui inativos — usado pela sincronização (Fase 5) para reconciliar contra o Drive. */
export async function listAllModules(): Promise<Module[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("modules").select("*").order("ordem", { ascending: true });
  if (error) throw error;
  return data as Module[];
}

/** Usado apenas pelo fluxo de sincronização (Fase 5). */
export async function upsertModuleByDriveFolderId(input: {
  phase_id: string;
  track_id: string | null;
  drive_folder_id: string;
  ordem: number;
  nome: string;
  material_type: "pdf" | "youtube";
  pdf_drive_id: string | null;
  pdf_nome: string | null;
  video_drive_id: string | null;
  video_external_id: string | null;
  video_titulo: string | null;
  questions_drive_id: string | null;
  has_questions: boolean;
  active?: boolean;
}): Promise<Module> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modules")
    .upsert(
      { ...input, active: input.active ?? true },
      { onConflict: "drive_folder_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as Module;
}

/** Soft-delete conforme §7.2 — nunca excluir fisicamente. */
export async function deactivateModule(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("modules").update({ active: false }).eq("id", id);
  if (error) throw error;
}
