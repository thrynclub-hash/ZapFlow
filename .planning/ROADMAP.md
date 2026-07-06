# Roadmap: ZapFlow — Fase 2 (Mini-CRM e Relacionamento)

## Overview

Fase 2 parte de um ambiente totalmente isolado da produção real (Clínica Hassum, 1190 contatos) e entrega, em ordem crescente de risco técnico, quatro capacidades de mini-CRM: import de leads do LinkedIn reaproveitando o pipeline de CSV já existente, um painel de consumo por plano com comparação de limite centralizada, visibilidade real do status de assinatura com o webhook do Mercado Pago tornado idempotente e seguro contra eventos fora de ordem, e por último — depois que as três features de menor risco já validaram o ambiente — o lifecycle de contato (Novo/Ativo/Dormindo/VIP), a única feature que introduz uma coluna nova na tabela `contacts` e por isso é deliberadamente construída por último, mantendo distância do gate de envio (`status`) que a V1 já usa em produção.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Ambiente Isolado** - Novo projeto Supabase + branch `fase-2` + deploy Vercel próprio, revisável por URL sem tocar a produção
- [ ] **Phase 2: Import de Leads do LinkedIn** - Reusa o pipeline de import CSV existente, com tag de origem, roteamento automático e blindagem de opt-out
- [ ] **Phase 3: Painel de Consumo por Plano** - Contatos/números/campanhas vs. limite, com comparação centralizada no banco
- [ ] **Phase 4: Status de Assinatura** - Visibilidade de Ativa/Em atraso/Cancelada, com webhook do MP idempotente e seguro contra fora-de-ordem
- [ ] **Phase 5: Lifecycle de Contato (Mini-CRM)** - Novo/Ativo/Dormindo/VIP auditável, sem tocar o gate de envio nem ser afetado por imports em massa

## Phase Details

### Phase 1: Ambiente Isolado
**Goal**: Existe um ambiente técnico completo e isolado (banco + deploy) onde toda a Fase 2 pode ser construída e revisada visualmente por Leonardo, sem qualquer risco à V1 em produção (Clínica Hassum).
**Depends on**: Nothing (first phase)
**Requirements**: Nenhum REQ-ID — infraestrutura pura, pré-requisito para Phases 2-5 (todas as features desta fase serão construídas e revisadas dentro deste ambiente)
**Success Criteria** (what must be TRUE):
  1. Existe um projeto Supabase novo, separado do projeto de produção, com dados de teste (não os 1190 contatos reais da Clínica Hassum)
  2. Existe uma branch git `fase-2` e um deployment Vercel próprio apontando para ela, com URL própria e distinta da URL de produção
  3. Leonardo consegue abrir a URL do deploy `fase-2` e ver a aplicação rodando de ponta a ponta contra o banco isolado, sem setup local
  4. As variáveis de ambiente do deployment `fase-2` (URL/keys do Supabase isolado) estão configuradas separadamente das variáveis de produção — nenhum caminho de código do ambiente `fase-2` consegue escrever no projeto Supabase de produção
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Import de Leads do LinkedIn
**Goal**: Leonardo consegue importar leads exportados do LinkedIn (CSV) para dentro do ZapFlow, marcados com origem e roteados automaticamente para uma campanha de boas-vindas, sem nenhum caminho de código novo e sem risco de reativar contatos que já pediram opt-out.
**Depends on**: Phase 1
**Requirements**: LNK-01, LNK-02, LNK-03, LNK-04, LNK-05
**Success Criteria** (what must be TRUE):
  1. Usuário pode importar um CSV de leads do LinkedIn usando a mesma tela/fluxo de importação de contatos que já existe (`Contacts.jsx` / `handleImportCSV`), sem tela ou pipeline novo
  2. Contatos importados do LinkedIn aparecem automaticamente com a tag de origem "LinkedIn"
  3. Uma campanha de boas-vindas configurada com `target_tags` incluindo "LinkedIn" alcança os novos contatos automaticamente, sem código de disparo novo
  4. A importação nunca reativa nem inclui um contato que já deu opt-out — a checagem de opt-out roda antes da checagem de duplicata, com a mesma normalização de telefone
  5. O resumo pós-importação reporta quantos contatos foram excluídos por estarem em opt-out
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Painel de Consumo por Plano
**Goal**: Leonardo (e o cliente final do ZapFlow) consegue ver, numa única tela, quanto do plano contratado já está sendo consumido — contatos, números e campanhas — incluindo add-ons ativos, com a lógica de limite resolvida em um único lugar no banco.
**Depends on**: Phase 1 (sequenciado após Phase 2 por ordem de risco recomendada pela pesquisa — sem dependência de dado forte entre as duas)
**Requirements**: CONS-01, CONS-02, CONS-03, CONS-04, CONS-05
**Success Criteria** (what must be TRUE):
  1. Usuário vê contatos usados vs. limite do plano
  2. Usuário vê números de WhatsApp usados vs. limite do plano
  3. Usuário vê campanhas criadas no mês vs. limite do plano
  4. O painel reflete limites ampliados por add-ons ativos (`client_addons`), não apenas o limite base do plano
  5. A comparação de limite é resolvida por uma única função/view no banco (extensão de `plan_limits` com `campaigns_limit`) — frontend e qualquer função futura consultam a mesma fonte, nunca duplicam a lógica de comparação
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Status de Assinatura
**Goal**: Leonardo (e o cliente final) consegue ver o status real da própria assinatura, distinguindo atraso de cancelamento, com o webhook do Mercado Pago tratado de forma idempotente e imune a eventos entregues fora de ordem.
**Depends on**: Phase 1 (sequenciado após Phase 3 por ordem de risco recomendada pela pesquisa — sem dependência de dado forte entre as duas)
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04
**Success Criteria** (what must be TRUE):
  1. Usuário vê o status da própria assinatura (Ativa/Em atraso/Cancelada) numa tela
  2. "Em atraso" (pausado/atraso de pagamento) aparece como estado distinto de "Cancelada" — hoje colapsados juntos no `mp-webhook`
  3. Reenviar a mesma notificação do Mercado Pago não duplica nenhum efeito (idempotência garantida por checagem do id do evento antes de aplicar o side-effect)
  4. Um evento do Mercado Pago entregue fora de ordem nunca sobrescreve um status mais recente já salvo (comparação de timestamp do evento contra o já salvo)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Lifecycle de Contato (Mini-CRM)
**Goal**: Cada contato tem um estágio de lifecycle (Novo/Ativo/Dormindo/VIP) visível, auditável e atualizado automaticamente por comportamento real — totalmente separado do `status` que já trava o envio na V1, e imune a qualquer importação em massa.
**Depends on**: Phase 1 (construída por último, deliberadamente, por ser a única fase que introduz coluna nova em `contacts` adjacente ao gate de envio que a V1 já usa em produção — depende de Phase 2 já ter validado que import em massa não contamina esse terreno)
**Requirements**: CRM-01, CRM-02, CRM-03, CRM-04, CRM-05, CRM-06, CRM-07, CRM-08
**Success Criteria** (what must be TRUE):
  1. Usuário vê o estágio de lifecycle (Novo/Ativo/Dormindo/VIP) de cada contato, separado do status Ativo/Inativo que já trava o envio (`contacts.status` nunca é tocado por esta fase)
  2. Contato transiciona automaticamente entre estágios: Novo→Ativo na primeira interação real; Ativo→Dormindo após N dias sem interação real via varredura diária num `pg_cron` job standalone (não uma extensão de `run-automations`); Dormindo→Ativo instantaneamente ao interagir de novo, via `zapi-webhook` existente — VIP nunca é atribuído automaticamente pelo cron, só manualmente
  3. Usuário pode filtrar/segmentar a lista de contatos por estágio de lifecycle e marcar manualmente um contato como VIP
  4. Toda mudança de estágio de lifecycle fica registrada com timestamp e motivo (auditoria de quem/quando/como)
  5. Importação em massa (CSV, incluindo a de leads do LinkedIn da Phase 2) nunca altera `status` nem `lifecycle_stage` de contatos já existentes — a transição automática só olha campo de "última interação real", nunca `updated_at` genérico do import
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Ambiente Isolado | 0/TBD | Not started | - |
| 2. Import de Leads do LinkedIn | 0/TBD | Not started | - |
| 3. Painel de Consumo por Plano | 0/TBD | Not started | - |
| 4. Status de Assinatura | 0/TBD | Not started | - |
| 5. Lifecycle de Contato (Mini-CRM) | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-05*
