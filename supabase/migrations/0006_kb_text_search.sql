-- ASSISTENTE SHOPPER - BUSCA TEXTUAL GRATUITA
--
-- Substitui a dependência de embeddings externos para recuperação
-- dos trechos da base de conhecimento.
--
-- Os chunks continuam armazenados normalmente no Supabase.
-- A busca usa Full Text Search nativo do PostgreSQL em português.
-- O Gemini fica responsável apenas pela geração da resposta final.
--
-- A function abaixo foi atualizada para bater exatamente com a versão
-- que roda em produção (extraída via `pg_get_functiondef` direto do
-- Supabase) — ela evoluiu manualmente depois da primeira versão desta
-- migration, para lidar melhor com perguntas naturais:
-- 1. quebra a pergunta em termos (`regexp_split_to_table` por espaço);
-- 2. descarta termos com menos de 4 caracteres e uma lista de palavras
--    pouco relevantes para busca (artigos, conectivos, verbos como
--    "gostaria"/"queria"/"entender" que não ajudam a achar o assunto);
-- 3. monta uma consulta unindo os termos restantes com OR (em vez do
--    AND implícito do `websearch_to_tsquery` da versão anterior),
--    tornando a busca mais tolerante a perguntas com várias palavras
--    onde nem todas precisam aparecer no mesmo trecho;
-- 4. continua rankeando com `ts_rank_cd`, como antes.

create index if not exists kb_chunks_content_fts_idx
on public.kb_chunks
using gin (to_tsvector('portuguese', content));

CREATE OR REPLACE FUNCTION public.kb_search_chunks_text(search_query text, match_count integer DEFAULT 8)
 RETURNS TABLE(chunk_id uuid, document_id uuid, content text, page_start integer, page_end integer, rank double precision, nome text, caminho text, categoria text)
 LANGUAGE sql
 STABLE
AS $function$
  with terms as (
    select regexp_split_to_table(
      lower(coalesce(search_query, '')),
      '\s+'
    ) as term
  ),
  filtered_terms as (
    select term
    from terms
    where length(term) >= 4
      and term not in (
        'gostaria',
        'quero',
        'queria',
        'saber',
        'entender',
        'melhor',
        'sobre',
        'como',
        'qual',
        'quais',
        'porque',
        'para',
        'pela',
        'pelo',
        'essa',
        'esse',
        'isso',
        'uma',
        'mais'
      )
  ),
  query_data as (
    select to_tsquery(
      'portuguese',
      string_agg(
        replace(
          plainto_tsquery('portuguese', term)::text,
          ' & ',
          ' | '
        ),
        ' | '
      )
    ) as query
    from filtered_terms
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
    and q.query is not null
    and q.query @@ to_tsvector('portuguese', c.content)
  order by rank desc
  limit match_count;
$function$
;

grant execute
on function public.kb_search_chunks_text(text, integer)
to service_role;