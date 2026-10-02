import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { renameEntity, removeEntity, type StructureKind } from "@/lib/services/structureService";
import { structureErrorResponse } from "@/lib/services/structureHttp";

const kinds: StructureKind[] = ["programa", "fase", "funcao", "modulo"];

function parseKind(tipo: string): StructureKind | null {
  return (kinds as string[]).includes(tipo) ? (tipo as StructureKind) : null;
}

const renameSchema = z.object({ nome: z.string().min(1).max(200) });

/** Renomeia (pasta do Drive + linha do banco). */
export async function PATCH(request: NextRequest, { params }: { params: { tipo: string; id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const kind = parseKind(params.tipo);
  if (!kind) return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });

  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Informe o novo nome." }, { status: 400 });

  try {
    await renameEntity(kind, params.id, parsed.data.nome);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return structureErrorResponse(err, "Não foi possível renomear agora.");
  }
}

/** Remove: pasta para a lixeira do Drive (reversível) + soft-delete no banco, em cascata. */
export async function DELETE(_request: NextRequest, { params }: { params: { tipo: string; id: string } }) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const kind = parseKind(params.tipo);
  if (!kind) return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });

  try {
    await removeEntity(kind, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return structureErrorResponse(err, "Não foi possível remover agora.");
  }
}
