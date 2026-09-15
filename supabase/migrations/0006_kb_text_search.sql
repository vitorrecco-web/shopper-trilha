-- ASSISTENTE SHOPPER - BUSCA TEXTUAL GRATUITA
--
-- Substitui a dependência de embeddings externos para recuperação
-- dos trechos da base de conhecimento.
--
-- Os chunks continuam armazenados normalmente no Supabase.
-- A busca usa Full Text Search nativo do PostgreSQL em português.
-- O Gemini fica responsável apenas pela geração da resposta final.

create index if not exists kb_chunks_content_fts_idx
on public.kb_chunks
using gin (to_tsvector('portuguese', content));

create or replace function public.kb_search_chunks_text(
  search_query text,
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  page_start int,
  page_end int,
  rank float,
  nome text,
  caminho text,
  categoria text
)
language sql
stable
as $$
  with query_data as (
    select websearch_to_tsquery(
      'portuguese',
      coalesce(search_query, '')
    ) as query
  )
  select
    c.id as chunk_id,
    c.document_id,
    c.content,
    c.page_start,
    c.page_end,
    ts_rank_cd(
      to_tsvector('portuguese', c.content),
      q.query
    )::float as rank,
    d.nome,
    d.caminho,
    d.categoria
  from public.kb_chunks c
  join public.kb_documents d
    on d.id = c.document_id
  cross join query_data q
  where
    d.status = 'active'
    and q.query @@ to_tsvector('portuguese', c.content)
  order by rank desc
  limit match_count;
$$;

grant execute
on function public.kb_search_chunks_text(text, int)
to service_role;