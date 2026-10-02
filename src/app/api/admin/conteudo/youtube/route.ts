import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getModuleById } from "@/lib/repositories/modulesRepository";
import { setYoutubeMaterial, ContentError } from "@/lib/services/moduleMaterialService";
import { driveWriteErrorResponse } from "@/lib/drive/driveErrors";

const bodySchema = z.object({
  moduleId: z.string().min(1),
  url: z.string().min(1).max(500),
  titulo: z.string().min(1).max(300),
});

/** Define o material do módulo como vídeo do YouTube: grava o video.json na pasta e remove o PDF anterior. */
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
    const result = await setYoutubeMaterial(module_, parsed.data.url, parsed.data.titulo);
    return NextResponse.json({ ok: true, nome: result.nome, videoId: result.videoId });
  } catch (err) {
    if (err instanceof ContentError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("Erro ao salvar vídeo do módulo:", err instanceof Error ? err.message : err);
    return driveWriteErrorResponse(err, "Não foi possível salvar o vídeo agora. Tente novamente.");
  }
}
