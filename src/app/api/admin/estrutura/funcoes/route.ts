import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { createTrack } from "@/lib/services/structureService";
import { structureErrorResponse } from "@/lib/services/structureHttp";

const bodySchema = z.object({ phaseId: z.string().uuid(), nome: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Informe o nome da Função." }, { status: 400 });

  try {
    const track = await createTrack(parsed.data.phaseId, parsed.data.nome);
    return NextResponse.json({ ok: true, id: track.id }, { status: 201 });
  } catch (err) {
    return structureErrorResponse(err, "Não foi possível criar a Função agora.");
  }
}
