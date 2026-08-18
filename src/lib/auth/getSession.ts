import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "./session";

/**
 * Lê a sessão atual a partir dos cookies da requisição (Server Components,
 * Route Handlers, Server Actions). Retorna null se não houver sessão válida.
 */
export async function getCurrentSession(): Promise<IronSession<SessionData> | null> {
  const session = await getIronSession<SessionData>(cookies(), getSessionOptions());
  if (!session.userId) return null;
  return session;
}

export async function requireSession(): Promise<IronSession<SessionData>> {
  const session = await getCurrentSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireAdminSession(): Promise<IronSession<SessionData>> {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}
