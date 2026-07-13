-- =============================================
-- ZapFlow — Origem de campanha nas mensagens recebidas (2026-07-13)
-- Rode isso UMA VEZ (depois de supabase_inbound_status.sql já aplicado).
--
-- Por quê: a tela Conversas (src/pages/Conversations.jsx) deve mostrar
-- SÓ resposta de campanha de verdade (pedido do Leonardo) — não qualquer
-- mensagem avulsa que alguém mande pro número (contato desconhecido, ou
-- contato conhecido que nunca recebeu campanha nenhuma). Antes, a tela
-- calculava "de qual campanha isso veio" toda vez que carregava, varrendo
-- TODO o histórico de message_logs — não dava pra paginar direito e não
-- dava pra filtrar no banco. Agora o zapi-webhook já grava campaign_id no
-- momento em que a mensagem chega (mesma lógica que já existia pra
-- resolver o fluxo de botão, só que agora persistida).
--
-- Esta migration faz o backfill pras mensagens que já chegaram antes
-- dessa mudança de código.
-- =============================================

alter table inbound_messages add column if not exists campaign_id uuid references campaigns(id);

comment on column inbound_messages.campaign_id is
  'Campanha (base ou follow-up) cuja última mensagem "sent" pro mesmo contato veio ANTES desta resposta. NULL = mensagem avulsa, não é resposta a nenhuma campanha (excluída da tela Conversas).';

-- Backfill: pra cada mensagem recebida com contato identificado, acha a
-- campanha da última mensagem "sent" enviada a esse contato antes do
-- horário do recebimento — mesma regra que o webhook aplica em tempo real.
update inbound_messages im
set campaign_id = sub.campaign_id
from (
  select im2.id as inbound_id, ml.campaign_id
  from inbound_messages im2
  cross join lateral (
    select ml.campaign_id
    from message_logs ml
    where ml.contact_id = im2.contact_id
      and ml.status = 'sent'
      and ml.sent_at <= im2.received_at
    order by ml.sent_at desc
    limit 1
  ) ml
  where im2.contact_id is not null and im2.campaign_id is null
) sub
where im.id = sub.inbound_id;

create index if not exists idx_inbound_messages_campaign on inbound_messages (campaign_id) where campaign_id is not null;
