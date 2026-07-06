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

### CRM Avançado

- **CRM-V2-01**: Funil visual Kanban (arrastar/soltar) para lifecycle de contato
- **CRM-V2-02**: "Carteiras" — atribuição de dono de lead a atendentes

### Atendimento

- **ATND-V2-01**: Inbox multiatendente/multicanal (Instagram, Messenger)
- **ATND-V2-02**: Agentes de IA / supervisor de conversas

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
| LNK-01 | TBD | Pending |
| LNK-02 | TBD | Pending |
| LNK-03 | TBD | Pending |
| LNK-04 | TBD | Pending |
| LNK-05 | TBD | Pending |
| CONS-01 | TBD | Pending |
| CONS-02 | TBD | Pending |
| CONS-03 | TBD | Pending |
| CONS-04 | TBD | Pending |
| CONS-05 | TBD | Pending |
| SUB-01 | TBD | Pending |
| SUB-02 | TBD | Pending |
| SUB-03 | TBD | Pending |
| SUB-04 | TBD | Pending |
| CRM-01 | TBD | Pending |
| CRM-02 | TBD | Pending |
| CRM-03 | TBD | Pending |
| CRM-04 | TBD | Pending |
| CRM-05 | TBD | Pending |
| CRM-06 | TBD | Pending |
| CRM-07 | TBD | Pending |
| CRM-08 | TBD | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapeados para fases: 0 (pendente — próxima etapa: roadmap)
- Não mapeados: 22 ⚠️

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after initial definition*
