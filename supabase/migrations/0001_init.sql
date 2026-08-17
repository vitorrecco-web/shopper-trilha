-- SHOPPER TRILHA - DATABASE SCHEMA V1
-- PostgreSQL / Supabase

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_folder_id TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo TEXT NOT NULL,
    matricula TEXT,
    login TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    track_id UUID REFERENCES tracks(id) ON DELETE RESTRICT,
    cd TEXT,
    turno TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin','student')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_login_unique ON users (LOWER(login));

CREATE TABLE phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_folder_id TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem > 0),
    phase_type TEXT NOT NULL CHECK (phase_type IN ('specific_track','common')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX phases_active_order_unique ON phases (ordem) WHERE active = TRUE;

CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id UUID NOT NULL REFERENCES phases(id) ON DELETE RESTRICT,
    track_id UUID REFERENCES tracks(id) ON DELETE RESTRICT,
    drive_folder_id TEXT NOT NULL UNIQUE,
    ordem INTEGER NOT NULL CHECK (ordem > 0),
    nome TEXT NOT NULL,
    pdf_drive_id TEXT,
    pdf_nome TEXT,
    questions_drive_id TEXT,
    has_questions BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX modules_phase_idx ON modules (phase_id);
CREATE INDEX modules_track_idx ON modules (track_id);
CREATE INDEX modules_active_idx ON modules (active);

CREATE TABLE user_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    unlocked_at TIMESTAMPTZ,
    material_accessed BOOLEAN NOT NULL DEFAULT FALSE,
    material_accessed_at TIMESTAMPTZ,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    best_score NUMERIC(5,2) CHECK (best_score IS NULL OR (best_score >= 0 AND best_score <= 100)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, module_id)
);

CREATE INDEX user_modules_user_idx ON user_modules (user_id);
CREATE INDEX user_modules_module_idx ON user_modules (module_id);
CREATE INDEX user_modules_completed_idx ON user_modules (user_id, completed);

CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    correct_answers INTEGER NOT NULL CHECK (correct_answers >= 0),
    total_questions INTEGER NOT NULL CHECK (total_questions > 0),
    passed BOOLEAN NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::JSONB,
    questions_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    CHECK (correct_answers <= total_questions)
);

CREATE INDEX quiz_attempts_user_idx ON quiz_attempts (user_id);
CREATE INDEX quiz_attempts_module_idx ON quiz_attempts (module_id);
CREATE INDEX quiz_attempts_user_module_idx ON quiz_attempts (user_id, module_id);

CREATE TABLE sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('preview','confirmed','completed','failed','cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    added_count INTEGER NOT NULL DEFAULT 0 CHECK (added_count >= 0),
    removed_count INTEGER NOT NULL DEFAULT 0 CHECK (removed_count >= 0),
    renamed_count INTEGER NOT NULL DEFAULT 0 CHECK (renamed_count >= 0),
    reordered_count INTEGER NOT NULL DEFAULT 0 CHECK (reordered_count >= 0),
    warnings_count INTEGER NOT NULL DEFAULT 0 CHECK (warnings_count >= 0),
    summary JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX sync_history_admin_idx ON sync_history (admin_user_id);
CREATE INDEX sync_history_started_idx ON sync_history (started_at DESC);

CREATE TABLE sync_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id UUID NOT NULL REFERENCES sync_history(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('track','phase','module','pdf','questions')),
    entity_drive_id TEXT,
    change_type TEXT NOT NULL CHECK (change_type IN ('added','removed','renamed','reordered','updated','warning')),
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sync_changes_sync_idx ON sync_changes (sync_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phases_updated_at BEFORE UPDATE ON phases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_modules_updated_at BEFORE UPDATE ON user_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
