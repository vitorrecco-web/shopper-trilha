/**
 * Script de bootstrap — cria o primeiro usuário admin.
 *
 * Por que existe: o CRUD de usuários (Fase 3) ainda não existe, e sem
 * pelo menos um admin cadastrado ninguém consegue logar. Este script
 * roda uma única vez, direto no banco via service_role — não é uma
 * rota HTTP pública (isso seria um risco de segurança).
 *
 * Uso (a partir da raiz do projeto, com .env.local configurado):
 *   node --env-file=.env.local scripts/seed-admin.mjs "Nome Completo" login123 SenhaForte123
 *
 * Requer Node 20.6+ (suporte a --env-file). Se sua versão for mais
 * antiga, exporte as variáveis do .env.local manualmente antes de rodar.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const [, , nomeCompleto, login, password] = process.argv;

if (!nomeCompleto || !login || !password) {
  console.error(
    "Uso: node --env-file=.env.local scripts/seed-admin.mjs \"Nome Completo\" login senha"
  );
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

const passwordHash = await bcrypt.hash(password, 12);

const { data: existing } = await supabase
  .from("users")
  .select("id")
  .ilike("login", login)
  .maybeSingle();

if (existing) {
  console.error(`Já existe um usuário com o login "${login}". Escolha outro login.`);
  process.exit(1);
}

const { data, error } = await supabase
  .from("users")
  .insert({
    nome_completo: nomeCompleto,
    login,
    password_hash: passwordHash,
    role: "admin",
    status: "active",
    track_id: null,
  })
  .select("id, nome_completo, login, role")
  .single();

if (error) {
  console.error("Erro ao criar admin:", error.message);
  process.exit(1);
}

console.log("Admin criado com sucesso:", data);
