import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getModuleById, setModuleHasQuestions } from "@/lib/repositories/modulesRepository";
import { updateDriveFileContent } from "@/lib/drive/googleDriveClient";
import { validatePerguntasJson } from "@/lib/drive/validatePerguntas";

/**
 * Salva o perguntas.json editado direto no Drive (mesmo fileId do
 * módulo) — elimina o passo de baixar e fazer upload manual. Nunca
 * escreve no Drive sem validar antes com a MESMA `validatePerguntasJson`
 * usada pelo sync e pela rota /validar, para nunca publicar um JSON
 * inválido (que derrubaria o quiz do módulo para os alunos).
 */
const bodySchema = z.object({
  moduleId: z.string().min(1),
  perguntas: z.unknown(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const validation = validatePerguntasJson(JSON.stringify(parsed.data.perguntas));
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: `perguntas.json inválido, nada foi salvo: ${validation.error}` },
      { status: 400 }
    );
  }

  let module_;
  try {
    module_ = await getModuleById(parsed.data.moduleId);
  } catch (err) {
    console.error("Erro ao buscar módulo para salvar perguntas:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível carregar o módulo agora." }, { status: 503 });
  }

  if (!module_) {
    return NextResponse.json({ ok: false, error: "Módulo não encontrado." }, { status: 404 });
  }
  if (!module_.questions_drive_id) {
    return NextResponse.json(
      { ok: false, error: "Este módulo não possui perguntas.json mapeado no Drive." },
      { status: 404 }
    );
  }

  try {
    const content = JSON.stringify(validation.data, null, 2);
    await updateDriveFileContent(module_.questions_drive_id, content);
  } catch (err) {
    console.error("Erro ao salvar perguntas.json no Drive:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível salvar no Drive agora. Nada foi alterado — tente novamente." },
      { status: 502 }
    );
  }

  try {
    await setModuleHasQuestions(module_.id, true);
  } catch (err) {
    // O arquivo já foi salvo no Drive com sucesso — só a flag local do
    // banco (has_questions) não atualizou. Próxima sincronização completa
    // corrige sozinha; não é motivo para reportar falha ao admin.
    console.error("Salvo no Drive, mas falhou ao atualizar has_questions:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, questionCount: validation.data.perguntas.length });
}
