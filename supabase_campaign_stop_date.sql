-- =============================================
-- ZapFlow — Data/hora de término para campanhas (2026-07-03)
-- Execute no SQL Editor do projeto (bhiggyigsrqfabqhutne)
--
-- Pedido do Leonardo: hoje dá pra agendar uma campanha "por dia" e ela
-- roda sozinha até acabar a lista de contatos, mas não tem como dizer
-- "para de mandar a partir do dia X" (útil pra promoção com prazo, ou
-- pra simplesmente interromper um disparo longo numa data certa).
-- =============================================

alter table campaigns add column if not exists stop_at timestamptz;
comment on column campaigns.stop_at is
  'Data/hora limite para parar de enviar esta campanha, mesmo que a lista de contatos não tenha acabado. NULL = sem limite (comportamento antigo: roda até completar a lista toda).';

-- 'stopped' é um novo valor possível de campaigns.status (não há CHECK
-- constraint nessa coluna no schema base — supabase_schema.sql — então não
-- precisa de ALTER nenhum além do comentário abaixo, só documentando):
--   'stopped' = parou por causa do stop_at, com gente ainda pendente na lista
--   (diferente de 'completed' = terminou porque alcançou todo mundo)
comment on column campaigns.status is
  'draft | scheduled | sending | completed | stopped | error. "stopped" = parou por stop_at antes de alcançar toda a lista (ver processScheduledCampaigns em run-automations).';
