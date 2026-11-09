-- Base de conhecimento do Agente de IA (2026-11-09). MVP deliberadamente
-- simples: sem pgvector/embeddings -- o conteudo inteiro do cliente
-- (cap de caracteres no ai-agent) entra direto no system prompt a cada
-- chamada. Catalogos/FAQs de negocio local cabem tranquilo nesse
-- orcamento; se um cliente real precisar de muito mais texto que isso,
-- ai sim vale trocar por retrieval de verdade (busca por chunk).
create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_documents_client_id_idx on knowledge_documents(client_id);

alter table knowledge_documents enable row level security;

drop policy if exists "Client own knowledge_documents" on knowledge_documents;
create policy "Client own knowledge_documents" on knowledge_documents for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

drop policy if exists "Admin all knowledge_documents" on knowledge_documents;
create policy "Admin all knowledge_documents" on knowledge_documents for all using (is_admin());
