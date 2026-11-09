-- ==============================================================================
-- ZapFlow — Migração Completa: ERP Nativo + Catálogo de Peças + Grokbot Multi-Agente
-- Zero dependência de Bling ou terceiros.
-- Totalmente compatível e isolado: Thaís Hassum (sem modules.estoque/ia_agent)
-- permanece 100% intocada e funcional.
-- ==============================================================================

-- 1. PRODUTOS (Catálogo Nativo Completo com Fotos e Promoções)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  sku text,
  barcode text, -- EAN-13 / GTIN
  category text,
  description text,
  stock_qty integer not null default 0,
  cost_price numeric(10,2) default 0,
  unit_price numeric(10,2) not null default 0,
  promo_price numeric(10,2), -- Preço com desconto quando em promoção
  is_promo boolean not null default false, -- Toggle para ativar promoção
  images text[] default '{}', -- URLs das fotos da peça (para envio no WhatsApp e visualização no PDV)
  min_stock_alert integer not null default 2,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adiciona colunas se a tabela products já tiver sido criada numa versão anterior
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='images') then
    alter table products add column images text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='promo_price') then
    alter table products add column promo_price numeric(10,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='is_promo') then
    alter table products add column is_promo boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='barcode') then
    alter table products add column barcode text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='cost_price') then
    alter table products add column cost_price numeric(10,2) default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='category') then
    alter table products add column category text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='description') then
    alter table products add column description text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='products' and column_name='min_stock_alert') then
    alter table products add column min_stock_alert integer not null default 2;
  end if;
end $$;

create index if not exists products_client_id_idx on products(client_id);
create index if not exists products_barcode_idx on products(barcode);
create index if not exists products_promo_idx on products(client_id, is_promo);

-- 2. VARIAÇÕES DE PRODUTO (Grade: Cores, Tamanhos P/M/G com estoque e preço por variação)
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  name text not null, -- ex: "Preto / M", "Off-White / G"
  color text,
  size text,
  sku text,
  barcode text,
  stock_qty integer not null default 0,
  unit_price numeric(10,2), -- Preço opcional da variação (se nulo, herda do produto pai)
  promo_price numeric(10,2),
  images text[] default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists product_variants_product_idx on product_variants(product_id);
create index if not exists product_variants_client_idx on product_variants(client_id);

-- 3. CATEGORIAS DE PRODUTOS
create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(client_id, name)
);
create index if not exists product_categories_client_idx on product_categories(client_id);

-- 4. KARDEX & HISTÓRICO DE MOVIMENTAÇÃO DE ESTOQUE
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  qty_change integer not null, -- positivo: entrada, negativo: saída
  reason text not null, -- 'venda_pdv', 'grok_venda', 'entrada_manual', 'ajuste', 'troca'
  previous_stock integer,
  new_stock integer,
  notes text,
  contact_id uuid references contacts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_client_idx on stock_movements(client_id);
create index if not exists stock_movements_product_idx on stock_movements(product_id);

-- 5. CONFIGURAÇÕES DO AGENTE DE IA (GROKBOT FUNCIONÁRIO)
create table if not exists ai_agent_settings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade unique,
  provider text not null default 'grok', -- 'grok' (xAI) | 'anthropic'
  model text not null default 'grok-beta',
  persona_name text not null default 'Sofia',
  persona_role text not null default 'Consultora de Vendas',
  greeting_message text default 'Olá! Tudo bem? Como posso te ajudar hoje?',
  business_hours jsonb default '{"start": "08:00", "end": "20:00", "days": [1,2,3,4,5,6]}',
  allow_send_photos boolean not null default true,
  allow_send_pix boolean not null default true,
  pix_key text,
  pix_key_type text, -- 'cpf', 'cnpj', 'email', 'telefone', 'aleatoria'
  pix_beneficiary text,
  auto_promo_announcement boolean not null default true,
  shipping_policy text, -- Informações de frete / entrega
  exchange_policy text, -- Regras de troca e devolução
  custom_instructions text, -- Informações adicionais da loja (história, medidas, etc.)
  monthly_token_budget integer not null default 500000, -- Teto mensal anti-prejuízo
  tokens_used_this_month integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_agent_settings_client_idx on ai_agent_settings(client_id);

-- 6. RLS (SEGURANÇA POR CLIENTE)
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_categories enable row level security;
alter table stock_movements enable row level security;
alter table ai_agent_settings enable row level security;

-- Policies Products
drop policy if exists "Client own products" on products;
create policy "Client own products" on products for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all products" on products;
create policy "Admin all products" on products for all using (is_admin());

-- Policies Product Variants
drop policy if exists "Client own product_variants" on product_variants;
create policy "Client own product_variants" on product_variants for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all product_variants" on product_variants;
create policy "Admin all product_variants" on product_variants for all using (is_admin());

-- Policies Product Categories
drop policy if exists "Client own product_categories" on product_categories;
create policy "Client own product_categories" on product_categories for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all product_categories" on product_categories;
create policy "Admin all product_categories" on product_categories for all using (is_admin());

-- Policies Stock Movements
drop policy if exists "Client own stock_movements" on stock_movements;
create policy "Client own stock_movements" on stock_movements for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all stock_movements" on stock_movements;
create policy "Admin all stock_movements" on stock_movements for all using (is_admin());

-- Policies AI Agent Settings
drop policy if exists "Client own ai_agent_settings" on ai_agent_settings;
create policy "Client own ai_agent_settings" on ai_agent_settings for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all ai_agent_settings" on ai_agent_settings;
create policy "Admin all ai_agent_settings" on ai_agent_settings for all using (is_admin());
