-- =============================================
-- ZapFlow — Triagem de mensagens recebidas (2026-07-13)
-- Rode isso UMA VEZ no SQL Editor do Supabase (ou via
-- `npx supabase db query --linked "$(cat supabase_inbound_status.sql)"`).
--
-- Por quê: nos relatórios, qualquer mensagem recebida já contava como
-- "respondida" (Reports.jsx já lê inbound_messages inteiro) — isso estava
-- certo. O problema real é que ninguém conseguia LER o que a pessoa
-- escreveu quando não era clique de botão nem "eu quero": ficava só no
-- banco, sem tela nenhuma no ZapFlow pra ver (achado com dado real da
-- Hassum: 211 mensagens recebidas, várias perguntas genuínas tipo "qual o
-- valor pra colocar um dente" nunca vistas por ninguém da clínica).
--
-- Esta coluna dá suporte pra tela de "Conversas" (src/pages/Conversations.jsx):
-- cada mensagem recebida nasce 'novo', e quem responde manualmente marca
-- como 'resolvido' (tratou) ou 'ignorado' (spam/engano/não precisa ação).
-- =============================================

alter table inbound_messages add column if not exists status text not null default 'novo';

comment on column inbound_messages.status is
  'novo | resolvido | ignorado — triagem manual de quem respondeu algo que o robô não reconheceu automaticamente (ver zapi-webhook notifyUnrecognized). Sem CHECK constraint, mesmo padrão de campaigns.status.';

create index if not exists idx_inbound_messages_client_status on inbound_messages (client_id, status, received_at desc);
