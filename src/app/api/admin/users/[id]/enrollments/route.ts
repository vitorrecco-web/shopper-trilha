import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getUserById } from "@/lib/repositories/usersRepository";
import { listActiveTracksForProgram } from "@/lib/repositories/tracksRepository";
import { createOrReactivateEnrollment, listAllEnrollmentsForUser } from "@/lib/repositories/enrollmentsRepository";

const addEnrollmentSchema = z.object({
  program_id: z.string().uuid("Selecione um Programa."),
  track_id: z.string().uuid().optional().nullable(),
});

/**
 * Adiciona uma trilha (Programa) nova a um usuário já existente — ex:
 * "Marcos" já estava na Trilha de Liderança e agora também vai fazer a
 * de Logística. Uma matrícula já existente nunca é editada em si (§11.4);
 * isso é sempre uma matrícula NOVA (ou a reativação de uma removida
 * antes), nunca uma troca de função numa matrícula atual.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = addEnrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const user = await getUserById(params.id);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
  }

  if (parsed.data.track_id) {
    const tracksOfProgram = await listActiveTracksForProgram(parsed.data.program_id);
    if (!tracksOfProgram.some((t) => t.id === parsed.data.track_id)) {
      return NextResponse.json(
        { ok: false, error: "A Função selecionada não pertence ao Programa escolhido." },
        { status: 400 }
      );
    }
  }

  const existing = await listAllEnrollmentsForUser(user.id);
  if (existing.some((e) => e.program_id === parsed.data.program_id && e.active)) {
    return NextResponse.json({ ok: false, error: "Esse usuário já está matriculado nesse Programa." }, { status: 409 });
  }

  try {
    const enrollment = await createOrReactivateEnrollment({
      user_id: user.id,
      program_id: parsed.data.program_id,
      track_id: parsed.data.track_id ?? null,
    });
    return NextResponse.json({ ok: true, enrollment }, { status: 201 });
  } catch (err) {
    console.error("Erro ao adicionar trilha:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível adicionar a trilha agora." }, { status: 500 });
  }
}
