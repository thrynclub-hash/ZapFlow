-- =============================================
-- ZapFlow — Janela de horário comercial + dias úteis (2026-07-03)
-- Execute no SQL Editor do projeto (bhiggyigsrqfabqhutne)
--
-- Pedido real do Leonardo: campanha "por dia" de 100 mensagens estava
-- disparando tudo de uma rajada só (em poucos minutos), em vez de espalhar
-- ao longo do horário comercial (ex: clínica que abre seg-sex das 9 às 17).
-- daily_start_hour já existia mas nunca era realmente usado pelo motor
-- (run-automations) — este arquivo adiciona o horário de FIM da janela
-- (daily_end_hour) e a opção de pular fins de semana (weekdays_only).
-- =============================================

alter table campaigns add column if not exists daily_end_hour int default 18;
comment on column campaigns.daily_end_hour is
  'Hora local (Brasil, UTC-3) em que a campanha para de mandar mensagens novas por hoje. Junto com daily_start_hour, define a janela de horário comercial em que os envios são espalhados ao longo do dia (evita rajada de N mensagens de uma vez só). Vale pra scheduled e daily.';

alter table campaigns add column if not exists weekdays_only boolean default true;
comment on column campaigns.weekdays_only is
  'Se true (padrão), pula sábado e domingo — não dispara nesses dias. Útil pra negócios que só funcionam dias úteis (ex: clínica). Vale pra scheduled e daily.';
