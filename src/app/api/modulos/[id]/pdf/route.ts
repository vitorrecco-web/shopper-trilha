import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { getModuleAccessInfo } from "@/lib/services/moduleAccessService";
import { markMaterialAccessed, markCompletedWithoutQuiz } from "@/lib/repositories/userModulesRepository";
import { unlockNextModule } from "@/lib/services/progressionService";
import { fetchDriveFileAsBuffer } from "@/lib/drive/googleDriveClient";

/**
 * Fase 8, tarefas 2-3, 6-7 e critério de aceite: serve o PDF só depois
 * de validar sessão + autorização (módulo aplicável e liberado para
 * este usuário) — o aluno nunca recebe a URL do Drive, e um módulo
 * bloqueado não pode ser baixado nem por chamada direta a esta rota.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") {
    return NextResponse.json({ ok: false, error: "Usuário inválido." }, { status: 401 });
  }

  const access = await getModuleAccessInfo(user.id, user.track_id, params.id);

  // Mesma resposta para "não existe/não aplicável" e "existe mas está
  // bloqueado" — não revela qual dos dois casos é.
  if (!access || !access.unlocked || !access.module.pdf_drive_id) {
    return NextResponse.json({ ok: false, error: "Módulo não disponível." }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await fetchDriveFileAsBuffer(access.module.pdf_drive_id);
  } catch (err) {
    console.error("Erro ao buscar PDF do Drive:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar o material agora." },
      { status: 502 }
    );
  }

  // §9: primeiro acesso ao visualizador registra material_accessed + data/hora.
  const wasAlreadyAccessed = access.materialAccessed;
  await markMaterialAccessed(user.id, access.module.id);

  // Fase 8, tarefa 7 / §3.3: sem perguntas, o primeiro acesso já conclui
  // o módulo e libera o próximo.
  if (!wasAlreadyAccessed && !access.module.has_questions) {
    await markCompletedWithoutQuiz(user.id, access.module.id);
    await unlockNextModule(user.id, user.track_id, access.module.id);
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const filename = (access.module.pdf_nome ?? "material.pdf").replace(/["\r\n]/g, "");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      // §9: não é preciso cachear — e melhor não cachear conteúdo autorizado por sessão.
      "Cache-Control": "private, no-store",
    },
  });
}
