import "server-only";
import { listUsers, listUsersWithTrack } from "@/lib/repositories/usersRepository";
import { listAllModules, getModuleById } from "@/lib/repositories/modulesRepository";
import { listAllAttempts, listAttemptsForModule } from "@/lib/repositories/quizAttemptsRepository";
import { computeUsersProgressBatch } from "@/lib/services/userProgress";

/**
 * Dashboard gerencial (Admin) — primeira versão, agregação em memória a
 * partir de repositórios já existentes (nada de queries novas
 * espalhadas em componentes). Sem dados pessoais de colaboradores
 * individuais: só métricas agregadas por módulo/pergunta.
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

export interface DashboardData {
  eligibleUsers: number;
  completionRate: number | null;
  modulePerformance: ModulePerformance[];
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

export async function getDashboardData(): Promise<DashboardData> {
  const [allStudents, modules, attempts] = await Promise.all([
    listUsers({ status: "active" }),
    listAllModules(),
    listAllAttempts(),
  ]);

  const students = allStudents.filter((u) => u.role === "student");

  // A. Taxa média de conclusão — % de módulos aplicáveis concluídos por
  // colaborador ativo elegível, com o mesmo cálculo já usado em
  // /admin/usuarios (1 leitura em lote, não N).
  const progressByUserId = await computeUsersProgressBatch(
    students.map((u) => ({ id: u.id, track_id: u.track_id }))
  );
  const percents = [...progressByUserId.values()]
    .map((p) => p.percent)
    .filter((p): p is number => p !== null);
  const completionRate =
    percents.length > 0 ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length) : null;

  const moduleById = new Map(modules.map((m) => [m.id, m]));

  // B. Desempenho por módulo + C. Perguntas mais erradas — uma única
  // passada sobre as tentativas, usando o questions_snapshot histórico
  // (não o perguntas.json atual do Drive, que pode já ter mudado).
  const perfByModule = new Map<
    string,
    { attempts: number; users: Set<string>; scoreSum: number; passed: number }
  >();
  const wrongByKey = new Map<
    string,
    { moduleId: string; questionId: string; pergunta: string; total: number; wrong: number }
  >();

  for (const attempt of attempts) {
    const perf = perfByModule.get(attempt.module_id) ?? {
      attempts: 0,
      users: new Set<string>(),
      scoreSum: 0,
      passed: 0,
    };
    perf.attempts += 1;
    perf.users.add(attempt.user_id);
    perf.scoreSum += Number(attempt.score);
    if (attempt.passed) perf.passed += 1;
    perfByModule.set(attempt.module_id, perf);

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
      const stat = wrongByKey.get(key) ?? {
        moduleId: attempt.module_id,
        questionId: q.id,
        pergunta: q.pergunta ?? "",
        total: 0,
        wrong: 0,
      };
      stat.total += 1;
      stat.pergunta = q.pergunta ?? stat.pergunta;
      if (answerByQuestion.get(q.id) !== q.correta) stat.wrong += 1;
      wrongByKey.set(key, stat);
    }
  }

  const modulePerformance: ModulePerformance[] = [...perfByModule.entries()]
    .map(([moduleId, perf]) => ({
      moduleId,
      moduleNome: moduleById.get(moduleId)?.nome ?? "Módulo removido",
      attempts: perf.attempts,
      uniqueUsers: perf.users.size,
      avgScore: Math.round(perf.scoreSum / perf.attempts),
      passRate: Math.round((perf.passed / perf.attempts) * 100),
    }))
    .sort((a, b) => a.moduleNome.localeCompare(b.moduleNome, "pt-BR"));

  const topWrongQuestions: WrongQuestionStat[] = [...wrongByKey.values()]
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
    .sort((a, b) => b.errorRate - a.errorRate || b.totalWrong - a.totalWrong)
    .slice(0, 20);

  return {
    eligibleUsers: percents.length,
    completionRate,
    modulePerformance,
    topWrongQuestions,
  };
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

/**
 * Drill-down do dashboard — "por qual usuário" um módulo tem taxa de
 * aprovação baixa. Só é acessado a partir de /admin/indicadores (admin
 * já teria essa visão em /admin/usuarios de qualquer forma); mesmo
 * assim, mostra só nome/trilha/desempenho, nunca CPF/e-mail/telefone.
 */
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

  const rows: ModuleUserRow[] = [...byUser.entries()].map(([userId, agg]) => {
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
  });

  // Quem ainda não passou, com a menor nota, aparece primeiro — é quem
  // provavelmente precisa de ajuda.
  rows.sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return a.bestScore - b.bestScore;
  });

  return { moduleId: module_.id, moduleNome: module_.nome, rows };
}
