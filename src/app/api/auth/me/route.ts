import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/getSession";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    authenticated: true,
    role: session.role,
    nome: session.nome,
  });
}
