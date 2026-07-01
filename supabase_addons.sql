-- =============================================
-- ZapFlow — Add-ons (order bump): +1 número WhatsApp / +1000 contatos
-- avulsos, sem precisar trocar de plano inteiro (2026-07-01)
--
-- Pedido do Leonardo: às vezes o cliente só quer um pouco mais de
-- capacidade (1 número a mais, ou +1000 contatos) sem migrar pro
-- próximo plano inteiro, que teria muito mais do que ele precisa.
--
-- Como funciona: cada linha aqui é "1 unidade comprada" de um tipo de
-- add-on. O limite EFETIVO de um cliente = limite do plano base
-- (plan_limits) + soma dos add-ons dele. O valor de cada add-on fica
-- gravado na própria linha (não é fórmula fixa), porque pode mudar ao
-- longo do tempo ou por negociação.
-- =============================================

create table if not exists client_addons (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  addon_type text not null check (addon_type in ('number', 'contacts_1000')),
  quantity int not null default 1 check (quantity > 0),
  monthly_price numeric(10,2) not null,
  created_at timestamptz not null default now()
);

alter table client_addons enable row level security;

drop policy if exists "Addons own" on client_addons;
create policy "Addons own" on client_addons for select using (client_id = my_client_id());

drop policy if exists "Admin all addons" on client_addons;
create policy "Admin all addons" on client_addons for all using (is_admin());

create index if not exists client_addons_client_idx on client_addons(client_id, addon_type);

-- Preços sugeridos (não são regra fixa, é só o ponto de partida usado no
-- painel admin ao adicionar um novo add-on):
--   +1 número WhatsApp:  R$149/mês  (mesma fórmula dos planos: custo real
--                        da instância Z-API ~R$99,99 x 1,30 de margem)
--   +1000 contatos:      R$59/mês   (praticamente sem custo real de infra
--                        extra — é margem, preço pensado pra ser fácil
--                        de aceitar, não custo-mais-margem como o número)
