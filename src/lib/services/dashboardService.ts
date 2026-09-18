import "server-only";
import type { Module } from "@/lib/db/types";
import { listUsersWithTrack, getUserWithTrackById, type UserWithTrack } from "@/lib/repositories/usersRepository";
import { listAllModules, getModuleById } from "@/lib/repositories/modulesRepository";
import {
  listAllAttempts,
  listAttemptsForModule,
  listAttemptsForUser,
} from "@/lib/repositories/quizAttemptsRepository";
import { computeUsersProgressBatch, type UserProgress } from "@/lib/services/userProgress";
import { computeTrackStatus, type TrackStatus } from "@/lib/services/trackStatus";

/**
 * Dashboard gerencial (Admin) — pensado para escalar com "Shopper
 * University" (muitas trilhas/módulos/perguntas):
 *
 * - `getDashboardOverview` — só o essencial pra abrir em /admin/indicadores:
 *   KPIs gerais + top 5 de cada lista "que precisa de atenção", com link
 *   para a lista completa. Nunca cresce com o tamanho da base.
 * - `getAllModulePerformance` / `getAllWrongQuestions` / `getAllColaboradores`
 *   — listas completas, cada uma na sua própria página, para o admin
 *   pesquisar/filtrar sem escrolar uma página só gigante.
 * - `getModuleUserBreakdown` / `getUserModuleHistory` — detalhe (drill-down)
 *   de um módulo específico ou de um colaborador específico.
 *
 * Todas calculadas a partir de repositórios já existentes, numa única
 * passada por `quiz_attempts` (`buildAggregates`) — sem dado pessoal
 * sensível (cpf/e-mail/telefone não existem nem no schema de `users`).
 */

export interface ModulePerformance {
  moduleId: string;
  moduleNome: string;
  attempts: number;
  uniqueUsers: number;
  avgScore: number;
  passRate: number;
}

export interface WrongQuestionStat {
  moduleId: string;
  moduleNome: string;
  questionId: string;
  pergunta: string;
  totalAnswered: number;
  totalWrong: number;
  errorRate: number;
}

export interface ColaboradorPerformance {
  userId: string;
  nomeCompleto: string;
  trackNome: string | null;
  trackStatus: TrackStatus;
  completionPercent: number | null;
  quizAttempts: number;
  quizAvgScore: number | null;
  modulesPassed: number;
  /** Módulos em que já tentou pelo menos uma vez mas ainda não passou — sinal mais forte de "está travado", não só "não iniciou". */
  modulesFailingOnly: number;
}

export interface DashboardOverview {
  completionRate: number | null;
  eligibleUsers: number;
  totalAttempts: number;
  overallPassRate: number | null;
  attentionModules: ModulePerformance[];
  attentionColaboradores: ColaboradorPerformance[];
  topWrongQuestions: WrongQuestionStat[];
}

interface QuestionSnapshotEntry {
  id: string;
  pergunta: string;
  correta: string;
}

interface AnswerEntry {
  questionId: string;
  alternativaId: string;
}

interface ModuleAgg {
  attempts: number;
  users: Set<string>;
  scoreSum: number;
  passed: number;
}

interface UserAgg {
  attemptsTotal: number;
  scoreSum: number;
  modulesAttempted: Set<string>;
  modulesPassed: Set<string>;
}

interface WrongAgg {
  moduleId: string;
  questionId: string;
  pergunta: string;
  total: number;
  wrong: number;
}

interface Aggregates {
  perfByModule: Map<string, ModuleAgg>;
  perfByUser: Map<string, UserAgg>;
  wrongByQuestion: Map<string, WrongAgg>;
}

/** Única passada por todas as tentativas — cada view deriva dela, em vez de reler `quiz_attempts` várias vezes. */
async function buildAggregates(): Promise<{ modules: Module[]; aggregates: Aggregates }> {
  const [modules, attempts] = await Promise.all([listAllModules(), listAllAttempts()]);

  const perfByModule = new Map<string, ModuleAgg>();
  const perfByUser = new Map<string, UserAgg>();
  const wrongByQuestion = new Map<string, WrongAgg>();

  for (const attempt of attempts) {
    const modulePerf = perfByModule.get(attempt.module_id) ?? {
      attempts: 0,
      users: new Set<string>(),
      scoreSum: 0,
      passed: 0,
    };
    modulePerf.attempts += 1;
    modulePerf.users.add(attempt.user_id);
    modulePerf.scoreSum += Number(attempt.score);
    if (attempt.passed) modulePerf.passed += 1;
    perfByModule.set(attempt.module_id, modulePerf);

    const userPerf = perfByUser.get(attempt.user_id) ?? {
      attemptsTotal: 0,
      scoreSum: 0,
      modulesAttempted: new Set<string>(),
      modulesPassed: new Set<string>(),
    };
    userPerf.attemptsTotal += 1;
    userPerf.scoreSum += Number(attempt.score);
    userPerf.modulesAttempted.add(attempt.module_id);
    if (attempt.passed) userPerf.modulesPassed.add(attempt.module_id);
    perfByUser.set(attempt.user_id, userPerf);

    const snapshotPerguntas = (attempt.questions_snapshot as { perguntas?: unknown } | null)?.perguntas;
    const answers = (attempt.answers as { answers?: unknown } | null)?.answers;
    if (!Array.isArray(snapshotPerguntas) || !Array.isArray(answers)) continue;

    const answerByQuestion = new Map(
      (answers as AnswerEntry[])
        .filter((a) => a && typeof a.questionId === "string" && typeof a.alternativaId === "string")
        .map((a) => [a.questionId, a.alternativaId])
    );

    for (const q of snapshotPerguntas as QuestionSnapshotEntry[]) {
      if (!q || typeof q.id !== "string" || typeof q.correta !== "string") continue;

      const key = `${attempt.module_id}::${q.id}`;
      const stat = wrongByQuestion.get(key) ?? {
        moduleId: attempt.module_id,
        questionId: q.id,
        pergunta: q.pergunta ?? "",
        total: 0,
        wrong: 0,
      };
      stat.total += 1;
      stat.pergunta = q.pergunta ?? stat.pergunta;
      if (answerByQuestion.get(q.id) !== q.correta) stat.wrong += 1;
      wrongByQuestion.set(key, stat);
    }
  }

  return { modules, aggregates: { perfByModule, perfByUser, wrongByQuestion } };
}

function toModulePerformanceList(modules: Module[], perfByModule: Map<string, ModuleAgg>): ModulePerformance[] {
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  return [...perfByModule.entries()]
    .map(([moduleId, perf]) => ({
      moduleId,
      moduleNome: moduleById.get(moduleId)?.nome ?? "Módulo removido",
      attempts: perf.attempts,
      uniqueUsers: perf.users.size,
      avgScore: Math.round(perf.scoreSum / perf.attempts),
      passRate: Math.round((perf.passed / perf.attempts) * 100),
    }))
    .sort((a, b) => a.moduleNome.localeCompare(b.moduleNome, "pt-BR"));
}

function toWrongQuestionList(modules: Module[], wrongByQuestion: Map<string, WrongAgg>): WrongQuestionStat[] {
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  return [...wrongByQuestion.values()]
    .filter((s) => s.wrong > 0)
    .map((s) => ({
      moduleId: s.moduleId,
      moduleNome: moduleById.get(s.moduleId)?.nome ?? "Módulo removido",
      questionId: s.questionId,
      pergunta: s.pergunta,
      totalAnswered: s.total,
      totalWrong: s.wrong,
      errorRate: Math.round((s.wrong / s.total) * 100),
    }))
    .sort((a, b) => b.errorRate - a.errorRate || b.totalWrong - a.totalWrong);
}

function toColaboradorList(
  students: UserWithTrack[],
  progressByUserId: Map<string, UserProgress>,
  perfByUser: Map<string, UserAgg>
): ColaboradorPerformance[] {
  return students.map((u) => {
    const progress = progressByUserId.get(u.id) ?? { totalModules: 0, completedModules: 0, percent: null };
    const perf = perfByUser.get(u.id);
    const modulesAttempted = perf?.modulesAttempted.size ?? 0;
    const modulesPassed = perf?.modulesPassed.size ?? 0;

    return {
      userId: u.id,
      nomeCompleto: u.nome_completo,
      trackNome: u.track?.nome ?? null,
      trackStatus: computeTrackStatus(progress.percent),
      completionPercent: progress.percent,
      quizAttempts: perf?.attemptsTotal ?? 0,
      quizAvgScore: perf && perf.attemptsTotal > 0 ? Math.round(perf.scoreSum / perf.attemptsTotal) : null,
      modulesPassed,
      modulesFailingOnly: Math.max(0, modulesAttempted - modulesPassed),
    };
  });
}

async function getEligibleStudentsWithProgress(): Promise<{
  students: UserWithTrack[];
  progressByUserId: Map<string, UserProgress>;
}> {
  const usersWithTrack = await listUsersWithTrack();
  const students = usersWithTrack.filter((u) => u.role === "student" && u.status === "active");
  const progressByUserId = await computeUsersProgressBatch(
    students.map((u) => ({ id: u.id, track_id: u.track_id }))
  );
  return { students, progressByUserId };
}

/** Visão geral de /admin/indicadores — KPIs + top 5 "que precisa de atenção" de cada lista. */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [{ students, progressByUserId }, { modules, aggregates }] = await Promise.all([
    getEligibleStudentsWithProgress(),
    buildAggregates(),
  ]);

  const percents = [...progressByUserId.values()]
    .map((p) => p.percent)
    .filter((p): p is number => p !== null);
  const completionRate =
    percents.length > 0 ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length) : null;

  const modulePerformance = toModulePerformanceList(modules, aggregates.perfByModule);
  const wrongQuestions = toWrongQuestionList(modules, aggregates.wrongByQuestion);
  const colaboradores = toColaboradorList(students, progressByUserId, aggregates.perfByUser);

  const totalAttempts = modulePerformance.reduce((sum, m) => sum + m.attempts, 0);
  const totalPassed = [...aggregates.perfByModule.values()].reduce((sum, p) => sum + p.passed, 0);
  const overallPassRate = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : null;

  const attentionModules = modulePerformance
    .filter((m) => m.attempts > 0)
    .sort((a, b) => a.passRate - b.passRate)
    .slice(0, 5);

  // Prioriza quem está travado num assunto (tentou e não passou), não só
  // quem tem conclusão baixa — alguém recém-contratado com 0% ainda não
  // é necessariamente "problema"; alguém com 30 tentativas reprovadas
  // no mesmo módulo é.
  const attentionColaboradores = [...colaboradores]
    .filter((c) => c.modulesFailingOnly > 0 || (c.completionPercent ?? 100) < 100)
    .sort((a, b) => {
      if (b.modulesFailingOnly !== a.modulesFailingOnly) return b.modulesFailingOnly - a.modulesFailingOnly;
      return (a.completionPercent ?? 0) - (b.completionPercent ?? 0);
    })
    .slice(0, 5);

  return {
    completionRate,
    eligibleUsers: percents.length,
    totalAttempts,
    overallPassRate,
    attentionModules,
    attentionColaboradores,
    topWrongQuestions: wrongQuestions.slice(0, 5),
  };
}

/** Lista completa para /admin/indicadores/modulos. */
export async function getAllModulePerformance(): Promise<ModulePerformance[]> {
  const { modules, aggregates } = await buildAggregates();
  return toModulePerformanceList(modules, aggregates.perfByModule);
}

/** Lista completa (ou filtrada por módulo) para /admin/indicadores/perguntas. */
export async function getAllWrongQuestions(moduleId?: string): Promise<WrongQuestionStat[]> {
  const { modules, aggregates } = await buildAggregates();
  const list = toWrongQuestionList(modules, aggregates.wrongByQuestion);
  return moduleId ? list.filter((q) => q.moduleId === moduleId) : list;
}

/** Lista completa para /admin/indicadores/colaboradores. */
export async function getAllColaboradores(): Promise<ColaboradorPerformance[]> {
  const [{ students, progressByUserId }, { aggregates }] = await Promise.all([
    getEligibleStudentsWithProgress(),
    buildAggregates(),
  ]);
  return toColaboradorList(students, progressByUserId, aggregates.perfByUser);
}

export interface ModuleUserRow {
  userId: string;
  nomeCompleto: string;
  trackNome: string | null;
  attempts: number;
  bestScore: number;
  lastScore: number;
  passed: boolean;
  lastAttemptAt: string | null;
}

export interface ModuleUserBreakdown {
  moduleId: string;
  moduleNome: string;
  rows: ModuleUserRow[];
}

/** Drill-down "por qual colaborador" um módulo específico tem taxa de aprovação baixa. */
export async function getModuleUserBreakdown(moduleId: string): Promise<ModuleUserBreakdown | null> {
  const [module_, attempts, usersWithTrack] = await Promise.all([
    getModuleById(moduleId),
    listAttemptsForModule(moduleId),
    listUsersWithTrack(),
  ]);

  if (!module_) return null;

  const userById = new Map(usersWithTrack.map((u) => [u.id, u]));

  const byUser = new Map<
    string,
    { attempts: number; bestScore: number; lastScore: number; lastAt: string; passed: boolean }
  >();

  for (const attempt of attempts) {
    const attemptAt = attempt.submitted_at ?? attempt.started_at;
    const score = Number(attempt.score);
    const current = byUser.get(attempt.user_id);

    if (!current) {
      byUser.set(attempt.user_id, {
        attempts: 1,
        bestScore: score,
        lastScore: score,
        lastAt: attemptAt,
        passed: attempt.passed,
      });
      continue;
    }

    current.attempts += 1;
    current.bestScore = Math.max(current.bestScore, score);
    current.passed = current.passed || attempt.passed;
    if (attemptAt > current.lastAt) {
      current.lastAt = attemptAt;
      current.lastScore = score;
    }
  }

  const rows: ModuleUserRow[] = [...byUser.entries()]
    .map(([userId, agg]) => {
      const user = userById.get(userId);
      return {
        userId,
        nomeCompleto: user?.nome_completo ?? "Usuário removido",
        trackNome: user?.track?.nome ?? null,
        attempts: agg.attempts,
        bestScore: agg.bestScore,
        lastScore: agg.lastScore,
        passed: agg.passed,
        lastAttemptAt: agg.lastAt,
      };
    })
    // Quem ainda não passou, com a menor nota, aparece primeiro.
    .sort((a, b) => {
      if (a.passed !== b.passed) return a.passed ? 1 : -1;
      return a.bestScore - b.bestScore;
    });

  return { moduleId: module_.id, moduleNome: module_.nome, rows };
}

export interface UserModuleHistoryRow {
  moduleId: string;
  moduleNome: string;
  attempts: number;
  bestScore: number;
  lastScore: number;
  passed: boolean;
  lastAttemptAt: string | null;
}

export interface UserModuleHistory {
  userId: string;
  nomeCompleto: string;
  trackNome: string | null;
  rows: UserModuleHistoryRow[];
}

/** Drill-down "em quais módulos" um colaborador específico está indo bem/mal. */
export async function getUserModuleHistory(userId: string): Promise<UserModuleHistory | null> {
  const [user, attempts, modules] = await Promise.all([
    getUserWithTrackById(userId),
    listAttemptsForUser(userId),
    listAllModules(),
  ]);

  if (!user) return null;

  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const byModule = new Map<
    string,
    { attempts: number; bestScore: number; lastScore: number; lastAt: string; passed: boolean }
  >();

  for (const attempt of attempts) {
    const attemptAt = attempt.submitted_at ?? attempt.started_at;
    const score = Number(attempt.score);
    const current = byModule.get(attempt.module_id);

    if (!current) {
      byModule.set(attempt.module_id, {
        attempts: 1,
        bestScore: score,
        lastScore: score,
        lastAt: attemptAt,
        passed: attempt.passed,
      });
      continue;
    }

    current.attempts += 1;
    current.bestScore = Math.max(current.bestScore, score);
    current.passed = current.passed || attempt.passed;
    if (attemptAt > current.lastAt) {
      current.lastAt = attemptAt;
      current.lastScore = score;
    }
  }

  const rows: UserModuleHistoryRow[] = [...byModule.entries()]
    .map(([moduleId, agg]) => ({
      moduleId,
      moduleNome: moduleById.get(moduleId)?.nome ?? "Módulo removido",
      attempts: agg.attempts,
      bestScore: agg.bestScore,
      lastScore: agg.lastScore,
      passed: agg.passed,
      lastAttemptAt: agg.lastAt,
    }))
    .sort((a, b) => {
      if (a.passed !== b.passed) return a.passed ? 1 : -1;
      return a.bestScore - b.bestScore;
    });

  return { userId: user.id, nomeCompleto: user.nome_completo, trackNome: user.track?.nome ?? null, rows };
}
