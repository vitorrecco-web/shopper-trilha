import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listAllEnrollmentsForUser, deactivateEnrollment } from "@/lib/repositories/enrollmentsRepository";

/**
 * Remove (desmatricula) uma trilha de um usuário — soft-delete, mesmo
 * padrão de `active` já usado em Programa/Fase/Módulo/Trilha. Nunca
 * apaga o histórico de tentativas/progresso daquela trilha, só tira ela
 * do seletor do aluno e das listagens do admin.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string; enrollmentId: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  // Confere que a matrícula pertence mesmo a este usuário antes de desativar.
  const enrollments = await listAllEnrollmentsForUser(params.id);
  const enrollment = enrollments.find((e) => e.id === params.enrollmentId);
  if (!enrollment) {
    return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });
  }

  try {
    await deactivateEnrollment(enrollment.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao remover trilha:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível remover a trilha agora." }, { status: 500 });
  }
}
