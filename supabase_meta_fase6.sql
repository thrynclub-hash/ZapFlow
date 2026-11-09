-- ZapFlow — Fase 2, Phase 6 (API Oficial da Meta — Piloto)
-- Aditivo apenas: CREATE TABLE novo + ADD COLUMN nullable em inbound_messages.
-- Nunca toca contacts/campaigns/client_numbers/message_logs (tabelas da V1).
-- Rodar manualmente no SQL Editor do dashboard Supabase (sem MCP write neste projeto).

-- 1. NÚMEROS conectados via API oficial da Meta (Cloud API/WABA) — espelha
-- client_numbers, mas é tabela própria porque os campos são outros
-- (phone_number_id da Meta, não instanceId/token da Z-API) e porque
-- nenhum caminho de código da V1 pode referenciar isto por engano.
create table if not exists meta_numbers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  label text not null,
  phone_number_id text not null unique, -- id do número na Cloud API (usado nas chamadas e no webhook)
  waba_id text, -- WhatsApp Business Account id
  display_phone_number text, -- número formatado pra exibição, ex "+55 11 ..."
  active boolean default true,
  created_at timestamptz default now()
);
alter table meta_numbers enable row level security;
drop policy if exists "Meta numbers own" on meta_numbers;
create policy "Meta numbers own" on meta_numbers for select using (client_id = my_client_id());
drop policy if exists "Admin all meta numbers" on meta_numbers;
create policy "Admin all meta numbers" on meta_numbers for all using (is_admin());

-- 2. TEMPLATES aprovados na Meta Business Manager — meta-send precisa saber
-- nome/idioma de um template aprovado antes de mandar fora da janela 24h
-- (ver TODO em meta-send/index.ts). "approved" é marcado manualmente depois
-- de confirmar status "APPROVED" no painel da Meta — não há API neste
-- piloto pra sincronizar status automaticamente.
create table if not exists meta_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  name text not null, -- nome exato do template cadastrado na Meta
  language_code text not null default 'pt_BR',
  approved boolean default false,
  created_at timestamptz default now(),
  unique (client_id, name, language_code)
);
alter table meta_templates enable row level security;
drop policy if exists "Meta templates own" on meta_templates;
create policy "Meta templates own" on meta_templates for select using (client_id = my_client_id());
drop policy if exists "Admin all meta templates" on meta_templates;
create policy "Admin all meta templates" on meta_templates for all using (is_admin());

-- 3. inbound_messages.number_id tem FK pra client_numbers — mensagem vinda
-- da API oficial não pode usar essa coluna. Coluna nova nullable, aditiva,
-- não quebra nenhuma linha existente (todas ficam com meta_number_id null).
alter table inbound_messages add column if not exists meta_number_id uuid references meta_numbers(id);
