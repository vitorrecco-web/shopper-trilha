-- UNIVERSIDADE SHOPPER — PROGRAMAS DE TREINAMENTO
--
-- Introduz um nível ACIMA das fases: até aqui, o sistema só sabia operar
-- UMA trilha completa (hoje "Trilha de Liderança"), com variação apenas
-- por função (tracks) dentro da Fase 1. Para suportar várias trilhas
-- completas e independentes (Liderança, Logística, ...), cada uma com seu
-- próprio conjunto de fases/módulos, introduzimos `programs`.
--
-- `program_id` nasce NULLABLE aqui de propósito — hoje já existem fases,
-- tracks e usuários em produção. O backfill (scripts/bootstrap-program.mjs)
-- roda DEPOIS desta migration, associando tudo que já existe ao primeiro
-- Programa. Só a migration seguinte (0008) torna a coluna NOT NULL, depois
-- que o backfill confirmar que não sobrou nenhuma linha nula.

CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_folder_id TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Mesmo motivo da migration 0002 (ALTER DEFAULT PRIVILEGES não cobriu
-- esta tabela nova na prática, por algum motivo de sessão/role — visto
-- ao rodar o backfill e receber "permission denied for table programs").
-- Explícito aqui em vez de confiar de novo no default privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON programs TO service_role;

ALTER TABLE phases ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE RESTRICT;
ALTER TABLE tracks ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE RESTRICT;
ALTER TABLE users ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE RESTRICT;

CREATE INDEX phases_program_idx ON phases (program_id);
CREATE INDEX tracks_program_idx ON tracks (program_id);
CREATE INDEX users_program_idx ON users (program_id);

-- A ordem de uma fase só precisa ser única DENTRO do seu Programa — duas
-- trilhas diferentes podem (e vão) ter cada uma a sua "Fase 1".
DROP INDEX IF EXISTS phases_active_order_unique;
CREATE UNIQUE INDEX phases_active_order_unique ON phases (program_id, ordem) WHERE active = TRUE;

-- `sync_changes.entity_type` precisa aceitar o novo tipo de mudança
-- ("Novo programa", "Programa renomeado", etc. — diffPhase/diffTrack já
-- seguem esse padrão de label). Nome da constraint pode variar se alguém
-- já alterou isso manualmente fora de uma migration (já visto em
-- kb_search_chunks_text/0006) — descobre o nome real antes de derrubar.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'sync_changes'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%entity_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE sync_changes DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE sync_changes ADD CONSTRAINT sync_changes_entity_type_check
    CHECK (entity_type IN ('program','track','phase','module','pdf','questions'));
