import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { searchKnowledgeBase } from "@/lib/kb/kbSearchService";

/**
 * Busca semântica sobre a Base de Conhecimento — Fase 1: devolve só os
 * chunks mais relevantes (com score, fonte, caminho/categoria e
 * página), sem gerar resposta conversacional. Admin-only nesta fase —
 * ainda não existe política de acesso definida para aluno/chat.
 */
const searchSchema = z.object({
  query: z.string().trim().min(1, "Informe uma pergunta ou termo de busca."),
  topK: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const results = await searchKnowledgeBase(parsed.data.query, parsed.data.topK ?? 8);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("Erro na busca semântica da base de conhecimento:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível buscar agora. Veja os logs do servidor." },
      { status: 500 }
    );
  }
}
