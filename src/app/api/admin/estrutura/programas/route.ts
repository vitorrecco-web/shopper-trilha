import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { createProgram } from "@/lib/services/structureService";
import { structureErrorResponse } from "@/lib/services/structureHttp";

const bodySchema = z.object({ nome: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Informe o nome do Programa." }, { status: 400 });

  try {
    const program = await createProgram(parsed.data.nome);
    return NextResponse.json({ ok: true, id: program.id }, { status: 201 });
  } catch (err) {
    return structureErrorResponse(err, "Não foi possível criar o Programa agora.");
  }
}
