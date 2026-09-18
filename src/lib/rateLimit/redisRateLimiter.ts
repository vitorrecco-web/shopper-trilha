import "server-only";

/**
 * Rate limiting compartilhado via Upstash Redis (REST API) — substitui a
 * limitação conhecida das versões em memória anteriores (rateLimiter.ts
 * do login, chatRateLimiter.ts do assistente): em serverless (Vercel),
 * cada instância fria tinha sua própria memória, então o limite não era
 * garantido entre múltiplas instâncias simultâneas.
 *
 * Sem dependência de SDK — chama a REST API do Upstash diretamente via
 * fetch (mesmo padrão já usado em src/lib/kb/generation.ts para o
 * Gemini), evitando adicionar uma dependência nova só para isso.
 *
 * Se UPSTASH_REDIS_REST_URL/TOKEN não estiverem configuradas, ou se a
 * chamada ao Redis falhar por qualquer motivo, cai automaticamente para
 * o fallback em memória — nunca derruba login nem assistente por causa
 * do rate limiter.
 *
 * Algoritmo: janela fixa (fixed window) via INCR + PEXPIRE NX — o TTL só
 * é setado na primeira requisição da janela (NX = "only if not already
 * set"), então a janela nasce no primeiro request e expira sozinha depois
 * de windowMs, sem precisar de um job de limpeza no Redis.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

type UpstashCommand = (string | number)[];
type UpstashPipelineResult = { result: unknown; error?: string }[];

async function upstashPipeline(commands: UpstashCommand[]): Promise<UpstashPipelineResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstash pipeline falhou (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ---- Fallback em memória (mesma lógica das versões anteriores) ----

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();

const cleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of memoryBuckets) {
      if (bucket.resetAt <= now) memoryBuckets.delete(key);
    }
  },
  5 * 60 * 1000
);
cleanupTimer.unref?.();

function memoryPeek(key: string, max: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) return { allowed: true };
  if (bucket.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true };
}

function memoryConsume(key: string, windowMs: number, max: number): RateLimitResult {
  const now = Date.now();
  let bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
  }
  bucket.count += 1;
  memoryBuckets.set(key, bucket);

  if (bucket.count > max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true };
}

// ---- API pública ----

/**
 * Consulta o limite SEM consumir uma cota — usado quando é preciso saber
 * se uma requisição poderia prosseguir antes de gastar outra cota (ex:
 * checar o limite por usuário antes de consumir o limite global do chat).
 */
export async function peekRateLimit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  if (!isRedisConfigured()) return memoryPeek(key, max);

  try {
    const results = await upstashPipeline([
      ["GET", key],
      ["PTTL", key],
    ]);
    const count = Number(results[0]?.result ?? 0) || 0;
    if (count >= max) {
      const ttlMs = Number(results[1]?.result ?? windowMs);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000)) };
    }
    return { allowed: true };
  } catch (err) {
    console.error("Rate limit (Redis) falhou em peekRateLimit, usando fallback em memória:", err);
    return memoryPeek(key, max);
  }
}

/** Incrementa e consome uma cota da janela, devolvendo se ainda era permitido. */
export async function consumeRateLimit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  if (!isRedisConfigured()) return memoryConsume(key, windowMs, max);

  try {
    const results = await upstashPipeline([
      ["INCR", key],
      ["PEXPIRE", key, windowMs, "NX"],
    ]);
    const count = Number(results[0]?.result ?? 0) || 0;

    if (count > max) {
      const ttlResults = await upstashPipeline([["PTTL", key]]);
      const ttlMs = Number(ttlResults[0]?.result ?? windowMs);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000)) };
    }
    return { allowed: true };
  } catch (err) {
    console.error("Rate limit (Redis) falhou em consumeRateLimit, usando fallback em memória:", err);
    return memoryConsume(key, windowMs, max);
  }
}

/** Atalho para limites de uma única camada (ex: login) — checa e já consome numa chamada. */
export async function checkRateLimit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  return consumeRateLimit(key, windowMs, max);
}
