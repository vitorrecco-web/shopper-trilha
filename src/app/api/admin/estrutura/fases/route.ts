import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { createPhase } from "@/lib/services/structureService";
import { structureErrorResponse } from "@/lib/services/structureHttp";

const bodySchema = z.object({ programId: z.string().uuid(), assunto: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Informe o nome da fase." }, { status: 400 });

  try {
    const phase = await createPhase(parsed.data.programId, parsed.data.assunto);
    return NextResponse.json({ ok: true, id: phase.id, ordem: phase.ordem }, { status: 201 });
  } catch (err) {
    return structureErrorResponse(err, "Não foi possível criar a fase agora.");
  }
}
