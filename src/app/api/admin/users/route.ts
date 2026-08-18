import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listUsersWithTrack, createUser } from "@/lib/repositories/usersRepository";
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
      progress: await computeUserProgress(user.id, user.track_id),
    }))
  );

  return NextResponse.json({ ok: true, users: usersWithProgress });
}

const createUserSchema = z.object({
  nome_completo: z.string().trim().min(1, "Informe o nome completo."),
  matricula: z.string().trim().min(1).optional().nullable(),
  login: z.string().trim().min(1, "Informe o login."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  track_id: z.string().uuid("Selecione uma trilha."),
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

  const { password, ...rest } = parsed.data;

  try {
    const password_hash = await hashPassword(password);
    const { password_hash: _omit, ...user } = await createUser({ ...rest, password_hash });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ ok: false, error: "Esse login já está em uso." }, { status: 409 });
    }
    console.error("Erro ao criar usuário:", err);
    return NextResponse.json({ ok: false, error: "Não foi possível criar o usuário." }, { status: 500 });
  }
}
