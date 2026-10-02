import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";

/**
 * "Trocar de trilha" — limpa a matrícula ativa da sessão antes de mandar
 * para `/app/trilhas`. Sem isso, `resolveActiveEnrollment` encontraria o
 * `activeProgramId` antigo ainda válido (status "ok") e a própria página
 * de escolha redirecionaria de volta para `/app` imediatamente.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/app/trilhas", request.url));
  const session = await getIronSession<SessionData>(request, response, getSessionOptions());

  if (session.userId) {
    delete session.activeProgramId;
    await session.save();
  }

  return response;
}
