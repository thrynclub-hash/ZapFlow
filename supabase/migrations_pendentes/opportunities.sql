-- Negocios/Funil de vendas (2026-11-09) -- distinto do Pipeline de
-- relacionamento (contacts.lifecycle_stage: Novo/Ativo/Dormindo/VIP).
-- Aqui e uma oportunidade de venda de verdade: ligada a um contato,
-- com itens (produto + quantidade + preco) e valor total, igual
-- referencia de mercado (Bolten "Funil de vendas" -- ver pesquisa
-- 2026-11-09). Aditivo -- so aparece se modules.crm = true (mesmo
-- gate do Pipeline).

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text not null,
  stage text not null default 'Novo', -- Novo | Orcamento | Negociacao | Ganho | Perdido
  notes text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists opportunities_client_id_idx on opportunities(client_id);

create table if not exists opportunity_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  description text not null,
  qty numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0
);
create index if not exists opportunity_items_opportunity_id_idx on opportunity_items(opportunity_id);

alter table opportunities enable row level security;
alter table opportunity_items enable row level security;

drop policy if exists "Client own opportunities" on opportunities;
create policy "Client own opportunities" on opportunities for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

drop policy if exists "Admin all opportunities" on opportunities;
create policy "Admin all opportunities" on opportunities for all using (is_admin());

-- opportunity_items nao tem client_id proprio -- escopa via join na
-- opportunity pai, mesmo padrao usado alhures pra tabelas de item.
drop policy if exists "Client own opportunity_items" on opportunity_items;
create policy "Client own opportunity_items" on opportunity_items for all
  using (exists (select 1 from opportunities o where o.id = opportunity_items.opportunity_id and o.client_id = my_client_id()))
  with check (exists (select 1 from opportunities o where o.id = opportunity_items.opportunity_id and o.client_id = my_client_id()));

drop policy if exists "Admin all opportunity_items" on opportunity_items;
create policy "Admin all opportunity_items" on opportunity_items for all using (is_admin());
