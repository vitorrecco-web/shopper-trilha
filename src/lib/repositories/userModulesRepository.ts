import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { UserModule } from "@/lib/db/types";

export async function listUserModules(userId: string): Promise<UserModule[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("user_modules").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as UserModule[];
}

/**
 * Versão em lote de `listUserModules` — busca todos os usuários numa
 * única consulta (`user_id IN (...)`), em vez de N consultas
 * sequenciais/paralelas por usuário. Usada por `/admin/usuarios` para
 * evitar disparar 2×N chamadas ao Supabase de uma vez (uma por
 * módulos + uma por user_modules, por usuário), que sob carga real de
 * produção (mais usuários do que em teste) é um risco concreto de
 * exceção/timeout — exatamente o tipo de causa investigada no patch
 * corretivo cirúrgico.
 */
export async function listUserModulesForUsers(userIds: string[]): Promise<UserModule[]> {
  if (userIds.length === 0) return [];
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("user_modules").select("*").in("user_id", userIds);
  if (error) throw error;
  return data as UserModule[];
}

export async function getUserModule(userId: string, moduleId: string): Promise<UserModule | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_modules")
    .select("*")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error) throw error;
  return data as UserModule | null;
}

/** Garante a linha (cria se não existir) sem sobrescrever progresso já feito. */
export async function ensureUserModule(userId: string, moduleId: string): Promise<UserModule> {
  const supabase = getSupabaseServerClient();
  const existing = await getUserModule(userId, moduleId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("user_modules")
    .insert({ user_id: userId, module_id: moduleId })
    .select("*")
    .single();
  if (error) throw error;
  return data as UserModule;
}

export async function markUnlocked(userId: string, moduleId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  await ensureUserModule(userId, moduleId);
  const { error } = await supabase
    .from("user_modules")
    .update({ unlocked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .is("unlocked_at", null); // não sobrescreve se já tinha sido desbloqueado antes
  if (error) throw error;
}

/** §9: primeiro acesso ao visualizador registra material_accessed + data/hora. */
export async function markMaterialAccessed(userId: string, moduleId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  await ensureUserModule(userId, moduleId);
  const { error } = await supabase
    .from("user_modules")
    .update({ material_accessed: true, material_accessed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .eq("material_accessed", false); // só grava a primeira vez
  if (error) throw error;
}

/**
 * §3.3 fluxo sem perguntas: "Acessar PDF -> concluir módulo -> liberar
 * próximo". Dedicada (em vez de reaproveitar markPassedAndMaybeUpdateBestScore)
 * porque não existe nota para um módulo sem quiz — best_score fica null.
 * Idempotente: não sobrescreve completed_at se já estava concluído.
 */
export async function markCompletedWithoutQuiz(userId: string, moduleId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const current = await ensureUserModule(userId, moduleId);

  const { error } = await supabase
    .from("user_modules")
    .update({ completed: true, completed_at: current.completed_at ?? new Date().toISOString() })
    .eq("user_id", userId)
    .eq("module_id", moduleId);
  if (error) throw error;
}

/**
 * Percentual máximo assistido do vídeo — mesma lógica de "nunca regride"
 * já usada em best_score, para o aluno poder pausar/voltar sem perder
 * progresso. `percent` é o que o cliente reportou nesta chamada; a
 * função sempre mantém o maior valor já visto, nunca sobrescreve com um
 * valor menor (ex: se o aluno voltar o vídeo para o início).
 */
export async function updateVideoWatchedPercent(
  userId: string,
  moduleId: string,
  percent: number
): Promise<number> {
  const supabase = getSupabaseServerClient();
  const current = await ensureUserModule(userId, moduleId);

  const clamped = Math.max(0, Math.min(100, percent));
  const nextPercent =
    current.video_watched_percent === null ? clamped : Math.max(current.video_watched_percent, clamped);

  const { error } = await supabase
    .from("user_modules")
    .update({ video_watched_percent: nextPercent })
    .eq("user_id", userId)
    .eq("module_id", moduleId);
  if (error) throw error;

  return nextPercent;
}

/**
 * §4: após aprovação o módulo fica permanentemente concluído; tentativas
 * seguintes não revogam isso, e nota menor não substitui a melhor nota.
 * Esta função só marca completed=true (idempotente) e atualiza best_score
 * se o novo score for maior que o atual.
 */
export async function markPassedAndMaybeUpdateBestScore(
  userId: string,
  moduleId: string,
  score: number
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const current = await ensureUserModule(userId, moduleId);

  const nextBestScore =
    current.best_score === null || score > current.best_score ? score : current.best_score;

  const { error } = await supabase
    .from("user_modules")
    .update({
      completed: true,
      completed_at: current.completed_at ?? new Date().toISOString(),
      best_score: nextBestScore,
    })
    .eq("user_id", userId)
    .eq("module_id", moduleId);
  if (error) throw error;
}
