import "server-only";
import type { Module, QuizAttempt, Vacancy } from "@/lib/db/types";
import { snapshotAssessmentIfComplete } from "./recruitmentReportService";
import { listActivePrograms } from "@/lib/repositories/programsRepository";
import { getPhaseById, listActivePhases } from "@/lib/repositories/phasesRepository";
import { listModulesByPhase } from "@/lib/repositories/modulesRepository";
import { listAttemptsForModule } from "@/lib/repositories/quizAttemptsRepository";
import {
  getRecruitmentProgramId,
  listVacancies,
  listPhaseAreas,
  hasAnsweredInterest,
  listInterestsForUser,
  getPhaseArea,
  insertResults,
  upsertPhaseArea,
  removePhaseArea,
} from "@/lib/repositories/recruitmentRepository";

/**
 * Recrutamento Interno (lado "gravação"): decide se um módulo é da trilha de
 * Recrutamento e grava o resultado de cada tentativa já com a ÁREA e os nomes
 * da época. A estrutura da trilha muda com o tempo (módulos de RC hoje,
 * de Logística depois) — por isso o resultado não depende de a fase/módulo
 * continuar existindo ou ter o mesmo nome.
 */

export const LOGIC_AREA_KEY = "logica";
export const LOGIC_AREA_LABEL = "Teste de lógica";

/** Chave estável de uma área a partir do nome ("Gestão de Estoque" -> "gestao-de-estoque"). */
export function slugifyAreaKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** O módulo pertence ao Programa configurado como Recrutamento? */
export async function isRecruitmentModule(module: Module): Promise<boolean> {
  try {
    const programId = await getRecruitmentProgramId();
    if (!programId) return false;
    const phase = await getPhaseById(module.phase_id);
    return Boolean(phase && phase.program_id === programId);
  } catch (err) {
    // Ex: migration 0012 ainda não aplicada — nunca derruba o fluxo do aluno.
    console.error("Erro ao checar módulo de recrutamento:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Chamado logo depois de gravar uma tentativa de quiz. Devolve se o módulo é
 * de Recrutamento (o quiz usa isso para liberar o próximo módulo mesmo
 * reprovando) e, se a fase tem área etiquetada, grava o resultado. Falha ao
 * gravar o resultado NUNCA derruba o envio do quiz (só é logada) — o
 * preenchimento ao etiquetar/reprocessar repõe qualquer lacuna.
 */
export async function onQuizAttemptRecorded(
  attempt: QuizAttempt,
  module: Module
): Promise<{ isRecruitment: boolean; summaryReady: boolean }> {
  try {
    const programId = await getRecruitmentProgramId();
    if (!programId) return { isRecruitment: false, summaryReady: false };

    const phase = await getPhaseById(module.phase_id);
    if (!phase || phase.program_id !== programId) return { isRecruitment: false, summaryReady: false };

    let summaryReady = false;
    const area = await getPhaseArea(phase.id);
    if (area) {
      await insertResults([
        {
          attempt_id: attempt.id,
          user_id: attempt.user_id,
          area_key: area.area_key,
          area_label: area.area_label,
          module_id: module.id,
          module_nome: module.nome,
          phase_id: phase.id,
          phase_nome: phase.nome,
          score: Number(attempt.score),
          correct_answers: attempt.correct_answers,
          total_questions: attempt.total_questions,
          submitted_at: attempt.submitted_at ?? new Date().toISOString(),
        },
      ]);
      // Foto da avaliação (cortes/vagas vigentes hoje) quando o teste de lógica está completo.
      summaryReady = await snapshotAssessmentIfComplete(attempt.user_id);
    }
    return { isRecruitment: true, summaryReady };
  } catch (err) {
    console.error("Erro ao registrar resultado de recrutamento:", err instanceof Error ? err.message : err);
    // Na dúvida, trata como recrutamento só se o Programa bate — evita bloquear candidato por falha de gravação.
    try {
      const programId = await getRecruitmentProgramId();
      const phase = await getPhaseById(module.phase_id);
      return { isRecruitment: Boolean(programId && phase && phase.program_id === programId), summaryReady: false };
    } catch {
      return { isRecruitment: false, summaryReady: false };
    }
  }
}

/**
 * Preenche (idempotente) `recruitment_results` com as tentativas JÁ existentes
 * dos módulos de uma fase — usado ao etiquetar uma fase com área, para não
 * perder o que os candidatos já fizeram antes da etiqueta.
 */
export async function backfillResultsForPhase(phaseId: string): Promise<number> {
  const phase = await getPhaseById(phaseId);
  const area = await getPhaseArea(phaseId);
  if (!phase || !area) return 0;

  const modules = await listModulesByPhase(phaseId);
  let count = 0;
  for (const module of modules) {
    const attempts = await listAttemptsForModule(module.id);
    const rows = attempts.map((a) => ({
      attempt_id: a.id,
      user_id: a.user_id,
      area_key: area.area_key,
      area_label: area.area_label,
      module_id: module.id,
      module_nome: module.nome,
      phase_id: phase.id,
      phase_nome: phase.nome,
      score: Number(a.score),
      correct_answers: a.correct_answers,
      total_questions: a.total_questions,
      submitted_at: a.submitted_at ?? a.started_at,
    }));
    await insertResults(rows);
    count += rows.length;
  }
  return count;
}

/** Etiqueta (ou remove a etiqueta de) uma fase e preenche o histórico. `label = null` remove. */
export async function setPhaseAreaLabel(phaseId: string, kind: "logica" | "area" | null, rawLabel?: string): Promise<void> {
  if (kind === null) {
    await removePhaseArea(phaseId);
    return;
  }

  const label = kind === "logica" ? LOGIC_AREA_LABEL : (rawLabel ?? "").trim();
  if (!label) throw new Error("Informe o nome da área.");
  const key = kind === "logica" ? LOGIC_AREA_KEY : slugifyAreaKey(label);
  // "logica" é reservado para o teste de lógica — uma área livre não pode usar esse nome.
  if (kind === "area" && (!key || key === LOGIC_AREA_KEY)) throw new Error("Nome de área inválido ou reservado.");

  await upsertPhaseArea({ phase_id: phaseId, area_key: key, area_label: label });
  await backfillResultsForPhase(phaseId);
}

/* ------------------------ configuração (tela do gestor) ------------------------ */

export interface RecruitmentConfig {
  programId: string | null;
  programs: Array<{ id: string; nome: string }>;
  phases: Array<{ id: string; ordem: number; nome: string; areaKey: string | null; areaLabel: string | null }>;
  areas: Array<{ key: string; label: string }>;
  vacancies: Vacancy[];
}

export async function getRecruitmentConfig(): Promise<RecruitmentConfig> {
  const [programId, programs, vacancies, phaseAreas] = await Promise.all([
    getRecruitmentProgramId(),
    listActivePrograms(),
    listVacancies(),
    listPhaseAreas(),
  ]);

  const areaByPhase = new Map(phaseAreas.map((a) => [a.phase_id, a]));
  const phases = programId ? await listActivePhases(programId) : [];

  // Áreas disponíveis para ligar a uma vaga: as já etiquetadas em qualquer fase
  // (a lógica fica de fora — o corte de lógica é um campo próprio da vaga).
  const areasMap = new Map<string, string>();
  for (const a of phaseAreas) {
    if (a.area_key !== LOGIC_AREA_KEY) areasMap.set(a.area_key, a.area_label);
  }

  return {
    programId,
    programs: programs.map((p) => ({ id: p.id, nome: p.nome })),
    phases: phases.map((p) => ({
      id: p.id,
      ordem: p.ordem,
      nome: p.nome,
      areaKey: areaByPhase.get(p.id)?.area_key ?? null,
      areaLabel: areaByPhase.get(p.id)?.area_label ?? null,
    })),
    areas: [...areasMap.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    vacancies,
  };
}

/* ------------------------------ lado do candidato ------------------------------ */

export interface InterestState {
  isRecruitment: boolean;
  /** Programa de Recrutamento + há vagas ativas + o candidato ainda não respondeu. */
  needsAnswer: boolean;
  /** Nomes das vagas de interesse hoje (vazio = "ainda não sei" ou não respondeu). */
  names: string[];
}

export async function getInterestState(userId: string, programId: string): Promise<InterestState> {
  const none: InterestState = { isRecruitment: false, needsAnswer: false, names: [] };
  try {
    const recruitmentProgramId = await getRecruitmentProgramId();
    if (!recruitmentProgramId || recruitmentProgramId !== programId) return none;

    const [answered, activeVacancies, interests] = await Promise.all([
      hasAnsweredInterest(userId),
      listVacancies({ onlyActive: true }),
      listInterestsForUser(userId),
    ]);

    return {
      isRecruitment: true,
      needsAnswer: !answered && activeVacancies.length > 0,
      names: interests.map((i) => i.vacancy_nome),
    };
  } catch (err) {
    // Ex: migration 0012 ainda não aplicada — a home do aluno nunca pode quebrar por isso.
    console.error("Erro ao ler interesses de recrutamento:", err instanceof Error ? err.message : err);
    return none;
  }
}
