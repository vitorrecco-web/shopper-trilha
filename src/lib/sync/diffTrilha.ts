import type { MappedUniversidade, MappedModule, PhaseType } from "@/lib/drive/trilhaMapper";
import type { Program, Track, Phase, Module } from "@/lib/db/types";

/**
 * Lógica pura de comparação Drive x banco (EXECUTION_PLAN Fase 5,
 * tarefas 1-2). Não faz nenhuma chamada de rede nem de banco — recebe a
 * árvore já mapeada do Drive (com perguntas.json já validado por quem
 * chama) e um snapshot do banco, e devolve o que mudou.
 *
 * Isso existe separado de driveSyncService.ts para poder ser testado com
 * fixtures em memória, sem precisar de credenciais reais — mesma ideia
 * usada em trilhaMapper.ts na Fase 4.
 */

export type ChangeType = "added" | "removed" | "renamed" | "reordered" | "updated";
export type EntityType = "program" | "track" | "phase" | "module";

export interface SyncChangeDraft {
  entity_type: EntityType;
  entity_drive_id: string;
  change_type: ChangeType;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  label: string;
  /** Drive folder id do Programa dono desta mudança — usado pela UI (Admin) para agrupar por Programa. */
  program_drive_folder_id: string;
}

export interface ProgramUpsert {
  drive_folder_id: string;
  nome: string;
}

export interface TrackUpsert {
  drive_folder_id: string;
  nome: string;
  program_drive_folder_id: string;
}

export interface PhaseUpsert {
  drive_folder_id: string;
  nome: string;
  ordem: number;
  phase_type: PhaseType;
  program_drive_folder_id: string;
}

export interface ModuleUpsert {
  drive_folder_id: string;
  phase_drive_folder_id: string;
  track_drive_folder_id: string | null;
  ordem: number;
  nome: string;
  material_type: "pdf" | "youtube";
  pdf_drive_id: string | null;
  pdf_nome: string | null;
  video_drive_id: string | null;
  video_external_id: string | null;
  video_titulo: string | null;
  questions_drive_id: string | null;
  has_questions: boolean;
  /** Drive folder id do Programa dono deste módulo — usado pela UI (Admin) para agrupar por Programa. */
  program_drive_folder_id: string;
}

export interface DbSnapshot {
  programs: Program[];
  tracks: Track[];
  phases: Phase[];
  modules: Module[];
}

export interface SyncPlan {
  changes: SyncChangeDraft[];
  warnings: string[];
  programUpserts: ProgramUpsert[];
  trackUpserts: TrackUpsert[];
  phaseUpserts: PhaseUpsert[];
  moduleUpserts: ModuleUpsert[];
  programsToDeactivate: string[];
  tracksToDeactivate: string[];
  phasesToDeactivate: string[];
  modulesToDeactivate: string[];
}

function diffProgram(
  discovered: ProgramUpsert,
  existing: Program | undefined,
  changes: SyncChangeDraft[]
) {
  const programDriveId = discovered.drive_folder_id;
  if (!existing) {
    changes.push({
      entity_type: "program",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "added",
      old_value: null,
      new_value: { nome: discovered.nome },
      label: `Novo Programa: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
    return;
  }
  if (existing.nome !== discovered.nome) {
    changes.push({
      entity_type: "program",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "renamed",
      old_value: { nome: existing.nome },
      new_value: { nome: discovered.nome },
      label: `Programa renomeado: "${existing.nome}" → "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (!existing.active) {
    changes.push({
      entity_type: "program",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { active: false },
      new_value: { active: true },
      label: `Programa reativado: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
}

function diffTrack(discovered: TrackUpsert, existing: Track | undefined, changes: SyncChangeDraft[]) {
  const programDriveId = discovered.program_drive_folder_id;
  if (!existing) {
    changes.push({
      entity_type: "track",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "added",
      old_value: null,
      new_value: { nome: discovered.nome },
      label: `Nova trilha: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
    return;
  }
  if (existing.nome !== discovered.nome) {
    changes.push({
      entity_type: "track",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "renamed",
      old_value: { nome: existing.nome },
      new_value: { nome: discovered.nome },
      label: `Trilha renomeada: "${existing.nome}" → "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (!existing.active) {
    changes.push({
      entity_type: "track",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { active: false },
      new_value: { active: true },
      label: `Trilha reativada: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
}

function diffPhase(discovered: PhaseUpsert, existing: Phase | undefined, changes: SyncChangeDraft[]) {
  const programDriveId = discovered.program_drive_folder_id;
  if (!existing) {
    changes.push({
      entity_type: "phase",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "added",
      old_value: null,
      new_value: { nome: discovered.nome, ordem: discovered.ordem, phase_type: discovered.phase_type },
      label: `Nova fase: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
    return;
  }
  if (existing.nome !== discovered.nome) {
    changes.push({
      entity_type: "phase",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "renamed",
      old_value: { nome: existing.nome },
      new_value: { nome: discovered.nome },
      label: `Fase renomeada: "${existing.nome}" → "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (existing.ordem !== discovered.ordem) {
    changes.push({
      entity_type: "phase",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "reordered",
      old_value: { ordem: existing.ordem },
      new_value: { ordem: discovered.ordem },
      label: `Fase "${discovered.nome}" reordenada: ${existing.ordem} → ${discovered.ordem}`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (existing.phase_type !== discovered.phase_type) {
    changes.push({
      entity_type: "phase",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { phase_type: existing.phase_type },
      new_value: { phase_type: discovered.phase_type },
      label: `Fase "${discovered.nome}" mudou de tipo: ${existing.phase_type} → ${discovered.phase_type}`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (!existing.active) {
    changes.push({
      entity_type: "phase",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { active: false },
      new_value: { active: true },
      label: `Fase reativada: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
}

function diffModule(discovered: ModuleUpsert, existing: Module | undefined, changes: SyncChangeDraft[]) {
  const programDriveId = discovered.program_drive_folder_id;
  if (!existing) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "added",
      old_value: null,
      new_value: { nome: discovered.nome, ordem: discovered.ordem },
      label: `Novo módulo: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
    return;
  }
  if (existing.nome !== discovered.nome) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "renamed",
      old_value: { nome: existing.nome },
      new_value: { nome: discovered.nome },
      label: `Módulo renomeado: "${existing.nome}" → "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (existing.ordem !== discovered.ordem) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "reordered",
      old_value: { ordem: existing.ordem },
      new_value: { ordem: discovered.ordem },
      label: `Módulo "${discovered.nome}" reordenado: ${existing.ordem} → ${discovered.ordem}`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (existing.pdf_drive_id !== discovered.pdf_drive_id) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { pdf_nome: existing.pdf_nome },
      new_value: { pdf_nome: discovered.pdf_nome },
      label: `Módulo "${discovered.nome}": PDF atualizado`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (existing.material_type !== discovered.material_type) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { material_type: existing.material_type },
      new_value: { material_type: discovered.material_type },
      label: `Módulo "${discovered.nome}": material principal mudou de ${existing.material_type === "youtube" ? "YouTube" : "PDF"} para ${discovered.material_type === "youtube" ? "YouTube" : "PDF"}`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (existing.video_external_id !== discovered.video_external_id) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { video_external_id: existing.video_external_id },
      new_value: { video_external_id: discovered.video_external_id },
      label: `Módulo "${discovered.nome}": vídeo do YouTube ${discovered.video_external_id ? "atualizado" : "removido"}`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (existing.has_questions !== discovered.has_questions) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { has_questions: existing.has_questions },
      new_value: { has_questions: discovered.has_questions },
      label: `Módulo "${discovered.nome}": ${discovered.has_questions ? "perguntas adicionadas" : "perguntas removidas"}`,
      program_drive_folder_id: programDriveId,
    });
  }
  const existingHasTrack = existing.track_id !== null;
  const discoveredHasTrack = discovered.track_drive_folder_id !== null;
  if (existingHasTrack !== discoveredHasTrack) {
    // módulo mudou entre fase comum e fase por trilha (ou vice-versa) — caso raro, mas real
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { had_track: existingHasTrack },
      new_value: { had_track: discoveredHasTrack },
      label: `Módulo "${discovered.nome}" mudou de fase/trilha`,
      program_drive_folder_id: programDriveId,
    });
  }
  if (!existing.active) {
    changes.push({
      entity_type: "module",
      entity_drive_id: discovered.drive_folder_id,
      change_type: "updated",
      old_value: { active: false },
      new_value: { active: true },
      label: `Módulo reativado: "${discovered.nome}"`,
      program_drive_folder_id: programDriveId,
    });
  }
}

export function diffTrilha(mapped: MappedUniversidade, db: DbSnapshot): SyncPlan {
  const warnings = [...mapped.warnings];
  const changes: SyncChangeDraft[] = [];

  const dbProgramsByDriveId = new Map(db.programs.map((p) => [p.drive_folder_id, p]));
  const dbProgramsById = new Map(db.programs.map((p) => [p.id, p]));
  const dbTracksByDriveId = new Map(db.tracks.map((t) => [t.drive_folder_id, t]));
  const dbPhasesByDriveId = new Map(db.phases.map((p) => [p.drive_folder_id, p]));
  const dbPhasesById = new Map(db.phases.map((p) => [p.id, p]));
  const dbModulesByDriveId = new Map(db.modules.map((m) => [m.drive_folder_id, m]));

  const programUpserts: ProgramUpsert[] = [];
  const trackUpserts: TrackUpsert[] = [];
  const phaseUpserts: PhaseUpsert[] = [];
  const moduleUpserts: ModuleUpsert[] = [];

  const discoveredProgramIds = new Set<string>();
  const discoveredTrackIds = new Set<string>();
  const discoveredPhaseIds = new Set<string>();
  const discoveredModuleIds = new Set<string>();

  function pushModule(mod: MappedModule, phaseDriveId: string, trackDriveId: string | null, programDriveId: string) {
    discoveredModuleIds.add(mod.drive_folder_id);
    const upsert: ModuleUpsert = {
      drive_folder_id: mod.drive_folder_id,
      phase_drive_folder_id: phaseDriveId,
      track_drive_folder_id: trackDriveId,
      ordem: mod.ordem,
      nome: mod.nome,
      material_type: mod.material_type,
      pdf_drive_id: mod.pdf_drive_id,
      pdf_nome: mod.pdf_nome,
      video_drive_id: mod.video_drive_id,
      video_external_id: mod.video_external_id,
      video_titulo: mod.video_titulo,
      questions_drive_id: mod.questions_drive_id,
      has_questions: mod.has_questions,
      program_drive_folder_id: programDriveId,
    };
    moduleUpserts.push(upsert);
    diffModule(upsert, dbModulesByDriveId.get(mod.drive_folder_id), changes);
  }

  for (const program of mapped.programs) {
    discoveredProgramIds.add(program.drive_folder_id);
    const programUpsert: ProgramUpsert = { drive_folder_id: program.drive_folder_id, nome: program.nome };
    programUpserts.push(programUpsert);
    diffProgram(programUpsert, dbProgramsByDriveId.get(program.drive_folder_id), changes);

    for (const phase of program.phases) {
      discoveredPhaseIds.add(phase.drive_folder_id);
      const phaseUpsert: PhaseUpsert = {
        drive_folder_id: phase.drive_folder_id,
        nome: phase.nome,
        ordem: phase.ordem,
        phase_type: phase.phase_type,
        program_drive_folder_id: program.drive_folder_id,
      };
      phaseUpserts.push(phaseUpsert);
      diffPhase(phaseUpsert, dbPhasesByDriveId.get(phase.drive_folder_id), changes);

      if (phase.phase_type === "common") {
        for (const mod of phase.modules) {
          pushModule(mod, phase.drive_folder_id, null, program.drive_folder_id);
        }
      } else {
        for (const track of phase.tracks) {
          discoveredTrackIds.add(track.drive_folder_id);
          const trackUpsert: TrackUpsert = {
            drive_folder_id: track.drive_folder_id,
            nome: track.nome,
            program_drive_folder_id: program.drive_folder_id,
          };
          trackUpserts.push(trackUpsert);
          diffTrack(trackUpsert, dbTracksByDriveId.get(track.drive_folder_id), changes);

          for (const mod of track.modules) {
            pushModule(mod, phase.drive_folder_id, track.drive_folder_id, program.drive_folder_id);
          }
        }
      }
    }
  }

  // Fases ativas cuja ordem colide com uma fase diferente já existente
  // no banco DENTRO DO MESMO PROGRAMA (não só entre as descobertas agora)
  // violaria o índice único phases_active_order_unique(program_id, ordem)
  // — avisar antes de tentar aplicar. Um Programa recém-descoberto (ainda
  // sem linha no banco) nunca pode colidir com fases existentes de outro
  // Programa — por isso só verifica quando o Programa já existe.
  for (const p of phaseUpserts) {
    const existingProgram = dbProgramsByDriveId.get(p.program_drive_folder_id);
    if (!existingProgram) continue;

    const conflict = db.phases.find(
      (existing) =>
        existing.active &&
        existing.program_id === existingProgram.id &&
        existing.ordem === p.ordem &&
        existing.drive_folder_id !== p.drive_folder_id &&
        !discoveredPhaseIds.has(existing.drive_folder_id)
    );
    if (conflict) {
      warnings.push(
        `Fase "${p.nome}" (ordem ${p.ordem}) colide com a fase já cadastrada "${conflict.nome}" no mesmo Programa, que não foi encontrada nesta leitura do Drive.`
      );
    }
  }

  const programsToDeactivate = db.programs
    .filter((p) => p.active && !discoveredProgramIds.has(p.drive_folder_id))
    .map((p) => p.drive_folder_id);
  const tracksToDeactivate = db.tracks
    .filter((t) => t.active && !discoveredTrackIds.has(t.drive_folder_id))
    .map((t) => t.drive_folder_id);
  const phasesToDeactivate = db.phases
    .filter((p) => p.active && !discoveredPhaseIds.has(p.drive_folder_id))
    .map((p) => p.drive_folder_id);
  const modulesToDeactivate = db.modules
    .filter((m) => m.active && !discoveredModuleIds.has(m.drive_folder_id))
    .map((m) => m.drive_folder_id);

  for (const driveId of programsToDeactivate) {
    const p = dbProgramsByDriveId.get(driveId);
    if (!p) continue;
    changes.push({
      entity_type: "program",
      entity_drive_id: driveId,
      change_type: "removed",
      old_value: { nome: p.nome },
      new_value: null,
      label: `Programa removido: "${p.nome}"`,
      program_drive_folder_id: driveId,
    });
  }
  for (const driveId of tracksToDeactivate) {
    const t = dbTracksByDriveId.get(driveId);
    if (!t) continue;
    const program = dbProgramsById.get(t.program_id);
    changes.push({
      entity_type: "track",
      entity_drive_id: driveId,
      change_type: "removed",
      old_value: { nome: t.nome },
      new_value: null,
      label: `Trilha removida: "${t.nome}"`,
      program_drive_folder_id: program?.drive_folder_id ?? driveId,
    });
  }
  for (const driveId of phasesToDeactivate) {
    const p = dbPhasesByDriveId.get(driveId);
    if (!p) continue;
    const program = dbProgramsById.get(p.program_id);
    changes.push({
      entity_type: "phase",
      entity_drive_id: driveId,
      change_type: "removed",
      old_value: { nome: p.nome },
      new_value: null,
      label: `Fase removida: "${p.nome}"`,
      program_drive_folder_id: program?.drive_folder_id ?? driveId,
    });
  }
  for (const driveId of modulesToDeactivate) {
    const m = dbModulesByDriveId.get(driveId);
    if (!m) continue;
    const phase = dbPhasesById.get(m.phase_id);
    const program = phase ? dbProgramsById.get(phase.program_id) : undefined;
    changes.push({
      entity_type: "module",
      entity_drive_id: driveId,
      change_type: "removed",
      old_value: { nome: m.nome },
      new_value: null,
      label: `Módulo removido: "${m.nome}"`,
      program_drive_folder_id: program?.drive_folder_id ?? driveId,
    });
  }

  return {
    changes,
    warnings,
    programUpserts,
    trackUpserts,
    phaseUpserts,
    moduleUpserts,
    programsToDeactivate,
    tracksToDeactivate,
    phasesToDeactivate,
    modulesToDeactivate,
  };
}
