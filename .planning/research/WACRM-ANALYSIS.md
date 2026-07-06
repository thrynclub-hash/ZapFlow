# wacrm (github.com/ArnasDon/wacrm) — Análise como referência de código aberto

> Fonte: WebFetch em github.com/ArnasDon/wacrm (README + descrição do repo). Não foi feito clone nem leitura
> de código-fonte linha a linha — análise de alto nível a partir de documentação pública do projeto.
> Registrado em 2026-07-06, na mesma sessão que gerou `HELENA-VIDEO-ANALYSIS.md`.

---

## O que é

CRM self-hosted, código aberto, feito especificamente pra integração com **WhatsApp Business API oficial
(Meta Cloud API)** — se posiciona como alternativa "forkável" a SaaS fechado, pra times que querem dono total
da própria infra de comunicação com cliente. ~1.4k stars, 3.4k forks, 518 commits, TypeScript 94.1% / PLpgSQL 5.5%.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase (Postgres + Auth + RLS + Storage),
Meta Cloud API, criptografia AES-256-GCM pra token, webhooks HMAC, headers CSP.

## Diferença de arquitetura crítica (mesma nota já registrada em `HELENA-VIDEO-ANALYSIS.md`)

wacrm usa **API oficial da Meta** — exige verificação de negócio, modelo de mensagem aprovado pra iniciar
conversa fora da janela de 24h, cobrança por conversa. O ZapFlow usa **Z-API** (WhatsApp Web não-oficial,
mensagem livre via spintax, sem aprovação, mensalidade fixa, risco de bloqueio). Qualquer feature amarrada a
"template aprovado" ou "janela de 24h" **não é portável** sem uma decisão de negócio maior (trocar de Z-API
pra API oficial — ver `REQUIREMENTS.md` seção "Not Portable").

## Features (confiança MÉDIA — só README/descrição pública, sem leitura de código)

| Feature | Descrição | Já coberto por outra referência? |
|---|---|---|
| Inbox compartilhado multiagente | Múltiplos atendentes num único número, atribuição por conversa, status, notas internas | Sim — confirmado com mais detalhe em `HELENA-VIDEO-ANALYSIS.md` (Central de Atendimento) |
| Funil de vendas (Kanban) com negócio vinculado à conversa | Visualização de estágio + valor do negócio, ligado à thread de conversa | Sim — Helena mostra o mesmo padrão com mais profundidade (Ganho/Perda, campos por funil) |
| Construtor de automação visual no-code | Gatilhos (mensagem recebida, novo contato, palavra-chave, agendamento), branches condicionais, espera, tags, webhooks — tudo por interface gráfica | Parcial — o ZapFlow já tem o motor por trás (`automations`/`automation_runs`/`executeAction` com blocos `send_whatsapp`/`add_tag`/condição/espera), só falta a camada visual no-code. wacrm é referência de "pra onde evoluir a UI", não de conceito novo |
| Assistente de resposta por IA + base de conhecimento | Chave própria OpenAI/Anthropic (criptografada), resposta sugerida com 1 clique, bot de auto-resposta opcional, RAG sobre FAQ/políticas/docs (busca full-text Postgres ou pgvector se tiver chave de embedding) | Idea nova (não tinha aparecido antes desta análise) — já capturada em `IA-V2-03` (base de conhecimento) e como conceito geral de assistente de IA em `IA-V2-01`/`IA-V2-02` |
| Contas de equipe com papéis (owner/admin/agent/viewer) | Controle de acesso granular por papel | Não crítico agora — só ganha relevância quando existir inbox multiatendente de verdade (ATND-V2-01); ZapFlow hoje só tem client/admin |
| API REST com chaves escopadas e revogáveis | Acesso programático de terceiros ao CRM | Público-alvo do wacrm é mais técnico/desenvolvedor; não parece prioridade pro perfil de cliente do ZapFlow (clínicas, pequenos negócios locais) — não recomendado adicionar como requirement agora |

## O que NÃO vale a pena trazer

- **Migração pra Next.js/React 19**: reescrita de framework inteira só pra "parecer" com a referência, sem
  ganho funcional real — ZapFlow já funciona bem em Vite+React, trocar de stack não está a serviço de nenhum
  requirement de produto.
- **API REST pública com chaves de API**: esforço de plataforma (docs, versionamento, rate limit) sem sinal de
  demanda do público-alvo atual do ZapFlow.

## Conclusão

wacrm não trouxe nenhum conceito de produto **estruturalmente novo** que o vídeo da Helena já não tenha coberto
com mais profundidade (a Central de Atendimento e o Funil da Helena são mais ricos do que a descrição do wacrm
permite confirmar). O valor real do wacrm como referência é:
1. **Confirmação de padrão de mercado** — os 3 concorrentes (Bolten, Helena, wacrm) convergem em inbox
   multiagente + funil + automação como o "pacote table stakes" de um CRM de WhatsApp maduro.
2. **Referência técnica de arquitetura**, se algum dia o ZapFlow decidir oferecer suporte à API oficial da
   Meta como opção adicional (não substituindo o Z-API) — wacrm é código real, aberto, que mostra como
   estruturar isso (tokens criptografados, webhooks HMAC, RLS) — mas isso é uma decisão de arquitetura maior,
   não escopo de nenhuma fase atual.

Nenhum item novo adicionado ao backlog `REQUIREMENTS.md` a partir desta análise isolada — os itens de valor
real (assistente de IA + base de conhecimento, automação visual) já estão cobertos pelos requirements `IA-V2-*`
criados a partir da análise do vídeo da Helena, que tem confiança mais alta (tela real vs. descrição de README).

---
*Análise registrada: 2026-07-06*
