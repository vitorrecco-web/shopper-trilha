-- Recrutamento Interno: diagnóstico de aptidão por vaga.
-- A trilha muda com o tempo (módulos/fases de área trocam conforme as vagas
-- abertas), então os dados guardados NÃO dependem da estrutura atual:
-- resultados e interesses são "fotografias" com a área e os nomes da época.

-- Qual Programa é o de Recrutamento (linha única).
CREATE TABLE recruitment_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    program_id UUID REFERENCES programs(id) ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO recruitment_settings (id) VALUES (1);

-- Etiqueta de ÁREA de cada fase do Programa ('logica' = teste de lógica;
-- livre para as demais, ex.: 'rc', 'logistica'). Vagas se ligam à área,
-- não à fase/módulo — trocar o módulo de uma área não quebra nada.
CREATE TABLE recruitment_phase_areas (
    phase_id UUID PRIMARY KEY REFERENCES phases(id) ON DELETE RESTRICT,
    area_key TEXT NOT NULL,
    area_label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX recruitment_phase_areas_area_idx ON recruitment_phase_areas (area_key);

CREATE TABLE vacancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    logic_cutoff NUMERIC(5,2) NOT NULL CHECK (logic_cutoff >= 0 AND logic_cutoff <= 100),
    area_key TEXT,
    area_cutoff NUMERIC(5,2) CHECK (area_cutoff IS NULL OR (area_cutoff >= 0 AND area_cutoff <= 100)),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vaga(s) de interesse do candidato; o nome da vaga é guardado junto para o
-- relatório continuar legível se a vaga for encerrada/renomeada.
CREATE TABLE candidate_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vacancy_id UUID NOT NULL REFERENCES vacancies(id) ON DELETE RESTRICT,
    vacancy_nome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, vacancy_id)
);
CREATE INDEX candidate_interests_user_idx ON candidate_interests (user_id);

-- Marca que o candidato já respondeu "quais vagas te interessam?" (inclusive
-- "ainda não sei", que não gera nenhuma linha em candidate_interests).
CREATE TABLE candidate_interest_answers (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Um registro por tentativa de quiz de uma fase com área, com área e nomes
-- da época (append-only).
CREATE TABLE recruitment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL UNIQUE REFERENCES quiz_attempts(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    area_key TEXT NOT NULL,
    area_label TEXT NOT NULL,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    module_nome TEXT NOT NULL,
    phase_id UUID REFERENCES phases(id) ON DELETE RESTRICT,
    phase_nome TEXT NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    correct_answers INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX recruitment_results_user_idx ON recruitment_results (user_id);
CREATE INDEX recruitment_results_area_idx ON recruitment_results (area_key);

-- Fotografia da avaliação do candidato (notas nas duas visões, encaixe por
-- vaga com os cortes vigentes naquele dia, pontos fortes) — append-only.
CREATE TABLE recruitment_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
);
CREATE INDEX recruitment_assessments_user_idx ON recruitment_assessments (user_id, generated_at DESC);

CREATE TRIGGER update_recruitment_settings_updated_at BEFORE UPDATE ON recruitment_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recruitment_phase_areas_updated_at BEFORE UPDATE ON recruitment_phase_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vacancies_updated_at BEFORE UPDATE ON vacancies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabelas novas não herdam o grant do service_role (ver 0002/0007/0009).
GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_phase_areas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON vacancies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_interests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_interest_answers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON recruitment_assessments TO service_role;
