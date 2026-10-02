import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { createModule } from "@/lib/services/structureService";
import { structureErrorResponse } from "@/lib/services/structureHttp";

const bodySchema = z.object({
  phaseId: z.string().uuid(),
  trackId: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Informe o título do módulo." }, { status: 400 });

  try {
    const module_ = await createModule(parsed.data.phaseId, parsed.data.trackId ?? null, parsed.data.titulo);
    return NextResponse.json({ ok: true, id: module_.id, ordem: module_.ordem }, { status: 201 });
  } catch (err) {
    return structureErrorResponse(err, "Não foi possível criar o módulo agora.");
  }
}
