import "server-only";
import { NextResponse } from "next/server";
import { requireActiveUserOrRespond } from "@/lib/auth/apiGuard";
import { getModuleAccessInfo } from "@/lib/services/moduleAccessService";
import { markCompletedWithoutQuiz } from "@/lib/repositories/userModulesRepository";
import { unlockNextModule } from "@/lib/services/progressionService";

/**
 * Ação explícita "Concluir módulo" para módulo de vídeo SEM quiz —
 * diferente do PDF, onde o próprio acesso já conclui automaticamente.
 * Aqui o aluno precisa clicar, e só depois de já ter atingido o
 * percentual mínimo assistido (revalidado aqui no servidor a partir do
 * que já foi persistido por /video-progress — esta rota não aceita um
 * percentual novo do cliente, só confirma o que já está salvo).
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireActiveUserOrRespond();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const access = await getModuleAccessInfo(user.id, user.track_id, params.id);
  if (!access || !access.unlocked || access.module.material_type !== "youtube") {
    return NextResponse.json({ ok: false, error: "Módulo não disponível." }, { status: 404 });
  }
  if (access.module.has_questions) {
    return NextResponse.json(
      { ok: false, error: "Este módulo tem quiz — a conclusão acontece ao ser aprovado nele." },
      { status: 400 }
    );
  }
  if (!access.videoThresholdReached) {
    return NextResponse.json(
      { ok: false, error: "Assista pelo menos o percentual mínimo do vídeo antes de concluir." },
      { status: 403 }
    );
  }

  await markCompletedWithoutQuiz(user.id, access.module.id);
  await unlockNextModule(user.id, user.track_id, access.module.id);

  return NextResponse.json({
    ok: true,
    nextModuleId: access.nextModuleId,
    nextModuleNome: access.nextModuleNome,
  });
}
