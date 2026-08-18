import "server-only";
import type { SessionOptions } from "iron-session";

/**
 * Sessão: apenas o essencial para autorização (§14 do PROJECT_CONTEXT —
 * autenticação própria com sessão segura via cookie httpOnly).
 *
 * Nunca guardar password_hash aqui. O cookie é assinado/criptografado
 * pelo iron-session usando SESSION_SECRET — sem esse segredo, o
 * conteúdo não pode ser forjado nem lido.
 */
export interface SessionData {
  userId: string;
  role: "admin" | "student";
  nome: string;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres). Gere com: openssl rand -base64 32"
    );
  }
  return secret;
}

export const sessionCookieName = "shopper_trilha_session";

export function getSessionOptions(): SessionOptions {
  return {
    password: getSessionSecret(),
    cookieName: sessionCookieName,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      // 7 dias — sem "lembrar de mim" na V1, todo login dura o mesmo tempo.
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    },
  };
}
