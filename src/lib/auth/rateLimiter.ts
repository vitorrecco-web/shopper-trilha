import "server-only";
import { checkRateLimit, type RateLimitResult } from "@/lib/rateLimit/redisRateLimiter";

/**
 * EXECUTION_PLAN Fase 11, tarefa 4 (rate limiting no login) — agora
 * apoiado em src/lib/rateLimit/redisRateLimiter.ts (Redis/Upstash
 * compartilhado entre instâncias, com fallback em memória quando o
 * Redis não está configurado ou falha). Ver aquele arquivo para os
 * detalhes de implementação; este módulo só define os limites e o
 * namespace da chave.
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ATTEMPTS = 5;

export type { RateLimitResult };

export async function checkLoginRateLimit(key: string): Promise<RateLimitResult> {
  return checkRateLimit(`login:${key}`, WINDOW_MS, MAX_ATTEMPTS);
}
