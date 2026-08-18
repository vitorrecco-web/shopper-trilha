import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getUserByLogin, touchLastLogin } from "@/lib/repositories/usersRepository";
import { checkLoginRateLimit } from "@/lib/auth/rateLimiter";

const loginSchema = z.object({
  login: z.string().trim().min(1, "Informe o login"),
  password: z.string().min(1, "Informe a senha"),
});

function getClientIp(request: NextRequest): string {
  // Vercel injeta x-forwarded-for; em dev local cai no fallback.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Regras aplicadas aqui (PROJECT_CONTEXT §11, EXECUTION_PLAN Fase 2;
 * rate limiting adicionado na Fase 11):
 * - login é único, case-insensitive (busca via ILIKE no repositório).
 * - usuário inativo não consegue logar.
 * - senha nunca é retornada em nenhuma resposta, em nenhum cenário.
 * - mensagem de erro genérica para login inexistente/senha errada,
 *   para não revelar quais logins existem no sistema.
 * - até 5 tentativas por IP a cada 5 minutos (ver rateLimiter.ts para
 *   a limitação conhecida em ambiente serverless).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 300) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const { login, password } = parsed.data;

  let user;
  try {
    user = await getUserByLogin(login);
  } catch (err) {
    // Não vazar detalhes de infraestrutura (ex: banco inacessível) ao cliente.
    console.error("Erro ao consultar usuário no login:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível processar o login agora. Tente novamente em instantes." },
      { status: 503 }
    );
  }

  const GENERIC_ERROR = "Login ou senha incorretos.";

  if (!user) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  if (user.status === "inactive") {
    return NextResponse.json(
      { ok: false, error: "Usuário inativo. Fale com o administrador." },
      { status: 403 }
    );
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    role: user.role,
    nome: user.nome_completo,
  });

  const session = await getIronSession<SessionData>(request, response, getSessionOptions());
  session.userId = user.id;
  session.role = user.role;
  session.nome = user.nome_completo;
  await session.save();

  try {
    await touchLastLogin(user.id);
  } catch (err) {
    // Falha ao atualizar last_login_at não deve impedir o login em si.
    console.error("Erro ao atualizar last_login_at:", err);
  }

  return response;
}
