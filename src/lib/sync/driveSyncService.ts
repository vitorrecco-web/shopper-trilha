import "server-only";
import { mapTrilhaFromDrive, type MappedTrilha, type MappedModule } from "@/lib/drive/trilhaMapper";
import { getGoogleDriveLister, getDriveRootFolderId, fetchDriveFileAsText } from "@/lib/drive/googleDriveClient";
import { validatePerguntasJson } from "@/lib/drive/validatePerguntas";
import { validateVideoJson } from "@/lib/drive/validateVideoJson";
import {
  listAllTracks,
  upsertTrackByDriveFolderId,
  deactivateTrack,
  getTrackByDriveFolderId,
} from "@/lib/repositories/tracksRepository";
import {
  listAllPhases,
  upsertPhaseByDriveFolderId,
  deactivatePhase,
  getPhaseByDriveFolderId,
} from "@/lib/repositories/phasesRepository";
import {
  listAllModules,
  upsertModuleByDriveFolderId,
  deactivateModule,
  getModuleByDriveFolderId,
} from "@/lib/repositories/modulesRepository";
import { diffTrilha, type SyncPlan, type ChangeType } from "./diffTrilha";

/**
 * Lê o Drive e valida o conteúdo de perguntas.json (§8.1) e video.json —
 * ambos seguem a mesma regra: se inválido, mostra aviso e o módulo é
 * rebaixado (sem perguntas / sem material principal), nunca interrompe
 * a sincronização. `mapTrilhaFromDrive` só lista metadados; buscar e
 * validar CONTEÚDO de arquivo fica sempre aqui, depois do mapeamento.
 */
async function fetchMappedTrilhaWithValidatedQuestions(): Promise<MappedTrilha> {
  const rootFolderId = getDriveRootFolderId();
  const lister = getGoogleDriveLister();
  const mapped = await mapTrilhaFromDrive(lister, rootFolderId);
  const warnings = [...mapped.warnings];

  async function validateModule(mod: MappedModule, context: string): Promise<MappedModule> {
    let result = mod;

    if (result.has_questions && result.questions_drive_id) {
      try {
        const raw = await fetchDriveFileAsText(result.questions_drive_id);
        const validated = validatePerguntasJson(raw);
        if (!validated.ok) {
          warnings.push(
            `${context} > "${result.nome}": perguntas.json inválido (${validated.error}) — módulo será publicado sem perguntas até ser corrigido.`
          );
          result = { ...result, has_questions: false, questions_drive_id: null };
        }
      } catch {
        warnings.push(
          `${context} > "${result.nome}": não foi possível ler perguntas.json — módulo será publicado sem perguntas até ser corrigido.`
        );
        result = { ...result, has_questions: false, questions_drive_id: null };
      }
    }

    if (result.material_type === "youtube" && result.video_drive_id) {
      try {
        const raw = await fetchDriveFileAsText(result.video_drive_id);
        const validated = validateVideoJson(raw);
        if (!validated.ok) {
          warnings.push(
            `${context} > "${result.nome}": video.json inválido (${validated.error}) — módulo ficará sem material principal até ser corrigido.`
          );
          result = { ...result, video_drive_id: null, video_external_id: null, video_titulo: null };
        } else {
          // §5.1 equivalente para vídeo: o título vem do conteúdo do
          // video.json (não há PDF cujo nome de arquivo possa ser usado).
          result = {
            ...result,
            nome: validated.data.titulo ?? result.nome,
            video_external_id: validated.data.videoId,
            video_titulo: validated.data.titulo,
          };
        }
      } catch {
        warnings.push(
          `${context} > "${result.nome}": não foi possível ler video.json — módulo ficará sem material principal até ser corrigido.`
        );
        result = { ...result, video_drive_id: null, video_external_id: null, video_titulo: null };
      }
    }

    return result;
  }

  for (const phase of mapped.phases) {
    const context = `Fase ${phase.ordem} (${phase.nome})`;
    if (phase.phase_type === "common") {
      for (let i = 0; i < phase.modules.length; i++) {
        phase.modules[i] = await validateModule(phase.modules[i], context);
      }
    } else {
      for (const track of phase.tracks) {
        const trackContext = `${context} > ${track.nome}`;
        for (let i = 0; i < track.modules.length; i++) {
          track.modules[i] = await validateModule(track.modules[i], trackContext);
        }
      }
    }
  }

  return { phases: mapped.phases, warnings };
}

/** Fase 5, tarefas 1-5: só lê (Drive + banco) e monta o plano — nada é gravado. */
export async function buildSyncPlan(): Promise<SyncPlan> {
  const mapped = await fetchMappedTrilhaWithValidatedQuestions();
  const [tracks, phases, modules] = await Promise.all([listAllTracks(), listAllPhases(), listAllModules()]);
  return diffTrilha(mapped, { tracks, phases, modules });
}

export interface ApplySummary {
  counts: Record<ChangeType, number>;
  warningsCount: number;
  failures: string[];
}

/**
 * Fase 5, tarefas 7-8: aplica o plano (só chamado depois da confirmação
 * do admin). Ordem importa: tracks e phases antes de modules, porque
 * modules referenciam ambos por FK.
 *
 * Sem transação atômica entre as tabelas (limitação conhecida do
 * supabase-js sobre REST — ver README, débito técnico). Cada item é
 * aplicado individualmente; uma falha isolada não impede o restante,
 * mas é reportada em `failures`.
 */
export async function applySyncPlan(plan: SyncPlan): Promise<ApplySummary> {
  const failures: string[] = [];

  for (const t of plan.trackUpserts) {
    try {
      await upsertTrackByDriveFolderId({ drive_folder_id: t.drive_folder_id, nome: t.nome, active: true });
    } catch (err) {
      failures.push(`Trilha "${t.nome}": ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }
  for (const driveId of plan.tracksToDeactivate) {
    try {
      const existing = await getTrackByDriveFolderId(driveId);
      if (existing) await deactivateTrack(existing.id);
    } catch (err) {
      failures.push(`Desativar trilha (${driveId}): ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  for (const p of plan.phaseUpserts) {
    try {
      await upsertPhaseByDriveFolderId({
        drive_folder_id: p.drive_folder_id,
        nome: p.nome,
        ordem: p.ordem,
        phase_type: p.phase_type,
        active: true,
      });
    } catch (err) {
      failures.push(`Fase "${p.nome}": ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }
  for (const driveId of plan.phasesToDeactivate) {
    try {
      const existing = await getPhaseByDriveFolderId(driveId);
      if (existing) await deactivatePhase(existing.id);
    } catch (err) {
      failures.push(`Desativar fase (${driveId}): ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  for (const m of plan.moduleUpserts) {
    try {
      const phase = await getPhaseByDriveFolderId(m.phase_drive_folder_id);
      if (!phase) {
        failures.push(`Módulo "${m.nome}": fase não encontrada após sincronização.`);
        continue;
      }
      let trackId: string | null = null;
      if (m.track_drive_folder_id) {
        const track = await getTrackByDriveFolderId(m.track_drive_folder_id);
        if (!track) {
          failures.push(`Módulo "${m.nome}": trilha não encontrada após sincronização.`);
          continue;
        }
        trackId = track.id;
      }
      await upsertModuleByDriveFolderId({
        phase_id: phase.id,
        track_id: trackId,
        drive_folder_id: m.drive_folder_id,
        ordem: m.ordem,
        nome: m.nome,
        material_type: m.material_type,
        pdf_drive_id: m.pdf_drive_id,
        pdf_nome: m.pdf_nome,
        video_drive_id: m.video_drive_id,
        video_external_id: m.video_external_id,
        video_titulo: m.video_titulo,
        questions_drive_id: m.questions_drive_id,
        has_questions: m.has_questions,
        active: true,
      });
    } catch (err) {
      failures.push(`Módulo "${m.nome}": ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }
  for (const driveId of plan.modulesToDeactivate) {
    try {
      const existing = await getModuleByDriveFolderId(driveId);
      if (existing) await deactivateModule(existing.id);
    } catch (err) {
      failures.push(`Desativar módulo (${driveId}): ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  const counts: Record<ChangeType, number> = { added: 0, removed: 0, renamed: 0, reordered: 0, updated: 0 };
  for (const c of plan.changes) counts[c.change_type]++;

  return { counts, warningsCount: plan.warnings.length, failures };
}
