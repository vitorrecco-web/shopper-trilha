import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";

/**
 * Guards de rota (EXECUTION_PLAN Fase 2, item 6; estendido na Fase 3
 * para cobrir /api/admin/**, e na Fase 8 para /api/modulos/**):
 * - /admin/**       exige role === "admin"
 * - /api/admin/**   idem — cada rota também revalida via requireAdminOrRespond,
 *                   isto aqui é a primeira camada, não a única.
 * - /app/**         exige qualquer sessão válida (admin ou student)
 * - /api/modulos/** idem — cada rota também revalida acesso ao módulo
 *                   específico (getModuleAccessInfo), isto aqui só
 *                   garante que existe uma sessão.
 * - /login          se já autenticado, redireciona para a home certa
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

  if (pathname.startsWith("/api/admin")) {
    if (!isAuthenticated) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Acesso restrito ao administrador." }, { status: 403 });
    }
    return response;
  }

  if (pathname.startsWith("/api/modulos")) {
    if (!isAuthenticated) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
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
  matcher: ["/login", "/admin/:path*", "/api/admin/:path*", "/api/modulos/:path*", "/app/:path*"],
};
