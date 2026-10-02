import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/roles";

/**
 * Guards de rota (EXECUTION_PLAN Fase 2, item 6; estendido na Fase 3
 * para cobrir /api/admin/**, na Fase 8 para /api/modulos/**, e agora
 * para /api/assistente/** — o backend do widget de chat):
 * - /admin/**       exige role === "admin" — exceto o hub /admin e
 *                   /admin/indicadores/**, que "analyst" também acessa
 *                   (somente leitura; cada página revalida o papel).
 * - /api/admin/**   só "admin" — cada rota também revalida via requireAdminOrRespond,
 *                   isto aqui é a primeira camada, não a única.
 * - /app/**         exige qualquer sessão válida (qualquer papel)
 * - /api/modulos/** idem — cada rota também revalida acesso ao módulo
 *                   específico (getModuleAccessInfo), isto aqui só
 *                   garante que existe uma sessão.
 * - /api/assistente/** idem — qualquer usuário autenticado (admin ou
 *                   student), a rota em si também revalida a sessão.
 * - /api/app/**     idem — hoje só /api/app/escolher-trilha (grava qual
 *                   matrícula o aluno está usando nesta sessão).
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
      return NextResponse.redirect(new URL(homePathForRole(session.role), request.url));
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

  if (pathname.startsWith("/api/modulos") || pathname.startsWith("/api/assistente") || pathname.startsWith("/api/app")) {
    if (!isAuthenticated) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    return response;
  }

  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.role === "admin") return response;
    if (session.role === "analyst") {
      const allowed = pathname === "/admin" || pathname.startsWith("/admin/indicadores");
      return allowed ? response : NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.redirect(new URL("/app", request.url));
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
  matcher: [
    "/login",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/modulos/:path*",
    "/api/assistente/:path*",
    "/api/app/:path*",
    "/app/:path*",
  ],
};
