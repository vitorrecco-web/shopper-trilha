import "server-only";
import { NextResponse } from "next/server";

/**
 * Causa mais comum de falha ao ESCREVER no Drive: GOOGLE_OAUTH_REFRESH_TOKEN
 * gerado só com o escopo drive.readonly — a leitura continua funcionando,
 * mas toda escrita volta 403. Mesma orientação usada em perguntas/salvar.
 */
export function driveWriteErrorResponse(err: unknown, fallbackMessage: string): NextResponse {
  const status =
    (err as { response?: { status?: number } })?.response?.status ?? (err as { code?: number })?.code;

  if (status === 403) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Sem permissão de escrita no Drive — o token OAuth atual foi gerado só para leitura. Gere um novo GOOGLE_OAUTH_REFRESH_TOKEN com o escopo https://www.googleapis.com/auth/drive (ver README, seção 'Configurar o acesso ao Google Drive') e atualize a variável de ambiente.",
      },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: false, error: fallbackMessage }, { status: 502 });
}
