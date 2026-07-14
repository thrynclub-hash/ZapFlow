# HELENA-SITE-VISUALS-2026-07-14.md — Screenshots do site/produto oficial da HelenaCRM

> **Fonte:** 18 imagens fornecidas pelo Leonardo (`C:\Users\Leonardo\Desktop\inspiracao zapflow\`), capturas de tela
> do site de marketing e do produto real da HelenaCRM (logo "helenaCRM" visível, sem white-label neste lote —
> diferente do vídeo "GOL" já analisado em `HELENA-VIDEO-ANALYSIS.md`).
> **Confiança: ALTA** — screenshots oficiais do produto/marketing, não inferência de frame de vídeo.
> **Método:** inspeção visual de 7 das 18 imagens (amostra representativa por categoria — 3 pilares de marketing,
> 2 telas de builder de Agentes de IA, 1 tela de white-label, 1 modal de CRM). As 11 restantes não foram abertas
> por não terem sinal de conter categoria nova além das já cobertas.

---

## 1. Posicionamento de marketing — 3 pilares

Home do site organiza o produto em 3 blocos: **Atendimento** ("todos os canais em um só lugar"), **CRM**
("funil de vendas em tempo real"), **Inteligência Artificial** ("agentes que executam rotinas de atendimento,
vendas e suporte"). Confirma a estrutura de navegação já vista no vídeo (`Atendimentos | CRM | Apps | Relatórios
| Ajustes`).

## 2. Builder visual de Agentes de IA — NOVO, mais concreto que `HELENA-VIDEO-ANALYSIS.md` seção 3

`HELENA-VIDEO-ANALYSIS.md` só tinha visto a tela de **cadastro** de um agente (wizard em abas: Perfil →
Comportamentos → Conhecimento → Configurações). Estas imagens mostram o **builder de fluxo** de verdade — um
canvas node-based (mesma linguagem visual de n8n/Make/Zapier), não uma lista:

- Nó **Início**: config de "Limite de espera" e "Tolerância" (ex.: "Imediatamente").
- Nó **Supervisor IA**: roteia pra agentes especializados (ex.: "Recepcionista" como supervisor, roteando pra
  Triagem Suporte, Financeiro, Comercial/Vendas).
- Nó **Agente IA**: cada um nomeado (ex.: "Fernanda", "Lena", "Bia - Agente Provedor de internet") com uma lista
  de **habilidades/ações atribuídas** visíveis diretamente no card do nó (ex.: "Criar Card", "MQL", "Cadência de
  Nutrição", "Inadimplente", "Insatisfação", "Alterar informação de C...").
- Nó de mensagem com **branching**: "Enviar pergunta" com opções Sim/Não como saídas do próprio nó.
- Nó **Enviar Webhook**: dispara pra URL externa (`automation.helena.run/webhook/send_conversion` — nome sugere
  integração com rastreamento de conversão/ads), com saídas "Sucesso no envio" / "Falha no envio".

### Paleta de blocos disponíveis ("Ações disponíveis", painel lateral direito)

| Categoria | Blocos |
|---|---|
| IA — blocos independentes | Adicionar Agente IA, Adicionar Supervisor IA |
| Mensagem | Enviar mensagem, Enviar modelo de mensagem, Enviar pergunta, Enviar menu |
| Contato | Adicionar/remover da sequência, Adicionar/remover etiquetas do contato, Alterar campo de contato |
| Atendimento | Transferir atendimento, Concluir atendimento |
| CRM | Criar card, Mover card, Alterar campos do card |
| Tempo | Aguardar mensagens do contato, Esperar alguns segundos |
| Fluxo | Enviar condicional, Direcionar para outro chatbot |
| Avançado | Acionar API, Consultar servidor MCP |

**Dois blocos merecem destaque por serem tecnicamente avançados:**
- **"Fluxo do chatbot"** — descrito como "múltiplos agentes atuando em conjunto na mesma conversa" — confirma
  que não é só "1 agente responde", é orquestração real de vários agentes numa mesma conversa.
- **"Consultar servidor MCP"** — "Realiza consultas em tempo real ao serviço MCP para verificar informações" —
  suporte a Model Context Protocol como fonte de dados pro agente, não só o CRM interno.

**Comparação com ZapFlow:** o `automations`/`automation_runs` do ZapFlow hoje é uma lista linear de steps
(trigger → ações em sequência), não um canvas visual com branching condicional nem conceito de "supervisor
roteando pra agentes especializados". Isso confirma e aprofunda o que `HELENA-VIDEO-ANALYSIS.md` já sinalizava
como Fase 4 (`ATND-V2-02`) — o padrão concreto a mirar, se/quando essa fase for planejada de verdade, é
canvas node-based + supervisor + blocos por categoria (Mensagem/Contato/Atendimento/CRM/Tempo/Fluxo/Avançado),
não um wizard de formulário.

## 3. White-label — confirma e detalha o já visto em `HELENA-VIDEO-ANALYSIS.md` seção 9

Tela de inbox com placeholder verde "SEU LOGO" no canto superior esquerdo — confirma que o white-label é
self-service/genérico (qualquer revendedor troca a marca), não uma instância fixa customizada só pra "GOL".
Mesmo inbox mostra popups inline de IA durante o atendimento: transcrição automática de áudio recebido
("Transcrição: Gostaria de recuperar a minha senha") e notificação inline "Card criado — Habilidade realizada
pelo Agente de IA" (o agente cria um card no CRM sozinho, no meio da conversa, com feedback visual imediato pro
atendente humano ver o que a IA acabou de fazer).

## 4. CRM Kanban — mesma estrutura já documentada, sem novidade estrutural

Modal "Contratos de clientes" com colunas Prospecção → Qualificação → Apresentação → Proposta → Ganho, valor em
R$ por coluna e por card, tags (WHITELABEL/QUENTE/MORNO/FRIO/REVENDA/CLIENTE FINAL), indicador "Atrasado",
responsável nomeado. Bate com `HELENA-VIDEO-ANALYSIS.md` seção 2 — sem informação nova aqui além de confirmar
visualmente o nível de polimento esperado.

---

## Resumo — o que isso muda

| Item | Status antes | Status agora |
|---|---|---|
| Agentes de IA — forma de construir o fluxo | Só a tela de cadastro (wizard formulário) vista | **Builder visual node-based confirmado**, com paleta de blocos concreta |
| "Fluxo do chatbot" (múltiplos agentes na mesma conversa) | Mencionado como conceito vago | **Confirmado com nome de bloco específico** |
| Integração MCP | Não mencionado | **Novo** — agente consulta servidor MCP em tempo real |
| White-label self-service (troca de logo) | Só inferido (instância "GOL") | **Confirmado visualmente** — placeholder genérico "SEU LOGO" |
| IA inline durante atendimento (transcrição de áudio, toast de ação da IA) | Não mencionado | **Novo**, detalhe de UX de alto impacto percebido / baixo esforço relativo |

**Como aplicar:** isso não muda a ordem das Fases 1-5 já roadmapadas (`ROADMAP.md`) — a Fase 4 (Agentes de
IA/Supervisor) continua depois das Fases 1-3, que ainda nem começaram a execução. Serve como referência mais
concreta pra quando a Fase 4 for de fato planejada (`/gsd:plan-phase 4`): o alvo de arquitetura é canvas visual
+ supervisor + paleta de blocos por categoria, não uma reforma incremental do `automations` linear atual.

---
*Análise realizada em 2026-07-15 a partir de 7 de 18 imagens fornecidas pelo usuário (amostra representativa).*
