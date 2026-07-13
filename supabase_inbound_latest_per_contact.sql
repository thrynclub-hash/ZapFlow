-- =============================================
-- ZapFlow — Uma linha por contato em Conversas (2026-07-13)
--
-- Pedido do Leonardo: a tela Conversas repetia o mesmo contato várias
-- vezes (ex: "Tatiana" mandou 5 mensagens seguidas = 5 linhas) — ele quer
-- ver só a ÚLTIMA mensagem de cada pessoa, pra bater o olho e saber se
-- aquela conversa foi resolvida ou não, sem repetição.
--
-- View com security_invoker=true: roda com o RLS de quem consulta (não do
-- dono da view) — herda automaticamente a mesma policy que já existe em
-- inbound_messages ("Inbound messages own": client_id = my_client_id()),
-- sem precisar duplicar regra de segurança nem criar policy própria pra
-- view. Suportado desde Postgres 15 (projeto está no 17.6).
-- =============================================

create or replace view inbound_messages_latest
with (security_invoker = true) as
select distinct on (contact_id)
  id, client_id, contact_id, campaign_id, number_id, phone, message, received_at, status
from inbound_messages
where contact_id is not null and campaign_id is not null
order by contact_id, received_at desc;

grant select on inbound_messages_latest to authenticated, anon;
