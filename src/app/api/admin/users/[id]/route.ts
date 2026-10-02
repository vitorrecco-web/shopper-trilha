import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getUserById, updateUser } from "@/lib/repositories/usersRepository";
import { listActiveEnrollmentsForUser } from "@/lib/repositories/enrollmentsRepository";
import { listAttemptsForUser } from "@/lib/repositories/quizAttemptsRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { listActivePhases } from "@/lib/repositories/phasesRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { computeUsersProgressBatch } from "@/lib/services/userProgress";
import { buildOrderedModules } from "@/lib/services/trilhaView";
import { isUniqueViolation } from "@/lib/utils/dbErrors";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const { password_hash, ...user } = (await getUserById(params.id)) ?? {};
  if (!("id" in user)) {
    return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
  }

  const [enrollments, userModules, attempts] = await Promise.all([
    listActiveEnrollmentsForUser(user.id),
    listUserModules(user.id),
    listAttemptsForUser(user.id),
  ]);

  const progressByUserId = await computeUsersProgressBatch([
    { id: user.id, enrollments: enrollments.map((e) => ({ program_id: e.program_id, track_id: e.track_id })) },
  ]);
  const progress = progressByUserId.get(user.id) ?? { totalModules: 0, completedModules: 0, percent: null };

  // §13 — "Detalhe do usuário deve permitir consultar": módulo, material
  // acessado + data, concluído + data, tentativas, notas, melhor nota —
  // agora somando TODAS as matrículas ativas da pessoa, cada módulo já
  // identificado por qual Programa/trilha ele pertence.
  const modulesDetail: Array<{
    module_id: string;
    nome: string;
    ordem: number;
    phase_id: string;
    phase_nome: string;
    phase_ordem: number;
    program_nome: string;
    has_questions: boolean;
    unlocked_at: string | null;
    material_accessed: boolean;
    material_accessed_at: string | null;
    completed: boolean;
    completed_at: string | null;
    best_score: number | null;
  }> = [];

  for (const enrollment of enrollments) {
    const [phases, modules] = await Promise.all([
      listActivePhases(enrollment.program_id),
      listActiveModulesForTrack(enrollment.program_id, enrollment.track_id),
    ]);
    // buildOrderedModules ordena por ordem da FASE, depois ordem do
    // módulo dentro dela (já usada desde a Fase 6/7 em "Minha Trilha").
    const orderedModules = buildOrderedModules(phases, modules);
    const phaseById = new Map(phases.map((p) => [p.id, p]));

    for (const m of orderedModules) {
      const um = userModules.find((x) => x.module_id === m.id);
      const phase = phaseById.get(m.phase_id);
      modulesDetail.push({
        module_id: m.id,
        nome: m.nome,
        ordem: m.ordem,
        phase_id: m.phase_id,
        phase_nome: phase?.nome ?? "—",
        phase_ordem: phase?.ordem ?? 0,
        program_nome: enrollment.program_nome,
        has_questions: m.has_questions,
        unlocked_at: um?.unlocked_at ?? null,
        material_accessed: um?.material_accessed ?? false,
        material_accessed_at: um?.material_accessed_at ?? null,
        completed: um?.completed ?? false,
        completed_at: um?.completed_at ?? null,
        best_score: um?.best_score ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true, user, enrollments, progress, modules: modulesDetail, attempts });
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

  // §11.4 — uma matrícula existente não é editável depois de criada. O
  // schema acima não tem nenhum campo de trilha/função; adicionar ou
  // remover uma trilha é feito por `/api/admin/users/[id]/enrollments`.
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
