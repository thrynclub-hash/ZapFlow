-- Execute isso no SQL Editor do Supabase
-- Adiciona colunas necessárias para chave de acesso

alter table clients add column if not exists access_key text unique;
alter table clients add column if not exists auth_email text;
alter table clients add column if not exists auth_password text;
alter table birthday_configs add column if not exists image_url text;

-- Cria index para busca rápida por chave
create index if not exists clients_access_key_idx on clients(access_key);

-- Colunas para disparo agendado com limite diário
alter table campaigns add column if not exists daily_limit int;
alter table campaigns add column if not exists daily_start_hour int default 9;
alter table campaigns add column if not exists daily_sent_today int default 0;
alter table campaigns add column if not exists last_daily_run date;

-- Tabela de estado de conversa (para resposta automática)
create table if not exists conversation_states (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  contact_id uuid references contacts(id),
  campaign_id uuid references campaigns(id),
  state text default 'initial', -- initial / asked_schedule / confirmed
  preference text, -- manha / tarde
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(contact_id, campaign_id)
);

-- Permite Make acessar
create policy if not exists "Make read conv states" on conversation_states for select using (true);
create policy if not exists "Make write conv states" on conversation_states for all using (true);
