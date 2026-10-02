import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getModuleById } from "@/lib/repositories/modulesRepository";
import { startResumableUpload, GOOGLE_SLIDES_MIME } from "@/lib/drive/googleDriveClient";
import { driveWriteErrorResponse } from "@/lib/drive/driveErrors";
import { MAX_PDF_BYTES, MAX_PPTX_BYTES } from "@/lib/services/moduleMaterialService";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const bodySchema = z.object({
  moduleId: z.string().min(1),
  kind: z.enum(["pdf", "pptx"]),
  fileName: z.string().min(1).max(300),
  sizeBytes: z.number().int().positive(),
});

/**
 * Passo 1 do upload: cria a sessão resumível no Drive (dentro da pasta do
 * módulo) e devolve a URL — o NAVEGADOR envia o arquivo direto para ela
 * (nada de arquivo grande passando pela função do servidor). Depois chama
 * /finalizar. PowerPoint já é convertido em Google Slides no upload.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }
  const { moduleId, kind, fileName, sizeBytes } = parsed.data;

  const lower = fileName.toLowerCase();
  if (kind === "pdf" && !lower.endsWith(".pdf")) {
    return NextResponse.json({ ok: false, error: "Envie um arquivo .pdf." }, { status: 400 });
  }
  if (kind === "pptx" && !lower.endsWith(".pptx")) {
    return NextResponse.json({ ok: false, error: "Envie um arquivo .pptx (PowerPoint)." }, { status: 400 });
  }
  const max = kind === "pdf" ? MAX_PDF_BYTES : MAX_PPTX_BYTES;
  if (sizeBytes > max) {
    return NextResponse.json(
      { ok: false, error: `Arquivo acima do limite de ${Math.round(max / 1024 / 1024)} MB.` },
      { status: 400 }
    );
  }

  const module_ = await getModuleById(moduleId).catch(() => null);
  if (!module_) {
    return NextResponse.json({ ok: false, error: "Módulo não encontrado." }, { status: 404 });
  }

  try {
    const uploadUrl = await startResumableUpload({
      parentFolderId: module_.drive_folder_id,
      name: kind === "pdf" ? "__novo_material.pdf" : "__novo_material",
      targetMimeType: kind === "pdf" ? "application/pdf" : GOOGLE_SLIDES_MIME,
      uploadContentType: kind === "pdf" ? "application/pdf" : PPTX_MIME,
      sizeBytes,
      origin: request.headers.get("origin") ?? request.nextUrl.origin,
    });
    return NextResponse.json({
      ok: true,
      uploadUrl,
      contentType: kind === "pdf" ? "application/pdf" : PPTX_MIME,
    });
  } catch (err) {
    console.error("Erro ao iniciar upload no Drive:", err instanceof Error ? err.message : err);
    return driveWriteErrorResponse(err, "Não foi possível iniciar o envio para o Drive agora. Tente novamente.");
  }
}
