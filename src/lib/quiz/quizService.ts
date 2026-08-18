import "server-only";
import { fetchDriveFileAsText } from "@/lib/drive/googleDriveClient";
import { validatePerguntasJson, type ValidatedPerguntas } from "@/lib/drive/validatePerguntas";

/**
 * EXECUTION_PLAN Fase 9 — Quiz.
 *
 * Separação deliberada: tudo que é I/O (buscar perguntas.json no Drive)
 * fica em `fetchAndValidateQuiz`; a montagem do que é exposto ao
 * frontend (`toPublicQuiz`) e a correção (`gradeSubmission`) são puras,
 * para serem testáveis com fixtures sem depender do Drive.
 */

export interface PublicAlternativa {
  id: string;
  texto: string;
}

export interface PublicPergunta {
  id: string;
  pergunta: string;
  alternativas: PublicAlternativa[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Tarefas 1-2: busca perguntas.json no servidor e valida (4 alternativas por pergunta, etc). */
export async function fetchAndValidateQuiz(questionsDriveId: string): Promise<ValidatedPerguntas> {
  const raw = await fetchDriveFileAsText(questionsDriveId);
  const result = validatePerguntasJson(raw);
  if (!result.ok) {
    throw new Error(`perguntas.json inválido: ${result.error}`);
  }
  return result.data;
}

/**
 * Tarefas 3-5: embaralha perguntas e alternativas a cada chamada, e
 * NUNCA inclui `correta` nem `explicacao` — o gabarito não pode ser
 * exposto antes da submissão.
 */
export function toPublicQuiz(perguntas: ValidatedPerguntas["perguntas"]): PublicPergunta[] {
  return shuffle(perguntas).map((p) => ({
    id: p.id,
    pergunta: p.pergunta,
    alternativas: shuffle(p.alternativas).map((a) => ({ id: a.id, texto: a.texto })),
  }));
}

export interface SubmittedAnswer {
  questionId: string;
  alternativaId: string;
}

export interface PerQuestionResult {
  questionId: string;
  correct: boolean;
  explicacao: string | null;
}

export interface GradeResult {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  perQuestion: PerQuestionResult[];
}

/** §4: nota mínima 70% — comparado pela fração exata, não pelo score já arredondado. */
const PASS_RATIO = 0.7;

/**
 * Pura — tarefa 6 (corrigir no servidor), sempre comparando por ID da
 * alternativa (`p.correta`), nunca pela posição em que foi exibida.
 */
export function gradeSubmission(
  perguntas: ValidatedPerguntas["perguntas"],
  answers: SubmittedAnswer[]
): GradeResult {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.alternativaId]));

  const perQuestion: PerQuestionResult[] = perguntas.map((p) => ({
    questionId: p.id,
    correct: answerByQuestionId.get(p.id) === p.correta,
    explicacao: p.explicacao ?? null,
  }));

  const correctAnswers = perQuestion.filter((r) => r.correct).length;
  const totalQuestions = perguntas.length;
  const score = totalQuestions === 0 ? 0 : Math.round((correctAnswers / totalQuestions) * 100);
  const passed = totalQuestions > 0 && correctAnswers / totalQuestions >= PASS_RATIO;

  return { score, correctAnswers, totalQuestions, passed, perQuestion };
}
