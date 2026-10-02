import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/db/types";

export async function listActiveTracks(): Promise<Track[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("active", true)
    .order("nome", { ascending: true });

  if (error) throw error;
  return data as Track[];
}

/** Funções/cargos ativos de UM Programa — usado no cadastro de aluno (§11.1), já escopado pelo Programa escolhido. */
export async function listActiveTracksForProgram(programId: string): Promise<Track[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("active", true)
    .eq("program_id", programId)
    .order("nome", { ascending: true });

  if (error) throw error;
  return data as Track[];
}

/** Inclui inativas — usado pela sincronização (Fase 5) para reconciliar contra o Drive. */
export async function listAllTracks(): Promise<Track[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("tracks").select("*").order("nome", { ascending: true });

  if (error) throw error;
  return data as Track[];
}

export async function getTrackById(id: string): Promise<Track | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("tracks").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data as Track | null;
}

export async function getTrackByDriveFolderId(driveFolderId: string): Promise<Track | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("drive_folder_id", driveFolderId)
    .maybeSingle();

  if (error) throw error;
  return data as Track | null;
}

/**
 * Usado pela sincronização com o Drive (Fase 5). Não usar fora desse fluxo:
 * criar/desativar tracks manualmente quebra a regra de "Drive é fonte de verdade".
 */
export async function upsertTrackByDriveFolderId(input: {
  program_id: string;
  drive_folder_id: string;
  nome: string;
  active?: boolean;
}): Promise<Track> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tracks")
    .upsert(
      {
        program_id: input.program_id,
        drive_folder_id: input.drive_folder_id,
        nome: input.nome,
        active: input.active ?? true,
      },
      { onConflict: "drive_folder_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as Track;
}

/** Soft-delete conforme §7.2 — nunca excluir fisicamente. */
export async function deactivateTrack(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("tracks").update({ active: false }).eq("id", id);
  if (error) throw error;
}

export async function renameTrack(id: string, nome: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("tracks").update({ nome }).eq("id", id);
  if (error) throw error;
}

/** Soft-delete de todas as Funções de um Programa (remoção do Programa inteiro). */
export async function deactivateTracksOfProgram(programId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("tracks").update({ active: false }).eq("program_id", programId);
  if (error) throw error;
}
