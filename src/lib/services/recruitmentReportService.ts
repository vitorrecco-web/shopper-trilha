import "server-only";
import type { RecruitmentResult, Vacancy } from "@/lib/db/types";
import { listUsersWithTrack, getUserById } from "@/lib/repositories/usersRepository";
import { listActiveEnrollmentsForUsers } from "@/lib/repositories/enrollmentsRepository";
import { listAllModules } from "@/lib/repositories/modulesRepository";
import { listAllPhases } from "@/lib/repositories/phasesRepository";
import {
  getRecruitmentProgramId,
  listAllResults,
  listResultsForUser,
  listVacancies,
  listPhaseAreas,
  listInterestsForUsers,
  listInterestsForUser,
  insertAssessment,
  listAssessmentsForUser,
} from "@/lib/repositories/recruitmentRepository";
import {
  analyzeCandidate,
  interestAlerts,
  LOGIC_AREA,
  type Analysis,
  type AnalysisResult,
  type AnalysisVacancy,
  type FitStatus,
} from "./recruitmentAnalysis";
import { buildCandidateSummary, type CandidateSummary } from "./recruitmentSummary";

/**
 * Recrutamento Interno (lado "leitura"): monta o relatório do gestor e a
 * fotografia da avaliação a partir de `recruitment_results` (dados gravados
 * com a área e os nomes da época) — nunca da estrutura atual da trilha.
 */

const toAnalysisResult = (r: RecruitmentResult): AnalysisResult => ({
  area_key: r.area_key,
  area_label: r.area_label,
  module_id: r.module_id,
  module_nome: r.module_nome,
  score: r.score,
  total_questions: r.total_questions,
  submitted_at: r.submitted_at,
});

const toAnalysisVacancy = (v: Vacancy): AnalysisVacancy => ({
  id: v.id,
  nome: v.nome,
  logic_cutoff: v.logic_cutoff,
  area_key: v.area_key,
  area_cutoff: v.area_cutoff,
});

/** Quantos módulos (com quiz) o teste de lógica tem HOJE — referência para "n/7". */
async function countExpectedLogicModules(programId: string): Promise<number> {
  const [phaseAreas, phases, modules] = await Promise.all([listPhaseAreas(), listAllPhases(), listAllModules()]);
  const logicPhaseIds = new Set(
    phaseAreas
      .filter((a) => a.area_key === LOGIC_AREA)
      .map((a) => a.phase_id)
      .filter((id) => phases.some((p) => p.id === id && p.active && p.program_id === programId))
  );
  return modules.filter((m) => m.active && m.has_questions && logicPhaseIds.has(m.phase_id)).length;
}

/* ---------------------------------- lista ---------------------------------- */

export interface CandidateRow {
  userId: string;
  nome: string;
  matricula: string | null;
  cd: string | null;
  turno: string | null;
  interestNames: string[];
  logicDone: number;
  logicExpected: number;
  logicComplete: boolean;
  bestScore: number | null;
  avgScore: number | null;
  bestPossibility: string | null;
  alertNames: string[];
  fitByVacancy: Record<string, FitStatus>; // visão melhor tentativa
}

export interface VacancyTally {
  id: string;
  nome: string;
  best: Record<FitStatus, number>;
  avg: Record<FitStatus, number>;
}

export interface RecruitmentReport {
  configured: boolean;
  vacancies: Array<{ id: string; nome: string }>;
  candidates: CandidateRow[];
  totals: { candidates: number; completed: number; avgBestScore: number | null; avgAvgScore: number | null };
  tallies: VacancyTally[];
}

const emptyTally = (): Record<FitStatus, number> => ({ atinge: 0, quase: 0, abaixo: 0, aguardando: 0 });

export async function getRecruitmentReport(): Promise<RecruitmentReport> {
  const programId = await getRecruitmentProgramId();
  if (!programId) {
    return { configured: false, vacancies: [], candidates: [], totals: { candidates: 0, completed: 0, avgBestScore: null, avgAvgScore: null }, tallies: [] };
  }

  const [users, vacancies, allResults] = await Promise.all([
    listUsersWithTrack(),
    listVacancies({ onlyActive: true }),
    listAllResults(),
  ]);
  const students = users.filter((u) => u.role === "student" && u.status === "active");
  const enrollmentsByUser = await listActiveEnrollmentsForUsers(students.map((u) => u.id));
  const candidates = students.filter((u) => (enrollmentsByUser.get(u.id) ?? []).some((e) => e.program_id === programId));

  const [expected, interestsByUser] = await Promise.all([
    countExpectedLogicModules(programId),
    listInterestsForUsers(candidates.map((c) => c.id)),
  ]);

  const resultsByUser = new Map<string, RecruitmentResult[]>();
  for (const r of allResults) {
    const list = resultsByUser.get(r.user_id) ?? [];
    list.push(r);
    resultsByUser.set(r.user_id, list);
  }

  const analysisVacancies = vacancies.map(toAnalysisVacancy);
  const tallies: VacancyTally[] = vacancies.map((v) => ({ id: v.id, nome: v.nome, best: emptyTally(), avg: emptyTally() }));

  const rows: CandidateRow[] = candidates.map((u) => {
    const analysis = analyzeCandidate((resultsByUser.get(u.id) ?? []).map(toAnalysisResult), analysisVacancies, expected);
    const interests = interestsByUser.get(u.id) ?? [];
    const alerts = interestAlerts(
      analysis,
      interests.map((i) => i.vacancy_id)
    );

    const fitByVacancy: Record<string, FitStatus> = {};
    for (const fit of analysis.fits) {
      fitByVacancy[fit.vacancy.id] = fit.best.status;
      const tally = tallies.find((t) => t.id === fit.vacancy.id);
      if (tally && analysis.logic) {
        tally.best[fit.best.status]++;
        tally.avg[fit.avg.status]++;
      }
    }

    return {
      userId: u.id,
      nome: u.nome_completo,
      matricula: u.matricula,
      cd: u.cd,
      turno: u.turno,
      interestNames: interests.map((i) => i.vacancy_nome),
      logicDone: analysis.logicModulesDone,
      logicExpected: analysis.logicModulesExpected,
      logicComplete: analysis.logicComplete,
      bestScore: analysis.logic?.best ?? null,
      avgScore: analysis.logic?.avg ?? null,
      bestPossibility: analysis.ranking[0]?.vacancy.nome ?? null,
      alertNames: alerts.map((a) => a.vacancy.nome),
      fitByVacancy,
    };
  });

  const completed = rows.filter((r) => r.logicComplete);
  const mean = (vals: Array<number | null>) => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length === 0 ? null : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
  };

  return {
    configured: true,
    vacancies: vacancies.map((v) => ({ id: v.id, nome: v.nome })),
    candidates: rows,
    totals: {
      candidates: rows.length,
      completed: completed.length,
      avgBestScore: mean(completed.map((r) => r.bestScore)),
      avgAvgScore: mean(completed.map((r) => r.avgScore)),
    },
    tallies,
  };
}

/* -------------------------------- detalhe -------------------------------- */

export interface CandidateDetail {
  userId: string;
  nome: string;
  matricula: string | null;
  cd: string | null;
  turno: string | null;
  analysis: Analysis;
  interests: Array<{ vacancyId: string; nome: string; active: boolean }>;
  alertVacancyIds: string[];
  history: Array<{ id: string; generatedAt: string; payload: AssessmentPayload }>;
}

export async function getCandidateDetail(userId: string): Promise<CandidateDetail | null> {
  const [user, programId] = await Promise.all([getUserById(userId), getRecruitmentProgramId()]);
  if (!user || !programId) return null;

  const [results, vacancies, interests, expected, assessments] = await Promise.all([
    listResultsForUser(userId),
    listVacancies({ onlyActive: true }),
    listInterestsForUser(userId),
    countExpectedLogicModules(programId),
    listAssessmentsForUser(userId),
  ]);

  const analysis = analyzeCandidate(results.map(toAnalysisResult), vacancies.map(toAnalysisVacancy), expected);
  const activeIds = new Set(vacancies.map((v) => v.id));

  return {
    userId,
    nome: user.nome_completo,
    matricula: user.matricula,
    cd: user.cd,
    turno: user.turno,
    analysis,
    interests: interests.map((i) => ({ vacancyId: i.vacancy_id, nome: i.vacancy_nome, active: activeIds.has(i.vacancy_id) })),
    alertVacancyIds: interestAlerts(analysis, interests.map((i) => i.vacancy_id)).map((a) => a.vacancy.id),
    history: assessments.map((a) => ({ id: a.id, generatedAt: a.generated_at, payload: a.payload as unknown as AssessmentPayload })),
  };
}

/* ------------------------ fotografia da avaliação ------------------------ */

export interface AssessmentPayload {
  logicBest: number | null;
  logicAvg: number | null;
  modulesDone: number;
  modulesExpected: number;
  areas: Array<{ key: string; label: string; best: number | null; avg: number | null }>;
  fits: Array<{
    vacancyId: string;
    nome: string;
    logicCutoff: number;
    areaKey: string | null;
    areaCutoff: number | null;
    best: FitStatus;
    avg: FitStatus;
  }>;
  strengths: string[];
  weaknesses: string[];
  bestPossibility: string | null;
}

/**
 * Grava a "foto" da avaliação (com as vagas e cortes vigentes HOJE) quando o
 * teste de lógica está completo — chamada a cada tentativa nova depois disso.
 * Assim "ele atingia RC em outubro" continua verdadeiro mesmo que o corte
 * mude depois. Nunca lança: falhar aqui não pode derrubar o envio do quiz.
 */
export async function snapshotAssessmentIfComplete(userId: string): Promise<boolean> {
  try {
    const programId = await getRecruitmentProgramId();
    if (!programId) return false;

    const [results, vacancies, expected] = await Promise.all([
      listResultsForUser(userId),
      listVacancies({ onlyActive: true }),
      countExpectedLogicModules(programId),
    ]);
    const analysis = analyzeCandidate(results.map(toAnalysisResult), vacancies.map(toAnalysisVacancy), expected);
    if (!analysis.logicComplete) return false;

    const payload: AssessmentPayload = {
      logicBest: analysis.logic?.best ?? null,
      logicAvg: analysis.logic?.avg ?? null,
      modulesDone: analysis.logicModulesDone,
      modulesExpected: analysis.logicModulesExpected,
      areas: analysis.areas.map((a) => ({ key: a.area_key, label: a.area_label, best: a.best, avg: a.avg })),
      fits: analysis.fits.map((f) => ({
        vacancyId: f.vacancy.id,
        nome: f.vacancy.nome,
        logicCutoff: f.vacancy.logic_cutoff,
        areaKey: f.vacancy.area_key,
        areaCutoff: f.vacancy.area_cutoff,
        best: f.best.status,
        avg: f.avg.status,
      })),
      strengths: analysis.strengths.map((m) => m.module_nome),
      weaknesses: analysis.weaknesses.map((m) => m.module_nome),
      bestPossibility: analysis.ranking[0]?.vacancy.nome ?? null,
    };
    await insertAssessment(userId, payload as unknown as Record<string, unknown>);
    return true;
  } catch (err) {
    console.error("Erro ao gravar a fotografia da avaliação:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Resumo para o colaborador (sem números de corte). Devolve null se o Programa de Recrutamento não está configurado. */
export async function getCandidateSummaryFor(userId: string): Promise<CandidateSummary | null> {
  const programId = await getRecruitmentProgramId();
  if (!programId) return null;

  const [results, vacancies, interests, expected] = await Promise.all([
    listResultsForUser(userId),
    listVacancies({ onlyActive: true }),
    listInterestsForUser(userId),
    countExpectedLogicModules(programId),
  ]);
  const analysis = analyzeCandidate(results.map(toAnalysisResult), vacancies.map(toAnalysisVacancy), expected);
  return buildCandidateSummary(analysis, interests.map((i) => i.vacancy_id));
}
