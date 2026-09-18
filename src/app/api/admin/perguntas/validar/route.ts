import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { validatePerguntasJson } from "@/lib/drive/validatePerguntas";

/**
 * Validação em tempo real do editor visual — usa EXATAMENTE a mesma
 * `validatePerguntasJson` que valida o perguntas.json vindo do Drive na
 * sincronização (src/lib/drive/validatePerguntas.ts), para o admin nunca
 * ver "válido aqui" e depois "inválido" na sincronização de verdade.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const result = validatePerguntasJson(JSON.stringify(body));
  if (!result.ok) {
    return NextResponse.json({ ok: true, valid: false, error: result.error });
  }

  return NextResponse.json({ ok: true, valid: true, questionCount: result.data.perguntas.length });
}
