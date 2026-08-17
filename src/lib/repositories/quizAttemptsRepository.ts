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
