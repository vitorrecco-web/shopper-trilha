import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getRecruitmentConfig } from "@/lib/services/recruitmentService";

/** Configuração do Recrutamento: Programa, etiquetas de área por fase e vagas. */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  try {
    return NextResponse.json({ ok: true, config: await getRecruitmentConfig() });
  } catch (err) {
    console.error("Erro ao carregar configuração de recrutamento:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível carregar a configuração agora." }, { status: 500 });
  }
}
