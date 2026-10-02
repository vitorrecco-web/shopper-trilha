import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RecruitmentPhaseArea,
  RecruitmentResult,
  Vacancy,
  CandidateInterest,
} from "@/lib/db/types";

/**
 * Recrutamento Interno — acesso às tabelas da migration 0012. NUMERIC volta
 * como string do PostgREST: tudo que é nota/corte passa por `Number()` aqui,
 * para o resto do código nunca lidar com string.
 */

/* ------------------------------ configuração ------------------------------ */

export async function getRecruitmentProgramId(): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("recruitment_settings").select("program_id").eq("id", 1).maybeSingle();
  if (error) throw error;
  return (data?.program_id as string | null | undefined) ?? null;
}

export async function setRecruitmentProgramId(programId: string | null): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruitment_settings").upsert({ id: 1, program_id: programId });
  if (error) throw error;
}

export async function listPhaseAreas(): Promise<RecruitmentPhaseArea[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("recruitment_phase_areas").select("*");
  if (error) throw error;
  return data as RecruitmentPhaseArea[];
}

export async function getPhaseArea(phaseId: string): Promise<RecruitmentPhaseArea | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("recruitment_phase_areas")
    .select("*")
    .eq("phase_id", phaseId)
    .maybeSingle();
  if (error) throw error;
  return data as RecruitmentPhaseArea | null;
}

export async function upsertPhaseArea(input: { phase_id: string; area_key: string; area_label: string }): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruitment_phase_areas").upsert(input, { onConflict: "phase_id" });
  if (error) throw error;
}

export async function removePhaseArea(phaseId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruitment_phase_areas").delete().eq("phase_id", phaseId);
  if (error) throw error;
}

/* --------------------------------- vagas ---------------------------------- */

function toVacancy(row: Record<string, unknown>): Vacancy {
  const v = row as unknown as Vacancy;
  return {
    ...v,
    logic_cutoff: Number(v.logic_cutoff),
    area_cutoff: v.area_cutoff === null || v.area_cutoff === undefined ? null : Number(v.area_cutoff),
  };
}

export async function listVacancies(opts: { onlyActive?: boolean } = {}): Promise<Vacancy[]> {
  const supabase = getSupabaseServerClient();
  let q = supabase.from("vacancies").select("*").order("nome", { ascending: true });
  if (opts.onlyActive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toVacancy);
}

export async function getVacancyById(id: string): Promise<Vacancy | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("vacancies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toVacancy(data) : null;
}

export interface VacancyInput {
  nome: string;
  logic_cutoff: number;
  area_key: string | null;
  area_cutoff: number | null;
}

export async function createVacancy(input: VacancyInput): Promise<Vacancy> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("vacancies").insert(input).select("*").single();
  if (error) throw error;
  return toVacancy(data);
}

export async function updateVacancy(id: string, input: Partial<VacancyInput> & { active?: boolean }): Promise<Vacancy> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("vacancies").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return toVacancy(data);
}

/* ------------------------------- interesses ------------------------------- */

export async function listInterestsForUser(userId: string): Promise<CandidateInterest[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("candidate_interests").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as CandidateInterest[];
}

export async function listInterestsForUsers(userIds: string[]): Promise<Map<string, CandidateInterest[]>> {
  const map = new Map<string, CandidateInterest[]>();
  if (userIds.length === 0) return map;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("candidate_interests").select("*").in("user_id", userIds);
  if (error) throw error;
  for (const row of data as CandidateInterest[]) {
    const list = map.get(row.user_id) ?? [];
    list.push(row);
    map.set(row.user_id, list);
  }
  return map;
}

export async function hasAnsweredInterest(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("candidate_interest_answers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Substitui as vagas de interesse do candidato (lista vazia = "ainda não sei") e marca como respondido. */
export async function saveInterests(userId: string, vacancies: Array<{ id: string; nome: string }>): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error: delError } = await supabase.from("candidate_interests").delete().eq("user_id", userId);
  if (delError) throw delError;

  if (vacancies.length > 0) {
    const { error: insError } = await supabase
      .from("candidate_interests")
      .insert(vacancies.map((v) => ({ user_id: userId, vacancy_id: v.id, vacancy_nome: v.nome })));
    if (insError) throw insError;
  }

  const { error: ansError } = await supabase
    .from("candidate_interest_answers")
    .upsert({ user_id: userId, answered_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (ansError) throw ansError;
}

/* -------------------------------- resultados ------------------------------- */

function toResult(row: Record<string, unknown>): RecruitmentResult {
  const r = row as unknown as RecruitmentResult;
  return { ...r, score: Number(r.score) };
}

/** Idempotente: `attempt_id` é UNIQUE — reprocessar a mesma tentativa não duplica. */
export async function insertResults(rows: Array<Omit<RecruitmentResult, "id">>): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("recruitment_results")
    .upsert(rows, { onConflict: "attempt_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function listResultsForUser(userId: string): Promise<RecruitmentResult[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("recruitment_results").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map(toResult);
}

export async function listAllResults(): Promise<RecruitmentResult[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("recruitment_results").select("*");
  if (error) throw error;
  return (data ?? []).map(toResult);
}

/* ------------------------- fotografias de avaliação ------------------------ */

export interface AssessmentRow {
  id: string;
  user_id: string;
  generated_at: string;
  payload: Record<string, unknown>;
}

/** Append-only: cada avaliação gerada vira uma linha nova, nunca é sobrescrita. */
export async function insertAssessment(userId: string, payload: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruitment_assessments").insert({ user_id: userId, payload });
  if (error) throw error;
}

export async function listAssessmentsForUser(userId: string): Promise<AssessmentRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("recruitment_assessments")
    .select("*")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return data as AssessmentRow[];
}
