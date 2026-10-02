-- Perfis de acesso total (além de 'admin' e 'student'):
--   viewer  = visão de aluno sem travas (todos os Programas/módulos liberados, nada é gravado)
--   analyst = viewer + indicadores (somente leitura)
-- 'admin' continua sendo o acesso a tudo (pode haver vários).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('admin','student','viewer','analyst'));
