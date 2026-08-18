import "server-only";

/**
 * EXECUTION_PLAN Fase 11, tarefa 4: "Rate limiting básico no login, se
 * viável." Implementação em memória — sem dependência externa (Redis,
 * etc), suficiente para uma V1 de baixo tráfego.
 *
 * LIMITAÇÃO CONHECIDA (documentada também no README): em ambiente
 * serverless (Vercel), cada instância fria da função tem sua própria
 * memória. Isto NÃO é um limite globalmente garantido entre múltiplas
 * instâncias simultâneas — é uma primeira barreira best-effort contra
 * tentativas repetidas na mesma instância, não uma proteção robusta
 * contra um ataque distribuído. Para essa garantia de verdade, seria
 * necessário um armazenamento compartilhado (ex: Redis/Upstash).
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ATTEMPTS = 5;

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const attempts = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (attempts.length >= MAX_ATTEMPTS) {
    const oldest = attempts[0];
    buckets.set(key, attempts);
    return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }

  attempts.push(now);
  buckets.set(key, attempts);
  return { allowed: true };
}

// Evita crescimento infinito do Map em processos de vida longa (dev
// local). Em serverless isso raramente chega a rodar, o que é
// inofensivo — a instância recicla e a memória some junto.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, attempts] of buckets) {
    const fresh = attempts.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) buckets.delete(k);
    else buckets.set(k, fresh);
  }
}, WINDOW_MS);
cleanupTimer.unref?.();
