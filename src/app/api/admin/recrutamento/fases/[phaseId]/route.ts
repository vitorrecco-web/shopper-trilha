import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getPhaseById } from "@/lib/repositories/phasesRepository";
import { getRecruitmentProgramId } from "@/lib/repositories/recruitmentRepository";
import { setPhaseAreaLabel } from "@/lib/services/recruitmentService";

const bodySchema = z.object({
  kind: z.enum(["logica", "area"]).nullable(),
  label: z.string().max(100).optional(),
});

/**
 * Etiqueta a fase com sua área ("logica" = teste de lógica; "area" + nome
 * livre, ex: RC/Logística) ou remove a etiqueta (kind = null). Ao etiquetar,
 * as tentativas que já existem nos módulos da fase entram nos resultados.
 */
export async function PUT(request: NextRequest, { params }: { params: { phaseId: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });

  const phase = await getPhaseById(params.phaseId).catch(() => null);
  const programId = await getRecruitmentProgramId().catch(() => null);
  if (!phase || !phase.active || !programId || phase.program_id !== programId) {
    return NextResponse.json({ ok: false, error: "Fase não encontrada no Programa de Recrutamento." }, { status: 404 });
  }

  try {
    await setPhaseAreaLabel(phase.id, parsed.data.kind, parsed.data.label);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && /área/i.test(err.message)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error("Erro ao etiquetar a fase:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar agora." }, { status: 500 });
  }
}
