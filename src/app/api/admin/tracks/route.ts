import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listActiveTracks, listActiveTracksForProgram } from "@/lib/repositories/tracksRepository";

/**
 * §11.1 — "trilha/função selecionada a partir de tracks ativos".
 * `?programId=` escopa a lista ao Programa escolhido no cadastro de
 * aluno (um Programa pode não ter nenhuma função — ex: hoje só a Fase 1
 * da Trilha de Liderança usa isso).
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const programId = request.nextUrl.searchParams.get("programId");
  const tracks = programId ? await listActiveTracksForProgram(programId) : await listActiveTracks();
  return NextResponse.json({ ok: true, tracks });
}
