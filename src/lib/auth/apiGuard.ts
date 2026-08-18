import "server-only";
import { NextResponse } from "next/server";
import type { IronSession } from "iron-session";
import { requireAdminSession } from "./getSession";
import type { SessionData } from "./session";

/**
 * Para usar em Route Handlers: se não autenticado ou não-admin, já
 * devolve a Response certa; senão devolve a sessão para a rota seguir.
 *
 * Complementa (não substitui) o middleware — mesma lógica de defesa
 * em profundidade usada nas páginas /app e /admin.
 */
export async function requireAdminOrRespond(): Promise<
  { session: IronSession<SessionData> } | { response: NextResponse }
> {
  try {
    const session = await requireAdminSession();
    return { session };
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return {
        response: NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }),
      };
    }
    return {
      response: NextResponse.json(
        { ok: false, error: "Acesso restrito ao administrador." },
        { status: 403 }
      ),
    };
  }
}
