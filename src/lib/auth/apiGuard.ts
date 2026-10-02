import "server-only";
import { NextResponse } from "next/server";
import type { IronSession } from "iron-session";
import { requireAdminSession, getCurrentSession } from "./getSession";
import type { SessionData } from "./session";
import type { User } from "@/lib/db/types";
import { getUserById } from "@/lib/repositories/usersRepository";
import { resolveActiveEnrollment } from "@/lib/services/activeEnrollmentService";

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
 * Resolve a matrícula ativa (`resolveActiveEnrollment`) e já devolve
 * `programId`/`trackId` prontos — essas rotas são só de aluno (quiz, PDF,
 * progresso de vídeo). Um aluno com 2+ trilhas e NENHUMA escolhida ainda
 * na sessão (`reason: "choose_program"`) não deveria bater aqui numa
 * navegação normal (a página sempre manda pra /app/trilhas antes) — só
 * acontece com uma aba antiga aberta; a API recusa com um motivo
 * reconhecível em vez de adivinhar qual trilha usar.
 */
export async function requireActiveUserOrRespond(): Promise<
  { user: User; programId: string; trackId: string | null } | { response: NextResponse }
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

    const active = await resolveActiveEnrollment(user.id, session.activeProgramId);
    if (active.status === "none") {
      return {
        response: NextResponse.json(
          { ok: false, error: "Usuário sem nenhuma trilha atribuída.", reason: "no_enrollment" },
          { status: 403 }
        ),
      };
    }
    if (active.status === "choose") {
      return {
        response: NextResponse.json(
          { ok: false, error: "Escolha uma trilha antes de continuar.", reason: "choose_program" },
          { status: 409 }
        ),
      };
    }

    return { user, programId: active.enrollment.programId, trackId: active.enrollment.trackId };
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
