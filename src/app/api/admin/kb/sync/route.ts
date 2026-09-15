import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { runKbSync } from "@/lib/kb/kbSyncService";

/**
 * Dispara a sincronização completa da Base de Conhecimento — admin-only,
 * totalmente isolada da sincronização da trilha (rota, serviço e
 * tabelas diferentes).
 */
export async function POST() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  try {
    const summary = await runKbSync();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("Erro ao sincronizar a base de conhecimento:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível concluir a sincronização. Veja os logs do servidor." },
      { status: 500 }
    );
  }
}
