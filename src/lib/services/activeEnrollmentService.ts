import "server-only";
import { listActiveEnrollmentsForUser } from "@/lib/repositories/enrollmentsRepository";

/**
 * Resolve qual Programa/Função um aluno está usando "agora". Centraliza a
 * regra para não duplicar em cada página/rota:
 * - 0 matrículas ativas → "none" (nunca deveria acontecer para um aluno
 *   recém-cadastrado pelo admin, mas é tratado, não ignorado).
 * - 1 matrícula ativa → sempre usa ela, direto — zero fricção para o caso
 *   comum, igual era antes de existir matrícula múltipla.
 * - 2+ matrículas → exige uma escolha explícita (feita em /app/trilhas e
 *   guardada em `session.activeProgramId`); se a sessão não tem escolha
 *   válida (nunca escolheu, ou a matrícula escolhida foi removida), devolve
 *   "choose" com as opções disponíveis.
 */

export interface EnrollmentOption {
  enrollmentId: string;
  programId: string;
  programNome: string;
  trackId: string | null;
  trackNome: string | null;
}

export type ActiveEnrollmentResult =
  | { status: "none" }
  | { status: "choose"; options: EnrollmentOption[] }
  // `hasMultiple` diz se o usuário tem mais de uma matrícula ativa — usado
  // pela UI (ex: Header) para só mostrar "Trocar de trilha" quando faz
  // sentido, sem precisar de outra consulta.
  | { status: "ok"; enrollment: EnrollmentOption; hasMultiple: boolean };

function toOption(e: Awaited<ReturnType<typeof listActiveEnrollmentsForUser>>[number]): EnrollmentOption {
  return {
    enrollmentId: e.id,
    programId: e.program_id,
    programNome: e.program_nome,
    trackId: e.track_id,
    trackNome: e.track_nome,
  };
}

export async function resolveActiveEnrollment(
  userId: string,
  sessionActiveProgramId?: string
): Promise<ActiveEnrollmentResult> {
  const enrollments = await listActiveEnrollmentsForUser(userId);

  if (enrollments.length === 0) return { status: "none" };

  if (enrollments.length === 1) {
    return { status: "ok", enrollment: toOption(enrollments[0]), hasMultiple: false };
  }

  const chosen = sessionActiveProgramId
    ? enrollments.find((e) => e.program_id === sessionActiveProgramId)
    : undefined;

  if (chosen) return { status: "ok", enrollment: toOption(chosen), hasMultiple: true };

  return { status: "choose", options: enrollments.map(toOption) };
}
