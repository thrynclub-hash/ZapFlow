-- =============================================
-- ZapFlow — Sessão real de Auth para clientes (2026-07-01)
-- Execute no SQL Editor do projeto (bhiggyigsrqfabqhutne)
--
-- Contexto: o login por access_key nunca criava uma sessão real do
-- Supabase Auth (só guardava dados no localStorage). Como quase toda
-- policy de RLS depende de auth.uid() (via my_client_id()), o cliente
-- "autenticado" por chave era tratado como anônimo pelo banco — por
-- isso client_numbers aparecia vazio e adicionar contato falhava.
--
-- Esta migração:
-- 1. Fecha o vazamento de contacts (policy aberta "Make read contacts")
-- 2. Prepara a tabela que guarda a credencial sintética de cada cliente
--    (usada pelas Edge Functions client-provision e client-login)
-- =============================================

-- 1. FECHA O VAZAMENTO CRÍTICO EM contacts
-- "Make read contacts" (using true) expunha nome/telefone/nascimento
-- de TODOS os contatos de TODOS os clientes pra qualquer requisição
-- anônima. Se o Make precisa ler contatos, deve usar a service role
-- key (que ignora RLS), não uma policy pública.
drop policy if exists "Make read contacts" on contacts;

-- 2. Tabela de credenciais sintéticas (se já existir de uma correção
-- anterior, ajusta as colunas em vez de recriar)
create table if not exists client_auth_secrets (
  client_id uuid primary key references clients(id) on delete cascade
);

alter table client_auth_secrets add column if not exists synthetic_email text;
alter table client_auth_secrets add column if not exists synthetic_password text;
alter table client_auth_secrets add column if not exists auth_user_id uuid references auth.users(id);
alter table client_auth_secrets add column if not exists updated_at timestamptz default now();

-- remove a coluna do desenho anterior que não é mais usada, se existir
alter table client_auth_secrets drop column if exists auth_password_hash;

alter table client_auth_secrets enable row level security;
-- Nenhuma policy criada de propósito — só a service role (usada dentro
-- das Edge Functions) pode tocar aqui. Ninguém mais precisa.

-- =============================================
-- VALIDAÇÃO:
-- select * from pg_policies where tablename = 'contacts';
-- ("Make read contacts" não deve mais aparecer)
-- =============================================
