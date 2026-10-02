-- MATRÍCULAS — um login pode ter mais de uma trilha (Programa) ao mesmo
-- tempo, com uma Função (se aplicável) por trilha.
--
-- `users.program_id`/`users.track_id` (singulares) deixam de ser a fonte
-- de verdade a partir daqui — ver 0010_drop_users_program_track.sql, que
-- só deve rodar DEPOIS de `scripts/backfill-enrollments.mjs` confirmar que
-- toda linha de `users` com program_id preenchido já virou uma linha em
-- `enrollments`.

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
    track_id UUID REFERENCES tracks(id) ON DELETE RESTRICT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, program_id)
);

CREATE INDEX enrollments_user_idx ON enrollments (user_id);
CREATE INDEX enrollments_program_idx ON enrollments (program_id);

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Mesmo motivo de sempre (ver 0002 e 0007): tabela nova pode não herdar
-- privilégios automáticos do service_role dependendo da configuração do
-- projeto — explícito aqui para não repetir o "permission denied" já
-- visto com `programs`.
GRANT SELECT, INSERT, UPDATE, DELETE ON enrollments TO service_role;
