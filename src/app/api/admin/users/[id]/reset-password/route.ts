import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getUserById, updatePasswordHash } from "@/lib/repositories/usersRepository";
import { hashPassword } from "@/lib/auth/password";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

/**
 * §11.2 — "admin pode redefinir senha" / "senha nunca é armazenada em
 * texto puro". Rota dedicada (em vez de fazer parte do PATCH geral) para
 * deixar claro no log/auditoria que essa é uma ação distinta e sensível.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const user = await getUserById(params.id);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
  }

  const password_hash = await hashPassword(parsed.data.password);
  await updatePasswordHash(params.id, password_hash);

  return NextResponse.json({ ok: true });
}
