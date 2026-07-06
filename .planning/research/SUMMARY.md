# ZapFlow Fase 2 — Synthesis (Research → Requirements)

> Fonte: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md. Destilado para quem vai escrever REQUIREMENTS.md e ROADMAP.md — não repete o raciocínio completo, só as conclusões acionáveis.

---

## 1. Recomendação de stack

**Zero dependências novas.** As 4 features cabem 100% no stack existente (React 18/Vite, Supabase Postgres/Auth/Edge Functions Deno, `pg_cron`+`pg_net`, `@supabase/supabase-js` com Realtime incluso, `xlsx`/SheetJS, `recharts`, Tailwind, sem ORM, sem state manager global). Tudo é "mais schema + mais RPC/edge function + mais tela", reaproveitando padrões já em produção: `pg_cron` (mesmo padrão de `run-automations`) para qualquer transição/reconciliação periódica, `xlsx` (já lê CSV nativamente) para o import LinkedIn, `recharts`/Tailwind para os medidores de consumo, e o próprio `mp-webhook` estendido (não reescrito) para status de assinatura. Resistir à tentação de introduzir scheduler dedicado (node-cron/BullMQ), parser de CSV dedicado (PapaParse), lib de gauge, ou Redux/Zustand — nenhuma das 4 features justifica.

---

## 2. Tabela stakes vs diferenciais

| Categoria | Feature | Nota |
|---|---|---|
| **Table stakes** | Status de contato como posição num funil nomeável (não binário) | Bolten/Helena/Kommo tratam isso como dado central |
| **Table stakes** | Import de planilha com mapeamento de coluna + feedback de erro | ZapFlow V1 já faz (`Contacts.jsx`) — manter é mínimo |
| **Table stakes** | Auditoria/histórico de mudança de status (quem/quando/como) | Todos os concorrentes pesquisados tratam como feature, não log técnico |
| **Table stakes** | Tags/segmentação vinculada a status/origem | Já existe no V1; concorrentes usam pra filtrar/roteirizar |
| **Diferencial** | Painel de consumo de plano visível ao cliente final | **Nenhum concorrente pesquisado expõe isso como tela de produto** — oportunidade real, mas também sem benchmark de UI pra copiar |
| **Diferencial** | Status de assinatura (Ativa/Em atraso/Cancelada) integrado visualmente ao CRM | Nenhuma fonte confirmou essa tela em concorrente algum |
| **Diferencial** | Import com tag de origem automática + roteamento sem reconfigurar frases-gatilho | Bolten exige frase-gatilho manual; Kommo exige nome de coluna idêntico ao pipeline — ZapFlow pode automatizar isso via `target_tags` já existente |
| **Nice-to-have / adiar** | Kanban visual completo, frases-gatilho conversacionais, múltiplos formatos de import (vCard/Sheets nativo), "Carteiras"/dono de lead | Fora de escopo Fase 2 (é Fase 3/4) — não construir agora |

---

## 3. Decisões de arquitetura recomendadas

| Questão | Decisão | Porquê |
|---|---|---|
| **Transições de status: cron / trigger / estender `run-automations`?** | **Novo `pg_cron` job standalone → função PL/pgSQL** (não estende `run-automations`, não é só trigger). Reativação (reply → volta a Ativo) é 1 linha de `UPDATE` dentro do `zapi-webhook` existente (evento, instantâneo). Decaimento (Ativo→Dormindo) precisa de varredura periódica separada — 1x/dia, não a cada 5min. | `run-automations` roda a cada 5min com cap de 60s — misturar housekeeping de CRM ali aumenta o raio de explosão de bugs no motor de envio. Trigger sozinho não resolve "ausência de evento" (decaimento por N dias sem interação). |
| **Coluna de status: uma só ou split?** | **Split em duas colunas**: `contacts.status` continua como gate de envio (`Ativo`/`Opt-out`, zero mudança no `run-automations`) + nova `contacts.lifecycle_stage` (`Novo`/`Ativo`/`Dormindo`/`VIP`, read-only pro motor de envio, dono é o cron). | `run-automations` já faz `.eq("status", "Ativo")` como gate — virar um enum de 5 valores quebraria isso silenciosamente. VIP é promoção manual/de negócio, não decaimento — não deve ser auto-atribuído pelo cron. |
| **Plan limits: config table ou constantes?** | **Config table já existe** (`plan_limits`: `numbers_limit`, `contacts_limit`) — só adicionar `campaigns_limit`. Painel de consumo = 3 queries read-only (`contacts`, `client_numbers`, `campaigns` do mês) comparadas contra a tabela + `client_addons` ativos. | Zero re-arquitetura; já é o padrão em produção (`Contacts.jsx:fetchPlanLimit`, `AdminPricing.jsx`). Centralizar comparação de limite em UM lugar (banco), não duplicar frontend/edge function (evita off-by-one — ver Pitfall #2). |
| **Billing status: qual coluna/tabela?** | **Nenhuma coluna nova em `clients`.** Se "assinatura" = add-ons → já é automático via `client_addons.status` (mp-webhook já sincroniza). Se "assinatura" = plano principal migrando pra MP recorrente → modelar como **nova linha em `client_addons`** com `addon_type='plan'`, reaproveitando o branch `isSubscriptionEvent` já existente no `mp-webhook`. O fluxo manual (`plan_next_charge_at`, calculado no cliente) continua intocado para quem não migrou. | Preserva a decisão de design deliberada (data calculada nunca fica stale se job falhar). Evita manter dois lugares perguntando "esse cliente está em dia". Também: separar `paused`→`past_due` de `cancelled` (hoje colapsados juntos) e tratar `subscription_authorized_payment` (evento não escutado hoje). |
| **Import LinkedIn: caminho novo ou reusar existente?** | **Reusar 100% o pipeline de `Contacts.jsx`** (`handleImportCSV`, já lê CSV via SheetJS, já dedupe por telefone, já aplica `importTag`). "Origem" = novo valor de tag (`LinkedIn`), não nova coluna. "Roteamento pra boas-vindas" = usar `campaigns.target_tags` já existente — sem código de disparo novo. | Zero risco a `run-automations`; feature de menor risco e menor esforço das 4. **Gap real a validar antes de planejar**: export nativo "Connections" do LinkedIn não tem telefone — confirmar se a fonte é lead-gen (tem telefone) antes de fechar escopo. |

**Ordem de build recomendada (por risco, não por dependência — nenhuma feature tem dependência de dado forte nas outras):** (1) Import LinkedIn → (2) Painel de consumo → (3) Status de assinatura → (4) Status lifecycle de contato (por último, único que toca a coluna que o motor de envio usa como gate).

---

## 4. Top 5 armadilhas a prevenir

1. **Import em massa disparando transição de status para todo mundo (P1.2)** — se a lógica de lifecycle depender de `updated_at` genérico em vez de "última interação real", o import CSV da feature 4 vai reativar/desativar contatos por engano. *Prevenção:* transição automática só olha campo de "última interação real" (mensagem/clique); import nunca toca `status`/`last_interaction_at` de contatos existentes.

2. **Race condition entre job de status e envio de campanha em andamento (P1.3)** — `run-automations` monta a lista de destinatários no início; se o cron de lifecycle rodar em paralelo e mudar status no meio, parte do batch é decidida com estado inconsistente e não auditável. *Prevenção:* gravar snapshot do status no `message_log` no momento do envio, ou serializar os dois jobs.

3. **Off-by-one e cache desatualizado no painel de consumo (P2.1/P2.2)** — comparação de limite duplicada em frontend e backend diverge na borda exata; contador desnormalizado esquece de contar imports em massa (CSV/LinkedIn). *Prevenção:* comparação de limite centralizada em UMA função/view no banco; contagem `count(*)` on-the-fly, não contador cacheado — se cachear, invalidar em TODOS os pontos de entrada.

4. **Webhook do Mercado Pago sem idempotência nem controle de ordem (P3.1/P3.2)** — MP pode reenviar notificação (duplica side-effects não-idempotentes) e não garante ordem de entrega (evento antigo pode sobrescrever status mais recente). *Prevenção:* gravar id do evento processado antes de aplicar side-effect; comparar timestamp do evento consultado contra o já salvo antes de sobrescrever status.

5. **Reimportar contato que já deu opt-out (P4.3)** — combinação de risco LGPD + reputação: lead do LinkedIn que pediu pra sair do WhatsApp meses atrás pode ser reativado por um reimport se a checagem de opt-out não rodar antes da checagem de duplicata comum (com a mesma normalização de telefone). *Prevenção:* checar opt-out primeiro, excluir do import automaticamente (nunca reativar), reportar no resumo do import.

*(Honra-mencionada: P5.1 — opt-in específico de WhatsApp para leads do LinkedIn é risco de banimento de conta, não só dado errado — decisão de produto que precisa ser resolvida antes do requirements fechar o fluxo de "boas-vindas" automático.)*

---

## 5. Confidence flags (tratar como inferência, não fato)

- **FEATURES.md — Bolten:** confiável apenas para "Conversion Management" (única página que respondeu com conteúdo real). Import/dedup da Bolten: **não documentado**, não citar como padrão.
- **FEATURES.md — HelenaCRM: confiança BAIXA-MÉDIA geral.** A maioria das páginas de `docs.helena.app` retornou 404 ou só Termos de Uso; `llms-full.txt` só trouxe ToS. Específicos não confirmados por doc primária: estrutura de custom fields, mecanismo de "Carteiras" (dono de lead), comportamento de dedup no import, e a hipótese de billing mais profundo por causa da aquisição pela Asaas (**isso é inferência explícita, não fato documentado**).
- **FEATURES.md — Kommo:** confiança MÉDIA (doc técnica pública real existe e foi lida) — é a fonte mais sólida para padrão de import CSV/mapeamento de coluna.
- **FEATURES.md — respond.io, Take Blip, Zenvia:** confiança BAIXA, só WebSearch sem WebFetch profundo. Tratar apenas como confirmação direcional de mercado ("funil + inbox unificado é a direção"), **nunca como fonte de padrão de implementação**.
- **FEATURES.md — "nenhum concorrente expõe painel de consumo/billing visual":** é ausência de evidência, não prova de ausência — a pesquisa foi interrompida por limite de contexto antes de aprofundar os 3 players mais fracos.
- **STACK.md — item 3 (Mercado Pago):** confiança MÉDIA — o gap no código (`paused` colapsado em `cancelled`, `subscription_authorized_payment` não tratado) foi confirmado por leitura direta do código, mas os nomes literais exatos de status/eventos do MP **não foram verificados contra a doc oficial** nesta pesquisa — confirmar antes de implementar.
