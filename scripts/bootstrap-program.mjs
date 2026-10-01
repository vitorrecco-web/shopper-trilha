/**
 * Script de bootstrap — cria o primeiro Programa (Universidade Shopper)
 * e associa a ele tudo que já existe em produção (fases, funções/tracks
 * e usuários sem Programa ainda).
 *
 * Por que existe: a migration 0007_programs.sql deixa `program_id`
 * NULLABLE de propósito, para permitir este backfill em duas etapas sem
 * janela de indisponibilidade. Rode este script DEPOIS de aplicar a
 * 0007 e ANTES de aplicar a 0008 (que torna `program_id` NOT NULL em
 * phases/tracks).
 *
 * Uso (a partir da raiz do projeto, com .env.local configurado):
 *   node --env-file=.env.local scripts/bootstrap-program.mjs "Trilha de Liderança" SEU_DRIVE_FOLDER_ID
 *
 * O ID do Drive é o valor ATUAL de GOOGLE_DRIVE_ROOT_FOLDER_ID (antes de
 * você trocar essa variável para apontar para a pasta "Universidade
 * Shopper" — mover a pasta no Drive não muda esse ID).
 *
 * Idempotente: pode rodar de novo com segurança — upsert pelo
 * drive_folder_id, e o backfill só afeta linhas com program_id NULL.
 */
import { createClient } from "@supabase/supabase-js";

const [, , nome, driveFolderId] = process.argv;

if (!nome || !driveFolderId) {
  console.error(
    'Uso: node --env-file=.env.local scripts/bootstrap-program.mjs "Nome do Programa" DRIVE_FOLDER_ID'
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

const { data: program, error: upsertError } = await supabase
  .from("programs")
  .upsert({ drive_folder_id: driveFolderId, nome, active: true }, { onConflict: "drive_folder_id" })
  .select("id, nome, drive_folder_id")
  .single();

if (upsertError) {
  console.error("Erro ao criar/atualizar o Programa:", upsertError.message);
  process.exit(1);
}

console.log("Programa:", program);

const tables = ["phases", "tracks", "users"];
for (const table of tables) {
  const { data, error } = await supabase
    .from(table)
    .update({ program_id: program.id })
    .is("program_id", null)
    .select("id");

  if (error) {
    console.error(`Erro ao backfillar ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`${table}: ${data.length} linha(s) associada(s) ao Programa.`);
}

console.log(
  "\nBackfill concluído. Confirme que não sobrou nenhuma linha com program_id nulo em phases/tracks antes de aplicar 0008_programs_not_null.sql."
);
