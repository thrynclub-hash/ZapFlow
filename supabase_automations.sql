-- =============================================
-- ZapFlow — Schema de Automações (MVP, 2026-07-01)
-- Execute no SQL Editor do Supabase, DEPOIS de supabase_security_fixes.sql
--
-- Contexto: agents/cargo/CTO-ZAPFLOW/ROADMAP-AUTOMACAO-MVP.md (Mega Brain)
-- =============================================

-- 1. AUTOMAÇÕES (o "fluxo" que o cliente monta)
create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  number_id uuid references client_numbers(id),
  name text not null,
  status text default 'draft', -- 'draft' | 'active' | 'paused'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. PASSOS DA AUTOMAÇÃO (gatilho / condição / ação, em sequência)
create table if not exists automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  kind text not null, -- 'trigger' | 'action' | 'condition'
  block text not null, -- ex: 'birthday' | 'tag_added' | 'send_whatsapp' | 'wait' | 'add_tag' | 'has_replied'
  config jsonb default '{}'::jsonb, -- parâmetros do bloco (ex: {"days": 30, "message": "..."})
  order_index int not null default 0,
  next_step_id uuid references automation_steps(id),
  next_step_id_if_false uuid references automation_steps(id), -- usado só em 'condition'
  created_at timestamptz default now()
);

-- 3. EXECUÇÕES EM ANDAMENTO (uma por contato que entrou na automação)
create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade, -- redundante de propósito, facilita RLS e índice
  current_step_id uuid references automation_steps(id),
  status text default 'running', -- 'running' | 'waiting' | 'done' | 'error'
  resume_at timestamptz, -- quando um passo "esperar" libera o próximo
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. LOG DE EXECUÇÃO (auditoria — o que aconteceu em cada passo)
create table if not exists automation_run_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references automation_runs(id) on delete cascade,
  step_id uuid references automation_steps(id),
  result text, -- 'ok' | 'error' | descrição curta
  detail text,
  created_at timestamptz default now()
);

-- Índices para o motor de execução (a Edge Function vai varrer por isso)
create index if not exists automation_runs_resume_idx
  on automation_runs (status, resume_at) where status = 'waiting';

create index if not exists automation_runs_client_idx
  on automation_runs (client_id);

-- =============================================
-- ROW LEVEL SECURITY — mesmo padrão do resto do schema
-- =============================================

alter table automations enable row level security;
alter table automation_steps enable row level security;
alter table automation_runs enable row level security;
alter table automation_run_logs enable row level security;

create policy "Automations own" on automations for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy "Admin all automations" on automations for all using (is_admin());

-- automation_steps não tem client_id direto — acessa via join na automation pai
create policy "Automation steps own" on automation_steps for all
  using (automation_id in (select id from automations where client_id = my_client_id()))
  with check (automation_id in (select id from automations where client_id = my_client_id()));
create policy "Admin all automation steps" on automation_steps for all using (is_admin());

create policy "Automation runs own" on automation_runs for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy "Admin all automation runs" on automation_runs for all using (is_admin());

create policy "Automation run logs own" on automation_run_logs for select
  using (run_id in (select id from automation_runs where client_id = my_client_id()));
create policy "Admin all automation run logs" on automation_run_logs for all using (is_admin());

-- Nota: a Edge Function do motor de execução (supabase/functions/run-automations)
-- usa a SERVICE ROLE KEY, que ignora RLS — por isso as policies acima só
-- precisam cobrir o acesso do painel do cliente/admin, não o motor em si.
