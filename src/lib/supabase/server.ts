import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase server-side, usando a service_role key.
 *
 * IMPORTANTE:
 * - Este arquivo importa "server-only": se algum componente cliente
 *   tentar importar isto, o build falha em vez de vazar o segredo.
 * - Nunca importar este módulo de um arquivo com "use client".
 * - Nunca logar SUPABASE_SERVICE_ROLE_KEY.
 */

let cachedClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes. Configure .env.local a partir de .env.example."
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      // Este cliente é server-side e usa service_role — não gerencia sessão de usuário final.
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
