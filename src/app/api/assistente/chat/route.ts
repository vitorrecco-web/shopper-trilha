import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/getSession";
import { checkChatRateLimit } from "@/lib/kb/chatRateLimiter";
import { searchKnowledgeBase } from "@/lib/kb/kbSearchService";
import { generateAnswer, generateSearchQueries, PRECISO_DE_MAIS_CONTEXTO } from "@/lib/kb/generation";

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
  reviewQuestions: z.array(z.string().trim().min(1).max(1000)).max(10).optional(),

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
    const question = parsed.data.question;

    // Modo de revisão após reprovação no quiz.
    // Cada questão errada é buscada separadamente para evitar transformar
    // várias dúvidas diferentes em uma única consulta textual gigante.
    if (parsed.data.reviewQuestions?.length) {
      const reviewQuestions = parsed.data.reviewQuestions.slice(0, 10);

      const reviewSearches = await Promise.all(
        reviewQuestions.map((reviewQuestion) =>
          searchKnowledgeBase(reviewQuestion, TOP_K)
        )
      );

      const byChunkId = new Map<
        string,
        (typeof reviewSearches)[number][number]
      >();

      for (const result of reviewSearches.flat()) {
        if (result.score < MIN_SCORE_THRESHOLD) continue;

        const current = byChunkId.get(result.chunkId);

        if (!current || result.score > current.score) {
          byChunkId.set(result.chunkId, result);
        }
      }

      const reviewResults = Array.from(byChunkId.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      if (reviewResults.length === 0) {
        return NextResponse.json({
          ok: true,
          answer:
            "Não consegui localizar material suficiente para revisar essas questões. Tente abrir o material do módulo ou me pergunte sobre um dos assuntos separadamente.",
          sources: [],
        });
      }

      const reviewPrompt = `Ajude o usuário a revisar os assuntos relacionados às questões que ele errou em uma avaliação.

QUESTÕES ERRADAS:
${reviewQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Monte uma revisão didática usando SOMENTE o contexto dos documentos fornecidos.

Regras:
- Não informe qual alternativa era a correta.
- Não entregue um gabarito.
- Explique os conceitos e procedimentos necessários para a pessoa aprender.
- Organize a revisão em tópicos claros.
- Quando houver vários assuntos, separe-os.
- Seja objetivo, mas suficientemente explicativo para ajudar em uma nova tentativa.`;

      const { answer } = await generateAnswer(
        reviewPrompt,
        reviewResults.map((r) => ({
          content: r.content,
          arquivo: r.arquivo,
          caminho: r.caminho,
          pagina: r.pageStart !== null ? String(r.pageStart) : null,
        }))
      );

      return NextResponse.json({
        ok: true,
        answer,
        sources: [],
      });
    }

    // Primeiro tenta a pergunta exatamente como o usuário escreveu.
    const directResults = await searchKnowledgeBase(question, TOP_K);
    let relevant = directResults.filter((r) => r.score >= MIN_SCORE_THRESHOLD);

    // Se a busca direta não encontrar nada, o Gemini reformula a
    // intenção em consultas curtas, aproximando a linguagem natural
    // do usuário da terminologia encontrada nos documentos.
    if (relevant.length === 0) {
      const alternativeQueries = await generateSearchQueries(question);

      if (alternativeQueries.length > 0) {
        const expandedResults = await Promise.all(
          alternativeQueries.map((query) => searchKnowledgeBase(query, TOP_K))
        );

        // O mesmo trecho pode aparecer em mais de uma consulta.
        // Mantemos apenas uma cópia e preservamos o melhor score.
        const byChunkId = new Map<string, (typeof directResults)[number]>();

        for (const result of expandedResults.flat()) {
          if (result.score < MIN_SCORE_THRESHOLD) continue;

          const current = byChunkId.get(result.chunkId);

          if (!current || result.score > current.score) {
            byChunkId.set(result.chunkId, result);
          }
        }

        relevant = Array.from(byChunkId.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_K);
      }
    }

    if (relevant.length === 0) {
      return NextResponse.json({ ok: true, answer: PRECISO_DE_MAIS_CONTEXTO, sources: [] });
    }

    const { answer } = await generateAnswer(
      question,
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
      { ok: false, error: "Tive dificuldade para localizar essa informação do jeito que a pergunta foi escrita. Tente reformular com um pouco mais de contexto." },
      { status: 500 }
    );
  }
}
