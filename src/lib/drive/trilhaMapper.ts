import "server-only";
import { FOLDER_MIME, PDF_MIME, type DriveItem, type DriveLister } from "./types";

/**
 * Implementa a convenção descrita em PROJECT_CONTEXT.md §5:
 *
 *   Trilha de Liderança/
 *   ├── Fase 1 - <assunto>/
 *   │   ├── Supervisor de Picking/      <- "função"/trilha (specific_track)
 *   │   │   ├── Módulo 1/
 *   │   │   │   ├── <nome>.pdf
 *   │   │   │   └── perguntas.json      (opcional)
 *   │   ├── Supervisor de Packing/
 *   ├── Fase 2 - <assunto>/             <- módulos direto na fase (common)
 *   │   ├── Módulo 1/
 *
 *   §5.1: nome do PDF (sem extensão) = título do módulo exibido ao usuário.
 *         Nome da pasta do módulo só define a ordem.
 *
 * Esta função não sabe nada sobre googleapis nem sobre o banco — recebe
 * um DriveLister (real ou fake) e devolve uma estrutura em memória mais
 * uma lista de avisos. Nada é escrito no banco aqui (isso é a Fase 5).
 */

const FASE_RE = /^Fase\s+(\d+)\s*-\s*(.+)$/i;
const MODULO_RE = /^M[oó]dulo\s+(\d+)\b/i;

export type MappedMaterialType = "pdf" | "youtube";

export interface MappedModule {
  drive_folder_id: string;
  ordem: number;
  nome: string;
  material_type: MappedMaterialType;
  pdf_drive_id: string | null;
  pdf_nome: string | null;
  /**
   * ID do arquivo video.json no Drive. Só o suficiente para a fase de
   * validação de conteúdo (Fase 5) buscar e validar o JSON depois — a
   * extração do videoId/título acontece nessa etapa seguinte, não aqui
   * (mapTrilhaFromDrive só lista metadados, nunca busca conteúdo de
   * arquivo — o mesmo padrão já usado para perguntas.json).
   */
  video_drive_id: string | null;
  video_external_id: string | null;
  video_titulo: string | null;
  questions_drive_id: string | null;
  has_questions: boolean;
}

export interface MappedTrack {
  drive_folder_id: string;
  nome: string;
  modules: MappedModule[];
}

export type PhaseType = "common" | "specific_track";

export interface MappedPhase {
  drive_folder_id: string;
  ordem: number;
  nome: string;
  phase_type: PhaseType;
  /** Preenchido quando phase_type === "common". */
  modules: MappedModule[];
  /** Preenchido quando phase_type === "specific_track". */
  tracks: MappedTrack[];
}

export interface MappedTrilha {
  phases: MappedPhase[];
  warnings: string[];
}

function isFolder(item: DriveItem): boolean {
  return item.mimeType === FOLDER_MIME;
}

/** true quando TODAS as subpastas seguem "Módulo N" — ou seja, fase comum. */
function looksLikeModuleFolders(items: DriveItem[]): boolean {
  const folders = items.filter(isFolder);
  if (folders.length === 0) return false;
  return folders.every((f) => MODULO_RE.test(f.name));
}

async function readModuleFolder(
  lister: DriveLister,
  folder: DriveItem,
  warnings: string[],
  context: string
): Promise<MappedModule | null> {
  const match = MODULO_RE.exec(folder.name);
  if (!match) {
    warnings.push(`${context}: pasta "${folder.name}" não segue o padrão "Módulo N" — ignorada.`);
    return null;
  }
  const ordem = Number(match[1]);
  const children = await lister.listChildren(folder.id);

  const pdfs = children.filter((c) => c.mimeType === PDF_MIME);
  const questionsFile = children.find((c) => c.name.toLowerCase() === "perguntas.json");
  const videoFile = children.find((c) => c.name.toLowerCase() === "video.json");

  // Regra de conteúdo: exatamente 1 PDF OU exatamente 1 video.json.
  // Se os dois existirem ao mesmo tempo, não escolher silenciosamente —
  // avisa e prioriza o PDF (comportamento pré-existente preservado).
  if (pdfs.length > 0 && videoFile) {
    warnings.push(
      `${context} > "${folder.name}": encontrado PDF e video.json juntos — um módulo só pode ter um material principal. Usando o PDF; remova um dos dois para resolver.`
    );
  }

  if (pdfs.length === 0 && !videoFile) {
    warnings.push(
      `${context} > "${folder.name}": nenhum PDF nem video.json encontrado (§5.1 exige exatamente 1 material) — módulo não pode ser publicado.`
    );
  } else if (pdfs.length > 1) {
    warnings.push(
      `${context} > "${folder.name}": ${pdfs.length} PDFs encontrados (esperado exatamente 1) — usando "${pdfs[0].name}", os demais serão ignorados.`
    );
  }

  const usesPdf = pdfs.length > 0;
  const pdf = usesPdf ? pdfs[0] : null;
  const pdfNomeSemExtensao = pdf ? pdf.name.replace(/\.pdf$/i, "") : null;

  // video.json só é considerado quando não há PDF (regra de conflito acima).
  const effectiveVideoFile = !usesPdf ? videoFile : undefined;

  return {
    drive_folder_id: folder.id,
    ordem,
    // §5.1 — o nome do PDF (sem extensão) é o título exibido quando há
    // PDF; a pasta só define a ordem. Para módulo em vídeo (sem PDF), o
    // título provisório é o nome da pasta — a Fase 5 substitui pelo
    // `titulo` do video.json depois de validar o conteúdo.
    nome: pdfNomeSemExtensao ?? folder.name,
    material_type: effectiveVideoFile ? "youtube" : "pdf",
    pdf_drive_id: pdf?.id ?? null,
    pdf_nome: pdf?.name ?? null,
    video_drive_id: effectiveVideoFile?.id ?? null,
    video_external_id: null,
    video_titulo: null,
    questions_drive_id: questionsFile?.id ?? null,
    has_questions: Boolean(questionsFile),
  };
}

async function readModulesUnder(
  lister: DriveLister,
  parent: DriveItem,
  warnings: string[],
  context: string
): Promise<MappedModule[]> {
  const children = await lister.listChildren(parent.id);
  const folders = children.filter(isFolder);

  const modules: MappedModule[] = [];
  for (const f of folders) {
    const mod = await readModuleFolder(lister, f, warnings, context);
    if (mod) modules.push(mod);
  }

  const ordersSeen = new Map<number, string>();
  for (const m of modules) {
    if (ordersSeen.has(m.ordem)) {
      warnings.push(
        `${context}: dois módulos usam a ordem ${m.ordem} ("${ordersSeen.get(m.ordem)}" e "${m.nome}").`
      );
    } else {
      ordersSeen.set(m.ordem, m.nome);
    }
  }

  modules.sort((a, b) => a.ordem - b.ordem);
  return modules;
}

export async function mapTrilhaFromDrive(
  lister: DriveLister,
  rootFolderId: string
): Promise<MappedTrilha> {
  const warnings: string[] = [];
  const rootChildren = await lister.listChildren(rootFolderId);
  const phaseFolders = rootChildren.filter(isFolder);

  const phases: MappedPhase[] = [];

  for (const phaseFolder of phaseFolders) {
    const match = FASE_RE.exec(phaseFolder.name);
    if (!match) {
      warnings.push(
        `Pasta raiz "${phaseFolder.name}" não segue o padrão "Fase N - assunto" — ignorada.`
      );
      continue;
    }

    const ordem = Number(match[1]);
    const nome = match[2].trim();
    const context = `Fase ${ordem} (${phaseFolder.name})`;

    const phaseChildren = await lister.listChildren(phaseFolder.id);
    const childFolders = phaseChildren.filter(isFolder);

    if (childFolders.length === 0) {
      warnings.push(`${context}: pasta vazia — nenhum módulo ou função encontrada.`);
      phases.push({ drive_folder_id: phaseFolder.id, ordem, nome, phase_type: "common", modules: [], tracks: [] });
      continue;
    }

    if (looksLikeModuleFolders(phaseChildren)) {
      const modules = await readModulesUnder(lister, phaseFolder, warnings, context);
      phases.push({
        drive_folder_id: phaseFolder.id,
        ordem,
        nome,
        phase_type: "common",
        modules,
        tracks: [],
      });
    } else {
      const tracks: MappedTrack[] = [];
      for (const trackFolder of childFolders) {
        const trackContext = `${context} > ${trackFolder.name}`;
        const modules = await readModulesUnder(lister, trackFolder, warnings, trackContext);
        if (modules.length === 0) {
          warnings.push(`${trackContext}: nenhum módulo encontrado.`);
        }
        tracks.push({ drive_folder_id: trackFolder.id, nome: trackFolder.name, modules });
      }
      phases.push({
        drive_folder_id: phaseFolder.id,
        ordem,
        nome,
        phase_type: "specific_track",
        modules: [],
        tracks,
      });
    }
  }

  phases.sort((a, b) => a.ordem - b.ordem);

  // Ordens de fase duplicadas violariam o índice único da migration
  // (phases_active_order_unique) — melhor avisar aqui do que só na hora
  // de aplicar (Fase 5).
  const phaseOrdersSeen = new Map<number, string>();
  for (const p of phases) {
    if (phaseOrdersSeen.has(p.ordem)) {
      warnings.push(
        `Ordem de fase duplicada: "${p.nome}" e "${phaseOrdersSeen.get(p.ordem)}" usam ordem ${p.ordem}.`
      );
    } else {
      phaseOrdersSeen.set(p.ordem, p.nome);
    }
  }

  return { phases, warnings };
}
