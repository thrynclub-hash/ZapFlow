-- =============================================
-- ZapFlow — 3 campanhas extras da Clínica Hassum (2026-07-01)
-- Execute DEPOIS de supabase_seed_hassum.sql
--
-- Pedido do Leonardo: 3 criativos a mais, deixados como RASCUNHO
-- genérico — sem data marcada, sem disparo automático — pra clínica
-- usar quando quiser, ou só trocar a imagem antes de disparar:
--   Campanha 5 - Terapia Neural       (pra usar depois de terminar as 4 semanas)
--   Campanha 6 - Autoridade da Dra. Thaís  (alternar entre campanhas, gerar autoridade)
--   Campanha 7 - Institucional/Relacionamento (manter relacionamento)
--
-- Sem follow-up vinculado (não foi pedido pra essas 3). Sem imagem
-- fixada no script — as imagens já foram subidas por você em Criativos;
-- depois de rodar isso, abre o Histórico, clica em "Adicionar imagem"
-- em cada uma dessas 3 e cola o link copiado da página Criativos (ou
-- sobe o arquivo de novo direto ali).
--
-- Idempotente: seguro rodar mais de uma vez, não duplica.
-- =============================================

do $$
declare
  v_client_id uuid;
  v_number_id uuid;
  v_c5 uuid;
  v_c6 uuid;
  v_c7 uuid;
begin
  select id into v_client_id from clients where name ilike '%hassum%' limit 1;
  if v_client_id is null then
    raise exception 'Cliente "Hassum" não encontrado — ajuste o filtro do script.';
  end if;

  select id into v_number_id from client_numbers where client_id = v_client_id and active = true order by created_at limit 1;
  if v_number_id is null then
    raise exception 'Nenhum número WhatsApp ativo encontrado para este client_id.';
  end if;

  -- ---------------------------------------------
  -- CAMPANHA 5 — Terapia Neural (pra usar depois das 4 semanas)
  -- ---------------------------------------------
  select id into v_c5 from campaigns where client_id = v_client_id and name = 'Campanha 5 - Terapia Neural';
  if v_c5 is null then
    insert into campaigns (client_id, number_id, name, caption, type, status, scheduled_for)
    values (
      v_client_id, v_number_id, 'Campanha 5 - Terapia Neural',
      E'Oi, {{nome}}! 😊\nVocê conhece a Terapia Neural?\nÉ um tratamento que busca estimular o equilíbrio do organismo e pode auxiliar em casos de dores crônicas, inflamações e outras disfunções, sempre com uma avaliação individualizada.\nA Dra. Thaís Hassum também é especialista nessa abordagem e está disponível para esclarecer suas dúvidas.\nSe quiser saber se esse tratamento é indicado para você, comente EU QUERO que nossa equipe entra em contato. 💛',
      'scheduled', 'draft', null
    );
  end if;

  -- ---------------------------------------------
  -- CAMPANHA 6 — Autoridade da Dra. Thaís
  -- ---------------------------------------------
  select id into v_c6 from campaigns where client_id = v_client_id and name = 'Campanha 6 - Autoridade da Dra. Thaís';
  if v_c6 is null then
    insert into campaigns (client_id, number_id, name, caption, type, status, scheduled_for)
    values (
      v_client_id, v_number_id, 'Campanha 6 - Autoridade da Dra. Thaís',
      E'Oi, {{nome}}! 💛\nHá mais de 20 anos, a Dra. Thaís Hassum cuida da saúde e da autoestima de pacientes em Indaiatuba, oferecendo tratamentos com atenção, segurança e um atendimento verdadeiramente humanizado.\nSe você está pensando em fazer um implante, clareamento, harmonização facial ou apenas realizar uma avaliação odontológica, será um prazer receber você na clínica.\nComente EU QUERO e nossa equipe enviará todas as informações e os horários disponíveis. 😊',
      'scheduled', 'draft', null
    );
  end if;

  -- ---------------------------------------------
  -- CAMPANHA 7 — Institucional / Relacionamento
  -- ---------------------------------------------
  select id into v_c7 from campaigns where client_id = v_client_id and name = 'Campanha 7 - Institucional e Relacionamento';
  if v_c7 is null then
    insert into campaigns (client_id, number_id, name, caption, type, status, scheduled_for)
    values (
      v_client_id, v_number_id, 'Campanha 7 - Institucional e Relacionamento',
      E'Oi, {{nome}}! 😊\nSeu sorriso merece cuidado em todas as fases da vida.\nNa clínica da Dra. Thaís Hassum, você encontra um atendimento acolhedor, tecnologia, experiência e tratamentos personalizados para cuidar da sua saúde bucal e da sua autoestima.\nEstamos prontos para receber você e sua família!\nComente EU QUERO que nossa equipe enviará todas as informações e ajudará a agendar sua consulta. 🦷✨',
      'scheduled', 'draft', null
    );
  end if;

  raise notice 'Campanhas extras configuradas para client_id=%. IDs: %, %, %', v_client_id, v_c5, v_c6, v_c7;
end $$;
