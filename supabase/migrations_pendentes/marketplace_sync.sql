-- ZapFlow — Sync de estoque/preço pra marketplaces (2026-11-08)
-- MVP: push de stock_qty/unit_price pra produto JÁ cadastrado no canal
-- (vínculo de SKU é manual, 1x por produto; criação de anúncio novo é fase 2).

create table if not exists marketplace_channels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  -- bling/tiny/omie = ERP que já propaga pra vários marketplaces sozinho
  -- (caminho recomendado); os demais = integração direta com 1 marketplace.
  platform text not null check (platform in ('bling','tiny','omie','mercadolivre','nuvemshop','tiktokshop','shopee','shein','netshoes')),
  credentials jsonb not null default '{}'::jsonb, -- ex: {"access_token": "...", "store_id": "..."}
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists product_channel_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  channel_id uuid not null references marketplace_channels(id) on delete cascade,
  external_id text not null, -- id do item/variant no marketplace
  sync_status text not null default 'pending', -- pending | synced | error
  last_synced_at timestamptz,
  last_error text,
  unique(product_id, channel_id)
);

create table if not exists marketplace_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  channel_id uuid not null references marketplace_channels(id) on delete cascade,
  status text not null default 'pending', -- pending | done | error
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

alter table marketplace_channels enable row level security;
alter table product_channel_links enable row level security;
alter table marketplace_sync_jobs enable row level security;

drop policy if exists "Admin all marketplace_channels" on marketplace_channels;
create policy "Admin all marketplace_channels" on marketplace_channels for all using (is_admin());
drop policy if exists "Client select own marketplace_channels" on marketplace_channels;
create policy "Client select own marketplace_channels" on marketplace_channels for select using (client_id = my_client_id());

drop policy if exists "Admin all product_channel_links" on product_channel_links;
create policy "Admin all product_channel_links" on product_channel_links for all using (is_admin());

drop policy if exists "Admin all marketplace_sync_jobs" on marketplace_sync_jobs;
create policy "Admin all marketplace_sync_jobs" on marketplace_sync_jobs for all using (is_admin());

-- Só enfileira pra links JÁ existentes (produto sem vínculo de SKU não gera job).
create or replace function enqueue_marketplace_sync()
returns trigger language plpgsql as $$
begin
  insert into marketplace_sync_jobs (product_id, channel_id)
  select pcl.product_id, pcl.channel_id
  from product_channel_links pcl
  join marketplace_channels mc on mc.id = pcl.channel_id
  where pcl.product_id = new.id and mc.active = true;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_marketplace_sync on products;
create trigger trg_enqueue_marketplace_sync
after update of stock_qty, unit_price on products
for each row execute function enqueue_marketplace_sync();
