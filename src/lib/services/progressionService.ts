import "server-only";
import type { Module } from "@/lib/db/types";
import { listActivePhases } from "@/lib/repositories/phasesRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { markUnlocked } from "@/lib/repositories/userModulesRepository";
import { buildOrderedModules } from "./trilhaView";

/**
 * EXECUTION_PLAN Fase 7 — Regra de desbloqueio e progresso.
 *
 * A Fase 6 (`trilhaView.ts`) só *computa em memória* o que exibir. Este
 * arquivo é quem *persiste* de verdade o desbloqueio, via `markUnlocked`
 * (repositório da Fase 1) — que já é idempotente e nunca sobrescreve um
 * `unlocked_at` existente, o que garante §7.1/§7.3: inserir um módulo
 * novo antes de um já desbloqueado não trava ele de novo.
 *
 * Nenhuma tela ainda chama `unlockNextModule` (isso é a Fase 8, para
 * módulos sem perguntas, e a Fase 9, para módulos com quiz aprovado) —
 * mas a função já existe, testada, pronta para ser chamada por elas.
 */

async function getOrderedModulesForTrack(trackId: string | null): Promise<Module[]> {
  const [phases, modules] = await Promise.all([listActivePhases(), listActiveModulesForTrack(trackId)]);
  return buildOrderedModules(phases, modules);
}

/** Pura — separada só para ser testável sem tocar em repositório/banco. */
export function findNextModuleId(ordered: Module[], completedModuleId: string): string | null {
  const index = ordered.findIndex((m) => m.id === completedModuleId);
  if (index === -1) return null;
  return ordered[index + 1]?.id ?? null;
}

/**
 * Tarefa 1: primeiro módulo da trilha começa liberado.
 * Idempotente — pode (e deve) ser chamada toda vez que a Fase 6 monta
 * "Minha Trilha"; só grava de verdade na primeira vez.
 */
export async function ensureFirstModuleUnlocked(userId: string, trackId: string | null): Promise<void> {
  const ordered = await getOrderedModulesForTrack(trackId);
  const first = ordered[0];
  if (!first) return;
  await markUnlocked(userId, first.id);
}

/**
 * Tarefas 2-3: ao concluir um módulo, libera o próximo da sequência
 * global (fase, depois módulo) — cobre avançar dentro da mesma fase E
 * liberar o primeiro módulo da fase seguinte ao terminar a atual, já
 * que na sequência linear elas são vizinhas; nenhum tratamento especial
 * de "fim de fase" é necessário.
 */
export async function unlockNextModule(
  userId: string,
  trackId: string | null,
  completedModuleId: string
): Promise<void> {
  const ordered = await getOrderedModulesForTrack(trackId);
  const nextId = findNextModuleId(ordered, completedModuleId);
  if (!nextId) return;
  await markUnlocked(userId, nextId);
}
