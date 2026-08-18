import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getUserWithTrackById, updateUser } from "@/lib/repositories/usersRepository";
import { listAttemptsForUser } from "@/lib/repositories/quizAttemptsRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { computeUserProgress } from "@/lib/services/userProgress";
import { isUniqueViolation } from "@/lib/utils/dbErrors";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const { password_hash, ...user } = (await getUserWithTrackById(params.id)) ?? {};
  if (!("id" in user)) {
    return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
  }

  const [modules, userModules, attempts, progress] = await Promise.all([
    listActiveModulesForTrack(user.track_id ?? null),
    listUserModules(user.id),
    listAttemptsForUser(user.id),
    computeUserProgress(user.id, user.track_id ?? null),
  ]);

  // §13 — "Detalhe do usuário deve permitir consultar": módulo, material
  // acessado + data, concluído + data, tentativas, notas, melhor nota.
  const modulesDetail = modules.map((m) => {
    const um = userModules.find((x) => x.module_id === m.id);
    return {
      module_id: m.id,
      nome: m.nome,
      ordem: m.ordem,
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
