import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/db/types";

/**
 * Programa = trilha de treinamento completa (Universidade Shopper).
 * Mesmo shape/padrão de `tracksRepository.ts` — ver `src/lib/db/types.ts`
 * para a distinção entre Programa e Track (função).
 */

export async function listActivePrograms(): Promise<Program[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("active", true)
    .order("nome", { ascending: true });

  if (error) throw error;
  return data as Program[];
}

/** Inclui inativos — usado pela sincronização (Fase 5) para reconciliar contra o Drive. */
export async function listAllPrograms(): Promise<Program[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("programs").select("*").order("nome", { ascending: true });

  if (error) throw error;
  return data as Program[];
}

export async function getProgramById(id: string): Promise<Program | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data as Program | null;
}

export async function getProgramByDriveFolderId(driveFolderId: string): Promise<Program | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("drive_folder_id", driveFolderId)
    .maybeSingle();

  if (error) throw error;
  return data as Program | null;
}

/**
 * Usado pela sincronização com o Drive (Fase 5 original, estendida para
 * Programas). Não usar fora desse fluxo: criar/desativar programas
 * manualmente quebra a regra de "Drive é fonte de verdade".
 */
export async function upsertProgramByDriveFolderId(input: {
  drive_folder_id: string;
  nome: string;
  active?: boolean;
}): Promise<Program> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .upsert(
      { drive_folder_id: input.drive_folder_id, nome: input.nome, active: input.active ?? true },
      { onConflict: "drive_folder_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as Program;
}

/** Soft-delete conforme §7.2 — nunca excluir fisicamente. */
export async function deactivateProgram(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("programs").update({ active: false }).eq("id", id);
  if (error) throw error;
}

/** Admin > Estrutura: renomeia só a linha (a pasta do Drive é renomeada junto por quem chama). */
export async function renameProgram(id: string, nome: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("programs").update({ nome }).eq("id", id);
  if (error) throw error;
}
