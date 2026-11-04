# vocero-crm (github.com/kevinrivm/vocero-crm) — Análise como referência de código aberto

> Fonte: gh api (metadata + README) em kevinrivm/vocero-crm, 2026-11-04. Sem clone, sem leitura de código
> linha a linha. Stack: Next.js/TS, self-hosted, Meta Cloud API (WABA) + agente de IA separado via API própria.

## Diferença de arquitetura crítica (mesma nota de `WACRM-ANALYSIS.md`)

vocero usa API oficial da Meta (WABA, `subscribed_apps`, override de webhook, janela 24h + template
aprovado). ZapFlow usa Z-API. Tudo amarrado a "template aprovado"/"janela 24h" não é portável sem decisão
de negócio maior (trocar de Z-API — ver REQUIREMENTS.md "Not Portable", já documentado, não repito aqui).

## Feature a feature

| Feature vocero | Já coberto? |
|---|---|
| Bandeja tempo real 3 colunas, status enviado/entregue/lido | ATND-V2-01 (inbox multiatendente) |
| Agente de IA externo plugado por contrato HTTP (dispatch/handoff) | IA-V2-01/02/04 |
| Base de conhecimento do agente (pares pergunta/resposta) | IA-V2-03 |
| Pipeline kanban (Novo→Conversa→Interessado→Cliente→Perdido) | CRM-V2-01 |
| Import CSV com preview antes de criar, não duplica, não reativa opt-out | LNK-01..05 (Phase 2) já cobre dedup+opt-out; preview antes de commit é diferença de UX, não de conceito — nota em LNK se quiser |
| Contato "sem agente" (atendente humano sempre, mensagem não some do agente) | **Novo** — não é opt-out (contato continua recebendo campanha), é roteamento: agente de IA nunca responde esse contato. Só faz sentido junto com ATND-V2-02 (agente IA) |
| Deletar conversa (mensagens+anexos+aprendizado do agente, mantém contato/etapa) | **Novo**, menor — cabe dentro de ATND-V2-01 quando implementado, não precisa requirement próprio |
| **Laboratório**: 6 clientes simulados conversam com o agente real em sandbox, juiz LLM dá score 0-100 + achados + sugestão aplicável no knowledge base | **Novo, conceito inédito** — nenhuma referência anterior (wacrm, Helena) tinha isso |
| Resultados: funil de prospectos→vendas, origem/anúncio (Click-to-WhatsApp) que mais converte, tempo de resposta do agente, leads/mensagens travados, janelas 24h por fechar | Parcial — CRM-V2-05 cobre funil/conversão; atribuição de anúncio e "o que está travando hoje" é **novo** |
| Agenda: disponibilidade, reservar/mover cita via API do agente | **Novo** |

## Novo no backlog v2 (REQUIREMENTS.md)

- **LAB-V2-01**: Laboratório de auto-avaliação do agente de IA — conversas simuladas contra o agente real em
  sandbox (nunca envia mensagem real), juiz LLM dá score + achados + sugestão aplicável à base de conhecimento.
  Depende de IA-V2-01..04 existir primeiro (não faz sentido sem agente de IA).
- **ATND-V2-06**: Flag "sem agente" por contato — agente de IA nunca responde esse contato, só humano; distinto
  de opt-out (contato continua em campanhas). Depende de ATND-V2-02.
- **CRM-V2-07**: Atribuição de origem/anúncio (Click-to-WhatsApp) no funil e no relatório — de qual anúncio/
  criativo vêm os leads que fecham. Requer o CRM saber o `ctwa_clid`/dado do webhook, hoje não capturado.
- **AGENDA-V2-01**: Agenda/booking (disponibilidade configurável, reservar/mover cita) acessível pelo agente de
  IA. Depende de IA-V2-01..04.

## O que NÃO vale a pena trazer

- Override de webhook da WABA / recuperação de override — específico de API oficial da Meta, não aplicável ao
  Z-API (ZapFlow registra webhook direto, sem conceito de "override" a disputar).
- Rate limit de API de serviço (1200/min com chave, 30/min sem) — ZapFlow não expõe API pública pra agente de
  terceiro hoje; adicionar isso é prematuro sem IA-V2-* implementado.

## Design — referência visual pra quando ATND-V2-01/CRM-V2-01/CRM-V2-05 forem construídas

vocero tem screenshots reais no próprio repo: `docs/screenshots/bandeja.png` (inbox 3 colunas), `laboratorio.png`
(relatório com score), `pipeline.png` (kanban). Usar como referência de layout quando essas fases v2 virarem
roadmap de verdade — mesmo padrão já usado com `HELENA-VIDEO-ANALYSIS.md`. Não puxa agora, v2 continua adiado.

## Conclusão

vocero-crm não muda a Fase 2 já planejada (Ambiente Isolado → LinkedIn → Consumo → Assinatura → Lifecycle) —
zero overlap com essas 5 fases. O valor dele é 4 itens novos de backlog v2 (acima), todos dependentes de
IA-V2-* (agente de IA) ainda não implementado — continuam adiados, não entram no roadmap atual.

---
*Análise registrada: 2026-11-04*
