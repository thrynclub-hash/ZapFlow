-- PDV + Caixa (2026-11-09) -- pedido do Leonardo baseado num prompt de
-- ERP generico, aplicado DENTRO da arquitetura do ZapFlow (nao reescreve
-- estoque/produto -- isso continua sendo o Bling por tras). Venda de PDV
-- = uma Opportunity criada ja como 'Ganho' com os itens, igual qualquer
-- negocio fechado -- reaproveita o funil que ja existe em vez de criar
-- conceito de "venda" duplicado. Pagamento (pode ser multiplo -- dinheiro
-- + pix no mesmo pedido) e caixa (abrir/fechar/sangria) sao conceitos
-- novos de verdade, ganham tabela propria.

create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  initial_amount numeric(10,2) not null default 0,
  status text not null default 'open', -- open | closed
  closed_at timestamptz,
  counted_cash numeric(10,2), -- dinheiro contado na hora de fechar (informado por quem fecha)
  notes text
);
create index if not exists cash_sessions_client_status_idx on cash_sessions(client_id, status);

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references cash_sessions(id) on delete cascade,
  type text not null, -- sangria | suprimento
  amount numeric(10,2) not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists opportunity_payments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  cash_session_id uuid references cash_sessions(id) on delete set null, -- nulo se a venda nao veio do PDV (ex: negocio fechado fora do caixa)
  method text not null, -- dinheiro | pix | debito | credito
  amount numeric(10,2) not null,
  amount_received numeric(10,2), -- só p/ dinheiro, pra calcular troco; nulo nos demais
  created_at timestamptz not null default now()
);
create index if not exists opportunity_payments_opportunity_idx on opportunity_payments(opportunity_id);
create index if not exists opportunity_payments_cash_session_idx on opportunity_payments(cash_session_id);

alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;
alter table opportunity_payments enable row level security;

drop policy if exists "Client own cash_sessions" on cash_sessions;
create policy "Client own cash_sessions" on cash_sessions for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "Admin all cash_sessions" on cash_sessions;
create policy "Admin all cash_sessions" on cash_sessions for all using (is_admin());

drop policy if exists "Client own cash_movements" on cash_movements;
create policy "Client own cash_movements" on cash_movements for all
  using (exists (select 1 from cash_sessions cs where cs.id = cash_movements.cash_session_id and cs.client_id = my_client_id()))
  with check (exists (select 1 from cash_sessions cs where cs.id = cash_movements.cash_session_id and cs.client_id = my_client_id()));
drop policy if exists "Admin all cash_movements" on cash_movements;
create policy "Admin all cash_movements" on cash_movements for all using (is_admin());

drop policy if exists "Client own opportunity_payments" on opportunity_payments;
create policy "Client own opportunity_payments" on opportunity_payments for all
  using (exists (select 1 from opportunities o where o.id = opportunity_payments.opportunity_id and o.client_id = my_client_id()))
  with check (exists (select 1 from opportunities o where o.id = opportunity_payments.opportunity_id and o.client_id = my_client_id()));
drop policy if exists "Admin all opportunity_payments" on opportunity_payments;
create policy "Admin all opportunity_payments" on opportunity_payments for all using (is_admin());
