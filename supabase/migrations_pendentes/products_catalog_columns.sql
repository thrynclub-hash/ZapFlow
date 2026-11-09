-- Completa o schema nativo de catálogo que Stock.jsx já espera
-- (categoria, codigo de barras, fotos, promocao, grade de variacoes).
alter table products add column if not exists category text;
alter table products add column if not exists barcode text;
alter table products add column if not exists description text;
alter table products add column if not exists cost_price numeric(10,2) default 0;
alter table products add column if not exists promo_price numeric(10,2);
alter table products add column if not exists is_promo boolean not null default false;
alter table products add column if not exists min_stock_alert integer not null default 2;
alter table products add column if not exists images text[] default '{}';

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  stock_qty integer not null default 0,
  unit_price numeric(10,2),
  promo_price numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists product_variants_product_id_idx on product_variants(product_id);

alter table stock_movements add column if not exists previous_stock integer;
alter table stock_movements add column if not exists new_stock integer;
alter table stock_movements add column if not exists notes text;
