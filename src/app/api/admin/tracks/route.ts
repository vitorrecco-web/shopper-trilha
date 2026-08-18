import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listActiveTracks } from "@/lib/repositories/tracksRepository";

/** §11.1 — "trilha/função selecionada a partir de tracks ativos". */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const tracks = await listActiveTracks();
  return NextResponse.json({ ok: true, tracks });
}
