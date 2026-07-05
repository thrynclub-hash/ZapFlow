# ZapFlow — Fase 2 (Mini-CRM e Relacionamento)

## What This Is

ZapFlow é uma plataforma de campanhas de WhatsApp pra negócios locais brasileiros — upload de criativo, agendamento, envio automático respeitando um limite diário seguro por número (anti-bloqueio), importação de contatos, aniversários automáticos, automações simples e relatórios. Roda em produção real hoje pra Clínica Hassum (1190 contatos, 4 campanhas semanais + follow-ups + fluxo de resposta automática "EU QUERO"). O objetivo do dono do produto (Leonardo, Marusso Produções) é evoluir o ZapFlow pra competir de perto com Bolten e HelenaCRM — CRMs de WhatsApp mais completos, com funil visual, inbox multiatendente e agentes de IA — eventualmente superando-os, para então investir em escalação comercial (Instagram da empresa, aquisição de mais clientes).

## Core Value

Fase 2 entrega uma camada leve de CRM (status de contato, consumo por plano, cobrança visível) sem quebrar a V1 que já está em produção — todo o trabalho novo acontece num ambiente isolado (banco e deploy próprios) até ser validado visualmente pelo Leonardo.

## Requirements

### Validated

<!-- Inferido do mapeamento de código em .planning/codebase/ — já existe e funciona em produção -->

- ✓ Campanhas: upload de criativo, agendamento (imediata/agendada/diária), follow-up automático por delay — existing (`src/pages/NewCampaign.jsx`, `supabase/functions/run-automations`)
- ✓ Limite diário global de envio por número (100/dia), aplicado em todo caminho de envio — existing (`try_consume_daily_send_budget()`)
- ✓ Importação de contatos via Excel/CSV com dedup, mapeamento de coluna tolerante, parse de data BR — existing (`src/pages/Contacts.jsx`)
- ✓ Tags de contato (`contacts.tags`) e segmentação de campanha por tag (`campaigns.target_tags`) — existing
- ✓ Status de contato Ativo/Inativo (`contacts.status`) — existing
- ✓ Aniversários automáticos — existing (`src/pages/Birthdays.jsx`)
- ✓ Motor de automação (gatilho aniversário, ações enviar/tag/esperar, condição "tem tag") — existing (`src/pages/Automations.jsx`, `supabase/functions/run-automations`)
- ✓ Resposta automática por palavra-chave (fluxo fixo "EU QUERO" configurado pra Hassum) — existing (`supabase/functions/zapi-webhook`)
- ✓ Relatórios com exportação Excel — existing (`src/pages/Reports.jsx`)
- ✓ Painel Admin multi-cliente (clientes, números, dashboard, preços) — existing (`src/pages/admin/*`)
- ✓ Cobrança recorrente via Mercado Pago (preapproval + webhook) — existing, não validado ponta a ponta (`supabase/functions/mp-create-preapproval`, `mp-webhook`)
- ✓ Segurança: RLS por `client_id`, token Z-API nunca chega ao navegador do cliente, headers de segurança no Vercel — existing

### Active

<!-- Escopo da Fase 2 — hipóteses até pesquisa de mercado + requirements confirmarem -->

- [ ] Status de contato ampliado (mini-CRM): Novo/Ativo/Dormindo/VIP/Opt-out com atualização automática por comportamento
- [ ] Painel de consumo por plano: contatos vs limite, números vs limite, campanhas/mês
- [ ] Status de assinatura visível (Ativa/Em atraso/Cancelada) ligado ao Mercado Pago já integrado
- [ ] Import de leads do LinkedIn (CSV) com origem/tag automática e roteamento pra campanha de boas-vindas
- [ ] (A confirmar após pesquisa de concorrência) — gap real de mercado que a Fase 2 deveria fechar

### Out of Scope

- CRM Kanban (funil visual arrastar/soltar) — é Fase 3/4, não Fase 2
- Agentes de IA / supervisor — é Fase 4
- Inbox multiatendente / multicanal (Instagram, Messenger) — é Fase 4
- Reescrever o motor de envio ou a arquitetura de automações — Fase 2 constrói sobre o que já existe, não substitui

## Context

- Cliente real em produção: Clínica Hassum, 1190 contatos, 4 campanhas semanais rodando — **não pode ser interrompido**.
- Documento de referência do usuário (`referencia para zapflow.docx`) já mapeia Bolten e HelenaCRM em alto nível — usar como ponto de partida, mas aprofundar com pesquisa real (o usuário pediu explicitamente pra ir além do que ele já levantou).
- Codebase mapeado em `.planning/codebase/` (7 documentos: STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS) — ler antes de planejar implementação.
- `CONCERNS.md` já lista débito técnico real (zero testes automatizados, gatilhos de automação parcialmente polling, gaps de LGPD) — considerar ao priorizar.
- Planos comerciais atuais: Starter (R$149/mês), Growth (R$279), Scale (R$669), Enterprise (R$1.319) — cada um com limite de contatos/números diferentes, o que valida a necessidade do "painel de consumo".

## Constraints

- **Produção intocável**: a V1 em produção (Vercel + Supabase atuais) não pode ser modificada ou arriscada por este trabalho — toda mudança de Fase 2 acontece em Supabase + Vercel novos, isolados.
- **Revisável visualmente**: o Leonardo só quer abrir uma URL e ver se está funcionando — sem setup local, sem passos técnicos pra conferir progresso.
- **Sem quebrar o motor anti-bloqueio**: qualquer feature nova de Fase 2 deve respeitar o limite diário de envio já existente, não criar caminho de envio paralelo que o ignore.
- **Compliance com LinkedIn**: import de leads só via CSV oficial (Lead Gen export) ou API de terceiro em conformidade — nunca DM em massa via API não-oficial nem scraping (risco de ban é do cliente final do ZapFlow).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ambiente isolado: novo projeto Supabase + branch `fase-2` com deploy Vercel próprio | Usuário pediu explicitamente manter V1 rodando; decisão delegada a Claude | — Pending |
| GSD usado para planejar Fase 2 (ao invés de plano ad-hoc na conversa) | Trabalho multi-sessão, precisa ser retomável; regra do projeto (RULE-GSD-MANDATORY) | — Pending |
| Pesquisa de mercado real (Bolten/HelenaCRM + domínio WhatsApp-CRM) antes de fechar requirements | Usuário pediu pra ir além do documento de referência dele | — Pending |

---
*Last updated: 2026-07-05 after initialization*
