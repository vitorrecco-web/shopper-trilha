import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Module } from "@/lib/db/types";

/**
 * §16.1: "módulo atual" não é salvo — é calculado em runtime a partir
 * da lista ordenada de módulos ativos aplicáveis ao usuário. Este
 * repositório só busca dados; o cálculo de bloqueado/atual/concluído
 * vive na camada de serviço (Fase 6/7), não aqui.
 */

/**
 * TODOS os módulos ativos de UM Programa (independente de função/track) —
 * base para `listActiveModulesForTrack` e para o batch de progresso
 * (`computeUsersProgressBatch`). Módulos não têm `program_id` direto
 * (só via `phase_id`), então o filtro passa pela fase com `!inner` para
 * poder usar `.eq()` no campo embutido.
 */
export async function listActiveModulesForProgram(programId: string): Promise<Module[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modules")
    .select("*, phase:phases!inner(program_id)")
    .eq("active", true)
    .eq("phase.program_id", programId)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data as (Module & { phase: { program_id: string } })[]).map(({ phase: _phase, ...m }) => m as Module);
}

/** Módulos comuns do Programa (track_id null) + os específicos da função do usuário, já escopados pelo Programa. */
export async function listActiveModulesForTrack(programId: string, trackId: string | null): Promise<Module[]> {
  const modules = await listActiveModulesForProgram(programId);
  return modules.filter((m) => m.track_id === null || m.track_id === trackId);
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

/**
 * Usado pelo editor visual de perguntas (Admin) depois de salvar um
 * perguntas.json válido direto no Drive — mantém `has_questions`
 * coerente sem esperar a próxima sincronização completa da trilha.
 */
export async function setModuleHasQuestions(id: string, hasQuestions: boolean): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("modules").update({ has_questions: hasQuestions }).eq("id", id);
  if (error) throw error;
}

/**
 * Usado pelo editor visual de perguntas (Admin) na PRIMEIRA vez que um
 * módulo sem perguntas.json mapeado ganha um — grava o fileId recém-criado
 * no Drive junto com `has_questions`, numa só escrita.
 */
export async function setModuleQuestionsDriveId(id: string, questionsDriveId: string, hasQuestions: boolean): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("modules")
    .update({ questions_drive_id: questionsDriveId, has_questions: hasQuestions })
    .eq("id", id);
  if (error) throw error;
}

export type ModuleMaterialInput =
  | { type: "pdf"; nome: string; pdf_drive_id: string; pdf_nome: string }
  | { type: "youtube"; nome: string; video_drive_id: string; video_external_id: string; video_titulo: string };

/**
 * Admin > Conteúdo: troca o material principal do módulo gravando EXATAMENTE
 * o que a sincronização derivaria da pasta (título = nome do PDF sem
 * extensão, ou `titulo` do video.json) — assim "Analisar alterações" depois
 * não mostra diferença. Os campos do material que saiu são zerados.
 */
export async function setModuleMaterial(id: string, input: ModuleMaterialInput): Promise<void> {
  const supabase = getSupabaseServerClient();
  const patch =
    input.type === "pdf"
      ? {
          nome: input.nome,
          material_type: "pdf" as const,
          pdf_drive_id: input.pdf_drive_id,
          pdf_nome: input.pdf_nome,
          video_drive_id: null,
          video_external_id: null,
          video_titulo: null,
        }
      : {
          nome: input.nome,
          material_type: "youtube" as const,
          pdf_drive_id: null,
          pdf_nome: null,
          video_drive_id: input.video_drive_id,
          video_external_id: input.video_external_id,
          video_titulo: input.video_titulo,
        };
  const { error } = await supabase.from("modules").update(patch).eq("id", id);
  if (error) throw error;
}
