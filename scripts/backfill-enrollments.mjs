/**
 * Script de bootstrap — cria uma `enrollment` (matrícula) para cada
 * `users` que hoje ainda tem `program_id` preenchido (coluna antiga,
 * singular, sendo substituída por `enrollments` — um usuário pode ter
 * várias matrículas ativas ao mesmo tempo).
 *
 * Rode DEPOIS de aplicar `supabase/migrations/0009_enrollments.sql` e
 * ANTES de aplicar `0010_drop_users_program_track.sql` (que remove as
 * colunas `program_id`/`track_id` de `users` — só faça isso depois de
 * confirmar que este script não deixou ninguém de fora).
 *
 * Uso (a partir da raiz do projeto, com .env.local configurado):
 *   node --env-file=.env.local scripts/backfill-enrollments.mjs
 *
 * Idempotente — `createOrReactivateEnrollment` (mesma lógica usada pelo
 * repositório) faz upsert por (user_id, program_id), então rodar de novo
 * não duplica nada.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

const { data: users, error: usersError } = await supabase
  .from("users")
  .select("id, nome_completo, program_id, track_id")
  .not("program_id", "is", null);

if (usersError) {
  console.error("Erro ao buscar usuários:", usersError.message);
  process.exit(1);
}

if (!users || users.length === 0) {
  console.log("Nenhum usuário com program_id preenchido — nada para migrar.");
  process.exit(0);
}

let ok = 0;
let failed = 0;

for (const user of users) {
  const { error } = await supabase
    .from("enrollments")
    .upsert(
      { user_id: user.id, program_id: user.program_id, track_id: user.track_id, active: true },
      { onConflict: "user_id,program_id" }
    );

  if (error) {
    console.error(`Falha ao migrar ${user.nome_completo} (${user.id}):`, error.message);
    failed += 1;
    continue;
  }
  console.log(`OK: ${user.nome_completo}`);
  ok += 1;
}

console.log(`\nConcluído: ${ok} migrado(s), ${failed} falha(s).`);
if (failed > 0) process.exit(1);
