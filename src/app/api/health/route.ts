import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Endpoint de diagnóstico da Fase 1: confirma que as variáveis de
 * ambiente estão configuradas e que a conexão com o Supabase funciona,
 * sem expor nenhum segredo na resposta.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { error, count } = await supabase
      .from("tracks")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, step: "query", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, tracks_count: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, step: "config", message }, { status: 500 });
  }
}
