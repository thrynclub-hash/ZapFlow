-- =============================================
-- ZapFlow — Limpeza de campanhas duplicadas (2026-07-01)
-- Rode isso UMA VEZ no SQL Editor do Supabase, ANTES (ou depois, tanto faz)
-- de rodar de novo o supabase_seed_hassum.sql corrigido.
--
-- Por quê: supabase_seed_hassum.sql (versão antiga) inseria as 4
-- campanhas semanais + 4 follow-ups sem checar se já existiam — cada
-- vez que o script rodava de novo, duplicava tudo (por isso "4 semana 1"
-- aparecendo no Histórico). A versão nova do script já é segura para
-- rodar mais de uma vez; isso aqui só limpa a bagunça que já existe.
--
-- O que faz: para cada nome de campanha duplicado do mesmo cliente,
-- mantém a linha MAIS ANTIGA (created_at menor) e apaga o resto —
-- junto com qualquer message_log associado às duplicatas apagadas
-- (senão a FK trava o delete).
-- =============================================

do $$
declare
  v_client_id uuid;
begin
  select id into v_client_id from clients where name ilike '%hassum%' limit 1;
  if v_client_id is null then
    raise exception 'Cliente "Hassum" não encontrado — ajuste o filtro do script.';
  end if;

  -- Apaga message_logs de campanhas duplicadas (mantendo a mais antiga por nome)
  delete from message_logs where campaign_id in (
    select id from (
      select id, row_number() over (partition by client_id, name order by created_at asc) as rn
      from campaigns
      where client_id = v_client_id
    ) ranked
    where rn > 1
  );

  -- Apaga as campanhas duplicadas em si
  delete from campaigns where id in (
    select id from (
      select id, row_number() over (partition by client_id, name order by created_at asc) as rn
      from campaigns
      where client_id = v_client_id
    ) ranked
    where rn > 1
  );

  raise notice 'Limpeza concluída para client_id=%', v_client_id;
end $$;

-- Verificação: depois de rodar, isso deve devolver 8 linhas (4 semanas + 4 follow-ups),
-- cada nome aparecendo exatamente 1 vez:
-- select name, count(*) from campaigns where client_id = (select id from clients where name ilike '%hassum%' limit 1) group by name order by name;
