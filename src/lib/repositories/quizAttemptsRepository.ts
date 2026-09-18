import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { QuizAttempt } from "@/lib/db/types";

/**
 * §4: guardar histórico completo de tentativas (nunca sobrescrever).
 * O snapshot de perguntas existe para auditar exatamente o que foi
 * mostrado naquela tentativa (perguntas/alternativas embaralhadas).
 */
export interface RecordAttemptInput {
  user_id: string;
  module_id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  passed: boolean;
  answers: Record<string, unknown>;
  questions_snapshot: Record<string, unknown>;
}

export async function recordQuizAttempt(input: RecordAttemptInput): Promise<QuizAttempt> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({ ...input, submitted_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return data as QuizAttempt;
}

export async function listAttemptsForUser(userId: string): Promise<QuizAttempt[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data as QuizAttempt[];
}

export async function listAttemptsForUserModule(
  userId: string,
  moduleId: string
): Promise<QuizAttempt[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data as QuizAttempt[];
}

/**
 * Usado pelo dashboard gerencial (Admin) — precisa de todas as
 * tentativas para agregar desempenho por módulo e ranking de perguntas
 * mais erradas a partir do `questions_snapshot` histórico, não do
 * perguntas.json atual no Drive.
 */
export async function listAllAttempts(): Promise<QuizAttempt[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("quiz_attempts").select("*");
  if (error) throw error;
  return data as QuizAttempt[];
}

/** Detalhe por colaborador de um módulo específico — drill-down do dashboard gerencial. */
export async function listAttemptsForModule(moduleId: string): Promise<QuizAttempt[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("quiz_attempts").select("*").eq("module_id", moduleId);
  if (error) throw error;
  return data as QuizAttempt[];
}
