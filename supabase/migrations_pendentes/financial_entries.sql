-- Contas a pagar/receber genéricas — gap real vs Bling/Olist (que têm
-- financeiro completo além de venda). MVP: lançamento manual, sem
-- conciliação bancária automática (fica pra depois, se precisar).
create table if not exists financial_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('receivable', 'payable')), -- a receber | a pagar
  description text not null,
  category text, -- ex: aluguel, fornecedor, imposto, salário
  amount numeric(10,2) not null,
  due_date date not null,
  paid boolean not null default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists financial_entries_client_id_idx on financial_entries(client_id);
create index if not exists financial_entries_due_date_idx on financial_entries(due_date);

alter table financial_entries enable row level security;

drop policy if exists "Client own financial_entries" on financial_entries;
create policy "Client own financial_entries" on financial_entries for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());

drop policy if exists "Admin all financial_entries" on financial_entries;
create policy "Admin all financial_entries" on financial_entries for all using (is_admin());
