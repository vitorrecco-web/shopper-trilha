-- ASSISTENTE SHOPPER — MIGRAÇÃO DE PROVEDOR DE EMBEDDINGS: OPENAI -> GEMINI
--
-- Contexto: a aprovação de pagamento da OpenAI ficou travada num
-- impasse. Trocando para o Gemini Developer API (Free Tier) para
-- custo zero. Os embeddings da OpenAI (1536 dimensões,
-- text-embedding-3-small) e do Gemini (768 dimensões,
-- gemini-embedding-001) NÃO são compatíveis entre si — não existe
-- "conversão", só reindexação do zero.
--
-- kb_sync_history é preservado (histórico de sincronizações
-- anteriores, incluindo as feitas com OpenAI, continua registrado).
-- kb_documents e kb_chunks são limpos — a próxima sincronização
-- reprocessa tudo (extrai, gera chunk, gera embedding novo com o
-- Gemini) e popula de novo do zero. Nada "quebra" fora disso: é
-- exatamente o mesmo fluxo de indexação de sempre, só que a primeira
-- rodada depois desta migration vai marcar TODO documento como novo.

truncate table kb_documents cascade;

-- A function antiga referenciava vector(1536) — precisa ser removida
-- antes de recriar com a nova dimensão (mudar o tipo do parâmetro conta
-- como assinatura diferente para o Postgres, "create or replace" não
-- é suficiente sozinho).
drop function if exists kb_match_chunks(vector(1536), int);

alter table kb_chunks
  alter column embedding type vector(768);

create or replace function kb_match_chunks(
  query_embedding vector(768),
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

grant execute on function kb_match_chunks(vector, int) to service_role;
