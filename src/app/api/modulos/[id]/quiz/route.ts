import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/getSession";
import type { User } from "@/lib/db/types";
import { getUserById } from "@/lib/repositories/usersRepository";
import { getModuleAccessInfo, type ModuleAccessInfo } from "@/lib/services/moduleAccessService";
import { fetchAndValidateQuiz, toPublicQuiz, gradeSubmission } from "@/lib/quiz/quizService";
import { recordQuizAttempt } from "@/lib/repositories/quizAttemptsRepository";
import { markPassedAndMaybeUpdateBestScore } from "@/lib/repositories/userModulesRepository";
import { unlockNextModule } from "@/lib/services/progressionService";

/**
 * Fase 9. Autorização compartilhada pelo GET (buscar perguntas) e pelo
 * POST (submeter respostas) — mesma regra da Fase 8: sessão válida,
 * módulo aplicável e liberado, e (tarefa 8 da Fase 8) só libera a área
 * de quiz depois que o material já foi acessado pelo menos uma vez.
 */
async function authorize(
  moduleId: string
): Promise<{ user: User; access: ModuleAccessInfo } | { error: NextResponse }> {
  const session = await getCurrentSession();
  if (!session) {
    return { error: NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  }

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") {
    return { error: NextResponse.json({ ok: false, error: "Usuário inválido." }, { status: 401 }) };
  }

  const access = await getModuleAccessInfo(user.id, user.track_id, moduleId);
  if (!access || !access.unlocked || !access.module.has_questions || !access.module.questions_drive_id) {
    return { error: NextResponse.json({ ok: false, error: "Quiz não disponível." }, { status: 404 }) };
  }
  if (!access.materialAccessed) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Acesse o material antes de responder o quiz." },
        { status: 403 }
      ),
    };
  }

  return { user, access };
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if ("error" in auth) return auth.error;

  try {
    const validated = await fetchAndValidateQuiz(auth.access.module.questions_drive_id!);
    return NextResponse.json({ ok: true, perguntas: toPublicQuiz(validated.perguntas) });
  } catch (err) {
    console.error("Erro ao carregar perguntas:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar as perguntas agora." },
      { status: 502 }
    );
  }
}

const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), alternativaId: z.string() })),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if ("error" in auth) return auth.error;
  const { user, access } = auth;

  const body = await request.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  let validated;
  try {
    validated = await fetchAndValidateQuiz(access.module.questions_drive_id!);
  } catch (err) {
    console.error("Erro ao carregar perguntas para correção:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível corrigir agora. Tente novamente." },
      { status: 502 }
    );
  }

  // Tarefa 6: corrige no servidor, nunca confiando em nota enviada pelo cliente.
  const result = gradeSubmission(validated.perguntas, parsed.data.answers);

  // Tarefa 9: registra a tentativa com snapshot completo — histórico
  // nunca é sobrescrito, mesmo que essa tentativa seja reprovada.
  await recordQuizAttempt({
    user_id: user.id,
    module_id: access.module.id,
    score: result.score,
    correct_answers: result.correctAnswers,
    total_questions: result.totalQuestions,
    passed: result.passed,
    answers: { answers: parsed.data.answers },
    questions_snapshot: { perguntas: validated.perguntas },
  });

  // Tarefas 10-11: só em caso de aprovação — nunca em reprovação, o que
  // já garante "nova tentativa não remove aprovação anterior" e "nota
  // menor não substitui a melhor nota" (a própria função do repositório
  // só aumenta best_score e nunca desmarca completed).
  if (result.passed) {
    await markPassedAndMaybeUpdateBestScore(user.id, access.module.id, result.score);
    await unlockNextModule(user.id, user.track_id, access.module.id);
  }

  return NextResponse.json({
    ok: true,
    score: result.score,
    correctAnswers: result.correctAnswers,
    totalQuestions: result.totalQuestions,
    passed: result.passed,
    perQuestion: result.perQuestion.map((r) => ({
      questionId: r.questionId,
      correct: r.correct,
      explicacao: r.explicacao,
    })),
    nextModuleId: result.passed ? access.nextModuleId : null,
    nextModuleNome: result.passed ? access.nextModuleNome : null,
  });
}
