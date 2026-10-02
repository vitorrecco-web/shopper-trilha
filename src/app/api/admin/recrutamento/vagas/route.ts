import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { createVacancy } from "@/lib/repositories/recruitmentRepository";

const score = z.number().min(0, "A nota de corte vai de 0 a 100.").max(100, "A nota de corte vai de 0 a 100.");

const bodySchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da vaga.").max(100),
  logic_cutoff: score,
  area_key: z.string().min(1).max(60).nullable().optional(),
  area_cutoff: score.nullable().optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const vacancy = await createVacancy({
      nome: parsed.data.nome,
      logic_cutoff: parsed.data.logic_cutoff,
      area_key: parsed.data.area_key ?? null,
      area_cutoff: parsed.data.area_key ? (parsed.data.area_cutoff ?? null) : null,
    });
    return NextResponse.json({ ok: true, id: vacancy.id }, { status: 201 });
  } catch (err) {
    console.error("Erro ao criar vaga:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível criar a vaga agora." }, { status: 500 });
  }
}
