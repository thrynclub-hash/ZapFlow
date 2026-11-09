-- Split de pagamento via Wiven (2026-11-09). Baseado SO no que o Leonardo
-- confirmou (doc 19/05/2026 + suporte, uso real no TOQY) -- ver comentario
-- em wiven-webhook/index.ts pro que NAO esta confirmado ainda.
--
-- Decisao de arquitetura: Wiven NAO suporta split dentro de assinatura
-- recorrente (so em cobranca avulsa). Como o ZapFlow cobra o cliente
-- final por assinatura mensal, o fluxo e: cobranca cai 100% na conta
-- principal (Leonardo) -> webhook confirma pagamento -> ZapFlow calcula
-- a comissao do parceiro e registra um repasse PENDENTE -- o envio de
-- dinheiro de verdade (API de transferencia da Wiven) fica MANUAL por
-- enquanto, porque o endpoint exato de transferencia nao foi confirmado
-- e isso e dinheiro real -- nao adivinho payload de movimentacao financeira.

alter table clients add column if not exists wiven_subscription_id text;
alter table clients add column if not exists wiven_pix_key text; -- chave Pix do parceiro, pra onde vai a comissao dele
alter table clients add column if not exists commission_pct numeric(5,2) not null default 70; -- % que o parceiro recebe (resto fica com Leonardo)

create table if not exists wiven_transfers (
  id uuid primary key default gen_random_uuid(),
  reseller_client_id uuid not null references clients(id) on delete cascade, -- parceiro que recebe
  source_client_id uuid references clients(id) on delete set null, -- cliente final que pagou
  wiven_reference text, -- id da transacao/assinatura na Wiven, pra conferencia
  amount numeric(10,2) not null,
  status text not null default 'pending', -- pending | sent | failed
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  notes text
);
create index if not exists wiven_transfers_reseller_idx on wiven_transfers(reseller_client_id, status);

alter table wiven_transfers enable row level security;

drop policy if exists "Admin all wiven_transfers" on wiven_transfers;
create policy "Admin all wiven_transfers" on wiven_transfers for all using (is_admin());

-- Parceiro ve (mas nao edita) os proprios repasses -- transparencia de
-- quanto ja foi pago/esta pendente pra ele.
drop policy if exists "Reseller select own wiven_transfers" on wiven_transfers;
create policy "Reseller select own wiven_transfers" on wiven_transfers for select
  using (reseller_client_id = my_client_id());
