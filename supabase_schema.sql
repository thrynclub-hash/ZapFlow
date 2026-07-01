-- =============================================
-- ZapFlow — Schema completo no Supabase
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. CLIENTES (empresas que pagam)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  plan text default 'Basic',
  segment text,
  status text default 'active',
  created_at timestamptz default now()
);

-- 2. PROFILES (usuários do sistema)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid references clients(id),
  role text default 'client', -- 'admin' ou 'client'
  full_name text,
  email text,
  created_at timestamptz default now()
);

-- 3. NÚMEROS WHATSAPP por cliente
create table if not exists client_numbers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  label text not null, -- "Loja 1", "Consultório Centro"
  phone text,
  zapi_instance_id text,
  zapi_token text,
  active boolean default true,
  created_at timestamptz default now()
);

-- 4. CONTATOS
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  number_id uuid references client_numbers(id),
  name text not null,
  phone text not null,
  birth_date date,
  tags text[] default '{}',
  created_at timestamptz default now(),
  unique(client_id, phone)
);

-- 5. CAMPANHAS
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  number_id uuid references client_numbers(id),
  name text,
  caption text,
  image_url text,
  type text default 'manual', -- 'manual' | 'birthday' | 'scheduled'
  status text default 'draft', -- 'draft' | 'sending' | 'completed' | 'error'
  total_count int default 0,
  sent_count int default 0,
  error_count int default 0,
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- 6. LOGS DE MENSAGENS
create table if not exists message_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  client_id uuid references clients(id),
  contact_id uuid references contacts(id),
  status text not null, -- 'sent' | 'error' | 'pending'
  error_detail text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- 7. CONFIG DE ANIVERSÁRIOS
create table if not exists birthday_configs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade unique,
  message text,
  enabled boolean default false,
  updated_at timestamptz default now()
);

-- =============================================
-- STORAGE: bucket para criativos
-- =============================================
insert into storage.buckets (id, name, public)
values ('creatives', 'creatives', true)
on conflict do nothing;

-- Policy: qualquer autenticado pode ler
create policy "Public read creatives"
  on storage.objects for select
  using (bucket_id = 'creatives');

-- Policy: autenticado pode fazer upload
create policy "Authenticated upload creatives"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'creatives');

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

alter table clients enable row level security;
alter table profiles enable row level security;
alter table client_numbers enable row level security;
alter table contacts enable row level security;
alter table campaigns enable row level security;
alter table message_logs enable row level security;
alter table birthday_configs enable row level security;

-- Helper: pega client_id do usuário logado
create or replace function my_client_id()
returns uuid language sql security definer
as $$ select client_id from profiles where id = auth.uid() $$;

-- Helper: verifica se é admin
create or replace function is_admin()
returns boolean language sql security definer
as $$ select role = 'admin' from profiles where id = auth.uid() $$;

-- PROFILES: pode ver o próprio
create policy "Profile own" on profiles for all using (id = auth.uid());
create policy "Admin all profiles" on profiles for all using (is_admin());

-- CLIENTS: admin vê tudo, cliente vê o seu
create policy "Client own" on clients for select using (id = my_client_id());
create policy "Admin all clients" on clients for all using (is_admin());

-- CLIENT_NUMBERS: admin tudo, cliente vê os seus
create policy "Numbers own" on client_numbers for select using (client_id = my_client_id());
create policy "Admin all numbers" on client_numbers for all using (is_admin());

-- CONTACTS: cliente gerencia os seus
create policy "Contacts own" on contacts for all using (client_id = my_client_id());
create policy "Admin all contacts" on contacts for all using (is_admin());

-- CAMPAIGNS: cliente gerencia as suas
create policy "Campaigns own" on campaigns for all using (client_id = my_client_id());
create policy "Admin all campaigns" on campaigns for all using (is_admin());

-- MESSAGE_LOGS: cliente vê os seus
create policy "Logs own" on message_logs for all using (client_id = my_client_id());
create policy "Admin all logs" on message_logs for all using (is_admin());

-- BIRTHDAY CONFIGS
create policy "Birthday own" on birthday_configs for all using (client_id = my_client_id());
create policy "Admin birthday" on birthday_configs for all using (is_admin());

-- =============================================
-- ADMIN INICIAL
-- Crie manualmente após setup (NUNCA commitar a senha aqui):
-- 1. Vá em Authentication > Users > Add user
-- 2. Defina o e-mail e uma senha forte diretamente no painel do Supabase
-- 3. Pegue o ID gerado
-- 4. Execute:
-- insert into profiles (id, role, full_name, email)
-- values ('<ID_DO_USER>', 'admin', '<NOME>', '<EMAIL>');
--
-- Nota de segurança (2026-07-01): este arquivo tinha uma senha em texto
-- puro aqui. Foi removida do código, mas o histórico do git ainda a
-- contém — troque essa senha real no painel do Supabase, o texto
-- antigo não protege mais nada. Ver SECURITY-FINDINGS-2026-07-01.md.
-- =============================================
