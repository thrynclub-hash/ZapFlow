-- Reforma white-label (2026-11-07) — revendedor: um `clients` row com
-- is_reseller=true, reusa 100% o login/sessão existente. Sodie/Hassum
-- não são tocados por esta migration (só adiciona colunas/policies novas).

-- 1. Colunas novas em `clients`
alter table clients add column if not exists reseller_id uuid references clients(id) on delete set null;
alter table clients add column if not exists is_reseller boolean not null default false;
alter table clients add column if not exists logo_url text;

create index if not exists clients_reseller_id_idx on clients(reseller_id);

-- 2. RLS: revendedor gerencia os próprios clientes finais
drop policy if exists "Reseller manages own clients" on clients;
create policy "Reseller manages own clients" on clients
  for all
  using (reseller_id = my_client_id())
  with check (reseller_id = my_client_id());

-- 3. RLS: revendedor gerencia números WPP dos clientes dele
drop policy if exists "Reseller manages sub-client numbers" on client_numbers;
create policy "Reseller manages sub-client numbers" on client_numbers
  for all
  using (client_id in (select id from clients where reseller_id = my_client_id()))
  with check (client_id in (select id from clients where reseller_id = my_client_id()));

-- 4. RLS: cliente final lê nome/logo do revendedor dono dele (white-label)
--
-- FIX (2026-11-07): a versão original fazia subquery em `clients` dentro
-- de uma policy de `clients` → RECURSÃO INFINITA, quebrava TODO select na
-- tabela (inclusive pro admin). Função security definer evita reacionar
-- a RLS (mesmo padrão de my_client_id()/is_admin() já existentes).
create or replace function my_reseller_id()
returns uuid
language sql security definer stable
as $$
  select reseller_id from clients where id = my_client_id()
$$;

drop policy if exists "Sub-client reads own reseller brand" on clients;
create policy "Sub-client reads own reseller brand" on clients
  for select
  using (id = my_reseller_id());

-- 5. Marcar o primeiro revendedor (pilot) — rodar manualmente apontando
-- pro client_id correto depois de criar a conta dele:
-- update clients set is_reseller = true where id = '<uuid do revendedor>';
