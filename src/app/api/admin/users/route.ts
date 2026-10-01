import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listUsersWithTrack, createUser } from "@/lib/repositories/usersRepository";
import { listActiveTracksForProgram } from "@/lib/repositories/tracksRepository";
import { hashPassword } from "@/lib/auth/password";
import { computeUserProgress } from "@/lib/services/userProgress";
import { isUniqueViolation } from "@/lib/utils/dbErrors";

export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const users = await listUsersWithTrack();

  const usersWithProgress = await Promise.all(
    users.map(async ({ password_hash, ...user }) => ({
      ...user,
      progress: await computeUserProgress(user.id, user.program_id, user.track_id),
    }))
  );

  return NextResponse.json({ ok: true, users: usersWithProgress });
}

const createUserSchema = z.object({
  nome_completo: z.string().trim().min(1, "Informe o nome completo."),
  matricula: z.string().trim().min(1).optional().nullable(),
  login: z.string().trim().min(1, "Informe o login."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  program_id: z.string().uuid("Selecione um Programa."),
  track_id: z.string().uuid().optional().nullable(),
  cd: z.string().trim().min(1).optional().nullable(),
  turno: z.string().trim().min(1).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function POST(request: Request) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const { password, track_id, ...rest } = parsed.data;

  // Defesa em profundidade: `track_id` precisa pertencer ao Programa
  // escolhido — nunca confiar que o front só ofereceu opções válidas.
  if (track_id) {
    const tracksOfProgram = await listActiveTracksForProgram(rest.program_id);
    if (!tracksOfProgram.some((t) => t.id === track_id)) {
      return NextResponse.json(
        { ok: false, error: "A Função selecionada não pertence ao Programa escolhido." },
        { status: 400 }
      );
    }
  }

  try {
    const password_hash = await hashPassword(password);
    const { password_hash: _omit, ...user } = await createUser({ ...rest, track_id, password_hash });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ ok: false, error: "Esse login já está em uso." }, { status: 409 });
    }
    console.error("Erro ao criar usuário:", err);
    return NextResponse.json({ ok: false, error: "Não foi possível criar o usuário." }, { status: 500 });
  }
}
