-- Campos de ERP de loja física que o Stock.jsx ainda não tinha (gap real
-- vs sistemas tipo ERP Pro): marca, subgrupo, preço atacado, comissão,
-- fornecedor. Comparado pelo Leonardo com print de sistema concorrente.
alter table products add column if not exists brand text;
alter table products add column if not exists subcategory text;
alter table products add column if not exists wholesale_price numeric(10,2);
alter table products add column if not exists wholesale_min_qty integer;
alter table products add column if not exists commission_pct numeric(5,2);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists suppliers_client_id_idx on suppliers(client_id);

alter table products add column if not exists supplier_id uuid references suppliers(id) on delete set null;

-- Marca entrada de estoque com o fornecedor — reusa o Kardex já existente
-- (stock_movements) em vez de criar tabela de "pedido de compra" nova.
alter table stock_movements add column if not exists supplier_id uuid references suppliers(id) on delete set null;

-- Vendedor que fechou a venda — base pra comissão (product.commission_pct).
-- Texto livre por enquanto: não existe cadastro de funcionário/vendedor
-- no ZapFlow ainda, criar isso seria escopo maior que o pedido.
alter table opportunities add column if not exists seller_name text;

alter table suppliers enable row level security;
drop policy if exists "Client own suppliers" on suppliers;
create policy "Client own suppliers" on suppliers for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all suppliers" on suppliers;
create policy "Admin all suppliers" on suppliers for all using (is_admin());
