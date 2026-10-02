import "server-only";
import type { Module } from "@/lib/db/types";
import { listActivePhases } from "@/lib/repositories/phasesRepository";
import { listActiveModulesForProgram, listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { listActiveTracksForProgram } from "@/lib/repositories/tracksRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { computeTrilhaView, type TrilhaView } from "./trilhaView";

/**
 * Perfis sem travas (viewer/analyst/admin): TODOS os módulos ativos do
 * Programa, inclusive os de função específica (que `listActiveModulesForTrack`
 * com `trackId = null` omitiria). Agrupados por Função e depois por `ordem`
 * — módulos de funções diferentes têm a mesma numeração. Com `labelTracks`,
 * o nome do módulo ganha o prefixo da Função ("Supervisor de Picking · ...")
 * só para exibição na lista; a página do módulo usa o nome original.
 */
export async function loadFullAccessModules(programId: string, labelTracks: boolean): Promise<Module[]> {
  const [modules, tracks] = await Promise.all([
    listActiveModulesForProgram(programId),
    listActiveTracksForProgram(programId),
  ]);
  const trackNomeById = new Map(tracks.map((t) => [t.id, t.nome]));

  const keyOf = (m: Module) => (m.track_id ? (trackNomeById.get(m.track_id) ?? "") : "");

  return [...modules]
    .sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      if (ka !== kb) return ka.localeCompare(kb, "pt-BR");
      return a.ordem - b.ordem;
    })
    .map((m) => {
      const trackNome = m.track_id ? trackNomeById.get(m.track_id) : null;
      return labelTracks && trackNome ? { ...m, nome: `${trackNome} · ${m.nome}` } : m;
    });
}

/**
 * `listActiveModulesForTrack` já devolve só os módulos aplicáveis ao
 * usuário (comuns + os da Fase 1 do Programa/função dele — §3.1/§3.2),
 * então a filtragem por trilha não precisa ser repetida aqui.
 *
 * `fullAccess`: visão sem travas — tudo liberado, nenhum progresso lido.
 */
export async function getTrilhaViewForUser(
  userId: string,
  programId: string,
  trackId: string | null,
  fullAccess = false
): Promise<TrilhaView> {
  if (fullAccess) {
    const [phases, modules] = await Promise.all([
      listActivePhases(programId),
      loadFullAccessModules(programId, true),
    ]);
    return computeTrilhaView(phases, modules, [], { bypassLocks: true });
  }

  const [phases, modules, userModules] = await Promise.all([
    listActivePhases(programId),
    listActiveModulesForTrack(programId, trackId),
    listUserModules(userId),
  ]);

  return computeTrilhaView(phases, modules, userModules);
}
