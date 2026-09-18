import "server-only";
import { peekRateLimit, consumeRateLimit } from "@/lib/rateLimit/redisRateLimiter";

/**
 * Rate limiting do assistente de chat — apoiado em
 * src/lib/rateLimit/redisRateLimiter.ts (Redis/Upstash compartilhado
 * entre instâncias, com fallback em memória).
 *
 * Duas camadas, deliberadas:
 * - Por usuário: evita que uma pessoa monopolize o assistente.
 * - Global (todo o projeto): o Free Tier do Gemini tem RPM baixo e
 *   COMPARTILHADO entre todos os usuários da aplicação (não é por
 *   usuário) — sem um limite global, algumas pessoas conversando ao
 *   mesmo tempo já esgotam a cota do projeto inteiro.
 *
 * Ordem deliberada: primeiro CONSULTA (sem consumir) o limite do
 * usuário — se ele já estourou, a requisição nem chega a gastar cota
 * global, que é o recurso mais escasso e compartilhado. Só depois de
 * confirmar que o usuário poderia prosseguir é que a cota global é de
 * fato consumida, e por último a cota do usuário.
 */

const USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_PER_USER = 15;

const GLOBAL_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_GLOBAL_PER_MINUTE = 8;

export interface ChatRateLimitResult {
  allowed: boolean;
  reason?: "user" | "global";
  retryAfterSeconds?: number;
}

export async function checkChatRateLimit(userId: string): Promise<ChatRateLimitResult> {
  const userKey = `chat:user:${userId}`;
  const globalKey = "chat:global";

  const userPeek = await peekRateLimit(userKey, USER_WINDOW_MS, MAX_PER_USER);
  if (!userPeek.allowed) {
    return { allowed: false, reason: "user", retryAfterSeconds: userPeek.retryAfterSeconds };
  }

  const global = await consumeRateLimit(globalKey, GLOBAL_WINDOW_MS, MAX_GLOBAL_PER_MINUTE);
  if (!global.allowed) {
    return { allowed: false, reason: "global", retryAfterSeconds: global.retryAfterSeconds };
  }

  const user = await consumeRateLimit(userKey, USER_WINDOW_MS, MAX_PER_USER);
  if (!user.allowed) {
    // Raro: outra requisição do mesmo usuário consumiu a cota entre o
    // peek acima e este consumo (corrida entre abas/requisições).
    return { allowed: false, reason: "user", retryAfterSeconds: user.retryAfterSeconds };
  }

  return { allowed: true };
}
