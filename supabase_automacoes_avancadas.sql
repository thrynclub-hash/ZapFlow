-- =============================================
-- ZapFlow — Automações avançadas: import inteligente, limite diário
-- global, respostas ("EU QUERO") e follow-ups (2026-07-01)
-- Execute no SQL Editor do Supabase, DEPOIS de:
--   supabase_security_fixes.sql
--   supabase_automations.sql
--   supabase_fix_public_key_lookup.sql
--   supabase_client_real_auth.sql
--
-- Contexto: agents/cargo/CTO-ZAPFLOW/AGENT.md (Mega Brain), pedido do
-- Leonardo em 2026-07-01 para configurar as automações da Clínica Hassum.
--
-- SEGURO RODAR MAIS DE UMA VEZ (corrigido em 2026-07-01): toda constraint,
-- policy e coluna deste arquivo agora tem guarda de idempotência
-- (if not exists / drop-then-create / bloco condicional). Rodar de novo
-- não quebra nada e não duplica nada.
-- =============================================

-- ---------------------------------------------
-- 1. CONTATOS: status de ciclo de vida + rastreio de importação
-- ---------------------------------------------
-- `contacts.status` já era usado por engano em run-automations
-- (sendCampaignBatch filtrava .eq('status','Ativo') numa coluna que
-- não existia — bug real, zerava todo envio agendado/diário). Corrigido
-- criando a coluna de verdade, com os 4 estados do master prompt.
alter table contacts add column if not exists status text not null default 'Ativo';

-- Postgres não tem "ADD CONSTRAINT IF NOT EXISTS" — sem essa guarda, rodar
-- este script uma 2ª vez dá ERROR 42710 (constraint já existe). Isso
-- aconteceu de verdade em 2026-07-01. Corrigido com bloco condicional:
-- só cria a constraint se ela ainda não existir.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_status_check'
  ) then
    alter table contacts add constraint contacts_status_check
      check (status in ('Ativo', 'Inativo', 'Descadastrado', 'Bloqueado'))
      not valid;
    alter table contacts validate constraint contacts_status_check;
  end if;
end $$;

-- Data em que o contato entrou nesta importação/lote (distinto de
-- created_at, que não muda em upsert de contato já existente).
alter table contacts add column if not exists imported_at timestamptz default now();

create index if not exists contacts_status_idx on contacts(client_id, status);

-- ---------------------------------------------
-- 2. LIMITE DIÁRIO GLOBAL DE ENVIO (100/dia por número, sem exceção)
-- ---------------------------------------------
-- Um único contador por número+dia, compartilhado por TODOS os
-- caminhos de envio (disparo "agora", campanha agendada/diária,
-- automação, follow-up, resposta do webhook) — ninguém manda mensagem
-- sem passar por aqui primeiro. Isso é o que garante o limite de 100
-- de verdade, e não só "por campanha".
create table if not exists daily_send_counters (
  number_id uuid not null references client_numbers(id) on delete cascade,
  send_date date not null default current_date,
  count int not null default 0,
  primary key (number_id, send_date)
);
alter table daily_send_counters enable row level security;
-- Sem policies de propósito: só a service role (Edge Functions) toca aqui.

create or replace function try_consume_daily_send_budget(p_number_id uuid, p_daily_cap int default 100)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into daily_send_counters (number_id, send_date, count)
  values (p_number_id, current_date, 1)
  on conflict (number_id, send_date)
  do update set count = daily_send_counters.count + 1
  returning count into v_count;

  if v_count > p_daily_cap then
    update daily_send_counters set count = count - 1
      where number_id = p_number_id and send_date = current_date;
    return false;
  end if;
  return true;
end;
$$;

grant execute on function try_consume_daily_send_budget(uuid, int) to authenticated, service_role;

-- ---------------------------------------------
-- 3. MENSAGENS RECEBIDAS (inbound) — alimenta follow-up e has_replied
-- ---------------------------------------------
create table if not exists inbound_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  number_id uuid references client_numbers(id),
  phone text not null,
  message text,
  received_at timestamptz not null default now()
);
alter table inbound_messages enable row level security;
drop policy if exists "Inbound messages own" on inbound_messages;
create policy "Inbound messages own" on inbound_messages for select using (client_id = my_client_id());
drop policy if exists "Admin all inbound messages" on inbound_messages;
create policy "Admin all inbound messages" on inbound_messages for all using (is_admin());
-- Escrita só pela service role (webhook da Z-API), de propósito.

create index if not exists inbound_messages_contact_idx on inbound_messages(contact_id, received_at);

-- ---------------------------------------------
-- 4. FLUXO DE RESPOSTA POR PALAVRA-CHAVE ("EU QUERO" etc.)
-- ---------------------------------------------
create table if not exists reply_flows (
  client_id uuid primary key references clients(id) on delete cascade,
  enabled boolean not null default true,
  trigger_keyword text not null default 'eu quero',
  ask_period_message text not null default 'Que ótimo, {{nome}}! 😊 Você prefere atendimento pela manhã ou à tarde?',
  confirm_message text not null default 'Perfeito! Em breve nossa equipe entra em contato pra confirmar seu horário 🗓️',
  notify_phone text, -- WhatsApp de quem recebe a notificação interna (ex: Paulo). NULL = não notifica ainda.
  updated_at timestamptz default now()
);
alter table reply_flows enable row level security;
drop policy if exists "Reply flow own" on reply_flows;
create policy "Reply flow own" on reply_flows for all using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all reply flows" on reply_flows;
create policy "Admin all reply flows" on reply_flows for all using (is_admin());

-- Reaproveita conversation_states (já existe e já tem RLS correta desde
-- supabase_security_fixes.sql) como a máquina de estado da conversa:
-- state: 'initial' -> 'asked_schedule' -> 'confirmed'
-- preference: 'manha' | 'tarde'

-- ---------------------------------------------
-- 5. FOLLOW-UPS (campanha B só dispara pra quem não respondeu à campanha A)
-- ---------------------------------------------
alter table campaigns add column if not exists follow_up_of uuid references campaigns(id);
alter table campaigns add column if not exists follow_up_delay_days int default 2;
-- type ganha um novo valor possível: 'followup' (além de manual/birthday/scheduled/daily)

create index if not exists campaigns_follow_up_idx on campaigns(follow_up_of) where follow_up_of is not null;

-- ---------------------------------------------
-- RLS em daily_send_counters e reply_flows para admin (auditoria)
-- ---------------------------------------------
drop policy if exists "Admin all daily counters" on daily_send_counters;
create policy "Admin all daily counters" on daily_send_counters for select using (is_admin());
