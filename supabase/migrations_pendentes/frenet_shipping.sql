-- Integração de frete/etiqueta via Frenet (sem exigir CNPJ do lojista —
-- cotação/etiqueta é logística, não fiscal). Token da Frenet fica por
-- cliente, configurado só pelo admin (Leonardo), igual Bling — nunca
-- visível/selecionável pelo cliente final (sem policy de select pro role
-- client, só admin + edge function com service role).
create table if not exists shipping_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade unique,
  provider text not null default 'frenet' check (provider in ('frenet')),
  frenet_token text not null,
  origin_cep text not null,
  origin_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  destination_name text,
  destination_cep text not null,
  destination_address text,
  carrier text,
  service_name text,
  price numeric(10,2),
  tracking_code text,
  label_url text,
  frenet_shipment_id text,
  status text not null default 'pending', -- pending | label_generated | shipped | delivered | error
  created_at timestamptz not null default now()
);

alter table shipping_accounts enable row level security;
alter table shipments enable row level security;

drop policy if exists "Admin all shipping_accounts" on shipping_accounts;
create policy "Admin all shipping_accounts" on shipping_accounts for all using (is_admin());
-- Sem policy de select pro client: token só é lido pela edge function (service role).

drop policy if exists "Admin all shipments" on shipments;
create policy "Admin all shipments" on shipments for all using (is_admin());
drop policy if exists "Client select own shipments" on shipments;
create policy "Client select own shipments" on shipments for select using (client_id = my_client_id());
drop policy if exists "Client insert own shipments" on shipments;
create policy "Client insert own shipments" on shipments for insert with check (client_id = my_client_id());
