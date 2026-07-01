-- =============================================
-- ZapFlow — Configuração da Clínica Hassum (2026-07-01)
-- Execute no SQL Editor DEPOIS de supabase_automacoes_avancadas.sql
--
-- Isso cria: as 4 campanhas semanais + os 4 follow-ups (2 dias sem
-- resposta) + o fluxo de resposta "EU QUERO".
--
-- Busca o client_id pelo nome (não hardcoda UUID) — se o nome da
-- clínica no banco for diferente de "Hassum", ajuste o "where" abaixo.
-- =============================================

do $$
declare
  v_client_id uuid;
  v_number_id uuid;
  v_c1 uuid; -- Semana 1: Limpeza
  v_c2 uuid; -- Semana 2: Clareamento
  v_c3 uuid; -- Semana 3: Harmonização
  v_c4 uuid; -- Semana 4: Implante
  v_base_url text := 'https://bhiggyigsrqfabqhutne.supabase.co/storage/v1/object/public/creatives/hassum/';
begin
  select id into v_client_id from clients where name ilike '%hassum%' limit 1;
  if v_client_id is null then
    raise exception 'Cliente "Hassum" não encontrado em clients — ajuste o filtro do script.';
  end if;

  select id into v_number_id from client_numbers where client_id = v_client_id and active = true order by created_at limit 1;
  if v_number_id is null then
    raise exception 'Nenhum número WhatsApp ativo encontrado para este client_id — cadastre o número antes de rodar este script.';
  end if;

  -- ---------------------------------------------
  -- SEMANA 1 — Limpeza + revisão semestral
  -- ---------------------------------------------
  select id into v_c1 from campaigns where client_id = v_client_id and name = 'Semana 1 - Limpeza e revisão semestral';
  if v_c1 is null then
    insert into campaigns (client_id, number_id, name, caption, image_url, type, status, scheduled_for)
    values (
      v_client_id, v_number_id, 'Semana 1 - Limpeza e revisão semestral',
      E'Oi, {{nome}}! Tudo bem? 😊 Aqui é da Dra. Thaís Hassum. Passando pra lembrar que a limpeza semestral é super importante pro seu sorriso — e quem sabe já está na hora da sua! 🦷\n\nLimpeza + revisão completa\n📍 Jd. Bom Princípio, Indaiatuba\n\nTemos horários disponíveis essa semana!\n\nResponde *EU QUERO* que já te enviamos os horários disponíveis 👇',
      v_base_url || 'foto4-fundo-branco-apontando.jpg',
      'scheduled', 'draft', null
    ) returning id into v_c1;
  end if;

  if not exists (select 1 from campaigns where client_id = v_client_id and name = 'Semana 1 - Follow-up (2 dias)') then
    insert into campaigns (client_id, number_id, name, caption, type, status, follow_up_of, follow_up_delay_days)
    values (
      v_client_id, v_number_id, 'Semana 1 - Follow-up (2 dias)',
      E'Oi, {{nome}}! 👋 Passando rapidinho...\n\nAinda temos alguns horários disponíveis para a sua limpeza esta semana. Que tal cuidar do seu sorriso?\n\nQualquer dúvida é só chamar 😊',
      'followup', 'scheduled', v_c1, 2
    );
  end if;

  -- ---------------------------------------------
  -- SEMANA 2 — Clareamento dental
  -- ---------------------------------------------
  select id into v_c2 from campaigns where client_id = v_client_id and name = 'Semana 2 - Clareamento dental';
  if v_c2 is null then
    insert into campaigns (client_id, number_id, name, caption, image_url, type, status, scheduled_for)
    values (
      v_client_id, v_number_id, 'Semana 2 - Clareamento dental',
      E'Oi, {{nome}}! ✨ Esse mês a Dra. Thaís está com uma condição especial no *Clareamento Dental* — o procedimento que transforma o sorriso de verdade! ☀️\n\nResultado visível já na 1ª sessão 🦷\nRealizado pela própria Dra. Thaís\n💛 Sorriso mais branco e autoestima lá em cima\n\nVagas limitadas pra esse mês! Quer garantir a sua?\n\nResponde *EU QUERO* 👇',
      v_base_url || 'foto3-blazer-cruzado.jpg',
      'scheduled', 'draft', null
    ) returning id into v_c2;
  end if;

  if not exists (select 1 from campaigns where client_id = v_client_id and name = 'Semana 2 - Follow-up (2 dias)') then
    insert into campaigns (client_id, number_id, name, caption, type, status, follow_up_of, follow_up_delay_days)
    values (
      v_client_id, v_number_id, 'Semana 2 - Follow-up (2 dias)',
      E'{{nome}}, ainda dá tempo! 😊\n\nAs vagas do clareamento especial estão quase esgotando por aqui. Se quiser garantir a sua, é só me falar!',
      'followup', 'scheduled', v_c2, 2
    );
  end if;

  -- ---------------------------------------------
  -- SEMANA 3 — Harmonização facial + Botox
  -- ---------------------------------------------
  select id into v_c3 from campaigns where client_id = v_client_id and name = 'Semana 3 - Harmonização facial e Botox';
  if v_c3 is null then
    insert into campaigns (client_id, number_id, name, caption, image_url, type, status, scheduled_for)
    values (
      v_client_id, v_number_id, 'Semana 3 - Harmonização facial e Botox',
      E'Oi, {{nome}}! 💛 Você sabia que a Dra. Thaís também é especialista em harmonização facial e Botox?\n\nÉ um procedimento seguro, sem cirurgia, resultado natural — e feito por dentista especialista com mais de 20 anos de experiência em Indaiatuba ✨\n\n✅ Harmonização orofacial\n✅ Toxina botulínica (Botox)\n✅ Preenchimento labial\n\n*Este mês temos condição especial para pacientes da clínica!*\n\nQuer saber mais? Responde *EU QUERO* 👇',
      v_base_url || 'foto2-blazer-mao-queixo.jpg',
      'scheduled', 'draft', null
    ) returning id into v_c3;
  end if;

  if not exists (select 1 from campaigns where client_id = v_client_id and name = 'Semana 3 - Follow-up (2 dias)') then
    insert into campaigns (client_id, number_id, name, caption, type, status, follow_up_of, follow_up_delay_days)
    values (
      v_client_id, v_number_id, 'Semana 3 - Follow-up (2 dias)',
      E'{{nome}}, olha só... 😍\n\nSemana passada tivemos vários atendimentos de harmonização e os resultados ficaram incríveis! Ainda temos horários disponíveis.\n\nQue tal agendar uma avaliação sem compromisso?',
      'followup', 'scheduled', v_c3, 2
    );
  end if;

  -- ---------------------------------------------
  -- SEMANA 4 — Implante dental (avaliação gratuita)
  -- ---------------------------------------------
  select id into v_c4 from campaigns where client_id = v_client_id and name = 'Semana 4 - Implante dental (avaliação gratuita)';
  if v_c4 is null then
    insert into campaigns (client_id, number_id, name, caption, image_url, type, status, scheduled_for)
    values (
      v_client_id, v_number_id, 'Semana 4 - Implante dental (avaliação gratuita)',
      E'Oi, {{nome}}! 😊 Perdeu um dente ou conhece alguém que usa dentadura e sofre com isso?\n\nHoje existe solução definitiva: o *Implante Dental* — dente fixo, confortável e com aparência completamente natural. A Dra. Thaís tem mais de 20 anos de experiência em implantes aqui em Indaiatuba 🦷\n\n✅ Avaliação *GRATUITA* e sem compromisso\n✅ Financiamento disponível\n✅ Resultado permanente\n\nQuer agendar sua avaliação? Responde *EU QUERO* 👇',
      v_base_url || 'foto5-blusa-creme-cruzado.jpg',
      'scheduled', 'draft', null
    ) returning id into v_c4;
  end if;

  if not exists (select 1 from campaigns where client_id = v_client_id and name = 'Semana 4 - Follow-up (2 dias)') then
    insert into campaigns (client_id, number_id, name, caption, type, status, follow_up_of, follow_up_delay_days)
    values (
      v_client_id, v_number_id, 'Semana 4 - Follow-up (2 dias)',
      E'{{nome}}, a avaliação de implante é totalmente gratuita e sem compromisso 😊\n\nMuita gente não sabe que o implante hoje é mais acessível do que parece, e temos opções de parcelamento. Que tal conhecer pessoalmente?',
      'followup', 'scheduled', v_c4, 2
    );
  end if;

  -- ---------------------------------------------
  -- Fluxo "EU QUERO" -> pergunta turno -> confirma -> notifica Paulo
  -- notify_phone fica NULL até você rodar o UPDATE no final deste
  -- arquivo com o número de verdade do Paulo.
  -- ---------------------------------------------
  insert into reply_flows (client_id, enabled, trigger_keyword, ask_period_message, confirm_message, notify_phone)
  values (
    v_client_id, true, 'eu quero, quero, eu qro, qro, quero sim, bora, pode ser, com certeza, isso',
    'Que ótimo, {{nome}}! 😊 Você prefere atendimento pela manhã ou à tarde?',
    'Perfeito! Em breve nossa equipe entra em contato pra confirmar seu horário 🗓️',
    null
  )
  on conflict (client_id) do update set
    enabled = excluded.enabled,
    trigger_keyword = excluded.trigger_keyword,
    ask_period_message = excluded.ask_period_message,
    confirm_message = excluded.confirm_message;

  raise notice 'Configurado para client_id=%, number_id=%. Campanhas: %, %, %, %', v_client_id, v_number_id, v_c1, v_c2, v_c3, v_c4;
end $$;

-- ---------------------------------------------
-- RODAR SEPARADO, DEPOIS DE SABER O NÚMERO DO PAULO:
-- ---------------------------------------------
-- update reply_flows set notify_phone = '5519XXXXXXXXX'
--   where client_id = (select id from clients where name ilike '%hassum%' limit 1);

-- Paulo confirmado 2026-07-01: mesmo número da clínica.
update reply_flows set notify_phone = '5519997818773'
  where client_id = (select id from clients where name ilike '%hassum%' limit 1);

-- ---------------------------------------------
-- Se você já rodou este script ANTES desta correção (campanhas nasceram
-- com scheduled_for já preenchido, disparando sozinhas), rode isso pra
-- voltar pro modo "rascunho, só dispara quando eu mandar":
-- ---------------------------------------------
-- update campaigns set status = 'draft', scheduled_for = null
--   where client_id = (select id from clients where name ilike '%hassum%' limit 1)
--   and type = 'scheduled' and follow_up_of is null;
