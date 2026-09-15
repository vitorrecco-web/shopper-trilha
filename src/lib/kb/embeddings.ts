import "server-only";

/**
 * Cliente de embeddings do Gemini Developer API — server-only, chave
 * nunca chega ao cliente.
 *
 * MIGRAÇÃO OPENAI → GEMINI: `gemini-embedding-001` é o modelo estável
 * (GA) atual — `text-embedding-004` está sendo descontinuado pelo
 * Google e não deve ser usado em um projeto novo. `gemini-embedding-001`
 * usa Matryoshka Representation Learning (MRL): a dimensão "nativa" é
 * 3072, mas dá pra pedir uma saída truncada (768/1536/3072) sem perder
 * a propriedade de similaridade de cosseno. Usamos 768 — a própria
 * documentação do Google recomenda 768/1536/3072 como as opções de
 * melhor qualidade, e 768 é a mais barata em armazenamento/comparação.
 *
 * ATENÇÃO — risco real de custo/quota, documentado no
 * ASSISTENTE_SHOPPER_FASE1_CONFIGURACAO.md: diferente dos modelos de
 * GERAÇÃO (Flash/Flash-Lite), que têm Free Tier claro e generoso, o
 * Free Tier especificamente para EMBEDDINGS tem relatos de
 * inconsistência (alguns projetos recebem cota 0 mesmo estando no Free
 * Tier). Se a sincronização falhar com erro 429/RESOURCE_EXHAUSTED
 * logo na primeira rodada, isso é o motivo mais provável — nesse caso,
 * o preço pago é baixo ($0.15 por milhão de tokens de entrada), mas
 * não é zero garantido feito a geração de texto.
 */

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Precisa bater com `vector(768)` na migration 0005. */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Nº de textos por chamada — o endpoint batchEmbedContents aceita
 * várias entradas numa única requisição HTTP (conta como 1 request
 * pro limite de RPM, não N), o que ajuda a não estourar o RPM baixo do
 * Free Tier mesmo processando muitos chunks.
 */
const BATCH_SIZE = 50;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY ausente. Configure .env.local.");
  }
  return key;
}

interface GeminiBatchEmbedResponse {
  embeddings: { values: number[] }[];
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Header em vez de query string — evita a chave aparecer em log
      // de acesso/URL de proxy por engano.
      "x-goog-api-key": getApiKey(),
    },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
  });

  if (!res.ok) {
    // Nunca loga o corpo da requisição (contém texto dos documentos) —
    // só o status e um trecho curto da resposta de erro do Gemini.
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar embeddings no Gemini (HTTP ${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiBatchEmbedResponse;
  return data.embeddings.map((e) => e.values);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch);
    results.push(...embeddings);
  }
  return results;
}

export async function embedSingleText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
