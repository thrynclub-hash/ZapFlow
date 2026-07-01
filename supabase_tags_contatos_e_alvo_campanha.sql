-- =============================================
-- ZapFlow — Tags de contato (Novo/Antigo) + campanha por tag-alvo (2026-07-01)
--
-- Pedido do Leonardo: orientar o cliente a marcar contato novo com a tag
-- "Novo" ao cadastrar; os contatos que já estavam salvos antes disso
-- viram "Antigo" (feito aqui, uma vez, em massa). O status Ativo/Inativo
-- já existe (contacts.status, adicionado em supabase_automacoes_avancadas.sql)
-- e já é usado pelo motor de envio — não é redundante com a tag, é uma
-- coisa a mais: tag = "é novo ou é da base antiga", status = "ainda tá
-- ativo ou faz tempo que sumiu" (você marca Inativo manualmente quando
-- perceber que um contato específico não aparece mais).
--
-- Também adiciona campaigns.target_tags — filtro de público por tag:
--   NULL/vazio = manda pra todo mundo Ativo (comportamento de sempre)
--   ['Antigo'] = manda só pra quem tem a tag Antigo
--   ['Novo']   = manda só pra quem tem a tag Novo
-- =============================================

-- 1. Coluna nova em campaigns
alter table campaigns add column if not exists target_tags text[];
comment on column campaigns.target_tags is 'Filtro de público por tag (ex: {Antigo} ou {Novo}). NULL/vazio = todos os contatos ativos, sem filtro.';

-- 2. Tag em massa: todo contato que já existia ganha "Antigo" (só se ainda
-- não tiver nem "Antigo" nem "Novo" — idempotente, seguro rodar de novo)
update contacts
set tags = array_append(tags, 'Antigo')
where not ('Antigo' = any(tags))
  and not ('Novo' = any(tags));

-- 3. Aplica o alvo nas campanhas da Hassum que já existem:
--    Semana 1-4 (+ seus follow-ups) -> só contatos "Antigo"
--    Campanha 5-7 (extras) -> só contatos "Novo"
do $$
declare
  v_client_id uuid;
begin
  select id into v_client_id from clients where name ilike '%hassum%' limit 1;
  if v_client_id is null then
    raise notice 'Cliente "Hassum" não encontrado — pulei a parte de aplicar alvo nas campanhas existentes (rode manualmente se precisar).';
    return;
  end if;

  update campaigns
  set target_tags = array['Antigo']
  where client_id = v_client_id
    and name ilike 'Semana %';

  update campaigns
  set target_tags = array['Novo']
  where client_id = v_client_id
    and name ilike 'Campanha %';
end $$;
