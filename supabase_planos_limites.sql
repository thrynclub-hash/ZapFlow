-- =============================================
-- ZapFlow — Planos com limite de verdade (2026-07-01)
-- Execute no SQL Editor DEPOIS de supabase_automacoes_avancadas.sql
--
-- Contexto: pedido do Leonardo pra travar limite de contatos/números por
-- plano (hoje nada travava nada — o valor em AdminPricing.jsx era só
-- referência visual, não tinha enforcement nenhum).
--
-- NOVA ESTRUTURA DE PLANOS (substitui Starter/Basic/Pro/Business/Enterprise):
--   Starter  -> 1 número  · 1.000 contatos
--   Growth   -> 2 números · 2.000 contatos
--   Scale    -> 5 números · 5.000 contatos
--   Enterprise -> 10 números · contatos ilimitados (null = sem limite)
-- =============================================

create table if not exists plan_limits (
  plan text primary key,
  numbers_limit int not null,
  contacts_limit int, -- null = ilimitado
  updated_at timestamptz default now()
);

alter table plan_limits enable row level security;
-- Não é dado sensível nem por tenant — qualquer usuário autenticado pode ler
-- (precisa pra UI mostrar "seu plano permite até X contatos").
create policy "Plan limits readable" on plan_limits for select using (true);
create policy "Admin manage plan limits" on plan_limits for all using (is_admin());

insert into plan_limits (plan, numbers_limit, contacts_limit) values
  ('Starter', 1, 1000),
  ('Growth', 2, 2000),
  ('Scale', 5, 5000),
  ('Enterprise', 10, null)
on conflict (plan) do update set
  numbers_limit = excluded.numbers_limit,
  contacts_limit = excluded.contacts_limit,
  updated_at = now();

-- Migração de clientes com plano antigo (Basic/Pro/Business) pro mais
-- próximo da nova estrutura — ajuste manualmente depois se algum cliente
-- precisar ficar num plano diferente do mapeamento automático abaixo.
update clients set plan = 'Growth' where plan in ('Basic');
update clients set plan = 'Scale' where plan in ('Pro', 'Business');
-- 'Starter' e 'Enterprise' já batem com o nome novo, não precisam de update.
