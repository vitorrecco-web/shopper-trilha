import "server-only";
import { listActiveEnrollmentsForUser } from "@/lib/repositories/enrollmentsRepository";
import { listActivePrograms } from "@/lib/repositories/programsRepository";
import { isFullAccessRole, type Role } from "@/lib/auth/roles";

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
  // `fullAccess` = perfil sem travas (viewer/analyst/admin): a "matrícula"
  // é só o Programa escolhido, `trackId` é sempre null e NADA é gravado.
  | { status: "ok"; enrollment: EnrollmentOption; hasMultiple: boolean; fullAccess: boolean };

function toOption(e: Awaited<ReturnType<typeof listActiveEnrollmentsForUser>>[number]): EnrollmentOption {
  return {
    enrollmentId: e.id,
    programId: e.program_id,
    programNome: e.program_nome,
    trackId: e.track_id,
    trackNome: e.track_nome,
  };
}

/**
 * Perfis sem travas (viewer/analyst/admin) não têm matrícula: as opções
 * são TODOS os Programas ativos, sem Função (`trackId = null` — quem monta
 * a lista de módulos usa `fullAccess` para trazer também os módulos de
 * função específica).
 */
export async function listFullAccessOptions(): Promise<EnrollmentOption[]> {
  const programs = await listActivePrograms();
  return programs.map((p) => ({
    enrollmentId: `full-access:${p.id}`,
    programId: p.id,
    programNome: p.nome,
    trackId: null,
    trackNome: null,
  }));
}

function pickAmong(
  options: EnrollmentOption[],
  sessionActiveProgramId: string | undefined,
  fullAccess: boolean
): ActiveEnrollmentResult {
  if (options.length === 0) return { status: "none" };

  if (options.length === 1) {
    return { status: "ok", enrollment: options[0], hasMultiple: false, fullAccess };
  }

  const chosen = sessionActiveProgramId
    ? options.find((o) => o.programId === sessionActiveProgramId)
    : undefined;

  if (chosen) return { status: "ok", enrollment: chosen, hasMultiple: true, fullAccess };

  return { status: "choose", options };
}

export async function resolveActiveEnrollment(
  userId: string,
  sessionActiveProgramId?: string,
  role: Role = "student"
): Promise<ActiveEnrollmentResult> {
  if (isFullAccessRole(role)) {
    return pickAmong(await listFullAccessOptions(), sessionActiveProgramId, true);
  }

  const enrollments = await listActiveEnrollmentsForUser(userId);
  return pickAmong(enrollments.map(toOption), sessionActiveProgramId, false);
}
