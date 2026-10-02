import "server-only";
import type { Phase } from "@/lib/db/types";
import {
  getDriveRootFolderId,
  getGoogleDriveLister,
  createDriveFolder,
  renameDriveFile,
  trashDriveFile,
  getDriveFileMeta,
} from "@/lib/drive/googleDriveClient";
import { FOLDER_MIME } from "@/lib/drive/types";
import {
  listActivePrograms,
  getProgramById,
  upsertProgramByDriveFolderId,
  renameProgram,
  deactivateProgram,
} from "@/lib/repositories/programsRepository";
import {
  listAllPhases,
  getPhaseById,
  upsertPhaseByDriveFolderId,
  renamePhase,
  deactivatePhase,
  deactivatePhasesOfProgram,
} from "@/lib/repositories/phasesRepository";
import {
  listAllTracks,
  getTrackById,
  upsertTrackByDriveFolderId,
  renameTrack,
  deactivateTrack,
  deactivateTracksOfProgram,
} from "@/lib/repositories/tracksRepository";
import {
  listAllModules,
  getModuleById,
  upsertModuleByDriveFolderId,
  renameModule,
  deactivateModule,
  deactivateModulesByPhaseIds,
  deactivateModulesByTrackIds,
} from "@/lib/repositories/modulesRepository";

/**
 * Admin > Estrutura — cria/renomeia/remove Programa, Fase, Função e Módulo
 * pelo app. O Drive continua sendo a fonte da verdade: cada ação mexe na
 * PASTA do Drive e na linha do banco juntas, com os mesmos nomes e valores
 * que a sincronização derivaria da pasta (regex de nome de `trilhaMapper.ts`),
 * então "Analisar alterações" depois não mostra diferença.
 *
 * Ordem das escritas: Drive primeiro, banco depois. Criar: se o banco
 * falha, a pasta recém-criada vai para a lixeira (sem órfã). Remover: se o
 * banco falha depois da pasta na lixeira, a próxima sincronização desativa
 * a linha sozinha (nunca o contrário — desativar só no banco seria
 * revertido pela sync, que reativa tudo que ainda existe no Drive).
 */

// Mesmo padrão de pasta de módulo de trilhaMapper.ts (MODULO_RE).
const MODULO_RE = /^M[oó]dulo\s+(\d+)\b/i;

export class StructureError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

/** Nome que vira pasta no Drive: sem caracteres proibidos, 1 a 100 caracteres. */
export function sanitizeName(raw: string, max = 100): string | null {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function requireName(raw: string, label: string): string {
  const name = sanitizeName(raw);
  if (!name) throw new StructureError(`Informe o nome ${label}.`);
  return name;
}

/** Executa a escrita no banco; se falhar, descarta a pasta recém-criada e repropaga o erro. */
async function withFolderRollback<T>(folderId: string, dbWrite: () => Promise<T>): Promise<T> {
  try {
    return await dbWrite();
  } catch (err) {
    await trashDriveFile(folderId).catch(() => undefined);
    throw err;
  }
}

async function listFolderChildren(folderId: string) {
  return getGoogleDriveLister().listChildren(folderId);
}

/* ------------------------------ árvore ------------------------------ */

export interface TreeModule {
  id: string;
  ordem: number;
  nome: string;
  hasMaterial: boolean;
  hasQuestions: boolean;
}
export interface TreeTrack {
  id: string;
  nome: string;
  modules: TreeModule[];
}
export interface TreePhase {
  id: string;
  ordem: number;
  nome: string;
  phaseType: "common" | "specific_track";
  modules: TreeModule[];
  tracks: TreeTrack[];
}
export interface TreeProgram {
  id: string;
  nome: string;
  phases: TreePhase[];
}

export async function getStructureTree(): Promise<TreeProgram[]> {
  const [programs, allPhases, allTracks, allModules] = await Promise.all([
    listActivePrograms(),
    listAllPhases(),
    listAllTracks(),
    listAllModules(),
  ]);
  const phases = allPhases.filter((p) => p.active);
  const tracks = allTracks.filter((t) => t.active);
  const modules = allModules.filter((m) => m.active);

  const toTreeModule = (m: (typeof modules)[number]): TreeModule => ({
    id: m.id,
    ordem: m.ordem,
    nome: m.nome,
    hasMaterial: m.material_type === "youtube" ? Boolean(m.video_drive_id) : Boolean(m.pdf_drive_id),
    hasQuestions: m.has_questions,
  });

  // Função não guarda a fase em que está (só o Programa) — a pasta da Função
  // fica dentro da pasta da fase, então cruza com a listagem do Drive; as
  // Funções que já têm módulos entram também pelo `phase_id` do módulo
  // (rede de segurança caso a leitura do Drive falhe).
  const specificPhases = phases.filter((p) => p.phase_type === "specific_track");
  const childFolderIdsByPhase = new Map<string, Set<string>>();
  await Promise.all(
    specificPhases.map(async (p) => {
      try {
        const children = await listFolderChildren(p.drive_folder_id);
        childFolderIdsByPhase.set(p.id, new Set(children.filter((c) => c.mimeType === FOLDER_MIME).map((c) => c.id)));
      } catch {
        childFolderIdsByPhase.set(p.id, new Set());
      }
    })
  );

  return programs.map((program) => ({
    id: program.id,
    nome: program.nome,
    phases: phases
      .filter((p) => p.program_id === program.id)
      .sort((a, b) => a.ordem - b.ordem)
      .map((phase) => {
        const phaseModules = modules.filter((m) => m.phase_id === phase.id);
        const folderIds = childFolderIdsByPhase.get(phase.id) ?? new Set<string>();
        const trackIdsWithModules = new Set(phaseModules.map((m) => m.track_id).filter((id): id is string => Boolean(id)));

        const phaseTracks =
          phase.phase_type === "specific_track"
            ? tracks
                .filter(
                  (t) => t.program_id === program.id && (folderIds.has(t.drive_folder_id) || trackIdsWithModules.has(t.id))
                )
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((t) => ({
                  id: t.id,
                  nome: t.nome,
                  modules: phaseModules
                    .filter((m) => m.track_id === t.id)
                    .sort((a, b) => a.ordem - b.ordem)
                    .map(toTreeModule),
                }))
            : [];

        return {
          id: phase.id,
          ordem: phase.ordem,
          nome: phase.nome,
          phaseType: phase.phase_type,
          modules:
            phase.phase_type === "common"
              ? phaseModules
                  .filter((m) => !m.track_id)
                  .sort((a, b) => a.ordem - b.ordem)
                  .map(toTreeModule)
              : [],
          tracks: phaseTracks,
        };
      }),
  }));
}

/* ------------------------------ criar ------------------------------ */

export async function createProgram(rawNome: string) {
  const nome = requireName(rawNome, "do Programa");
  const existing = await listActivePrograms();
  if (existing.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) {
    throw new StructureError("Já existe um Programa com esse nome.", 409);
  }

  const folderId = await createDriveFolder(getDriveRootFolderId(), nome);
  return withFolderRollback(folderId, () => upsertProgramByDriveFolderId({ drive_folder_id: folderId, nome }));
}

export async function createPhase(programId: string, rawAssunto: string) {
  const assunto = requireName(rawAssunto, "da fase");
  const program = await getProgramById(programId);
  if (!program || !program.active) throw new StructureError("Programa não encontrado.", 404);

  const phases = (await listAllPhases()).filter((p) => p.program_id === programId && p.active);
  const ordem = phases.reduce((max, p) => Math.max(max, p.ordem), 0) + 1;

  const folderId = await createDriveFolder(program.drive_folder_id, `Fase ${ordem} - ${assunto}`);
  return withFolderRollback(folderId, () =>
    upsertPhaseByDriveFolderId({
      program_id: programId,
      drive_folder_id: folderId,
      nome: assunto,
      ordem,
      // Fase nova é "comum" — a sync só enxerga "por função" quando há subpastas de Função na pasta.
      phase_type: "common",
    })
  );
}

async function requireActivePhase(phaseId: string): Promise<Phase> {
  const phase = await getPhaseById(phaseId);
  if (!phase || !phase.active) throw new StructureError("Fase não encontrada.", 404);
  return phase;
}

export async function createTrack(phaseId: string, rawNome: string) {
  const nome = requireName(rawNome, "da Função");
  const phase = await requireActivePhase(phaseId);

  const children = await listFolderChildren(phase.drive_folder_id);
  if (children.some((c) => c.mimeType === FOLDER_MIME && MODULO_RE.test(c.name))) {
    throw new StructureError(
      "Esta fase já tem módulos diretos — uma fase tem módulos OU Funções, não os dois. Crie a Função em outra fase.",
      409
    );
  }
  if (children.some((c) => c.mimeType === FOLDER_MIME && c.name.toLowerCase() === nome.toLowerCase())) {
    throw new StructureError("Já existe uma Função com esse nome nesta fase.", 409);
  }

  const folderId = await createDriveFolder(phase.drive_folder_id, nome);
  return withFolderRollback(folderId, async () => {
    const track = await upsertTrackByDriveFolderId({
      program_id: phase.program_id,
      drive_folder_id: folderId,
      nome,
    });
    if (phase.phase_type !== "specific_track") {
      await upsertPhaseByDriveFolderId({
        program_id: phase.program_id,
        drive_folder_id: phase.drive_folder_id,
        nome: phase.nome,
        ordem: phase.ordem,
        phase_type: "specific_track",
      });
    }
    return track;
  });
}

export async function createModule(phaseId: string, trackId: string | null, rawTitulo: string) {
  const titulo = requireName(rawTitulo, "do módulo");
  const phase = await requireActivePhase(phaseId);

  let parentFolderId: string;
  if (trackId) {
    const track = await getTrackById(trackId);
    if (!track || !track.active || track.program_id !== phase.program_id) {
      throw new StructureError("Função não encontrada neste Programa.", 404);
    }
    const meta = await getDriveFileMeta(track.drive_folder_id);
    if (!meta.parents.includes(phase.drive_folder_id)) {
      throw new StructureError("Essa Função não pertence a esta fase.", 400);
    }
    parentFolderId = track.drive_folder_id;
  } else {
    if (phase.phase_type === "specific_track") {
      throw new StructureError("Esta fase é dividida por Função — escolha a Função em que o módulo vai ficar.", 400);
    }
    const children = await listFolderChildren(phase.drive_folder_id);
    if (children.some((c) => c.mimeType === FOLDER_MIME && !MODULO_RE.test(c.name))) {
      throw new StructureError("Esta fase já tem Funções — o módulo precisa ficar dentro de uma delas.", 409);
    }
    parentFolderId = phase.drive_folder_id;
  }

  const siblings = (await listAllModules()).filter(
    (m) => m.active && m.phase_id === phase.id && (m.track_id ?? null) === (trackId ?? null)
  );
  const ordem = siblings.reduce((max, m) => Math.max(max, m.ordem), 0) + 1;
  const folderName = `Módulo ${ordem} - ${titulo}`;

  const folderId = await createDriveFolder(parentFolderId, folderName);
  return withFolderRollback(folderId, () =>
    upsertModuleByDriveFolderId({
      phase_id: phase.id,
      track_id: trackId,
      drive_folder_id: folderId,
      ordem,
      // Sem material a sync deriva o nome da própria pasta; ao enviar o
      // material (Admin > Conteúdo) o nome passa a ser o título dele.
      nome: folderName,
      material_type: "pdf",
      pdf_drive_id: null,
      pdf_nome: null,
      video_drive_id: null,
      video_external_id: null,
      video_titulo: null,
      questions_drive_id: null,
      has_questions: false,
    })
  );
}

/* ----------------------------- renomear ----------------------------- */

export type StructureKind = "programa" | "fase" | "funcao" | "modulo";

export async function renameEntity(kind: StructureKind, id: string, rawNome: string): Promise<void> {
  const nome = requireName(rawNome, "novo");

  if (kind === "programa") {
    const program = await getProgramById(id);
    if (!program || !program.active) throw new StructureError("Programa não encontrado.", 404);
    const others = (await listActivePrograms()).filter((p) => p.id !== id);
    if (others.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) {
      throw new StructureError("Já existe um Programa com esse nome.", 409);
    }
    await renameDriveFile(program.drive_folder_id, nome);
    await renameProgram(id, nome);
    return;
  }

  if (kind === "fase") {
    const phase = await requireActivePhase(id);
    await renameDriveFile(phase.drive_folder_id, `Fase ${phase.ordem} - ${nome}`);
    await renamePhase(id, nome);
    return;
  }

  if (kind === "funcao") {
    const track = await getTrackById(id);
    if (!track || !track.active) throw new StructureError("Função não encontrada.", 404);
    await renameDriveFile(track.drive_folder_id, nome);
    await renameTrack(id, nome);
    return;
  }

  const module_ = await getModuleById(id);
  if (!module_ || !module_.active) throw new StructureError("Módulo não encontrado.", 404);
  const folderName = `Módulo ${module_.ordem} - ${nome}`;
  await renameDriveFile(module_.drive_folder_id, folderName);
  // Com material, o nome exibido é o título dele (editado em Admin > Conteúdo) — aqui só a pasta muda.
  const hasMaterial = module_.material_type === "youtube" ? Boolean(module_.video_drive_id) : Boolean(module_.pdf_drive_id);
  if (!hasMaterial) await renameModule(id, folderName);
}

/* ------------------------------ remover ----------------------------- */

export async function removeEntity(kind: StructureKind, id: string): Promise<void> {
  if (kind === "modulo") {
    const module_ = await getModuleById(id);
    if (!module_ || !module_.active) throw new StructureError("Módulo não encontrado.", 404);
    await trashDriveFile(module_.drive_folder_id);
    await deactivateModule(id);
    return;
  }

  if (kind === "funcao") {
    const track = await getTrackById(id);
    if (!track || !track.active) throw new StructureError("Função não encontrada.", 404);
    await trashDriveFile(track.drive_folder_id);
    await deactivateTrack(id);
    await deactivateModulesByTrackIds([id]);
    return;
  }

  if (kind === "fase") {
    const phase = await requireActivePhase(id);
    // As Funções ficam dentro da pasta da fase — listar ANTES de ir para a lixeira.
    const children = await listFolderChildren(phase.drive_folder_id);
    const childIds = new Set(children.map((c) => c.id));
    const tracks = (await listAllTracks()).filter(
      (t) => t.active && t.program_id === phase.program_id && childIds.has(t.drive_folder_id)
    );

    await trashDriveFile(phase.drive_folder_id);
    await deactivatePhase(id);
    await deactivateModulesByPhaseIds([id]);
    for (const t of tracks) await deactivateTrack(t.id);
    return;
  }

  const program = await getProgramById(id);
  if (!program || !program.active) throw new StructureError("Programa não encontrado.", 404);
  const phaseIds = (await listAllPhases()).filter((p) => p.program_id === id).map((p) => p.id);

  await trashDriveFile(program.drive_folder_id);
  await deactivateModulesByPhaseIds(phaseIds);
  await deactivatePhasesOfProgram(id);
  await deactivateTracksOfProgram(id);
  await deactivateProgram(id);
}
