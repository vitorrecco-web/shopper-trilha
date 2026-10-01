import "server-only";
import { NextResponse } from "next/server";
import type { IronSession } from "iron-session";
import { requireAdminSession, getCurrentSession } from "./getSession";
import type { SessionData } from "./session";
import type { User } from "@/lib/db/types";
import { getUserById } from "@/lib/repositories/usersRepository";

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

/**
 * Para rotas como /api/modulos/** (Fase 8/9): exige qualquer sessão
 * válida + usuário ativo, com erro de banco tratado (débito técnico
 * anotado nas Fases 8/9, resolvido na Fase 11 — tarefa 6, tratamento de
 * erros). Nunca vaza detalhe de infraestrutura ao cliente.
 *
 * `program_id` precisa existir aqui — essas rotas são só de aluno (quiz,
 * PDF, progresso de vídeo), e um aluno sempre tem Programa atribuído na
 * criação (§ cadastro em /admin/usuarios/novo). `program_id` nulo só
 * acontece para admin (mesmo padrão de `track_id`) — um admin batendo
 * numa rota de aluno é tratado como acesso inválido, não como bug.
 */
export async function requireActiveUserOrRespond(): Promise<
  { user: User & { program_id: string } } | { response: NextResponse }
> {
  const session = await getCurrentSession();
  if (!session) {
    return { response: NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }) };
  }

  try {
    const user = await getUserById(session.userId);
    if (!user || user.status === "inactive") {
      return { response: NextResponse.json({ ok: false, error: "Usuário inválido." }, { status: 401 }) };
    }
    if (!user.program_id) {
      return { response: NextResponse.json({ ok: false, error: "Usuário sem Programa atribuído." }, { status: 403 }) };
    }
    return { user: { ...user, program_id: user.program_id } };
  } catch (err) {
    console.error("Erro ao carregar usuário da sessão:", err);
    return {
      response: NextResponse.json(
        { ok: false, error: "Não foi possível processar a requisição agora. Tente novamente." },
        { status: 503 }
      ),
    };
  }
}
