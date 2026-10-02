import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getModuleById } from "@/lib/repositories/modulesRepository";
import { finalizePdfUpload, finalizePptxUpload, ContentError } from "@/lib/services/moduleMaterialService";
import { driveWriteErrorResponse } from "@/lib/drive/driveErrors";

// Exportar o PowerPoint para PDF pode levar alguns segundos.
export const maxDuration = 60;

const bodySchema = z.object({
  moduleId: z.string().min(1),
  kind: z.enum(["pdf", "pptx"]),
  fileId: z.string().min(1),
  titulo: z.string().min(1).max(300),
});

/** Passo 2 do upload: confere o arquivo na pasta do módulo, converte (PowerPoint -> PDF), remove o material anterior e atualiza o banco. */
export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const module_ = await getModuleById(parsed.data.moduleId).catch(() => null);
  if (!module_) {
    return NextResponse.json({ ok: false, error: "Módulo não encontrado." }, { status: 404 });
  }

  try {
    const result =
      parsed.data.kind === "pdf"
        ? await finalizePdfUpload(module_, parsed.data.fileId, parsed.data.titulo)
        : await finalizePptxUpload(module_, parsed.data.fileId, parsed.data.titulo);
    return NextResponse.json({ ok: true, nome: result.nome });
  } catch (err) {
    if (err instanceof ContentError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("Erro ao finalizar material:", err instanceof Error ? err.message : err);
    return driveWriteErrorResponse(
      err,
      "Não foi possível concluir o envio agora. Nada foi alterado no módulo — tente novamente."
    );
  }
}
