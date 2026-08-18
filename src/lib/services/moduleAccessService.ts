import "server-only";
import type { Module } from "@/lib/db/types";
import { listActivePhases } from "@/lib/repositories/phasesRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { computeTrilhaView, buildOrderedModules } from "./trilhaView";
import { findNextModuleId } from "./progressionService";

/**
 * Fase 8, tarefa 3 e critério de aceite ("módulo bloqueado não pode ser
 * baixado por chamada direta"): centraliza a checagem de "esse módulo
 * existe, é aplicável a este usuário, e está liberado para ele" — usada
 * tanto pelo endpoint de PDF quanto pelo de quiz, e pela página do
 * módulo em si.
 *
 * Reaproveita a MESMA lógica de desbloqueio da Fase 6/7 (computeTrilhaView)
 * em vez de reimplementar — assim um módulo nunca aparece liberado em
 * "Minha Trilha" e bloqueado aqui (ou vice-versa).
 */

export interface ModuleAccessInfo {
  module: Module;
  unlocked: boolean;
  completed: boolean;
  materialAccessed: boolean;
  bestScore: number | null;
  phaseNome: string;
  nextModuleId: string | null;
  nextModuleNome: string | null;
}

export async function getModuleAccessInfo(
  userId: string,
  trackId: string | null,
  moduleId: string
): Promise<ModuleAccessInfo | null> {
  const [phases, modules, userModules] = await Promise.all([
    listActivePhases(),
    listActiveModulesForTrack(trackId),
    listUserModules(userId),
  ]);

  const targetModule = modules.find((m) => m.id === moduleId);
  if (!targetModule) return null; // não existe, inativo, ou não aplicável a esta trilha

  const view = computeTrilhaView(phases, modules, userModules);
  const phaseView = view.phases.find((p) => p.modules.some((m) => m.id === moduleId));
  const moduleView = phaseView?.modules.find((m) => m.id === moduleId);
  if (!phaseView || !moduleView) return null;

  const ordered = buildOrderedModules(phases, modules);
  const nextModuleId = findNextModuleId(ordered, moduleId);
  const nextModule = nextModuleId ? modules.find((m) => m.id === nextModuleId) ?? null : null;

  return {
    module: targetModule,
    unlocked: moduleView.unlocked,
    completed: moduleView.completed,
    materialAccessed: moduleView.materialAccessed,
    bestScore: moduleView.bestScore,
    phaseNome: phaseView.nome,
    nextModuleId: nextModule?.id ?? null,
    nextModuleNome: nextModule?.nome ?? null,
  };
}
