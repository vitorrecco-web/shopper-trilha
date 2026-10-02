import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getStructureTree } from "@/lib/services/structureService";

/** Árvore Programa > Fase > [Função] > Módulo (só itens ativos) para a tela Admin > Estrutura. */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  try {
    const programs = await getStructureTree();
    return NextResponse.json({ ok: true, programs });
  } catch (err) {
    console.error("Erro ao montar a estrutura:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível carregar a estrutura agora." }, { status: 500 });
  }
}
