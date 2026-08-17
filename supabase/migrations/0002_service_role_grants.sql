-- SHOPPER TRILHA - GRANTS PARA service_role
--
-- Contexto: quando a exposição automática de tabelas na Data API do
-- Supabase está desabilitada no projeto, o `service_role` não recebe
-- privilégios automáticos sobre as tabelas criadas em 0001_init.sql.
-- Sem isso, toda query via @supabase/supabase-js falha (visto em
-- produção como /api/health retornando {"step":"query"}).
--
-- Este script é idempotente — pode rodar de novo sem efeito colateral.

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO service_role;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO service_role;

-- Garante que tabelas criadas por migrations FUTURAS também herdem
-- esses privilégios automaticamente, sem precisar rodar isso de novo
-- a cada nova tabela.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO service_role;
