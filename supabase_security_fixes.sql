-- =============================================
-- ZapFlow — Correções de Segurança (2026-07-01)
-- Execute no SQL Editor do Supabase do projeto ZapFlow
-- (https://bhiggyigsrqfabqhutne.supabase.co)
--
-- Contexto completo dos achados:
-- agents/cargo/CTO-ZAPFLOW/SECURITY-FINDINGS-2026-07-01.md (Mega Brain)
-- =============================================

-- ---------------------------------------------
-- FIX 1: conversation_states estava aberta entre clientes (cross-tenant)
-- As policies antigas usavam `using (true)` sem filtro de client_id,
-- então qualquer chave anon podia ler/escrever estado de conversa de
-- QUALQUER cliente. Corrigido para seguir o mesmo padrão das outras
-- tabelas (client_id = my_client_id()), e o acesso do Make passa a ser
-- feito com a service role (que ignora RLS), não mais por policy pública.
-- ---------------------------------------------

drop policy if exists "Make read conv states" on conversation_states;
drop policy if exists "Make write conv states" on conversation_states;

create policy "Conversation states own"
  on conversation_states for all
  using (client_id = my_client_id())
  with check (client_id = my_client_id());

create policy "Admin all conversation states"
  on conversation_states for all
  using (is_admin());

-- Se o Make ainda precisar ler/escrever aqui diretamente (fora do fluxo
-- de app autenticado), use a SERVICE ROLE KEY do Supabase nas chamadas
-- do Make em vez da anon key — a service role ignora RLS por padrão,
-- então não precisa (e não deve) de uma policy pública para isso.

-- ---------------------------------------------
-- FIX 2 (parcial): reduzir exposição de auth_password
-- A tabela `clients` ganhou colunas auth_email/auth_password em
-- supabase_adicionar_colunas.sql para suportar login por chave, mas o
-- fluxo real de login (AuthContext.jsx -> loginWithKey) faz um select
-- direto do browser filtrando por access_key. Isso só é seguro se NÃO
-- existir nenhuma policy que libere esse select sem autenticação — o
-- que já deveria ser o caso hoje (nenhuma policy pública foi encontrada
-- para `clients`). Ainda assim, como defesa em profundidade, movemos
-- auth_password para uma tabela separada que nunca é exposta por RLS
-- de leitura a ninguém além da service role.
-- ---------------------------------------------

create table if not exists client_auth_secrets (
  client_id uuid primary key references clients(id) on delete cascade,
  auth_password_hash text,
  updated_at timestamptz default now()
);

alter table client_auth_secrets enable row level security;
-- Nenhuma policy criada de propósito: só a service role (que ignora RLS)
-- deve tocar nessa tabela. Login por chave/senha deve migrar para uma
-- Edge Function que usa a service role — ver supabase/functions/.

-- Migra o que já existir (se auth_password já estiver em uso em algum
-- lugar) e depois remove as colunas sensíveis da tabela `clients`.
-- Comentado de propósito — rode manualmente depois de confirmar que
-- nada mais lê `clients.auth_password` diretamente:
--
-- insert into client_auth_secrets (client_id, auth_password_hash)
--   select id, auth_password from clients where auth_password is not null
--   on conflict (client_id) do nothing;
-- alter table clients drop column if exists auth_password;
-- alter table clients drop column if exists auth_email;

-- ---------------------------------------------
-- FIX 3: senha de admin em texto puro no schema
-- O arquivo supabase_schema.sql tinha, em comentário, e-mail e senha do
-- admin inicial. Isso já ficou no histórico do git para sempre — a
-- correção de código (remover do arquivo) está neste branch, mas ISSO
-- NÃO SUBSTITUI trocar a senha de verdade. Ação manual obrigatória:
--
-- 1. Ir em Supabase > Authentication > Users > thrynclub@gmail.com
-- 2. Reset password / definir uma senha nova
-- 3. Nunca commitar a senha nova em lugar nenhum, nem em comentário
-- ---------------------------------------------
