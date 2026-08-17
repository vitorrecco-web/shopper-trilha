import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Phase } from "@/lib/db/types";

export async function listActivePhases(): Promise<Phase[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("phases")
    .select("*")
    .eq("active", true)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return data as Phase[];
}

export async function getPhaseByDriveFolderId(driveFolderId: string): Promise<Phase | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("phases")
    .select("*")
    .eq("drive_folder_id", driveFolderId)
    .maybeSingle();

  if (error) throw error;
  return data as Phase | null;
}

/** Usado apenas pelo fluxo de sincronização (Fase 5). */
export async function upsertPhaseByDriveFolderId(input: {
  drive_folder_id: string;
  nome: string;
  ordem: number;
  phase_type: Phase["phase_type"];
  active?: boolean;
}): Promise<Phase> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("phases")
    .upsert(
      {
        drive_folder_id: input.drive_folder_id,
        nome: input.nome,
        ordem: input.ordem,
        phase_type: input.phase_type,
        active: input.active ?? true,
      },
      { onConflict: "drive_folder_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as Phase;
}
