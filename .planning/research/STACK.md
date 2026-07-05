# ZapFlow Fase 2 — Stack Research

> **Escopo:** O que é preciso, em cima do stack já existente (React 18 + Vite, Supabase Postgres/Auth/Edge Functions em Deno, Vercel, Tailwind, react-router-dom, recharts, xlsx), para entregar bem as 4 features da Fase 2.
> **Método:** Leitura de `STACK.md`, `INTEGRATIONS.md`, `PROJECT.md` e do código-fonte de `mp-webhook`, `run-automations` (+ README) e do parser de import em `Contacts.jsx`.
> **Tese geral:** o stack atual já cobre quase tudo. Fase 2 é praticamente 100% "mais schema + mais uma edge function + mais uma tela", não "mais dependências".

---

## 1. Mini-CRM de status de contato (Novo/Ativo/Dormindo/VIP/Opt-out automático)

**Recomendação:** Nenhuma dependência nova. Implementar como coluna `contacts.status` (enum ampliado) recalculada por uma função PL/pgSQL agendada via `pg_cron` + `pg_net` — o mesmo padrão que já roda `run-automations` a cada 5 minutos.

**Racional:**
- Transições **para baixo** (Ativo → Dormindo) são inerentemente baseadas em tempo decorrido ("sem interação há N dias") — isso não é um evento, é uma varredura periódica. `pg_cron` já está em uso exatamente para isso (`run-automations-every-5-min`, ver `supabase/functions/run-automations/README.md`). Não precisa de um scheduler novo (ex.: node-cron, Agenda, BullMQ) — seria reinventar algo que o Postgres do próprio projeto já faz.
- Transições **por evento** (contato responde → volta a Ativo; palavra-chave de opt-out → Opt-out) já têm o hook certo: `zapi-webhook` já implementa a lógica de opt-out por keyword (`supabase/functions/zapi-webhook/index.ts`) e grava toda mensagem recebida em `inbound_messages`. Ampliar esse handler para também atualizar `contacts.status` no mesmo insert é mais barato e mais correto do que um trigger de banco separado, porque a decisão ("isso conta como reengajamento?") já é tomada em código ali.
- **VIP** não é comportamental no sentido de "tempo decorrido" — é regra de negócio (ex.: X campanhas recebidas + respondeu, ou LTV/ticket). Recomenda-se tratar como resultado da mesma função de recálculo periódico (uma cláusula a mais no `CASE`), não como feature à parte.
- **Supabase Realtime** (já incluso em `@supabase/supabase-js` `2.45.0`, sem custo de dependência nova) é uma boa opção **apenas para a UI** — assinar mudanças em `contacts` via `supabase.channel(...).on('postgres_changes', ...)` para o badge de status atualizar sozinho na tela do admin sem F5. Isso é diferente de "usar Realtime para computar a transição" — Realtime não decide status, só empurra o resultado já decidido pro navegador. É opcional (nice-to-have), não crítico para a Fase 2.
- Evitar: transição de status via `setInterval` no frontend, via serviço externo de cron (ex.: cron-job.org chamando uma edge function), ou introduzir uma fila (BullMQ/Redis) — tudo isso duplicaria infraestrutura que o Postgres do projeto já resolve com `pg_cron`.

**Confiança:** Alta (padrão já validado em produção pelo próprio `run-automations`; só está sendo estendido, não inventado).

---

## 2. Painel de consumo por plano (contatos vs limite, números vs limite, campanhas/mês vs plano)

**Recomendação:** Nenhuma dependência nova. Uma função RPC PL/pgSQL nova (`get_plan_consumption(client_id)`) seguindo o mesmo padrão de `try_consume_daily_send_budget`, e UI com Tailwind puro (barras de progresso simples) ou, se quiser algo mais visual, `recharts` (`RadialBarChart`) — que já está importado no projeto.

**Racional:**
- Os três números (contagem de `contacts`, contagem de `client_numbers`, contagem de `campaigns` no mês corrente) são agregações simples. Uma única função RPC que retorna os três + os limites do plano do cliente evita 3 round-trips separados do frontend e mantém a lógica de "o que é o limite de cada plano" no banco (fonte única de verdade), em vez de hardcoded no React — mesmo racional já aplicado a preços do Mercado Pago (`PRICES` fica em `mp-create-preapproval`, nunca no cliente).
- Para o visual de "medidor de consumo": isso é puramente uma barra de progresso (`valor atual / limite`). Não justifica biblioteca de gauge dedicada (ex.: `react-circular-progressbar`) — um `<div>` com Tailwind (`w-[X%]`) resolve para barras lineares, e `recharts` (já presente) tem `RadialBarChart` pronto se quiser o efeito "gauge circular" sem novo pacote.
- Vale rodar a skill `dataviz` no momento de desenhar esse painel (paleta, formas, acessibilidade) — é guidance de design, não uma dependência de código.

**Confiança:** Alta.

---

## 3. Status de assinatura sincronizado com Mercado Pago

**Recomendação:** Nenhuma dependência nova. Ajustar `mp-webhook/index.ts` (já existente) em dois pontos, e adicionar uma função de reconciliação periódica reaproveitando `pg_cron` + `pg_net` (mesmo padrão de `run-automations`).

**Racional — o que o código atual faz hoje** (`supabase/functions/mp-webhook/index.ts`, linhas 96–104):
```
Assinatura (preapproval): authorized → active | cancelled/paused → cancelled
Pagamento avulso:          approved   → active | rejected/cancelled → cancelled
```

**Gaps identificados para um "status" limpo (Ativa/Em atraso/Cancelada):**

1. **`paused` está sendo tratado como `cancelled`, mas semanticamente não é o mesmo.** No Mercado Pago, uma assinatura (`preapproval`) entra em `paused` tipicamente após falha de cobrança (cartão recusado, saldo insuficiente) — é exatamente o estado que deveria virar **"Em atraso"**, não "Cancelada". Recomenda-se separar: `authorized` → `active`, `paused` → `past_due` (novo valor), `cancelled` → `cancelled`. Isso é uma mudança de poucas linhas no `if/else` já existente, sem tocar em nada mais.

2. **O webhook só escuta `preapproval`/`subscription_preapproval` e `payment`, mas não `subscription_authorized_payment`.** Esse terceiro tipo de evento é o que o Mercado Pago dispara a cada cobrança recorrente individual (mensal) dentro de uma assinatura — é o sinal mais direto de "essa cobrança do mês falhou" ou "essa cobrança do mês passou", frequentemente chegando *antes* do `preapproval.status` mudar (o MP tenta recobrar antes de marcar a assinatura como pausada). Sem tratar esse evento, o campo "Em atraso" só vai aparecer com atraso adicional (esperando o preapproval mudar de estado), o que enfraquece o propósito de ter esse status visível. Recomenda-se adicionar um terceiro branch no `if (isSubscriptionEvent) / else if (isPaymentEvent)` para `type === "subscription_authorized_payment"`, mapeando `status: "rejected"` daquela cobrança → `past_due` no `client_addons` correspondente (via `external_reference` do preapproval, não do pagamento avulso — atenção ao `external_reference` ser diferente aqui).

3. **Webhooks não são 100% confiáveis** (o próprio código já assume isso implicitamente com a checagem dupla "sempre confirma direto na API do MP, nunca confia só no payload"). Para o campo de status ficar visivelmente correto mesmo se uma notificação for perdida, vale um job de reconciliação periódico (ex.: 1x/dia via `pg_cron`+`pg_net`, chamando uma edge function nova `mp-reconcile` que itera `client_addons` com assinatura ativa e reconsulta `/preapproval/{id}` no MP) — mesmo padrão de scheduled function já em uso, não uma ferramenta nova.

4. Sugestão de schema: manter `client_addons.status` como está (não quebrar o que já funciona), e adicionar `client_addons.status_detail` ou uma view `subscription_status` que expõe `Ativa|Em atraso|Cancelada` pro frontend, com `last_synced_at` para a UI poder mostrar "atualizado há X".

**Confiança:** Média — a leitura do código confirma o gap (paused colapsado em cancelled, subscription_authorized_payment não tratado), mas os nomes exatos de status/eventos do Mercado Pago não foram verificados contra a documentação oficial nesta pesquisa (não consultei API externa); confirmar os literais exatos (`subscription_authorized_payment`, campos do payload) contra a doc do MP antes de implementar.

---

## 4. Import de leads do LinkedIn (CSV → tag origem → campanha de boas-vindas)

**Recomendação:** Nenhuma dependência nova. Reaproveitar o pipeline de import já existente em `src/pages/Contacts.jsx` (baseado em `xlsx`/SheetJS), que já lê `.csv` sem mudança nenhuma — `XLSX.read()` já faz parsing de CSV, não só de `.xlsx`. Adicionar: (a) um campo de origem no contato (`contacts.source = 'linkedin'` ou reaproveitar `contacts.tags` com uma tag reservada tipo `origem:linkedin`), e (b) o gatilho de roteamento pra campanha de boas-vindas.

**Racional:**
- `Contacts.jsx` já resolve os três problemas difíceis de import (dedup, mapeamento de coluna tolerante via alias, parse de data BR) — ver `STACK.md`/`PROJECT.md`: "Importação de contatos via Excel/CSV com dedup, mapeamento de coluna tolerante, parse de data BR — existing". Um CSV exportado do LinkedIn Lead Gen Forms é só mais um formato de coluna para mapear via alias, não um problema novo de parsing. Introduzir `PapaParse` ou `csv-parse` aqui seria dependência redundante — SheetJS já lê CSV nativamente e o projeto já tem o código de mapeamento de coluna escrito.
- Para "rotear pra campanha de boas-vindas": a arquitetura de campanhas já suporta segmentação por tag (`campaigns.target_tags`). O caminho de menor risco é: import LinkedIn tageia o contato com uma tag de origem → uma campanha "Boas-vindas LinkedIn" já configurada com `target_tags` correspondente é pega automaticamente pelo `run-automations` no próximo ciclo agendado. Isso **não exige nenhum código de disparo novo** — só usar a segmentação por tag que já existe. Alternativa mais imediata (envio na hora do import, não esperando o próximo ciclo do cron) seria chamar `send-message` diretamente para os novos contatos ao final do import — também zero dependência nova, só uma chamada a mais à function existente.
- Atenção ao constraint do próprio PROJECT.md: import deve ser só via CSV oficial do LinkedIn (Lead Gen export), nunca scraping/DM em massa via API não-oficial — isso é regra de produto/compliance, não afeta a escolha de stack.

**Confiança:** Alta.

---

## O que NÃO adicionar

| Tentação | Por que não |
|---|---|
| Biblioteca de cron (node-cron, Agenda, BullMQ + Redis) | `pg_cron` + `pg_net` já rodam em produção (`run-automations`); mesmo padrão cobre status automático e reconciliação MP. Adicionar um scheduler novo duplicaria infraestrutura sem necessidade. |
| Parser de CSV dedicado (PapaParse, csv-parse, Papa Parse) | `xlsx` (SheetJS) já parseia `.csv` nativamente e o projeto já tem toda a lógica de dedup/alias/data BR escrita em cima dele em `Contacts.jsx`. |
| Biblioteca de gauge/medidor (react-circular-progressbar, react-gauge-chart) | Barra de progresso linear = `<div>` + Tailwind. Se quiser radial, `recharts` (já importado) tem `RadialBarChart`. |
| Gerenciador de estado global (Redux, Zustand, Jotai) | O projeto já documenta explicitamente "No state management library — React Context for global state" e as 4 features da Fase 2 não introduzem complexidade de estado que justifique mudar isso. |
| ORM (Prisma, Drizzle) | Projeto usa PostgREST direto via `@supabase/supabase-js`, por decisão documentada ("No ORM"). Painel de consumo e status são queries/RPCs simples — não há ganho em introduzir camada de ORM para 3 contagens e um enum. |
| Servidor Node/Express separado para as novas rotas | Toda lógica nova (status automático, consumo, sync MP, import LinkedIn) cabe em Edge Functions (Deno) + PL/pgSQL, o mesmo padrão arquitetural já usado por todas as 8 functions existentes. |
| Biblioteca de real-time própria (socket.io, Pusher) | `@supabase/supabase-js` já inclui client de Realtime (Postgres Changes) sem custo de dependência adicional, caso o refresh ao vivo do status seja desejado na UI. |
