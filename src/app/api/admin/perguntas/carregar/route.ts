import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getModuleById } from "@/lib/repositories/modulesRepository";
import { fetchDriveFileAsText } from "@/lib/drive/googleDriveClient";
import { validatePerguntasJson } from "@/lib/drive/validatePerguntas";

/**
 * Carrega o perguntas.json ATUAL do Drive para edição no Admin. Devolve
 * o JSON completo (com `correta`) — diferente das rotas de aluno, aqui
 * é intencional: esta rota é admin-only (guardada pelo middleware e de
 * novo por requireAdminOrRespond) e o objetivo explícito é editar o
 * gabarito, não escondê-lo.
 *
 * Se o arquivo estiver malformado/inválido, ainda assim devolve ok:true
 * com a validação indicando o erro — o editor abre vazio em vez de
 * quebrar, para o admin poder recomeçar a partir daqui.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  const moduleId = request.nextUrl.searchParams.get("moduleId");
  if (!moduleId) {
    return NextResponse.json({ ok: false, error: "Parâmetro 'moduleId' obrigatório." }, { status: 400 });
  }

  let module_;
  try {
    module_ = await getModuleById(moduleId);
  } catch (err) {
    console.error("Erro ao buscar módulo para editor de perguntas:", err instanceof Error ? err.message : err);
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
    const raw = await fetchDriveFileAsText(module_.questions_drive_id);
    const validation = validatePerguntasJson(raw);

    let perguntasJson: unknown;
    try {
      perguntasJson = JSON.parse(raw);
    } catch {
      perguntasJson = { perguntas: [] };
    }

    return NextResponse.json({
      ok: true,
      moduleNome: module_.nome,
      perguntasJson,
      validation: validation.ok ? { ok: true } : { ok: false, error: validation.error },
    });
  } catch (err) {
    console.error("Erro ao ler perguntas.json do Drive:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível ler o arquivo no Drive agora." },
      { status: 502 }
    );
  }
}
