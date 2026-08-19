import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getUserWithTrackById, updateUser } from "@/lib/repositories/usersRepository";
import { listAttemptsForUser } from "@/lib/repositories/quizAttemptsRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { listActivePhases } from "@/lib/repositories/phasesRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { computeUserProgress } from "@/lib/services/userProgress";
import { buildOrderedModules } from "@/lib/services/trilhaView";
import { isUniqueViolation } from "@/lib/utils/dbErrors";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const { password_hash, ...user } = (await getUserWithTrackById(params.id)) ?? {};
  if (!("id" in user)) {
    return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
  }

  const [phases, modules, userModules, attempts, progress] = await Promise.all([
    listActivePhases(),
    listActiveModulesForTrack(user.track_id ?? null),
    listUserModules(user.id),
    listAttemptsForUser(user.id),
    computeUserProgress(user.id, user.track_id ?? null),
  ]);

  // Ordenar por ordem da FASE, depois ordem do módulo dentro dela —
  // listActiveModulesForTrack só ordena pelo campo `ordem` do módulo,
  // que reinicia a cada fase (Módulo 1 de fases diferentes ficavam
  // agrupados). buildOrderedModules já resolve isso (usada desde a Fase 6/7).
  const orderedModules = buildOrderedModules(phases, modules);
  const phaseById = new Map(phases.map((p) => [p.id, p]));

  // §13 — "Detalhe do usuário deve permitir consultar": módulo, material
  // acessado + data, concluído + data, tentativas, notas, melhor nota.
  const modulesDetail = orderedModules.map((m) => {
    const um = userModules.find((x) => x.module_id === m.id);
    const phase = phaseById.get(m.phase_id);
    return {
      module_id: m.id,
      nome: m.nome,
      ordem: m.ordem,
      phase_id: m.phase_id,
      phase_nome: phase?.nome ?? "—",
      phase_ordem: phase?.ordem ?? 0,
      has_questions: m.has_questions,
      unlocked_at: um?.unlocked_at ?? null,
      material_accessed: um?.material_accessed ?? false,
      material_accessed_at: um?.material_accessed_at ?? null,
      completed: um?.completed ?? false,
      completed_at: um?.completed_at ?? null,
      best_score: um?.best_score ?? null,
    };
  });

  return NextResponse.json({ ok: true, user, progress, modules: modulesDetail, attempts });
}

const updateUserSchema = z.object({
  nome_completo: z.string().trim().min(1).optional(),
  cd: z.string().trim().min(1).nullable().optional(),
  turno: z.string().trim().min(1).nullable().optional(),
  login: z.string().trim().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  // §11.4 — trilha/função não é editável. O schema acima simplesmente não
  // tem `track_id`, então qualquer tentativa de enviá-lo é ignorada aqui,
  // independente do que o cliente mandar no corpo da requisição.
  try {
    const { password_hash, ...user } = await updateUser(params.id, parsed.data);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ ok: false, error: "Esse login já está em uso." }, { status: 409 });
    }
    console.error("Erro ao editar usuário:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível salvar as alterações." },
      { status: 500 }
    );
  }
}
