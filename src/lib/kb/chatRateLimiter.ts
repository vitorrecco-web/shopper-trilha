import "server-only";

/**
 * Rate limiting do assistente de chat — em memória, mesma limitação
 * conhecida do rateLimiter.ts do login (não garante nada entre
 * múltiplas instâncias serverless simultâneas, é best-effort).
 *
 * Duas camadas, deliberadas:
 * - Por usuário: evita que uma pessoa monopolize o assistente.
 * - Global (todo o projeto): o Free Tier do Gemini tem RPM baixo e
 *   COMPARTILHADO entre todos os usuários da aplicação (não é por
 *   usuário) — sem um limite global, algumas pessoas conversando ao
 *   mesmo tempo já esgotam a cota do projeto inteiro. Ajuste
 *   MAX_GLOBAL_PER_MINUTE depois de confirmar o RPM real da sua conta
 *   no Google AI Studio.
 */

const USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_PER_USER = 15;

const GLOBAL_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_GLOBAL_PER_MINUTE = 8;

const perUserAttempts = new Map<string, number[]>();
let globalAttempts: number[] = [];

export interface ChatRateLimitResult {
  allowed: boolean;
  reason?: "user" | "global";
  retryAfterSeconds?: number;
}

export function checkChatRateLimit(userId: string): ChatRateLimitResult {
  const now = Date.now();

  globalAttempts = globalAttempts.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (globalAttempts.length >= MAX_GLOBAL_PER_MINUTE) {
    const oldest = globalAttempts[0];
    return {
      allowed: false,
      reason: "global",
      retryAfterSeconds: Math.ceil((GLOBAL_WINDOW_MS - (now - oldest)) / 1000),
    };
  }

  const userAttempts = (perUserAttempts.get(userId) ?? []).filter((t) => now - t < USER_WINDOW_MS);
  if (userAttempts.length >= MAX_PER_USER) {
    const oldest = userAttempts[0];
    perUserAttempts.set(userId, userAttempts);
    return {
      allowed: false,
      reason: "user",
      retryAfterSeconds: Math.ceil((USER_WINDOW_MS - (now - oldest)) / 1000),
    };
  }

  globalAttempts.push(now);
  userAttempts.push(now);
  perUserAttempts.set(userId, userAttempts);
  return { allowed: true };
}
