-- Agente local de impressão térmica (2026-11-07) — a nuvem nunca imprime
-- direto numa impressora física da loja; o agente local busca jobs
-- pendentes e imprime. Autentica por token próprio (não service role,
-- não sessão de cliente) — se vazar, só permite ler/marcar print_jobs
-- desse client_id específico, nada mais.

create table if not exists print_agents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null default 'Agente da loja',
  token text not null unique,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null default 'receipt', -- 'receipt' (etiqueta/nota de venda)
  title text,
  lines jsonb not null, -- array de strings, cada uma vira uma linha ESC/POS
  status text not null default 'pending', -- pending, printed, failed
  created_at timestamptz not null default now(),
  printed_at timestamptz
);
create index if not exists print_jobs_client_pending_idx on print_jobs(client_id, status);

alter table print_agents enable row level security;
alter table print_jobs enable row level security;

-- Só admin/service role mexe nessas duas tabelas pelo client normal do
-- app — o agente local NÃO usa sessão Supabase Auth, passa sempre pela
-- Edge Function print-agent (que usa service role por dentro).
drop policy if exists "Admin all print_agents" on print_agents;
create policy "Admin all print_agents" on print_agents for all using (is_admin());
drop policy if exists "Client reads own print_agents" on print_agents;
create policy "Client reads own print_agents" on print_agents for select using (client_id = my_client_id());

drop policy if exists "Admin all print_jobs" on print_jobs;
create policy "Admin all print_jobs" on print_jobs for all using (is_admin());
drop policy if exists "Client own print_jobs" on print_jobs;
create policy "Client own print_jobs" on print_jobs for select using (client_id = my_client_id());
