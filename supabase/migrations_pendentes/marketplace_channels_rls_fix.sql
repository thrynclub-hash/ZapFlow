-- Bug de seguranca real (2026-11-09): "Client select own marketplace_channels"
-- dava SELECT na linha inteira pro cliente autenticado (RLS e row-level,
-- nao esconde colunas) -- vazava access_token, refresh_token e ate o
-- client_secret do app Bling via supabase.from('marketplace_channels').select('*')
-- direto do navegador. As edge functions agora leem via service role, apos
-- resolver o client_id pelo profile do chamador (ver bling-estoque/index.ts).
-- Ja aplicado em producao; este arquivo documenta a migration.
drop policy if exists "Client select own marketplace_channels" on marketplace_channels;
