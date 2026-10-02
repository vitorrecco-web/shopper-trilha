import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getVacancyById, updateVacancy } from "@/lib/repositories/recruitmentRepository";

const score = z.number().min(0, "A nota de corte vai de 0 a 100.").max(100, "A nota de corte vai de 0 a 100.");

const bodySchema = z.object({
  nome: z.string().trim().min(1).max(100).optional(),
  logic_cutoff: score.optional(),
  area_key: z.string().min(1).max(60).nullable().optional(),
  area_cutoff: score.nullable().optional(),
  // Vaga encerrada é desativada, nunca apagada — o histórico e os interesses continuam legíveis.
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const existing = await getVacancyById(params.id);
    if (!existing) return NextResponse.json({ ok: false, error: "Vaga não encontrada." }, { status: 404 });

    const patch = { ...parsed.data };
    // Sem área, não há corte de área.
    const nextAreaKey = patch.area_key === undefined ? existing.area_key : patch.area_key;
    if (!nextAreaKey) patch.area_cutoff = null;

    await updateVacancy(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao atualizar vaga:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar a vaga agora." }, { status: 500 });
  }
}
