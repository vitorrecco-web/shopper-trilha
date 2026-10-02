import "server-only";
import { NextResponse } from "next/server";
import { StructureError } from "./structureService";
import { driveWriteErrorResponse } from "@/lib/drive/driveErrors";
import { isUniqueViolation } from "@/lib/utils/dbErrors";

/** Resposta padrão de erro das rotas de Admin > Estrutura. */
export function structureErrorResponse(err: unknown, fallbackMessage: string): NextResponse {
  if (err instanceof StructureError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  if (isUniqueViolation(err)) {
    return NextResponse.json(
      { ok: false, error: "Já existe um item com esses dados (número de fase ou nome repetido)." },
      { status: 409 }
    );
  }
  console.error(fallbackMessage, err instanceof Error ? err.message : err);
  return driveWriteErrorResponse(err, fallbackMessage);
}
