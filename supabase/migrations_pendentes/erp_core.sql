-- Núcleo ERP (estoque + agenda), genérico pra qualquer vertical
-- (doceria, barbearia, clínica...). Aditivo — só existe se o client
-- tiver modules.estoque/agenda = true; Hassum/Sodie (modules={}) não usam.

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  sku text,
  stock_qty integer not null default 0,
  unit_price numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_client_id_idx on products(client_id);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty_change integer not null, -- negativo = saída (venda), positivo = entrada
  reason text, -- 'ia_agent_sale', 'manual', 'ifood_order', etc.
  contact_id uuid references contacts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_client_id_idx on stock_movements(client_id);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled', -- scheduled, done, cancelled
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_client_id_starts_at_idx on appointments(client_id, starts_at);

alter table products enable row level security;
alter table stock_movements enable row level security;
alter table appointments enable row level security;

drop policy if exists "Client own products" on products;
create policy "Client own products" on products for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

drop policy if exists "Admin all products" on products;
create policy "Admin all products" on products for all using (is_admin());

drop policy if exists "Client own stock_movements" on stock_movements;
create policy "Client own stock_movements" on stock_movements for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

drop policy if exists "Admin all stock_movements" on stock_movements;
create policy "Admin all stock_movements" on stock_movements for all using (is_admin());

drop policy if exists "Client own appointments" on appointments;
create policy "Client own appointments" on appointments for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

drop policy if exists "Admin all appointments" on appointments;
create policy "Admin all appointments" on appointments for all using (is_admin());
