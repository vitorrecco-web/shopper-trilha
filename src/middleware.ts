import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";

/**
 * Guards de rota (EXECUTION_PLAN Fase 2, item 6):
 * - /admin/**  exige role === "admin"
 * - /app/**    exige qualquer sessão válida (admin ou student)
 * - /login     se já autenticado, redireciona para a home certa
 *
 * Middleware roda no Edge runtime — iron-session v8 é compatível.
 * Nenhum segredo de banco é acessado aqui, só o cookie de sessão.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, getSessionOptions());

  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(session.userId);

  if (pathname.startsWith("/login")) {
    if (isAuthenticated) {
      const dest = session.role === "admin" ? "/admin" : "/app";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return response;
  }

  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return response;
  }

  if (pathname.startsWith("/app")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/app/:path*"],
};
