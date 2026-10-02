import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";
import { listActiveEnrollmentsForUser } from "@/lib/repositories/enrollmentsRepository";

const bodySchema = z.object({
  programId: z.string().uuid(),
});

/**
 * Grava em qual Programa (matrícula) o aluno vai trabalhar nesta sessão —
 * só depois da tela "/app/trilhas". Nunca confia cegamente no `programId`
 * enviado: revalida contra as matrículas ATIVAS de verdade do usuário
 * logado antes de gravar na sessão.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, getSessionOptions());

  if (!session.userId) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  let enrollments;
  try {
    enrollments = await listActiveEnrollmentsForUser(session.userId);
  } catch (err) {
    console.error("Erro ao verificar matrículas:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível processar agora." }, { status: 503 });
  }

  const isValid = enrollments.some((e) => e.program_id === parsed.data.programId);
  if (!isValid) {
    return NextResponse.json({ ok: false, error: "Essa trilha não está disponível para você." }, { status: 403 });
  }

  session.activeProgramId = parsed.data.programId;
  await session.save();

  return response;
}
