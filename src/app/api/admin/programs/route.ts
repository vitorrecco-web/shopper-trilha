import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listActivePrograms } from "@/lib/repositories/programsRepository";

/** Lista de Programas ativos — usado no cadastro de aluno (seleção antes da Função). */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const programs = await listActivePrograms();
  return NextResponse.json({ ok: true, programs });
}
