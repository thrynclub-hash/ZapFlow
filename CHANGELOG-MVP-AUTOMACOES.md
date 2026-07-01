# Changelog — MVP de Automações + Correções de Segurança

> Branch: `megabrain/mvp-automacoes-seguranca` · Gerado via Mega Brain (Cowork) em 2026-07-01
> Contexto completo: `agents/cargo/CTO-ZAPFLOW/` no repositório Mega Brain

## O que mudou

### Segurança (ver `supabase_security_fixes.sql`)
- `conversation_states` estava com policy aberta entre clientes (`using (true)`) — corrigido para escopo por `client_id`, igual ao resto do schema
- Nova tabela `client_auth_secrets` para eventualmente separar senha de cliente da tabela `clients` (migração de dados comentada, não executada automaticamente)
- Senha de admin em texto puro removida de `supabase_schema.sql` (histórico do git ainda tem — trocar a senha real no painel)

### Automações (ver `supabase_automations.sql` + `supabase/functions/run-automations/`)
- Schema novo: `automations`, `automation_steps`, `automation_runs`, `automation_run_logs`
- Edge Function `run-automations`: motor server-side que (1) inscreve aniversariantes automaticamente, (2) avança automações passo a passo, (3) processa campanhas `scheduled`/`daily` que já existiam na UI mas não tinham motor nenhum rodando
- Página `/automations` no painel do cliente: criar automação linear com gatilho de aniversário, ações (enviar WhatsApp, adicionar tag, esperar) e um "portão" de condição (só continua se tiver tag)

## O que NÃO está pronto (documentado, não escondido)

- Gatilhos `tag_added` e `first_purchase` — precisam de evento real disparando, não só polling (ver TODO em `supabase/functions/run-automations/README.md`)
- Condição `has_replied` — precisa de webhook de mensagens recebidas da Z-API, que não existe no projeto ainda; sempre retorna `false`
- `zapi_token` ainda é lido pelo navegador em `NewCampaign.jsx` e `Birthdays.jsx` (envio manual/imediato) — só o novo motor de automações e campanhas agendadas/diárias já manda pelo servidor. Migrar o envio "agora" para servidor fica para uma próxima leva.
- Login por `access_key` (item 2 do `SECURITY-FINDINGS-2026-07-01.md`) não foi alterado nesta leva — precisa ser testado em produção antes de decidir a correção.

## Passos manuais necessários (nenhum aplicado automaticamente)

1. Rodar `supabase_security_fixes.sql` no SQL Editor do projeto (`bhiggyigsrqfabqhutne`)
2. Rodar `supabase_automations.sql` no SQL Editor
3. Trocar a senha do usuário admin (Authentication > Users)
4. Deploy da função: `supabase functions deploy run-automations --no-verify-jwt`
5. Agendar a função para rodar a cada 5 min (Dashboard > Database > Cron, ou `pg_cron` — exemplo em `supabase/functions/run-automations/README.md`)
6. Testar criando uma automação de aniversário com um contato cujo `birth_date` seja hoje
