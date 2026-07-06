-- ZapFlow — Corrige dois bugs reais encontrados em 2026-07-06 durante
-- debug de "Z-API paga/conectada mas mensagem não chega":
--
-- 1. try_consume_daily_send_budget reservava a vaga do limite diário
--    (100 msgs/número/dia) ANTES de saber se o envio ia dar certo, e
--    nunca devolvia a vaga se a Z-API recusasse depois (Client-Token
--    errado, telefone sem código do país, etc.). Resultado real: uma
--    campanha (Dra Thais Hassum) tentou mandar pra 100 contatos reais
--    entre 09h05 e 10h05, TODAS as 100 tentativas falharam com
--    "Z-API error: 403" (Client-Token antigo, já corrigido), e o limite
--    diário ficou esgotado sem UMA mensagem sequer ter sido entregue.
--    Esta migração já foi aplicada manualmente em produção (autorizado
--    pelo Leonardo) — este arquivo é o registro/histórico.
--
-- 2. campaigns.last_daily_run e campaigns.daily_sent_today (usadas pelo
--    run-automations pra espalhar os envios proporcionalmente ao longo
--    da janela de horário comercial, ex: 9h-18h) nunca existiam de
--    verdade na tabela — só no código. Cada ciclo do cron (5 em 5 min)
--    "esquecia" quanto já tinha tentado e tentava até 15 de novo, sem
--    acumular. O único freio real era o limite de 100/dia (bug 1 acima),
--    por isso as 100 tentativas saíram todas espremidas numa hora, em
--    vez de espalhadas nas 9 horas da janela comercial.

alter table campaigns
  add column if not exists last_daily_run date,
  add column if not exists daily_sent_today int not null default 0;

create or replace function refund_daily_send_budget(p_number_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update daily_send_counters
    set count = greatest(count - 1, 0)
    where number_id = p_number_id and send_date = current_date;
end;
$$;

grant execute on function refund_daily_send_budget(uuid) to authenticated, service_role;
