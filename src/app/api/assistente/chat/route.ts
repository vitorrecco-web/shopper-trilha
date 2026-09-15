import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/getSession";
import { checkChatRateLimit } from "@/lib/kb/chatRateLimiter";
import { searchKnowledgeBase } from "@/lib/kb/kbSearchService";
import { generateAnswer, NAO_ENCONTREI } from "@/lib/kb/generation";

/**
 * Rota do Assistente Shopper — chat com RAG sobre a Base de
 * Conhecimento. Diferente de `/api/admin/kb/search` (admin-only,
 * Fase 1, só recuperação): esta rota é para QUALQUER usuário
 * autenticado, é o backend do widget flutuante.
 *
 * Fluxo: pergunta → busca no índice (kbSearchService, inalterado) →
 * filtra pelos chunks acima do limiar de score → pergunta + só esses
 * trechos vão pro Gemini → resposta + fontes. Nunca manda o Drive
 * inteiro nem documentos não relevantes para o modelo.
 */

/**
 * Limiar mínimo de score para considerar um chunk "evidência
 * suficiente". Valor inicial conservador — ainda não calibrado com
 * buscas reais da sua base (a troca de embeddings pra Gemini também
 * muda a escala de score em relação ao que foi observado com OpenAI).
 * Ajuste aqui depois de testar com perguntas reais.
 */
const MIN_SCORE_THRESHOLD = 0;
const TOP_K = 5;

const chatSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Digite uma pergunta.")
    .max(1000, "Pergunta muito longa (máximo de 1000 caracteres)."),
});

export interface ChatSource {
  arquivo: string;
  caminho: string;
  categoria: string;
  pagina: number | null;
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const rate = checkChatRateLimit(session.userId);
  if (!rate.allowed) {
    const message =
      rate.reason === "global"
        ? "O assistente está recebendo muitas perguntas ao mesmo tempo. Tente novamente em instantes."
        : "Você enviou muitas perguntas em pouco tempo. Aguarde um momento antes de tentar de novo.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds ?? 60) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  try {
    const results = await searchKnowledgeBase(parsed.data.question, TOP_K);
    const relevant = results.filter((r) => r.score >= MIN_SCORE_THRESHOLD);

    if (relevant.length === 0) {
      return NextResponse.json({ ok: true, answer: NAO_ENCONTREI, sources: [] });
    }

    const { answer } = await generateAnswer(
      parsed.data.question,
      relevant.map((r) => ({
        content: r.content,
        arquivo: r.arquivo,
        caminho: r.caminho,
        pagina: r.pageStart !== null ? String(r.pageStart) : null,
      }))
    );

    const sources: ChatSource[] = relevant.map((r) => ({
      arquivo: r.arquivo,
      caminho: r.caminho,
      categoria: r.categoria,
      pagina: r.pageStart,
    }));

    return NextResponse.json({ ok: true, answer, sources });
  } catch (err) {
    // Nunca loga a pergunta do usuário nem conteúdo de documento — só a
    // mensagem de erro técnica (do Gemini/Supabase), útil pra diagnóstico.
    console.error("Erro no Assistente Shopper:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível responder agora. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
