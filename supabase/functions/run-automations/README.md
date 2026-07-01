# run-automations — Motor de Execução

Processa, a cada chamada:
1. **Enroll** — entra contatos aniversariantes de hoje nas automações ativas com gatilho `birthday`
2. **Process** — avança `automation_runs` que estão `running` ou `waiting` com `resume_at` vencido
3. **Campanhas** — dispara campanhas `scheduled`/`daily` que ainda não têm motor nenhum hoje (ver `SECURITY-FINDINGS-2026-07-01.md` item 6)

## Deploy

```bash
supabase functions deploy run-automations --no-verify-jwt
```

`--no-verify-jwt` porque quem chama essa função é o agendador (cron), não um usuário logado. Alternativa mais segura: manter `verify_jwt` ligado e chamar com a service role key no header — ajustar conforme preferir.

## Agendar

No Supabase Dashboard: Database → Cron Jobs → nova entrada, a cada 5 minutos, chamando a URL da função. Ou via `pg_cron` + `pg_net`:

```sql
select cron.schedule(
  'run-automations-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://bhiggyigsrqfabqhutne.supabase.co/functions/v1/run-automations',
    headers := jsonb_build_object('Authorization', 'Bearer SERVICE_ROLE_KEY_AQUI')
  );
  $$
);
```

## Blocos implementados nesta versão (MVP)

| Tipo | Bloco | Status |
|---|---|---|
| Gatilho | `birthday` | ✅ funcional (varre `contacts.birth_date`) |
| Gatilho | `tag_added`, `first_purchase` | ❌ não implementado — precisa de um evento real (trigger de banco ou chamada do frontend), não só polling. Ver TODO abaixo. |
| Ação | `send_whatsapp` | ✅ funcional (Z-API, server-side — token nunca sai do backend) |
| Ação | `add_tag` | ✅ funcional |
| Ação | `wait` | ✅ funcional (`config.days` / `config.hours`) |
| Condição | `has_tag` | ✅ funcional |
| Condição | `has_replied` | ❌ não implementado — sempre retorna `false`. Precisa de um webhook de mensagens recebidas da Z-API, que não existe no projeto ainda. |

## TODO antes de expandir gatilhos/condições

- **`tag_added`**: criar uma chamada explícita da UI quando uma tag é adicionada manualmente, ou um trigger de Postgres em `contacts` que insere um evento numa tabela de fila
- **`first_purchase`**: depende de existir algum conceito de "compra" no sistema — hoje não há tabela de pedidos/vendas no schema. Definir isso é decisão de produto antes de virar gatilho.
- **`has_replied`**: implementar endpoint de webhook (`supabase/functions/zapi-webhook`) que recebe mensagens recebidas da Z-API e grava numa tabela `inbound_messages`, aí sim a condição pode checar isso de verdade.
