import "server-only";
import { listActiveModulesForTrack, listActiveModulesForTrackIds } from "@/lib/repositories/modulesRepository";
import { listUserModules, listUserModulesForUsers } from "@/lib/repositories/userModulesRepository";
export { computeTrackStatus, trackStatusLabel, type TrackStatus } from "./trackStatus";

/**
 * §12 do PROJECT_CONTEXT: "A situação Concluída é calculada, não salva
 * como flag permanente." Este serviço recalcula o progresso a cada
 * leitura, a partir dos módulos ativos aplicáveis à trilha do usuário
 * e do que existe em user_modules — nunca lê nem escreve um campo
 * "progresso" na tabela users.
 */
export interface UserProgress {
  totalModules: number;
  completedModules: number;
  /** null enquanto não existir nenhum módulo ativo para a trilha (ex: antes da Fase 4/5). */
  percent: number | null;
}

export async function computeUserProgress(
  userId: string,
  trackId: string | null
): Promise<UserProgress> {
  const modules = await listActiveModulesForTrack(trackId);

  if (modules.length === 0) {
    return { totalModules: 0, completedModules: 0, percent: null };
  }

  const userModules = await listUserModules(userId);
  const completedIds = new Set(userModules.filter((m) => m.completed).map((m) => m.module_id));
  const completedModules = modules.filter((m) => completedIds.has(m.id)).length;

  return {
    totalModules: modules.length,
    completedModules,
    percent: Math.round((completedModules / modules.length) * 100),
  };
}

/**
 * PATCH CORRETIVO — Prioridade 1: `/admin/usuarios` disparava
 * `computeUserProgress` por usuário (2 consultas sequenciais cada),
 * ou seja, 2×N chamadas ao Supabase em paralelo via `Promise.all` só
 * para montar a listagem. Com poucos usuários de teste isso nunca
 * quebrava; com a base real de produção, é um candidato concreto para
 * estourar limite de conexões/taxa do Supabase ou o timeout da função
 * serverless — exatamente o tipo de causa server-side que produz
 * "Application error: a server-side exception has occurred" sem
 * nenhuma mudança visual/de props envolvida.
 *
 * Esta versão em lote faz o equivalente com um número FIXO de consultas
 * (2, não importa quantos usuários existam): uma para os módulos de
 * todas as trilhas envolvidas, outra para o user_modules de todos os
 * usuários — e computa o progresso de cada um em memória depois.
 */
export async function computeUsersProgressBatch(
  users: Array<{ id: string; track_id: string | null }>
): Promise<Map<string, UserProgress>> {
  const distinctTrackIds = [...new Set(users.map((u) => u.track_id).filter((t): t is string => t !== null))];

  const [modules, userModules] = await Promise.all([
    listActiveModulesForTrackIds(distinctTrackIds),
    listUserModulesForUsers(users.map((u) => u.id)),
  ]);

  const userModulesByUserId = new Map<string, typeof userModules>();
  for (const um of userModules) {
    const list = userModulesByUserId.get(um.user_id) ?? [];
    list.push(um);
    userModulesByUserId.set(um.user_id, list);
  }

  const result = new Map<string, UserProgress>();
  for (const u of users) {
    const applicable = modules.filter((m) => m.track_id === null || m.track_id === u.track_id);
    if (applicable.length === 0) {
      result.set(u.id, { totalModules: 0, completedModules: 0, percent: null });
      continue;
    }
    const myUserModules = userModulesByUserId.get(u.id) ?? [];
    const completedIds = new Set(myUserModules.filter((m) => m.completed).map((m) => m.module_id));
    const completedModules = applicable.filter((m) => completedIds.has(m.id)).length;
    result.set(u.id, {
      totalModules: applicable.length,
      completedModules,
      percent: Math.round((completedModules / applicable.length) * 100),
    });
  }
  return result;
}
