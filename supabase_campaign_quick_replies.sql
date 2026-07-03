-- =============================================
-- ZapFlow — Botões de resposta rápida por campanha (2026-07-03)
-- Execute no SQL Editor do projeto (bhiggyigsrqfabqhutne), depois de
-- supabase_campaign_stop_date.sql
--
-- Pedido do Leonardo: além da pessoa poder responder escrevendo "eu quero"
-- (fluxo que já existia), oferecer botões prontos na própria mensagem —
-- ex: "Quero sim! 🙌" / "Não quero receber esse tipo de mensagem" — e deixar
-- CONFIGURÁVEL, por campanha, o que cada botão faz (hoje: continuar o fluxo
-- normal de "eu quero", ou desligar o follow-up automático dessa campanha
-- pra quem clicou).
-- =============================================

alter table campaigns add column if not exists quick_replies jsonb default '[]'::jsonb;
comment on column campaigns.quick_replies is
  'Array de botões de resposta rápida pra esta campanha. Cada item: {id, label, action}. action ∈ (trigger_flow | stop_followup | opt_out). NULL/vazio = sem botões, mensagem só em texto (comportamento antigo). Editável na criação da campanha e depois no Histórico.';

-- Exemplo do formato esperado (não é executado, só documentação):
-- [
--   {"id": "yes", "label": "Quero sim! 🙌", "action": "trigger_flow"},
--   {"id": "no", "label": "Não quero receber esse tipo de mensagem", "action": "stop_followup"}
-- ]
