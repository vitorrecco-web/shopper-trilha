-- ASSISTENTE SHOPPER — FASE 1: BASE DE CONHECIMENTO / RAG
--
-- Totalmente isolada do restante do schema: nenhuma foreign key para
-- tracks/phases/modules/user_modules/quiz_attempts/sync_history/
-- sync_changes. A sincronização da base de conhecimento (kb_*) roda em
-- código separado, aponta para uma pasta diferente do Drive
-- (GOOGLE_DRIVE_KB_ROOT_FOLDER_ID), e não altera nada da trilha.

create extension if not exists vector;

create table kb_documents (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique not null,
  nome text not null,
  -- Caminho completo relativo à pasta "documentos/", ex:
  -- "Liderança/Comunicação/arquivo.pdf" — preserva a subpasta real,
  -- independente da profundidade.
  caminho text not null,
  -- Primeira subpasta abaixo de "documentos/" (ex: "Liderança",
  -- "Política Shopper + CLT", futuramente "POPs Operacionais").
  categoria text not null,
  mime_type text not null,
  modified_time_drive timestamptz not null,
  -- md5Checksum do Drive quando disponível — usado para decidir se o
  -- CONTEÚDO mudou de verdade (não só metadado), evitando reprocessar
  -- um arquivo que só foi tocado sem alterar o texto.
  content_hash text,
  page_count int,
  -- "removed": documento saiu da pasta no Drive. Nunca é apagado de
  -- verdade — só sai das buscas (ver índice/uso em kbSearchService).
  status text not null default 'active' check (status in ('active', 'removed')),
  last_indexed_at timestamptz,
  last_seen_at timestamptz,
  -- Preenchido quando a extração falha (ex: PDF escaneado, sem camada
  -- de texto) — o documento fica sinalizado, sem quebrar o resto da
  -- sincronização nem virar chunk vazio silenciosamente.
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kb_documents_status_idx on kb_documents (status);
create index kb_documents_categoria_idx on kb_documents (categoria);

create table kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references kb_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_start int,
  page_end int,
  token_count int,
  -- text-embedding-3-small da OpenAI — 1536 dimensões.
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index kb_chunks_document_id_idx on kb_chunks (document_id);

-- Sem índice ANN (ivfflat/hnsw) por enquanto — no volume esperado
-- (centenas/poucos milhares de chunks), busca exata via operador <=>
-- é rápida o suficiente e evita ajuste prematuro de índice. Pode ser
-- adicionado depois se o volume crescer, sem migração destrutiva.

create table kb_sync_history (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'completed', 'failed')),
  summary jsonb
);

-- O supabase-js não expõe o operador <=> do pgvector via query builder
-- (.select()/.eq()/etc.) — busca por similaridade precisa de uma
-- function SQL, chamada via `supabase.rpc('kb_match_chunks', {...})`.
-- Retorna a DISTÂNCIA de cosseno (0 = idêntico); o "score normalizado"
-- (1 - distância, quanto maior mais parecido) é calculado na camada de
-- serviço (kbSearchService.ts), não aqui — mantém a function simples.
create or replace function kb_match_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  page_start int,
  page_end int,
  distance float,
  nome text,
  caminho text,
  categoria text
)
language sql stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    c.content,
    c.page_start,
    c.page_end,
    (c.embedding <=> query_embedding) as distance,
    d.nome,
    d.caminho,
    d.categoria
  from kb_chunks c
  join kb_documents d on d.id = c.document_id
  where d.status = 'active'
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Mesmo motivo da migration 0002 (Data API exposure desabilitada no
-- projeto): sem isto, a chamada via .rpc() falha para o service_role.
grant execute on function kb_match_chunks(vector, int) to service_role;
