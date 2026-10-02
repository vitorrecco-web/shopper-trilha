import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listUsersWithTrack, createUser } from "@/lib/repositories/usersRepository";
import { listActiveTracksForProgram } from "@/lib/repositories/tracksRepository";
import {
  listActiveEnrollmentsForUsers,
  createOrReactivateEnrollment,
} from "@/lib/repositories/enrollmentsRepository";
import { hashPassword } from "@/lib/auth/password";
import { computeUsersProgressBatch } from "@/lib/services/userProgress";
import { isUniqueViolation } from "@/lib/utils/dbErrors";

export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const users = await listUsersWithTrack();
  const enrollmentsByUserId = await listActiveEnrollmentsForUsers(users.map((u) => u.id));
  const progressByUserId = await computeUsersProgressBatch(
    users.map((u) => ({
      id: u.id,
      enrollments: (enrollmentsByUserId.get(u.id) ?? []).map((e) => ({
        program_id: e.program_id,
        track_id: e.track_id,
      })),
    }))
  );

  const usersWithProgress = users.map(({ password_hash, ...user }) => ({
    ...user,
    enrollments: enrollmentsByUserId.get(user.id) ?? [],
    progress: progressByUserId.get(user.id) ?? { totalModules: 0, completedModules: 0, percent: null },
  }));

  return NextResponse.json({ ok: true, users: usersWithProgress });
}

const enrollmentInputSchema = z.object({
  program_id: z.string().uuid("Selecione um Programa."),
  track_id: z.string().uuid().optional().nullable(),
});

const createUserSchema = z.object({
  nome_completo: z.string().trim().min(1, "Informe o nome completo."),
  matricula: z.string().trim().min(1).optional().nullable(),
  login: z.string().trim().min(1, "Informe o login."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  // Perfil: aluno (com trilhas) ou um dos perfis sem travas (sem trilhas).
  role: z.enum(["student", "viewer", "analyst", "admin"]).default("student"),
  enrollments: z.array(enrollmentInputSchema).default([]),
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

  const { password, enrollments: rawEnrollments, ...rest } = parsed.data;

  // Perfis sem travas veem todos os Programas e não têm matrícula — qualquer
  // trilha enviada junto é ignorada; só o aluno exige pelo menos uma.
  const isStudent = rest.role === "student";
  const enrollments = isStudent ? rawEnrollments : [];
  if (isStudent && enrollments.length === 0) {
    return NextResponse.json({ ok: false, error: "Adicione pelo menos uma trilha." }, { status: 400 });
  }

  // Um Programa não pode se repetir na mesma lista (UNIQUE(user_id, program_id) rejeitaria na 2ª linha mesmo assim).
  const programIds = enrollments.map((e) => e.program_id);
  if (new Set(programIds).size !== programIds.length) {
    return NextResponse.json({ ok: false, error: "Cada Programa só pode aparecer uma vez na lista de trilhas." }, { status: 400 });
  }

  // Defesa em profundidade: cada `track_id` precisa pertencer ao Programa
  // daquela mesma linha — nunca confiar que o front só ofereceu opções válidas.
  for (const e of enrollments) {
    if (!e.track_id) continue;
    const tracksOfProgram = await listActiveTracksForProgram(e.program_id);
    if (!tracksOfProgram.some((t) => t.id === e.track_id)) {
      return NextResponse.json(
        { ok: false, error: "A Função selecionada não pertence ao Programa escolhido em uma das trilhas." },
        { status: 400 }
      );
    }
  }

  try {
    const password_hash = await hashPassword(password);
    const { password_hash: _omit, ...user } = await createUser({ ...rest, password_hash });

    for (const e of enrollments) {
      await createOrReactivateEnrollment({ user_id: user.id, program_id: e.program_id, track_id: e.track_id ?? null });
    }

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ ok: false, error: "Esse login já está em uso." }, { status: 409 });
    }
    console.error("Erro ao criar usuário:", err);
    return NextResponse.json({ ok: false, error: "Não foi possível criar o usuário." }, { status: 500 });
  }
}
