-- =============================================
-- ZapFlow — warm-up automático de número novo + monitoramento de conexão
-- (2026-07-15, pedido direto do Leonardo após bloqueio da Hassum)
--
-- Esclarecimento importante: o sistema JÁ tinha uma checagem (checkPhoneExists
-- em sendCampaignBatch) que marca CONTATOS como Inativo quando o NÚMERO DO
-- CONTATO não tem WhatsApp — isso é validação do lado do destinatário, feita
-- a cada envio. É DIFERENTE do que falta aqui: monitorar se o PRÓPRIO número
-- do cliente (a instância Z-API que MANDA as mensagens) continua conectado —
-- essa checagem (zapi-status) já existia, mas só rodava manualmente (botão
-- "Testar" em Números WhatsApp), nunca automaticamente pelo cron. Ninguém
-- descobria um bloqueio até um cliente perceber e avisar.
-- =============================================

-- Monitoramento: status de conexão detectado automaticamente pelo cron
alter table client_numbers add column if not exists connection_status text default 'unknown';
alter table client_numbers add column if not exists last_status_check_at timestamptz;

comment on column client_numbers.connection_status is
  'unknown | connected | disconnected — atualizado automaticamente pelo cron (run-automations), throttled a 1x/hora por número. disconnected pausa novos envios automaticamente até reconectar.';

-- Warm-up: liga/desliga a rampa automática de volume pra número novo.
-- Default true pra números NOVOS (dado real: número da Hassum foi
-- conectado e já no mesmo dia tentou mandar 100/dia — nenhuma rampa).
-- Só entra em vigor quando daily_send_cap está vazio (config explícita do
-- admin sempre tem prioridade sobre o warm-up automático).
alter table client_numbers add column if not exists warmup_enabled boolean not null default true;

comment on column client_numbers.warmup_enabled is
  'Quando true E daily_send_cap está vazio, o teto diário sobe automaticamente com a idade do número (created_at): 15/dia (0-3 dias) -> 25 (4-7) -> 40 (8-14) -> 70 (15-21) -> padrão do sistema depois disso. daily_send_cap explícito sempre tem prioridade sobre isso.';

-- Números que JÁ existiam antes desta migração ficam DE FORA do warm-up
-- automático (grandfathered) — eles já estão rodando, e aplicar a rampa
-- retroativamente poderia derrubar o volume de um número que já está
-- funcionando bem, sem ninguém ter pedido isso. Só números criados DAQUI
-- PRA FRENTE nascem com warmup_enabled=true (o default da coluna).
update client_numbers set warmup_enabled = false where daily_send_cap is null;
