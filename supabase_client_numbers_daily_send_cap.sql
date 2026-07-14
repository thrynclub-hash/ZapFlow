-- =============================================
-- ZapFlow — teto diário REAL por número (2026-07-15)
--
-- Bug real que causou o bloqueio do WhatsApp da Clínica Hassum: o cliente
-- configurou daily_limit=50 na campanha "Semana 1", mas o follow-up dela
-- ficou com daily_limit vazio (caindo no padrão de 50 dele também) — as
-- duas campanhas rodam em paralelo no MESMO número, cada uma pensando ter
-- seu próprio teto de 50/dia. O único freio de verdade compartilhado era
-- um valor global fixo (DAILY_CAP - REPLY_RESERVE = 90), igual pra
-- QUALQUER número do sistema, sem jeito de configurar mais baixo. Resultado
-- real: 45+44=89 mensagens no número em 13/07, 44+44=88 em 14/07 — quase o
-- dobro do que o cliente pretendia, direto na causa mais provável do
-- bloqueio (denúncia de destinatário por volume/frequência sentidos como spam).
--
-- daily_send_cap agora é o teto de VERDADE por número — campanha,
-- follow-up, automação e resposta automática (zapi-webhook) todos
-- respeitam o MESMO orçamento, nunca somam mais que isso juntos no mesmo
-- número. NULL = mantém o comportamento antigo (teto global de 100).
-- =============================================

alter table client_numbers add column if not exists daily_send_cap integer;

comment on column client_numbers.daily_send_cap is
  'Teto REAL de mensagens/dia para este número, somando campanha + follow-up + automação + resposta automática. NULL = usa o padrão global (100). Recomendado começar baixo (15-20) em números novos/recém-conectados e subir aos poucos (warm-up).';

-- Número da Dra Thais Hassum (conectado 2026-06-30, bloqueado ~2026-07-14)
-- — teto real de 50/dia, do jeito que o cliente já pretendia.
update client_numbers set daily_send_cap = 50 where id = '0fb6dcbe-8374-4984-9ee3-fc17408f2017';
