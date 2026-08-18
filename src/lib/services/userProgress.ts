import "server-only";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";

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
