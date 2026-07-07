# Requirements: ZapFlow — Fase 2 (Mini-CRM e Relacionamento)

**Defined:** 2026-07-05
**Core Value:** Fase 2 entrega uma camada leve de CRM (status de contato, consumo por plano, cobrança visível) sem quebrar a V1 que já está em produção — todo o trabalho novo acontece num ambiente isolado até ser validado visualmente pelo Leonardo.

## v1 Requirements

Requirements para a Fase 2. Cada um mapeia para exatamente uma fase do roadmap.

### Lifecycle de Contato (Mini-CRM)

- [ ] **CRM-01**: Usuário pode ver o estágio de lifecycle de cada contato (Novo/Ativo/Dormindo/VIP) separado do status Ativo/Inativo que já trava o envio
- [ ] **CRM-02**: Contato transiciona automaticamente Novo→Ativo na primeira interação real (resposta ou clique registrado)
- [ ] **CRM-03**: Contato transiciona automaticamente Ativo→Dormindo após N dias sem interação real (varredura diária)
- [ ] **CRM-04**: Contato transiciona automaticamente Dormindo→Ativo ao interagir novamente (reativação instantânea via evento do webhook)
- [ ] **CRM-05**: Usuário pode marcar manualmente um contato como VIP (nunca atribuído automaticamente pelo cron)
- [ ] **CRM-06**: Usuário pode filtrar/segmentar a lista de contatos por estágio de lifecycle
- [ ] **CRM-07**: Toda mudança de estágio de lifecycle fica registrada com timestamp e motivo (auditoria — quem/quando/como)
- [ ] **CRM-08**: Importação em massa (CSV) nunca altera `status` nem `lifecycle_stage` de contatos já existentes

### Painel de Consumo

- [ ] **CONS-01**: Usuário pode ver contatos usados vs. limite do plano
- [ ] **CONS-02**: Usuário pode ver números de WhatsApp usados vs. limite do plano
- [ ] **CONS-03**: Usuário pode ver campanhas criadas no mês vs. limite do plano
- [ ] **CONS-04**: Usuário vê add-ons ativos refletidos no painel de consumo (limites ampliados por add-on)
- [ ] **CONS-05**: A comparação de limite é centralizada em uma única função/view no banco (não duplicada entre frontend e backend)

### Status de Assinatura

- [ ] **SUB-01**: Usuário pode ver o status da própria assinatura (Ativa/Em atraso/Cancelada)
- [ ] **SUB-02**: Status de assinatura distingue "Em atraso" (pausado/atraso de pagamento) de "Cancelada" (hoje colapsados juntos)
- [ ] **SUB-03**: Webhook do Mercado Pago processa cada evento de forma idempotente (não duplica efeito em reenvio de notificação)
- [ ] **SUB-04**: Webhook do Mercado Pago não sobrescreve um status mais recente com um evento antigo fora de ordem

### Import de Leads do LinkedIn

- [ ] **LNK-01**: Usuário pode importar leads do LinkedIn via CSV reaproveitando o mesmo pipeline de importação de contatos já existente
- [ ] **LNK-02**: Contatos importados do LinkedIn recebem automaticamente tag de origem "LinkedIn"
- [ ] **LNK-03**: Contatos importados do LinkedIn podem ser roteados automaticamente para uma campanha de boas-vindas via `target_tags` já existente (sem novo código de disparo)
- [ ] **LNK-04**: Importação nunca reativa ou inclui um contato que já deu opt-out (checagem de opt-out roda antes da checagem de duplicata)
- [ ] **LNK-05**: Resumo da importação reporta quantos contatos foram excluídos por estarem em opt-out

## v2 Requirements

Reconhecidos mas propositalmente adiados — não entram no roadmap desta fase.

> Itens `-03` em diante nesta seção vêm de `research/HELENA-VIDEO-ANALYSIS.md` (análise de vídeo de demonstração
> de concorrente, 2026-07-06) — confiança ALTA (visualmente confirmado em tela real de produto, não marketing).
> Ver o documento pra detalhe completo de cada feature e frame de referência.

### CRM Avançado

- **CRM-V2-01**: Funil visual Kanban (arrastar/soltar) para lifecycle de contato
- **CRM-V2-02**: "Carteiras" — atribuição de dono de lead a atendentes (confirmado por concorrente como campo
  "Responsável" simples + filtro "todos" vs "meus itens" — mecanismo mais simples do que o nome sugere)
- **CRM-V2-03**: Marcação de Ganho/Perda em card do funil, com lista de motivos de perda configurável pelo
  cliente e marcação automática de perda após N dias configuráveis sem movimentação no card
- **CRM-V2-04**: Campos personalizados configuráveis por funil (não um conjunto global único — cada funil/pipeline
  tem os próprios campos)
- **CRM-V2-05**: Dashboard de relatório do funil — taxa de conversão por etapa, ticket médio, ciclo médio de
  venda, motivos de perda mais frequentes, conversão por atendente/vendedor (distinto do relatório de campanha
  que o ZapFlow já tem)
- **CRM-V2-06**: Classificação estruturada ao encerrar um atendimento (categorias tipo "Objetivo atingido" /
  "Objetivo perdido" / "Dúvidas" / "Outro", cada uma com sub-motivos configuráveis) — alimenta o dashboard de
  CRM-V2-05

### Atendimento

- **ATND-V2-01**: Inbox multiatendente/multicanal (Instagram, Messenger)
- **ATND-V2-02**: Agentes de IA / supervisor de conversas
- **ATND-V2-03**: Sequências multi-etapa (generalização do follow-up único atual): cada etapa com seu próprio
  atraso, janela de dia-da-semana/horário e métricas próprias (disparos/movimentação/engajamento); mapeia
  naturalmente para `follow_up_delay_days`/`follow_up_of` já existente em `campaigns`, generalizado pra N etapas
- **ATND-V2-04**: Mensagem agendada avulsa por contato (fora do fluxo de campanha em massa) — atendente escolhe
  1 contato + data/horário pra lembrete pontual, sem precisar criar uma campanha inteira
- **ATND-V2-05**: Canal de e-mail como alternativa/complemento ao WhatsApp — hoje o ZapFlow é 100% Z-API
  (WhatsApp), sem nenhum conceito de "canal" no schema; exigiria um provider de e-mail separado (ex. Resend,
  já em uso no PhotoForge) rodando em paralelo, mais um campo de canal em campanhas/automações, e uma régua de
  limite diferente (o orçamento diário atual existe pra evitar ban de WhatsApp, não se aplica a e-mail).
  Motivação é diferencial competitivo (concorrentes mapeados — Bolten, Helena — também são só-WhatsApp), não
  necessidade imediata; surgiu em conversa de 2026-07-07 sobre a esteira do ecossistema pessoal do Leonardo,
  fora do escopo do ZapFlow em si

### IA / Automação Avançada

- **IA-V2-01**: Agente de IA configurável por papel (Vendedor/SDR/Suporte/Onboarding/Recepcionista) + tom de
  comunicação (presets) — refina `ATND-V2-02` com estrutura concreta confirmada por concorrente
- **IA-V2-02**: Agente "Supervisor" — camada de roteamento que decide qual agente especializado deve assumir
  cada conversa, em vez de um único agente genérico tratando tudo
- **IA-V2-03**: Base de conhecimento (RAG) alimentando os agentes de IA (existência confirmada como aba
  separada em concorrente; conteúdo/mecanismo não capturado — baixa confiança nos detalhes, alta confiança na
  existência do conceito)
- **IA-V2-04**: Chatbot determinístico (regras/condições/webhooks) como produto distinto do Agente de IA
  generativo — o motor de `automations`/`automation_runs` do ZapFlow já é o embrião desse lado determinístico

### Modelo de Negócio (decisão do Leonardo, não requirement de produto)

- **BIZ-V2-01**: Programa de revenda white-label (parceiro rebrandeia a plataforma inteira) — confirmado como
  padrão usado por 2 concorrentes de referência (Bolten e, agora confirmado também, o produto por trás da marca
  "GOL"/Helena)

### Not Portable (explicitamente fora de cogitação, por incompatibilidade de arquitetura)

- Fluxo de campanha baseado em "modelo de mensagem" pré-aprovado — é um requisito da API oficial da Meta
  (Cloud API), que o ZapFlow não usa (usa Z-API, WhatsApp Web não-oficial, mensagem livre). Adotar esse padrão
  de UI seria regressão de flexibilidade, não avanço, a menos que o ZapFlow decida migrar de Z-API para a API
  oficial da Meta — isso seria uma decisão de arquitetura/negócio muito maior, fora de qualquer fase de produto
  atual (ver conversa registrada em sessão de 2026-07-06 sobre trade-offs de custo/aprovação de template vs.
  risco de bloqueio).

## Out of Scope

Explicitamente excluído desta fase. Documentado para prevenir scope creep.

| Feature | Motivo |
|---------|--------|
| CRM Kanban (funil visual) | Fase 3/4 — não é table stakes pra validar a hipótese de Fase 2 |
| Agentes de IA / supervisor | Fase 4 — depende de inbox multiatendente que ainda não existe |
| Inbox multiatendente/multicanal | Fase 4 — fora do core value desta fase (mini-CRM leve) |
| Reescrita do motor de envio/automações | Fase 2 constrói sobre o que já existe, nunca substitui — risco à produção real (Clínica Hassum) |
| Scraping ou DM em massa via API não-oficial do LinkedIn | Risco de banimento é do cliente final do ZapFlow — import só via CSV oficial (Lead Gen export) |
| Scheduler dedicado (node-cron/BullMQ), parser CSV dedicado (PapaParse), lib de gauge, Redux/Zustand | Nenhuma das 4 features justifica dependência nova — `pg_cron`, `xlsx`, `recharts`/Tailwind já resolvem (ver research/STACK.md) |

## Traceability

Preenchido durante a criação do roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LNK-01 | Phase 2 (Import de Leads do LinkedIn) | Mapped |
| LNK-02 | Phase 2 (Import de Leads do LinkedIn) | Mapped |
| LNK-03 | Phase 2 (Import de Leads do LinkedIn) | Mapped |
| LNK-04 | Phase 2 (Import de Leads do LinkedIn) | Mapped |
| LNK-05 | Phase 2 (Import de Leads do LinkedIn) | Mapped |
| CONS-01 | Phase 3 (Painel de Consumo por Plano) | Mapped |
| CONS-02 | Phase 3 (Painel de Consumo por Plano) | Mapped |
| CONS-03 | Phase 3 (Painel de Consumo por Plano) | Mapped |
| CONS-04 | Phase 3 (Painel de Consumo por Plano) | Mapped |
| CONS-05 | Phase 3 (Painel de Consumo por Plano) | Mapped |
| SUB-01 | Phase 4 (Status de Assinatura) | Mapped |
| SUB-02 | Phase 4 (Status de Assinatura) | Mapped |
| SUB-03 | Phase 4 (Status de Assinatura) | Mapped |
| SUB-04 | Phase 4 (Status de Assinatura) | Mapped |
| CRM-01 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |
| CRM-02 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |
| CRM-03 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |
| CRM-04 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |
| CRM-05 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |
| CRM-06 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |
| CRM-07 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |
| CRM-08 | Phase 5 (Lifecycle de Contato - Mini-CRM) | Mapped |

**Coverage:**
- v1 requirements: 22 total
- Mapeados para fases: 22 (Phase 1 é infraestrutura pura — sem REQ-ID próprio, pré-requisito de todas as demais)
- Não mapeados: 0 ✅

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after roadmap creation — traceability complete, 22/22 mapped*
