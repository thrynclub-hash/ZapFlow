# Research: Phase 1 — Ambiente Isolado

**Phase goal:** um ambiente técnico completo e isolado (banco + deploy) onde toda a Fase 2 pode ser construída e revisada visualmente por Leonardo, sem qualquer risco à V1 em produção (Clínica Hassum, 1190 contatos reais).

**Método:** leitura de `.planning/{PROJECT,REQUIREMENTS,STATE,ROADMAP}.md`, `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS}.md`, todos os `supabase_*.sql` do repo root, `supabase/functions/*`, `vercel.json`, `package.json`, `vite.config.js`, `.env.example`, mais inspeção read-only ao vivo via Supabase MCP e Vercel CLI (sem provisionar nada).

---

## Overview

O repo tem hoje **zero infraestrutura formal de migração** — o schema inteiro vive em 19 arquivos `supabase_*.sql` soltos na raiz, escritos para serem colados manualmente no SQL Editor do Supabase, em ordem cronológica (não há `supabase/migrations/`, nem `supabase/config.toml`). Isso muda a estratégia de replicação: não existe um `supabase db push` a fazer — é preciso **aplicar os arquivos SQL na ordem certa** (determinada abaixo via `git log`) contra o projeto novo.

Duas descobertas de ambiente, feitas checando as ferramentas ao vivo (sem criar nada), mudam como o plano deve ser escrito:

1. **A produção real já está estruturalmente inacessível a partir desta sessão.** O projeto Supabase de produção (`bhiggyigsrqfabqhutne`, listado em `supabase/.temp/linked-project.json`) pertence à organização Supabase `mwkjwallfderomyllbta` ("Marusso Projetos"). A sessão MCP disponível aqui está autenticada em **outra organização**, "Marusso Produções" (`pyuobhdhrchsqqqxhqff`), que só enxerga 2 projetos (`PhotoForge`, `leonardo-ecossistema`) — nenhum deles é o ZapFlow de produção. Ou seja: **nenhuma chamada MCP nesta sessão consegue, nem por engano, tocar o banco de produção** — é isolamento por credencial, não só por disciplina.
2. **Não existe projeto Vercel chamado "zapflow" (ou variante) no escopo Vercel autenticado desta sessão** (`leonardo-marussos-projects-8d614f58`, 10 projetos, nenhum ZapFlow). Isso é tratado em detalhe na seção de Pitfalls — não bloqueia o plano (podemos criar algo novo com segurança), mas é uma pergunta a fazer a Leonardo antes de declarar a Fase 1 "conectada corretamente".

---

## 1. Supabase: caminho mais rápido para um projeto genuinamente isolado

### MCP vs CLI vs Dashboard

| Caminho | Viável aqui? | Observação |
|---|---|---|
| **Supabase CLI** (`supabase link`, `supabase db push`, `supabase functions deploy`) | **Não instalado** nesta sessão (`supabase: command not found`) | Mesmo se estivesse instalado, é a opção mais arriscada neste repo específico — ver Pitfall #1 abaixo (`linked-project.json` já aponta pra prod). |
| **Supabase MCP tools** (`create_project`, `apply_migration`, `deploy_edge_function`, `execute_sql`) | **Sim, disponível e testado nesta sessão** (list/get calls já confirmados read-only) | **Caminho recomendado.** Cada chamada exige `project_id` explícito — não há "projeto atualmente linkado" ambiente, então não existe risco de ambiguidade sobre qual projeto está sendo alterado. |
| **Dashboard manual** | Sempre disponível como fallback | Necessário para as poucas coisas que nenhuma ferramenta expõe (ver tabela Automatable vs Manual no final). |

**Recomendação: usar as MCP tools do Supabase como caminho principal**, não porque a CLI seria insegura em geral, mas porque *neste repo* a CLI já teria um viés perigoso embutido (ver Pitfall #1).

### create_project vs. Supabase Branching (create_branch) — não confundir

O MCP expõe `create_branch`/`list_branches`/`merge_branch`/`rebase_branch`/`reset_branch`/`delete_branch` (Supabase Branching) **e** `create_project`. São coisas diferentes:

- **Branching** cria uma cópia efêmera/preview **do mesmo projeto pai** — normalmente usada para PRs de curta duração, tipicamente atrelada a plano pago, e semanticamente ainda "pertence" ao projeto de produção (mesma org, mesmo billing, lineage compartilhada).
- **`create_project`** cria um **projeto totalmente novo e independente** — auth própria, service-role key própria, banco próprio, billing próprio.

O objetivo explícito da Fase 1 ("não é uma branch de prod, é um projeto separado, com seu próprio auth/data/service-role-key") **exige `create_project`**, não `create_branch`. Não usar Branching aqui.

### Passo a passo concreto (via MCP)

1. `list_organizations` → confirmar/escolher a organização de destino (ver Pitfall #2 sobre limite de projetos free).
2. `get_cost(type="project", organization_id=...)` → confirmar custo (testado agora: **$0/mês** na org "Marusso Produções").
3. `confirm_cost(type="project", recurrence="monthly", amount=0)` → obter `confirm_cost_id`.
4. `create_project(name="zapflow-fase2", region="sa-east-1", organization_id=..., confirm_cost_id=...)` — região `sa-east-1` (São Paulo) por consistência com os outros 2 projetos já na org e por latência (público-alvo é Brasil).
5. Poll `get_project` até `status = ACTIVE_HEALTHY`.
6. Aplicar os 14 arquivos SQL de schema, **na ordem cronológica abaixo**, via `apply_migration(project_id=novo_ref, name=<slug>, query=<conteúdo do arquivo>)` — um `apply_migration` por arquivo, mesmo nome de slug do arquivo original para rastreabilidade:

   | # | Arquivo | O que cria/altera |
   |---|---|---|
   | 1 | `supabase_schema.sql` | Tabelas base (`clients`, `profiles`, `client_numbers`, `contacts`, `campaigns`, `message_logs`, `birthday_configs`), bucket `creatives`, RLS inicial, `my_client_id()`, `is_admin()` |
   | 2 | `supabase_adicionar_colunas.sql` | `clients.access_key/auth_email/auth_password`, `birthday_configs.image_url`, colunas de `daily_limit`/`daily_start_hour`/etc em `campaigns`, tabela `conversation_states` |
   | 3 | `supabase_automations.sql` | Tabelas `automations`, `automation_steps`, `automation_runs`, `automation_run_logs` + RLS |
   | 4 | `supabase_security_fixes.sql` | Fix RLS de `conversation_states`, cria `client_auth_secrets` |
   | 5 | `supabase_fix_public_key_lookup.sql` | Função `lookup_client_by_key()` |
   | 6 | `supabase_client_real_auth.sql` | Colunas extras em `client_auth_secrets` (synthetic_email/password, auth_user_id) |
   | 7 | `supabase_automacoes_avancadas.sql` | `contacts.status`/`imported_at`, tabela `daily_send_counters`, função `try_consume_daily_send_budget()`, tabelas `inbound_messages`/`reply_flows`, colunas de follow-up em `campaigns` |
   | 8 | `supabase_planos_limites.sql` | Tabela `plan_limits` + seed dos 4 planos (Starter/Growth/Scale/Enterprise) — **dado de referência, não dado de cliente, OK replicar tal qual** |
   | 9 | `supabase_addons.sql` | Tabela `client_addons` |
   | 10 | `supabase_addons_mercadopago.sql` | `client_addons.status`/`mp_preapproval_id` |
   | 11 | `supabase_fix_delete_creatives.sql` | Policies extra de storage (delete/update em `creatives`) |
   | 12 | `supabase_plan_billing.sql` | `clients.plan_next_charge_at`/`plan_billing_cycle_days` |
   | 13 | `supabase_tags_contatos_e_alvo_campanha.sql` | `contacts.tags` (se ainda não existir) + `campaigns.target_tags` |
   | 14 | `supabase_campaign_stop_date.sql` → `supabase_campaign_quick_replies.sql` → `supabase_campaign_daily_window.sql` | `campaigns.stop_at`, `campaigns.quick_replies`, `campaigns.daily_end_hour`/`weekdays_only` (3 arquivos pequenos, aplicar nessa ordem exata — confirmada via `git log --diff-filter=A`) |

   **NÃO aplicar** (confirmado por leitura de conteúdo):
   - `supabase_seed_hassum.sql` e `supabase_seed_hassum_criativos_extra.sql` — **dado real de cliente de produção** (a Clínica Hassum, 1190 contatos, campanhas reais com a voz da Dra. Thaís). Violaria o critério de sucesso #1 da fase.
   - `supabase_cleanup_duplicate_campaigns.sql` — script de reparo pontual de dados que só existiam em produção (remove duplicatas). Projeto novo nasce sem duplicatas, não há o que limpar.

7. Habilitar extensões necessárias antes/durante o passo 7 (`daily_send_counters`/cron): `create extension if not exists pg_cron; create extension if not exists pg_net;` — confirmar com `list_extensions(project_id)` antes, ambas costumam vir disponíveis por padrão no Supabase Cloud, mas precisam ser explicitamente `create extension`d.
8. Agendar o cron do motor de automações **apontando para o projeto novo**, adaptando o exemplo de `supabase/functions/run-automations/README.md`:
   ```sql
   select cron.schedule(
     'run-automations-every-5-min',
     '*/5 * * * *',
     $$
     select net.http_post(
       url := 'https://<REF_DO_PROJETO_NOVO>.supabase.co/functions/v1/run-automations',
       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY_DO_PROJETO_NOVO>')
     );
     $$
   );
   ```
   **Nunca copiar o SQL do README literalmente** — ele tem a URL e é um lembrete textual do padrão de produção; a URL e a service role key têm que ser as do projeto `fase-2`.
9. Deploy das 8 Edge Functions via `deploy_edge_function(project_id=novo_ref, name=..., files=[...], verify_jwt=...)`, preservando o `verify_jwt` de cada uma (ver tabela):

   | Function | `verify_jwt` |
   |---|---|
   | `client-login` | `false` (`--no-verify-jwt` no original — chave de acesso, ainda sem sessão) |
   | `client-provision` | `true` (admin-only) |
   | `send-message` | `true` |
   | `zapi-webhook` | `false` (webhook público) |
   | `zapi-status` | `true` |
   | `mp-webhook` | `false` (webhook público) |
   | `mp-create-preapproval` | `true` |
   | `run-automations` | `false` (chamado pelo cron, não por usuário logado) |

10. Configurar **secrets de Edge Functions** (não é auto-injetado, ver Pitfall #4 — nenhuma MCP tool faz isso, é passo manual/dashboard):
    - `MP_ACCESS_TOKEN` → **token de teste/sandbox do Mercado Pago** (nunca o de produção)
    - `MP_WEBHOOK_SECRET` → valor aleatório novo (não reaproveitar o de prod, se existir)
    - `ZAPI_WEBHOOK_SECRET` → valor aleatório novo
11. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` são **auto-injetados pelo próprio Supabase** em todo projeto novo — nada a fazer manualmente para esses 3.
12. Confirmar RLS e config com `get_advisors(project_id)` antes de considerar a Fase 1 "pronta" (checagem de segurança automática do próprio Supabase).

---

## 2. Git: branching

- Criar branch longa-duração `fase-2` a partir do `main` atual: `git checkout -b fase-2 main`.
- **Atenção antes disso:** o repo local está **7 commits à frente de `origin/main`** (não commitados/pushados ainda, ver `git status`). Empurrar `main` pro GitHub primeiro (`git push origin main`) para que `fase-2` nasça de um `main` remoto atualizado — senão o Vercel (que vai importar o repo do GitHub, não do disco local) não vê os commits mais recentes.
- `git push -u origin fase-2`.
- **Manter sincronizada:** como é branch de longa duração atravessando as Fases 2–5 (múltiplas sessões/semanas), preferir `git merge main` periódico dentro de `fase-2` (não `rebase`) sempre que houver hotfix de produção em `main` — merge preserva histórico e evita reescrever commits que outras sessões/agentes já possam ter baseado trabalho em cima. Cadência sugerida: no início de cada nova Fase (2, 3, 4, 5), antes de planejar/executar, rodar `git merge main` em `fase-2`.
- Não é necessário (nem recomendado) abrir PR de `fase-2` contra `main` até a Fase 2-5 estarem prontas para promoção — é uma branch de trabalho, não uma feature branch curta.

---

## 3. Vercel: segundo deployment independente

### Ponto de atenção descoberto ao vivo

`vercel project ls` no escopo autenticado (`leonardo-marussos-projects-8d614f58`) retorna 10 projetos — **nenhum chamado "zapflow"**. Isso significa uma de duas coisas, e o plano deve tratar isso como pergunta em aberto para Leonardo, não como bloqueio:
- (a) a produção real do ZapFlow está em outro escopo/conta Vercel não visível a partir daqui (ex.: conta separada, ou time diferente) — nesse caso criar um projeto novo aqui é 100% seguro, mas o plano deveria pedir a Leonardo o nome/URL exato do projeto de produção antes de prosseguir, só para registro;
- (b) o ZapFlow ainda não foi de fato implantado num projeto Vercel formal (pode estar rodando de outro jeito, ou "produção" no `PROJECT.md` está descrevendo o estado-alvo/iminente, não um deploy Vercel já existente).

Em ambos os casos, **a ação seguinte do plano não muda**: criar um projeto Vercel novo e dedicado. A diferença é só se vale avisar/perguntar a Leonardo antes de prosseguir (recomendado, é uma linha de pergunta, não trava o trabalho).

### Recomendação: projeto Vercel novo e dedicado (não branch-scoped dentro do projeto existente)

Como não há projeto ZapFlow visível para reaproveitar, a decisão simplifica: criar **`zapflow-fase2`** (ou nome similar) como projeto novo, importando o mesmo repo GitHub (`thrynclub-hash/ZapFlow`). Vantagens de projeto dedicado vs. tentar escopar env vars de Preview por branch dentro de um projeto único:
- Isolamento total por padrão — nenhuma variável de ambiente pode vazar entre prod e fase-2 porque são *projetos* diferentes, não apenas *environments* diferentes do mesmo projeto.
- Não depende de recursos de plano pago (Custom Environments do Vercel Pro/Enterprise) para ter uma "produção" nomeada e estável — um projeto novo já trata a branch padrão dele como quiser.
- URL estável e óbvia: Vercel mantém automaticamente um alias de **Git Branch URL** por branch (`https://zapflow-fase2-git-fase-2-<scope>.vercel.app`), que não muda a cada commit — serve perfeitamente ao critério "Leonardo abre uma URL e vê rodando", mesmo que `fase-2` não seja tecnicamente a "Production branch" do projeto novo.

### Passo a passo concreto

1. `vercel project add zapflow-fase2` (ou equivalente não-interativo) — cria o projeto vazio no escopo `leonardo-marussos-projects-8d614f58`.
2. `vercel link --yes --project zapflow-fase2` dentro do diretório do repo (idealmente com a branch `fase-2` já checked out) para linkar a pasta local.
3. `vercel git connect` (ou configurar via dashboard Settings → Git) para conectar o repositório GitHub `thrynclub-hash/ZapFlow` a este projeto — isso habilita deploy automático a cada push.
4. Definir as env vars do projeto novo (ver seção 4) — como é projeto 100% dedicado, **não há necessidade de escopar por Environment** (Production/Preview/Development podem receber os mesmos valores do Supabase isolado, já que este projeto Vercel nunca vai servir produção real).
5. Deploy inicial: `vercel deploy` (preview, branch `fase-2` não sendo a branch padrão do repo) ou `vercel deploy --prod` se quiser forçar como "Production" deste projeto novo — qualquer um dos dois satisfaz o critério de sucesso, a diferença é só qual rótulo/URL aparece no dashboard Vercel.
6. **Opcional (melhoria, não obrigatório):** para que `fase-2` apareça como a "Production Branch" deste projeto novo (URL mais limpa, sem o sufixo `-git-fase-2-`), mudar em Settings → Git → Production Branch → `fase-2`. A CLI do Vercel não expõe um flag dedicado para isso; é ação de dashboard, **ou** uma chamada direta à API REST da Vercel (`PATCH /v10/projects/{id}` com `{"link":{"productionBranch":"fase-2"}}`) usando o token já autenticado na CLI — tecnicamente automatizável por um agente de execução via `curl`, mas normalmente tratado como passo de dashboard por simplicidade.

---

## 4. Variáveis de ambiente: lista completa e separação

### Frontend (Vercel, prefixo `VITE_`)

| Variável | Produção (não tocar) | `fase-2` (novo) |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://bhiggyigsrqfabqhutne.supabase.co` | `https://<ref-do-projeto-novo>.supabase.co` (via `get_project_url`) |
| `VITE_SUPABASE_ANON_KEY` | anon key de produção | anon key do projeto novo (via `get_publishable_keys`) |

### Edge Functions (Supabase, não passam pelo Vercel)

| Variável | Origem | Ação necessária no projeto novo |
|---|---|---|
| `SUPABASE_URL` | Auto-injetado pelo Supabase | Nenhuma — automático |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injetado pelo Supabase | Nenhuma — automático |
| `SUPABASE_ANON_KEY` | Auto-injetado pelo Supabase | Nenhuma — automático |
| `MP_ACCESS_TOKEN` | Secret manual | **Definir com token de TESTE do Mercado Pago** (dashboard ou CLI `supabase secrets set`) |
| `MP_WEBHOOK_SECRET` | Secret manual, opcional | Gerar valor novo, distinto do de produção |
| `ZAPI_WEBHOOK_SECRET` | Secret manual, opcional | Gerar valor novo, distinto do de produção |

### Prevenção de cross-contaminação

- Como Vercel (`fase-2`) e Supabase (`zapflow-fase2`) são **projetos inteiramente separados** dos de produção (não branches, não environments do mesmo projeto), não existe um "vazamento acidental" possível por engano de escopo de env var — o pior cenário seria alguém copiar/colar manualmente os valores errados. Documentar isso explicitamente no `.env.example`/README da branch `fase-2` (ex.: um comentário "estes valores são do projeto Supabase ISOLADO, nunca copiar os de produção") é a única mitigação adicional necessária, já que a arquitetura por si só já impede o vazamento estrutural.
- **Nunca** commitar os valores reais em `.env` (já gitignored) — usar `vercel env add` (que grava só no Vercel, não no git) para as `VITE_*`, e o mecanismo de secrets do Supabase para as de Edge Functions.

---

## 5. Seed de dados de teste (mínimo para "ver funcionando visualmente")

**Regra dura:** nada disso pode ser os 1190 contatos reais da Clínica Hassum nem reaproveitar `supabase_seed_hassum*.sql`.

Conjunto mínimo recomendado (via `apply_migration`/`execute_sql`, um script novo tipo `seed_fase2_teste.sql`, nunca os scripts de Hassum):

1. **1 `clients`**: ex. `name = 'Clínica Teste (Fase 2)'`, `plan = 'Growth'`, `status = 'active'`.
2. **1 `client_numbers`**: vinculado ao client acima, `active = true`, `zapi_instance_id`/`zapi_token` podem ser placeholders óbvios (`"TESTE-NAO-REAL"`) — não é necessário um número Z-API real funcionando para o critério de sucesso da Fase 1 (ver Pitfall #6); só é necessário se Leonardo quiser validar envio real de mensagem já na Fase 1.
3. **15–30 `contacts`** variados: misturar `status` (`Ativo`/`Inativo`), `tags` (`VIP`, `Descadastrado`, tags livres), `birth_date` incluindo pelo menos 1-2 com aniversário hoje/amanhã (pra `Birthdays.jsx` mostrar algo), telefones fictícios válidos em formato (ex. `5511999990001`...`5511999990030`, nunca números reais de terceiros).
4. **2-3 `campaigns`** em estados diferentes (`draft`, `scheduled`/`active`, `completed`) para popular `Campaigns.jsx`/`Reports.jsx` sem esperar o cron rodar.
5. Alguns `message_logs` correspondentes às campanhas "completed" (sent/error variados) para o relatório não aparecer vazio.
6. `plan_limits` — **pode ser copiado tal qual** do SQL de produção (`supabase_planos_limites.sql`), é dado de referência de produto, não dado de cliente.
7. **Usuários de autenticação reais** (Supabase Auth) — mínimo 2: 1 admin (`role='admin'` em `profiles`) e 1 usuário client (`role='client'`, `client_id` apontando pro client de teste). Precisam ser criados via Dashboard → Authentication → Users (mesma nota que já existe, comentada, em `supabase_schema.sql` linhas 159-173, sobre criar o admin inicial manualmente) — **é passo manual**, não há MCP tool de "criar usuário Auth" na lista disponível aqui.
8. Opcional: 1 `client_addons` de teste, útil quando a Fase 3 (Painel de Consumo) chegar, mas não obrigatório só para a Fase 1.

---

## 6. Pitfalls específicos deste setup

### Pitfall #1 — `supabase/.temp/linked-project.json` já aponta para produção
O repo tem um arquivo de estado local (gitignored, confirmado via `git check-ignore`) `supabase/.temp/linked-project.json` com `{"ref":"bhiggyigsrqfabqhutne", ...}` — o ref de **produção**. Esse arquivo **não é apagado ao trocar de branch git** (é untracked, vive fora do controle do git). Se alguém instalar a Supabase CLI depois e rodar `supabase db push`/`supabase functions deploy` **sem antes rodar `supabase link --project-ref <novo-ref>`**, o comando vai mirar produção por padrão. **Mitigação recomendada no plano:** preferir MCP tools (que exigem `project_id` explícito em toda chamada, sem estado ambiente) em vez de instalar/usar a CLI; se a CLI for mesmo necessária futuramente, o primeiro passo obrigatório é `supabase link --project-ref <ref-do-projeto-fase-2>` e conferir o conteúdo do `.temp/linked-project.json` resultante antes de qualquer deploy.

### Pitfall #2 — Limite de projetos free por organização Supabase
A organização visível nesta sessão ("Marusso Produções", plano `free`) **já tem 2 projetos `ACTIVE_HEALTHY`** (`PhotoForge`, `leonardo-ecossistema`). O plano Free do Supabase historicamente limita a **2 projetos ativos por organização**. Tentar `create_project` numa 3ª vez nesta org pode falhar. Não há MCP tool de "criar organização nova" na lista disponível — criação de org é ação de **dashboard, manual**. **Recomendação para o plano de execução:** ou (a) pedir a Leonardo pra criar uma organização Supabase nova e dedicada (dashboard, gratuito, não deveria exigir cartão para plano Free) e passar o `organization_id` resultante, ou (b) tentar `create_project` na org atual primeiro e só escalar pra (a) se a API retornar erro de limite. **Não** propor pausar/deletar `PhotoForge` ou `leonardo-ecossistema` — são projetos não relacionados, fora do escopo de autoridade desta tarefa.

### Pitfall #3 — Nenhum projeto Vercel "zapflow" visível nesta sessão
Ver seção 3 acima — não bloqueia, mas vale uma linha de confirmação com Leonardo antes de considerar a separação "validada contra a produção real", já que não foi possível inspecionar programaticamente a config de produção (env vars, domain, etc.) para ter certeza de que não há sobreposição de nome/domínio.

### Pitfall #4 — Secrets de Edge Function não são automatizáveis via MCP
Nenhuma das tools MCP disponíveis (`deploy_edge_function` incluso) aceita um parâmetro de secrets/env vars. `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ZAPI_WEBHOOK_SECRET` só podem ser definidos via Dashboard (Project Settings → Edge Functions → Secrets) ou `supabase secrets set` (CLI, não instalada nesta sessão). **É passo manual do plano de execução**, mesmo que tudo mais seja automatizado via MCP.

### Pitfall #5 — Credenciais de Mercado Pago de teste precisam vir de Leonardo
Não existe um "token de sandbox genérico" — credenciais de teste do Mercado Pago (test access token, usuários de teste comprador/vendedor) são geradas na conta de desenvolvedor do próprio Leonardo (mercadopago.com.br/developers). Um agente de execução não consegue se autoprover essas credenciais; é **input humano obrigatório** antes do passo 10 da seção 1 poder ser concluído de verdade (pode ficar como placeholder/pendência documentada se Leonardo não tiver isso à mão na hora de rodar a Fase 1 — a aplicação roda ponta a ponta mesmo sem MP funcional, só a cobrança real não vai processar).

### Pitfall #6 — Z-API: não é necessário um número real para o critério de sucesso da Fase 1
O critério de sucesso #3 pede "ver a aplicação rodando de ponta a ponta contra o banco isolado" — isso é satisfeito com dados fake em `client_numbers` (UI renderiza normalmente, telas de contatos/campanhas funcionam). Só é necessário um número Z-API de teste real se Leonardo quiser validar o **envio de mensagem de verdade** já na Fase 1 (não é exigido pelo success criteria). Se quiser, precisa de uma instância Z-API adicional (Z-API cobra por instância) — decisão/custo de Leonardo, fora do escopo de automação.

### Pitfall #7 — URLs de webhook (Z-API, Mercado Pago) apontam pro projeto errado se copiadas sem editar
Os dois exemplos de configuração de webhook documentados em `INTEGRATIONS.md` usam a URL literal de produção (`https://<project>.functions.supabase.co/...`). Se alguém reconfigurar um número Z-API de teste ou app de teste do Mercado Pago apontando pra essas URLs copiadas sem trocar o `<project>` pelo ref do projeto `fase-2`, os webhooks de teste vão bater na produção (ou simplesmente falhar, dependendo do projeto). Sempre gerar a URL a partir de `get_project_url(project_id=fase2_ref)`, nunca reaproveitar a string documentada.

### Pitfall #8 — `vercel.json` CSP já é genérico o suficiente, não precisa editar
`connect-src 'self' https://*.supabase.co wss://*.supabase.co` no CSP não hardcoda o ref do projeto de produção — o wildcard `*.supabase.co` já cobre qualquer projeto novo automaticamente. **Não é necessário** alterar `vercel.json` para o ambiente `fase-2` funcionar (um erro fácil de tentar "consertar" sem necessidade).

### Pitfall #9 — `git status` mostra 7 commits locais não enviados a `origin/main`
Antes de criar a branch `fase-2` a partir de `main`, considerar se esses 7 commits devem ir para `origin/main` primeiro (provavelmente sim, já que são os commits de inicialização do GSD/`.planning/`) — senão a branch remota `fase-2` (e o Vercel, que importa do GitHub) não vai ter esse histórico.

---

## Automatable vs. Manual (para o executor da Fase 1)

| Etapa | Automatable via ferramenta desta sessão | Manual/Humano |
|---|---|---|
| Criar organização Supabase nova (se necessário, Pitfall #2) | Não (sem tool de criação de org) | **Sim** — dashboard Supabase |
| Criar projeto Supabase novo | **Sim** — `get_cost` → `confirm_cost` → `create_project` (MCP) | — |
| Aplicar os 14 arquivos de schema SQL, na ordem | **Sim** — `apply_migration` por arquivo (MCP) | — |
| Criar extensões `pg_cron`/`pg_net` | **Sim** — via `apply_migration`/`execute_sql` (MCP) | — |
| Agendar `cron.schedule(...)` do `run-automations` | **Sim** — via `apply_migration`/`execute_sql`, com URL/key do projeto novo | — |
| Deploy das 8 Edge Functions | **Sim** — `deploy_edge_function` por função (MCP) | — |
| Definir secrets de Edge Function (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `ZAPI_WEBHOOK_SECRET`) | Não (nenhuma MCP tool expõe isso) | **Sim** — Dashboard → Edge Functions → Secrets |
| Obter credenciais de teste do Mercado Pago | Não | **Sim** — conta de developer do Leonardo |
| Criar usuários reais de Supabase Auth (admin + client de teste) | Não (sem MCP tool de criação de usuário Auth) | **Sim** — Dashboard → Authentication → Users |
| Seed de dados de teste (contatos/campanhas fake) | **Sim** — `apply_migration`/`execute_sql` (MCP), depois dos usuários existirem | — |
| Criar branch git `fase-2` + push | **Sim** — `git` via Bash | — |
| Criar projeto Vercel novo (`zapflow-fase2`) | **Sim** — Vercel CLI (`vercel project add`, autenticado nesta sessão) | — |
| Conectar projeto Vercel ao repo GitHub | **Sim** — `vercel git connect` (CLI) ou possível via API | Alternativa: dashboard, se CLI não suportar não-interativo |
| Definir env vars `VITE_*` no projeto Vercel novo | **Sim** — `vercel env add` (CLI, valores vindos de `get_project_url`/`get_publishable_keys`) | — |
| Deploy do projeto Vercel novo | **Sim** — `vercel deploy` / `vercel deploy --prod` (CLI) | — |
| Mudar "Production Branch" do projeto Vercel novo para `fase-2` (opcional, cosmético) | Parcial — possível via API REST direta (`PATCH /v10/projects/{id}`) | Mais simples via dashboard |
| Confirmar com Leonardo se existe projeto Vercel de produção não visível nesta sessão (Pitfall #3) | Não | **Sim** — pergunta direta |
| Validação final (`get_advisors`, abrir URL, checar RLS) | **Sim** (advisors via MCP) / URL precisa ser aberta por um humano para "ver visualmente" | Abrir a URL e confirmar visualmente é, por definição do success criteria, o próprio Leonardo |
