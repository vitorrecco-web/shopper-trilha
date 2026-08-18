import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { getGoogleDriveLister, getDriveRootFolderId } from "@/lib/drive/googleDriveClient";
import { mapTrilhaFromDrive } from "@/lib/drive/trilhaMapper";

/**
 * Fase 4 — só leitura. Mapeia a estrutura real do Drive e devolve como
 * JSON, sem gravar nada no banco (isso é a Fase 5, com prévia + confirmação
 * do admin). Critério de aceite: "aplicação consegue mapear a estrutura
 * real do Drive sem dar acesso aos alunos" — por isso esta rota exige
 * admin (guardada no middleware e de novo aqui).
 */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  let rootFolderId: string;
  try {
    rootFolderId = getDriveRootFolderId();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Configuração do Drive ausente.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  try {
    const lister = getGoogleDriveLister();
    const result = await mapTrilhaFromDrive(lister, rootFolderId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // Não vazar detalhes de credenciais/infra do Google ao cliente.
    console.error("Erro ao mapear estrutura do Drive:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível ler a estrutura do Drive agora. Verifique as credenciais e a permissão de acesso à pasta." },
      { status: 502 }
    );
  }
}
