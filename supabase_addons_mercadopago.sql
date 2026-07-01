-- =============================================
-- ZapFlow — Mercado Pago para os add-ons (order bump) (2026-07-01)
-- Execute DEPOIS de supabase_addons.sql
--
-- Adiciona rastreio de status/assinatura do Mercado Pago em cada add-on,
-- pra distinguir "pedido criado" de "pagamento confirmado" — o limite só
-- deve contar add-ons com status = 'active'.
-- =============================================

alter table client_addons add column if not exists status text not null default 'active'
  check (status in ('pending', 'active', 'cancelled'));

alter table client_addons add column if not exists mp_preapproval_id text;

create index if not exists client_addons_mp_idx on client_addons(mp_preapproval_id) where mp_preapproval_id is not null;

-- Nota: add-ons já existentes (criados manualmente pelo painel Clientes,
-- sem passar pelo Mercado Pago) ficam com status='active' por padrão —
-- continuam contando pro limite normalmente, sem precisar de nada extra.
