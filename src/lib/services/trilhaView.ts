import type { Phase, Module, UserModule } from "@/lib/db/types";

/**
 * Lógica pura (sem I/O) para a Fase 6 — Minha Trilha. A persistência de
 * `unlocked_at`/`completed` e a progressão em si são da Fase 7; aqui só
 * computamos, em memória, o que mostrar na tela a partir do que já
 * existe em user_modules (que pode estar vazio, já que nenhum aluno
 * ainda passou pela Fase 7).
 *
 * Regra de desbloqueio para EXIBIÇÃO (§3.3, §7.1):
 * - um módulo já com `unlocked_at` persistido nunca volta a ficar
 *   bloqueado, mesmo que um módulo novo seja inserido antes dele;
 * - na ausência desse registro, um módulo está liberado se for o
 *   primeiro da trilha (ordenada por fase, depois por módulo) ou se o
 *   módulo imediatamente anterior nessa sequência estiver concluído —
 *   isso cobre tanto a progressão dentro da fase quanto "ao concluir o
 *   último módulo de uma fase, libera o primeiro da próxima", porque na
 *   sequência linear elas são vizinhas.
 */

export interface TrilhaModuleView {
  id: string;
  drive_folder_id: string;
  nome: string;
  ordem: number;
  unlocked: boolean;
  completed: boolean;
  materialAccessed: boolean;
  bestScore: number | null;
  isCurrent: boolean;
}

export interface TrilhaPhaseView {
  id: string;
  nome: string;
  ordem: number;
  modules: TrilhaModuleView[];
  completedCount: number;
  totalCount: number;
  percent: number;
  isDefaultOpen: boolean;
}

export interface TrilhaView {
  phases: TrilhaPhaseView[];
  overallCompleted: number;
  overallTotal: number;
  overallPercent: number;
}

/**
 * Sequência global (fase, depois módulo) — usada tanto para computar a
 * visão da trilha (abaixo) quanto pelo serviço de progressão da Fase 7
 * (`progressionService.ts`), que decide qual módulo liberar a seguir.
 */
export function buildOrderedModules(phases: Phase[], modules: Module[]): Module[] {
  const modulesByPhaseId = new Map<string, Module[]>();
  for (const m of modules) {
    const list = modulesByPhaseId.get(m.phase_id) ?? [];
    list.push(m);
    modulesByPhaseId.set(m.phase_id, list);
  }
  for (const list of modulesByPhaseId.values()) {
    list.sort((a, b) => a.ordem - b.ordem);
  }

  const orderedPhases = [...phases].sort((a, b) => a.ordem - b.ordem);

  const flat: Module[] = [];
  for (const phase of orderedPhases) {
    flat.push(...(modulesByPhaseId.get(phase.id) ?? []));
  }
  return flat;
}

export function computeTrilhaView(phases: Phase[], modules: Module[], userModules: UserModule[]): TrilhaView {
  const userModuleByModuleId = new Map(userModules.map((um) => [um.module_id, um]));

  const modulesByPhaseId = new Map<string, Module[]>();
  for (const m of modules) {
    const list = modulesByPhaseId.get(m.phase_id) ?? [];
    list.push(m);
    modulesByPhaseId.set(m.phase_id, list);
  }
  for (const list of modulesByPhaseId.values()) {
    list.sort((a, b) => a.ordem - b.ordem);
  }

  const orderedPhases = [...phases].sort((a, b) => a.ordem - b.ordem);

  // Sequência global (fase, depois módulo) — é sobre ela que a regra de
  // "anterior concluído libera o próximo" é aplicada.
  const flat: Array<{ phase: Phase; module: Module }> = [];
  for (const phase of orderedPhases) {
    for (const module of modulesByPhaseId.get(phase.id) ?? []) {
      flat.push({ phase, module });
    }
  }

  let previousCompleted = true; // o primeiro módulo da trilha sempre começa liberado
  let currentAssigned = false;

  const moduleViewById = new Map<string, TrilhaModuleView>();

  for (const { module } of flat) {
    const um = userModuleByModuleId.get(module.id);
    const persistedUnlock = Boolean(um?.unlocked_at);
    const unlocked = persistedUnlock || previousCompleted;
    const completed = Boolean(um?.completed);

    const isCurrent = unlocked && !completed && !currentAssigned;
    if (isCurrent) currentAssigned = true;

    moduleViewById.set(module.id, {
      id: module.id,
      drive_folder_id: module.drive_folder_id,
      nome: module.nome,
      ordem: module.ordem,
      unlocked,
      completed,
      materialAccessed: Boolean(um?.material_accessed),
      bestScore: um?.best_score ?? null,
      isCurrent,
    });

    previousCompleted = completed;
  }

  let defaultOpenPhaseId: string | null = null;

  const phaseViews: TrilhaPhaseView[] = orderedPhases.map((phase) => {
    const phaseModules = (modulesByPhaseId.get(phase.id) ?? []).map((m) => moduleViewById.get(m.id)!);
    const completedCount = phaseModules.filter((m) => m.completed).length;
    const totalCount = phaseModules.length;
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    if (defaultOpenPhaseId === null && phaseModules.some((m) => m.isCurrent)) {
      defaultOpenPhaseId = phase.id;
    }

    return {
      id: phase.id,
      nome: phase.nome,
      ordem: phase.ordem,
      modules: phaseModules,
      completedCount,
      totalCount,
      percent,
      isDefaultOpen: false, // ajustado abaixo, depois de sabermos qual fase é
    };
  });

  // Se a trilha inteira já foi concluída (nenhum módulo "current"), abre
  // a última fase por padrão — não deixar o accordion inteiro fechado.
  const openId = defaultOpenPhaseId ?? phaseViews[phaseViews.length - 1]?.id ?? null;
  for (const p of phaseViews) {
    p.isDefaultOpen = p.id === openId;
  }

  const overallCompleted = flat.filter(({ module }) => moduleViewById.get(module.id)!.completed).length;
  const overallTotal = flat.length;
  const overallPercent = overallTotal === 0 ? 0 : Math.round((overallCompleted / overallTotal) * 100);

  return { phases: phaseViews, overallCompleted, overallTotal, overallPercent };
}
