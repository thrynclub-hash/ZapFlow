-- =============================================
-- ZapFlow — CORREÇÃO CRÍTICA: exposição da tabela clients (2026-07-01)
-- Execute AGORA no SQL Editor do projeto (bhiggyigsrqfabqhutne)
--
-- Achado: a policy "Public key lookup" (using (true), sem restrição de
-- linha) permitia que QUALQUER pessoa, com apenas a anon key pública do
-- site, rodasse `select * from clients` e obtivesse o access_key (e
-- potencialmente auth_email/auth_password) de TODOS os clientes, sem
-- precisar adivinhar nada. Isso permite logar como qualquer cliente.
--
-- Correção: substitui a policy por uma função (RPC) que busca UMA linha
-- por vez, exigindo a chave exata como parâmetro — nunca lista todas.
-- =============================================

-- 1. Remove a policy que expunha a tabela inteira
drop policy if exists "Public key lookup" on clients;

-- 2. Função de busca segura — roda com privilégio elevado (security definer)
--    mas só retorna 1 linha, e só se a chave bater exatamente
create or replace function public.lookup_client_by_key(p_access_key text)
returns table (id uuid, name text, email text, plan text, status text, access_key text)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, email, plan, status, access_key
  from clients
  where access_key = lower(trim(p_access_key))
    and status = 'active'
  limit 1;
$$;

-- 3. Só quem não está logado (anon) pode chamar essa função —
--    e só ela, não a tabela inteira
revoke all on function public.lookup_client_by_key(text) from public;
grant execute on function public.lookup_client_by_key(text) to anon;
grant execute on function public.lookup_client_by_key(text) to authenticated;

-- =============================================
-- VALIDAÇÃO (rode depois de aplicar, deve retornar 1 linha só,
-- nunca a tabela inteira):
-- select * from public.lookup_client_by_key('chave-de-teste-aqui');
--
-- E confirme que a tabela não está mais aberta:
-- select * from pg_policies where tablename = 'clients';
-- ("Public key lookup" não deve mais aparecer na lista)
-- =============================================
