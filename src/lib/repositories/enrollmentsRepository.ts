import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Enrollment } from "@/lib/db/types";

/**
 * Matrículas — um usuário pode ter várias trilhas (Programas) ativas ao
 * mesmo tempo. Ver `src/lib/db/types.ts` para o porquê de não guardar
 * "a trilha do usuário" como campo único em `users`.
 */

export interface EnrollmentWithNames extends Enrollment {
  program_nome: string;
  track_nome: string | null;
}

function mapRow(row: Record<string, unknown>): EnrollmentWithNames {
  const { program, track, ...rest } = row as Record<string, unknown> & {
    program: { nome: string } | null;
    track: { nome: string } | null;
  };
  return {
    ...(rest as unknown as Enrollment),
    program_nome: program?.nome ?? "Programa removido",
    track_nome: track?.nome ?? null,
  };
}

export async function listActiveEnrollmentsForUser(userId: string): Promise<EnrollmentWithNames[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, program:programs(nome), track:tracks(nome)")
    .eq("user_id", userId)
    .eq("active", true);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Versão em lote — 1 consulta para N usuários, mesmo padrão já usado em `listUserModulesForUsers`. */
export async function listActiveEnrollmentsForUsers(userIds: string[]): Promise<Map<string, EnrollmentWithNames[]>> {
  const result = new Map<string, EnrollmentWithNames[]>();
  if (userIds.length === 0) return result;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, program:programs(nome), track:tracks(nome)")
    .in("user_id", userIds)
    .eq("active", true);

  if (error) throw error;

  for (const row of data ?? []) {
    const enrollment = mapRow(row);
    const list = result.get(enrollment.user_id) ?? [];
    list.push(enrollment);
    result.set(enrollment.user_id, list);
  }
  return result;
}

/** Inclui inativas — usado na tela de admin para poder reativar em vez de duplicar. */
export async function listAllEnrollmentsForUser(userId: string): Promise<EnrollmentWithNames[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, program:programs(nome), track:tracks(nome)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getEnrollment(userId: string, programId: string): Promise<Enrollment | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  if (error) throw error;
  return data as Enrollment | null;
}

/**
 * Cria a matrícula, ou reativa (e atualiza a função) se já existia uma
 * linha para esse par usuário+Programa — `UNIQUE(user_id, program_id)`
 * impede duplicar, e reaproveitar a linha existente nunca mexe no
 * progresso (que vive em `user_modules`/`quiz_attempts`, não aqui).
 */
export async function createOrReactivateEnrollment(input: {
  user_id: string;
  program_id: string;
  track_id: string | null;
}): Promise<Enrollment> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      { user_id: input.user_id, program_id: input.program_id, track_id: input.track_id, active: true },
      { onConflict: "user_id,program_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as Enrollment;
}

export async function deactivateEnrollment(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("enrollments").update({ active: false }).eq("id", id);
  if (error) throw error;
}
