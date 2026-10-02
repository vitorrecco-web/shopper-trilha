import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { listVacancies, saveInterests } from "@/lib/repositories/recruitmentRepository";

const bodySchema = z.object({ vacancyIds: z.array(z.string().uuid()).max(50) });

/**
 * Grava a(s) vaga(s) de interesse do candidato (lista vazia = "ainda não sei").
 * Valida contra as vagas ATIVAS de verdade — nunca confia no que o cliente manda.
 */
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });

  try {
    const user = await getUserById(session.userId);
    if (!user || user.status === "inactive" || user.role !== "student") {
      return NextResponse.json({ ok: false, error: "Usuário inválido." }, { status: 403 });
    }

    const active = await listVacancies({ onlyActive: true });
    const chosen = active.filter((v) => parsed.data.vacancyIds.includes(v.id));
    if (chosen.length !== new Set(parsed.data.vacancyIds).size) {
      return NextResponse.json({ ok: false, error: "Uma das vagas escolhidas não está mais disponível." }, { status: 400 });
    }

    await saveInterests(user.id, chosen.map((v) => ({ id: v.id, nome: v.nome })));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar interesses:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar agora. Tente novamente." }, { status: 500 });
  }
}
