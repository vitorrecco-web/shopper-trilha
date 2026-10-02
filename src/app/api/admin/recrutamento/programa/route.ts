import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { setRecruitmentProgramId } from "@/lib/repositories/recruitmentRepository";
import { getProgramById } from "@/lib/repositories/programsRepository";

const bodySchema = z.object({ programId: z.string().uuid().nullable() });

/** Define qual Programa é o de Recrutamento Interno (ou nenhum). */
export async function PUT(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });

  try {
    if (parsed.data.programId) {
      const program = await getProgramById(parsed.data.programId);
      if (!program || !program.active) {
        return NextResponse.json({ ok: false, error: "Programa não encontrado." }, { status: 404 });
      }
    }
    await setRecruitmentProgramId(parsed.data.programId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao definir o Programa de recrutamento:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar agora." }, { status: 500 });
  }
}
