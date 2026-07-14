-- =============================================
-- ZapFlow — Constraint faltante em conversation_states (2026-07-14)
-- Rode isso UMA VEZ no SQL Editor do Supabase.
--
-- Bug CRÍTICO real: conversation_states tinha 0 linhas, desde sempre.
-- O código do zapi-webhook faz `.upsert(..., { onConflict:
-- "contact_id,campaign_id" })` em 2 lugares (fluxo "EU QUERO" pergunta
-- turno, e fluxo "ask_choice" de sub-opções por botão) — mas a tabela
-- NUNCA teve uma constraint UNIQUE nessas colunas, só PRIMARY KEY em
-- `id`. Sem a constraint, todo upsert falha com erro do Postgres ("no
-- unique or exclusion constraint matching the ON CONFLICT specification")
-- — e como o código não checava o `error` de retorno do Supabase-js
-- (que não lança exceção, só devolve {data:null, error}), a falha era
-- 100% silenciosa: a pergunta (manhã/tarde, ou sub-opção) era enviada
-- normalmente, mas o estado nunca era salvo. Resultado: quando a pessoa
-- respondia "manhã" ou "tarde" (ou clicava na sub-opção), o código
-- procurava um estado que nunca existiu, não encontrava nada, e a
-- resposta simplesmente não era processada — sem confirmação, sem aviso
-- pra equipe. Achado 2026-07-14 a partir de um caso real (Neuza Miller,
-- Clínica Hassum) que respondeu "eu quero a limpeza", recebeu a pergunta
-- de turno, mas nada aconteceu depois.
--
-- Confirmado sem duplicatas existentes (0 linhas na tabela) — constraint
-- pode ser adicionada direto, sem precisar de deduplicação antes.
-- =============================================

alter table conversation_states
  add constraint conversation_states_contact_campaign_unique unique (contact_id, campaign_id);
