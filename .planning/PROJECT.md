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
- **3 referências de mercado confirmadas (2026-07-06), pra quando o backlog v2 de `REQUIREMENTS.md` começar a virar fase de verdade**: Bolten e HelenaCRM (`research/FEATURES.md`, `research/SUMMARY.md` — pesquisa via site/docs, confiança BAIXA-MÉDIA) e HelenaCRM de novo, agora via vídeo de demonstração real (`research/HELENA-VIDEO-ANALYSIS.md` — confiança ALTA, tela real de produto) e wacrm/ArnasDon, CRM open-source (`research/WACRM-ANALYSIS.md` — confiança MÉDIA, só README). Regra ao usar essas referências: copiar o **conceito**, adaptar ao ZapFlow, nunca o que depende de API oficial da Meta (modelo de mensagem aprovado, janela de 24h) sem decisão de negócio explícita — ZapFlow usa Z-API.
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

## Ideas Backlog (2026-07-13)

Leonardo trouxe uma pesquisa própria (via Perplexity) sobre criar um micro-SaaS B2B nichado (ticket R$49-149/mês) de "recuperação/reengajamento automático de clientes" via WhatsApp — score de risco de churn, sequências automáticas pra quem sumiu, playbooks prontos por nicho (academia, clínica, infoproduto).

**Diagnóstico:** isso não é um produto novo — é, quase ponto a ponto, a **Phase 5 (Lifecycle de Contato)** já desenhada no `ROADMAP.md` deste mesmo projeto, rodando sobre o motor de disparo/follow-up que já existe e roda em produção (Hassum). O que a pesquisa descreve como "diferencial de mercado" (score Novo/Dormindo/VIP, sequência automática pra quem parou de responder) é literalmente o success criteria da Phase 5.

**Genuinamente novo em relação ao que já está planejado:**
- Ticket de entrada mais baixo (R$49-149) — hoje os planos ZapFlow começam em R$149; é decisão comercial, não técnica, de criar um tier abaixo do Starter atual
- Playbooks prontos por nicho como produto (não só configuração livre) — não existe, seria construído em cima da Phase 5 uma vez pronta
- Framing de "produto de churn/retenção" como posicionamento de venda, mais amplo que "CRM de WhatsApp" — mercado/marketing, não arquitetura

**Como aplicar:** antes de tratar isso como iniciativa separada, validar a tese terminando a Phase 5 do roadmap atual (que já está isolada da V1 por causa da Phase 1 — Ambiente Isolado). Reavaliar preço de entrada e "modo playbook" só depois de ter o lifecycle rodando de verdade com um cliente real.

## Incidente real — Bloqueio WhatsApp Hassum (2026-07-15)

O número da Dra Thais Hassum (conectado 2026-06-30) foi bloqueado pelo WhatsApp mesmo com o cliente configurando "50/dia". Causa raiz confirmada com dado real de produção: a campanha "Semana 1" (`daily_limit=50`) e o follow-up dela (`daily_limit` vazio, caindo no default de 50 também) rodavam em paralelo no MESMO número, cada uma se achando com teto próprio de 50 — mas o único hard-stop compartilhado de verdade era um valor global fixo (`DAILY_CAP - REPLY_RESERVE = 90`), igual pra qualquer número do sistema. Resultado: 45+44=89 mensagens no número em 13/07, 44+44=88 em 14/07 — quase o dobro do pretendido. **Não foi causado por múltiplas campanhas (Semana 2/3/4 nunca chegaram a rodar) nem por "automação longa"** — hipóteses levantadas na conversa e descartadas depois de checar o dado real.

**Fixes shipados na V1 em produção** (fora do escopo/isolamento da Fase 2 — correção de bug real, não feature nova):
- `client_numbers.daily_send_cap`: teto REAL por número, compartilhado entre campanha + follow-up + automação + resposta automática (PR #46)
- Opt-out reconhece frase livre, não só 3 palavras-chave exatas (PR #46)
- Warm-up automático de número novo (rampa 15→25→40→70→padrão ao longo de 3 semanas, só quando `daily_send_cap` vazio) (PR #46)
- Monitoramento automático de conexão (cron detecta desconexão/bloqueio sozinho, throttled 1x/hora, pausa envios) (PR #46)
- Bug achado junto: toggle "Número ativo" nunca era checado em lugar nenhum — corrigido (PR #46)

**Decisão de priorização (2026-07-15):** não acelerar pra Fase 4 (Agentes de IA) mesmo com a pesquisa da Helena mais rica agora (`research/HELENA-SITE-VISUALS-2026-07-14.md`, PR #47) — é o item mais caro de construir de todo o roadmap, e ZapFlow ainda tem só 1 cliente real rodando (Hassum) com a Fase 1 (Ambiente Isolado) ainda não iniciada. Ordem recomendada e aceita: seguir Fases 1→5 como já roadmapado, validar CRM básico com uso real antes de investir em canvas visual de agentes.

---
*Last updated: 2026-07-15 — incidente de bloqueio WhatsApp (Hassum) documentado, decisão de manter ordem das fases apesar de nova pesquisa de Agentes de IA*
