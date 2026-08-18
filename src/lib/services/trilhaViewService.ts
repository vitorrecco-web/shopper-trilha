import "server-only";
import { listActivePhases } from "@/lib/repositories/phasesRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { computeTrilhaView, type TrilhaView } from "./trilhaView";

/**
 * `listActiveModulesForTrack` já devolve só os módulos aplicáveis ao
 * usuário (comuns + os da Fase 1 da trilha dele — §3.1/§3.2), então a
 * filtragem por trilha não precisa ser repetida aqui.
 */
export async function getTrilhaViewForUser(userId: string, trackId: string | null): Promise<TrilhaView> {
  const [phases, modules, userModules] = await Promise.all([
    listActivePhases(),
    listActiveModulesForTrack(trackId),
    listUserModules(userId),
  ]);

  return computeTrilhaView(phases, modules, userModules);
}
