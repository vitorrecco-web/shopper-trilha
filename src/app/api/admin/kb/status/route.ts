import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getLastKbSync, listActiveKbDocuments } from "@/lib/repositories/kbRepository";

export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  try {
    const [lastSync, documents] = await Promise.all([getLastKbSync(), listActiveKbDocuments()]);
    return NextResponse.json({
      ok: true,
      lastSync,
      documents: documents.map((d) => ({
        id: d.id,
        nome: d.nome,
        caminho: d.caminho,
        categoria: d.categoria,
        pageCount: d.page_count,
        lastIndexedAt: d.last_indexed_at,
        error: d.error,
      })),
    });
  } catch (err) {
    console.error("Erro ao buscar status da base de conhecimento:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível carregar o status agora." }, { status: 500 });
  }
}
