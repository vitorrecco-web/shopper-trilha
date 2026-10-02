import "server-only";
import { listActiveModulesForTrack, listActiveModulesForProgram } from "@/lib/repositories/modulesRepository";
import { listUserModules, listUserModulesForUsers } from "@/lib/repositories/userModulesRepository";
export { computeTrackStatus, trackStatusLabel, type TrackStatus } from "./trackStatus";

/**
 * §12 do PROJECT_CONTEXT: "A situação Concluída é calculada, não salva
 * como flag permanente." Este serviço recalcula o progresso a cada
 * leitura, a partir dos módulos ativos aplicáveis ao Programa/função do
 * usuário e do que existe em user_modules — nunca lê nem escreve um
 * campo "progresso" na tabela users.
 */
export interface UserProgress {
  totalModules: number;
  completedModules: number;
  /** null enquanto não existir nenhum módulo ativo aplicável (sem Programa, ou Programa ainda sem conteúdo sincronizado). */
  percent: number | null;
}

export async function computeUserProgress(
  userId: string,
  programId: string | null,
  trackId: string | null
): Promise<UserProgress> {
  if (!programId) {
    return { totalModules: 0, completedModules: 0, percent: null };
  }

  const modules = await listActiveModulesForTrack(programId, trackId);

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
 * Esta versão em lote faz o equivalente com um número de consultas FIXO
 * por PROGRAMA distinto (não por usuário nem por matrícula): uma busca
 * de módulos por Programa, mais uma única consulta de user_modules de
 * todos os usuários — e computa o progresso de cada um em memória
 * depois.
 *
 * Um usuário pode ter várias matrículas (trilhas) ativas ao mesmo tempo
 * — o progresso devolvido aqui é a SOMA combinada de todas elas (módulos
 * concluídos / total aplicável somando todas as trilhas da pessoa), que
 * é a métrica única mostrada na listagem de Usuários do admin. O
 * detalhe por trilha usa `computeUserProgress` (uma matrícula por vez).
 */
export async function computeUsersProgressBatch(
  users: Array<{ id: string; enrollments: Array<{ program_id: string; track_id: string | null }> }>
): Promise<Map<string, UserProgress>> {
  const distinctProgramIds = [...new Set(users.flatMap((u) => u.enrollments.map((e) => e.program_id)))];

  const [modulesByProgramEntries, userModules] = await Promise.all([
    Promise.all(
      distinctProgramIds.map(
        async (programId) => [programId, await listActiveModulesForProgram(programId)] as const
      )
    ),
    listUserModulesForUsers(users.map((u) => u.id)),
  ]);
  const modulesByProgramId = new Map(modulesByProgramEntries);

  const userModulesByUserId = new Map<string, typeof userModules>();
  for (const um of userModules) {
    const list = userModulesByUserId.get(um.user_id) ?? [];
    list.push(um);
    userModulesByUserId.set(um.user_id, list);
  }

  const result = new Map<string, UserProgress>();
  for (const u of users) {
    const myUserModules = userModulesByUserId.get(u.id) ?? [];
    const completedIds = new Set(myUserModules.filter((m) => m.completed).map((m) => m.module_id));

    let totalModules = 0;
    let completedModules = 0;
    for (const e of u.enrollments) {
      const programModules = modulesByProgramId.get(e.program_id) ?? [];
      const applicable = programModules.filter((m) => m.track_id === null || m.track_id === e.track_id);
      totalModules += applicable.length;
      completedModules += applicable.filter((m) => completedIds.has(m.id)).length;
    }

    result.set(u.id, {
      totalModules,
      completedModules,
      percent: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : null,
    });
  }
  return result;
}
