# HELENA-VIDEO-ANALYSIS.md — Análise de demonstração em vídeo (HelenaCRM white-label)

> **Fonte:** vídeo de demonstração de ~21 minutos (`videoplayback.mp4`, fornecido pelo usuário), gravado sob uma
> instância **white-label** de um parceiro chamado "GOL" (a marca "Helena" não aparece na tela em nenhum momento —
> é inferência do usuário, baseada em contexto de fora deste vídeo, que a plataforma por trás é a HelenaCRM).
>
> **Método:** extração de 1 frame a cada 15s (85 frames no total) via `ffmpeg`, inspeção visual de cada frame.
> **Sem transcrição de áudio** — não havia modelo whisper.cpp disponível na máquina e a extração de áudio para
> transcrição não foi feita sem antes checar com o usuário. Toda a análise abaixo é baseada em **inspeção visual
> de tela**, não em narração falada — o que se vê na tela é fato; a intenção/motivação por trás de cada feature
> é inferência.
>
> **Por que isso importa mais que `FEATURES.md`:** a pesquisa anterior (`FEATURES.md`) teve confiança
> BAIXA-MÉDIA pra HelenaCRM porque `docs.helena.app` retornou 404 pra maioria das páginas — a pesquisa foi
> baseada em texto de marketing. Este vídeo mostra a **tela real do produto em uso**, então tudo confirmado
> aqui sobe pra confiança ALTA (é o que o produto genuinamente faz, não o que o marketing promete).
>
> **Diferença de arquitetura a manter em mente:** esta plataforma (como o wacrm analisado antes) provavelmente
> usa a **API oficial do WhatsApp (Meta Cloud API)** — a tela de Campanhas usa explicitamente "Modelo de
> Mensagem" (template aprovado pela Meta). O ZapFlow usa Z-API (WhatsApp Web não-oficial, mensagem livre, sem
> aprovação de template). Qualquer feature amarrada a "modelo aprovado" **não é diretamente portável** — sinalizado
> explicitamente abaixo onde relevante.

---

## 1. Central de Atendimento (Inbox compartilhado)

**Confiança: ALTA** (visualmente confirmado, frames ~006-012)

- Lista de conversas com múltiplos atendentes visíveis simultaneamente (nomes: Ana Filipa, Cindy, Render, Eric
  Patrick, Vinicius, etc.), com indicador de quem está atribuído a cada conversa.
- Painel de dados do contato (lateral direita): Telefone, Etiquetas, Contribuições, Solicitações, Número
  interno, Site, Data, Notas internas, e **campos personalizados** adicionáveis (`Adicionar/Alterar campos
  personalizados`) — **confirma e sobe a confiança** da hipótese de custom fields do `FEATURES.md` (lá estava
  "não confirmado por doc primária").
- **Transferência de atendimento** (frame 009): modal "Transferir" com abas "Para uma equipe" / "Para uma
  pessoa" — lista de equipes nomeadas (Administrativo, Ajuste Usuários, Assinatura de Plano, Atendimento
  Automação N1/N2, Atendimento Geral). Confirma roteamento por equipe, não só por pessoa.
- **Classificação de encerramento de atendimento** (frame 010) — feature **NOVA**, não estava em `FEATURES.md`:
  ao fechar uma conversa, um modal "Classificar atendimento" pede pra marcar o resultado em 4 categorias —
  "Objetivo atingido" / "Objetivo perdido" / "Dúvidas" / "Outro" — cada uma com sub-motivos específicos
  configuráveis (ex.: em "Objetivo atingido": "Agendar visita ou reunião", "Apresentação IA", "Reunião de
  acompanhamento", "Upsell"). O modal também permite aplicar etiquetas no mesmo passo. Isso vira dado
  estruturado pra relatório (ver seção 2 — "Motivos de perda" no dashboard vem exatamente daqui).

**Comparação com ZapFlow:** ZapFlow V1 não tem inbox nem conceito de "atendimento" — é só disparo de campanha +
resposta automática por palavra-chave. Isso é território de Fase 4 (`ATND-V2-01`, já reconhecido). A
classificação estruturada de encerramento é um detalhe novo que vale registrar como refinamento futuro desse
item.

---

## 2. CRM / Funil (Kanban)

**Confiança: ALTA** (visualmente confirmado, frames ~020-046 — a seção mais rica do vídeo)

### 2.1 Estrutura de funil
- Múltiplos painéis/funis nomeados (visto: "Comercial (Treinamento)") — não é um único Kanban fixo, o usuário
  cria vários funis pra contextos diferentes.
- Criação de funil (frame 022/026): lista de etapas configuráveis (nome + tipo, ex. "Intermediário"), botão
  "Adicionar etapa", reordenável.
- **Campos personalizados configuráveis por funil** (frame 018, texto sobreposto "Campos personalizados por
  funil") — cada funil pode ter seu próprio conjunto de campos, não é um conjunto global único.
- 3 modos de visualização da mesma base de dados: **Kanban** / **Lista** / **Relatório** (abas no topo do
  funil) — mesmo funil, três lentes diferentes.

### 2.2 Ganho/Perda (Win/Loss) — feature **NOVA**, não estava em `FEATURES.md`
- Card do funil pode ser marcado como **Ganho** ou **Perda** manualmente (frame 030, modal "Marcar como Perda").
- Motivos de perda são uma **lista configurável** pelo admin (frame 026: "Gerencie motivos de perda") — no
  exemplo do vídeo, os motivos eram específicos de venda de CRM ("Valor da Mensalidade", "Visão do Setup",
  "Funcionalidades", "Preferiu API Oficial", "Custo de Conversas" — isso é o próprio time da Helena/GOL vendendo
  o produto, os motivos são customizáveis pelo cliente final, não fixos).
- **Perda automática por inatividade** (frame 022, destaque em vermelho): "Marcar como perda automaticamente
  após o card permanecer [N dias] sem movimentação" — configurável (exemplo mostrado: 30 dias) — o motivo
  registrado nesse caso automático também é configurável.
- Comportamento extra configurável ao marcar como ganho: "Continuar no mesmo como Ganho" e "Tocar
  comunicação sonora ao marcar como ganho" (feedback sonoro de vitória — detalhe de UX, baixo esforço, alto
  efeito percebido).

### 2.3 Lista (frame 034)
- Colunas: Título, Valor (R$), Situação, Descrição.
- **Busca avançada** com filtros: Responsável (todos / só meus itens — confirma o conceito de "dono do lead",
  que em `FEATURES.md` era hipótese não-confirmada sob o nome "Carteiras" — **agora confirmado, mecanismo
  visível**: é um campo "Responsável" simples com filtro "todos os responsáveis" vs "apenas meus itens", não
  algo mais elaborado que isso), Etapa, Situação (Ganho/Perda/Em andamento), Data de vencimento (intervalo),
  Etiquetas.

### 2.4 Relatório (frames 040-046) — dashboard de vendas rico, **NOVO**, não estava em `FEATURES.md`
- Cards de estatística no topo: **Ganhos** (R$), **Perdas** (R$), **Em andamento** (R$).
- Métricas: **Ticket médio**, **Taxa de conversão** (%), **Principal motivo de perda**, **Ciclo médio de venda**
  (em dias).
- Gráfico "Meta vs Ganho mensal" — barras comparando meta configurada vs. valor realmente ganho, mês a mês.
- **Funil de vendas visual** — cada etapa do funil mostra o valor total parado ali e a % de conversão pra
  próxima etapa (visto: Prospecção 70%, depois queda gradual etapa a etapa).
- **Motivos de perda** — gráfico de barras horizontal, motivos ordenados por frequência.
- **Etapas** — tabela por etapa: Ganho e Perda (R$) / Tempo médio na etapa.
- **Conversão por atendente** — tabela por vendedor/atendente: Disparados, Ganhos, Em andamento, Perdas, Taxa de
  conversão. Isso é relatório de performance individual de vendas, distinto do que ZapFlow já tem (que é
  relatório de campanha, não de funil/vendedor).

**Comparação com ZapFlow:** o Kanban completo já era reconhecido como Fase 3/4 (`CRM-V2-01`). O que este vídeo
adiciona de concreto e **não estava documentado antes**: o padrão Ganho/Perda com motivo configurável e
timeout automático, e principalmente o **dashboard de relatório do funil** (taxa de conversão, ciclo médio de
venda, motivos de perda, conversão por atendente) — isso é bem mais específico do que "Kanban visual completo"
genérico que estava no backlog. Vale desmembrar em itens próprios (ver REQUIREMENTS.md v2 atualizado).

---

## 3. Agentes de IA

**Confiança: ALTA para estrutura da tela, MÉDIA para comportamento real (não testado ao vivo, só a tela de
configuração)** — frames ~050-057

### 3.1 Criação de agente (frame 050)
Wizard em 4 abas: **Perfil** → Comportamentos → Conhecimento → Configurações.

Campos da aba Perfil:
- Nome do agente, Apelido.
- "Assiste a conversa?" (Sim/Não) — toggle que sugere um modo onde o agente observa mas não necessariamente
  responde sozinho.
- **Tom de comunicação** (presets): "Consultivo e Acolhedor" / "Neutro e Equilibrado" / "Formal e
  Institucional".
- **Formulação de resposta** (presets): "Curta e Objetiva" / "Longa e Detalhada" / "Automáticas".
- **Perfil do agente** (papel, presets): "Vendedor" / "SDR" / "Suporte" / "Onboarding" / "Recepcionista" /
  "Outro".
- Campo livre "Descreva o objetivo deste agente" com chips de sugestão: "Captar Leads", "Suporte Técnico",
  "Fechar as Conversas".
- Seção seguinte visível no rodapé: "Informações sobre a Empresa" (contexto de negócio pro agente usar).

### 3.2 Supervisores — feature **NOVA**, não estava em `FEATURES.md` nem em `PROJECT.md`
Aba separada "Supervisores" dentro de Agentes de IA (frame 054): *"Crie supervisores para analisar e decidir
qual agente deve assumir o atendimento em cada situação."*

- Um supervisor é ele mesmo configurado com nome, papel e tom (mesmos presets do agente comum) — mas sua função
  é **rotear a conversa pro agente especializado certo**, não atender diretamente.
- Exemplos nomeados vistos no vídeo: "Teste Ana Flavis - Supervisor" (Recepcionista), "Coordenador" (Neutro e
  Equilibrado), "[ACADEMIA] Supervisor Geral" (Professor), "Stallone (Funcionário)" (Vendedor), "Parcerias
  comerciais" (SDR).
- Terceira aba visível: **"Base de conhecimento"** — existe como conceito separado (RAG), mas o conteúdo
  específico dessa tela não apareceu nos frames amostrados (sem conteúdo capturado, só a aba).

**Comparação com ZapFlow:** `PROJECT.md`/`REQUIREMENTS.md` já reconheciam "Agentes de IA / supervisor de
conversas" como item de backlog (`ATND-V2-02`), mas de forma vaga. Este vídeo **confirma um padrão de
implementação concreto**: múltiplos agentes especializados por papel + uma camada de "supervisor" que decide o
roteamento. Vale desmembrar em itens mais específicos.

---

## 4. Chatbots (distinto de Agentes de IA)

**Confiança: MÉDIA** (só um frame com texto de capacidades, sem tela de builder capturada) — frame ~059

Lista de capacidades mostrada em texto: "Coletar dados do contato", "Atualizar dados", "Executar ações
internas", "Webhooks para integração externa", "Ser usado em diferentes contextos".

- É tratado como produto **separado** de "Agentes de IA" na navegação (aba própria) — sugere um construtor de
  fluxo determinístico (regras/condições/webhooks), enquanto "Agentes de IA" é o motor conversacional livre por
  LLM. Essa separação de conceito (chatbot determinístico vs. agente de IA generativo) é um padrão de produto
  que vale considerar explicitamente quando o ZapFlow chegar em Fase 4 — hoje o `automations`/`automation_runs`
  do ZapFlow já é o embrião do lado "chatbot determinístico" (blocos como `send_whatsapp`, `add_tag`, espera,
  condição).

---

## 5. Campanhas

**Confiança: ALTA pra estrutura de tela, mas com ressalva de portabilidade** — frame ~060

Campos vistos na configuração de campanha:
- Nome da campanha, Equipe, Canal de atendimento.
- "Habilitar chatbot" (toggle, desabilitado no exemplo) — dispara automaticamente quando o contato responder.
- Início do disparo: "Iniciar agora" (ou agendado, presumivelmente).
- **Disparo usa "Modelo de Mensagem"** (Template) — ⚠️ **isso é o modelo de template aprovado da API oficial da
  Meta.** O Z-API do ZapFlow não exige nem usa esse conceito — campanhas do ZapFlow já mandam texto livre com
  spintax na hora. **Não portável diretamente** — copiar a UI de "escolher modelo de mensagem" faria o ZapFlow
  parecer mais rígido do que já é hoje, não mais rico.
- Público/Destinatários e Resultados do disparo (contadores pós-envio) — esse padrão de tela (config → preview
  → resultados) já existe em espírito no `NewCampaign.jsx`/`Campaigns.jsx` do ZapFlow.

**Comparação com ZapFlow:** nada de novo aproveitável aqui além do padrão de tela geral, que o ZapFlow já
replica. O ponto mais importante é a ressalva: **não adotar o conceito de "modelo de mensagem aprovado"** — isso
seria regressão de flexibilidade pro ZapFlow, não avanço, dado que ele usa Z-API.

---

## 6. Sequências (Sequences)

**Confiança: ALTA** (visualmente confirmado, frame ~066) — feature **NOVA**, mais rica que o follow-up atual do
ZapFlow.

Exemplo visto: "Follow Up Retenção", com múltiplas etapas:
- Etapa 1: "Após 1 dia(s)", com **janela de dia da semana e horário** ("Das 08:00 às 17:00", "Seg à Sexta e
  Sábado Tarde") — não é só "N dias depois", é "N dias depois, mas só dentro dessa janela".
- Métricas **por etapa**: Disparos, Movimentação (%), Engajamento (%).
- Etapa 2: "Após 3 dias", com referência a "Modelo de mensagem" diferente.
- Toggle de habilitar/desabilitar por etapa individualmente.
- Passo terminal explícito: "Finalizar a sequência".

**Comparação com ZapFlow:** o ZapFlow hoje só tem **um** follow-up automático por campanha (N dias depois, uma
mensagem, sem janela de dia-da-semana própria pro follow-up — usa a mesma janela da campanha-mãe). Uma
"Sequência" com múltiplas etapas encadeadas, cada uma com sua própria janela e métricas, é uma evolução natural
e concreta desse recurso já existente (`follow_up_delay_days`/`follow_up_of` em `campaigns`) — não é uma feature
do zero, é uma generalização do que já existe pra N etapas em vez de 1.

---

## 7. Mensagens agendadas (avulsas, por contato)

**Confiança: ALTA** (visualmente confirmado, frame ~070) — feature **NOVA**, não estava em `FEATURES.md`.

Tela de lista "Mensagens agendadas" — histórico de mensagens agendadas individualmente (Enviado/Agendado/Falha
por linha), e painel "Novo agendamento":
- Contato* (busca/seleciona 1 contato específico), Data*/Horário*.
- Escolha entre "Modelo de mensagem" ou "Chatbot" como o que dispara.
- Seleção de número/telefone de origem.
- "Telefone para notificar o responsável" e "Atendimento incluído" (toggles).

Isso é **diferente de campanha em massa**: é um agendamento pontual, um-pra-um, tipicamente usado por um
atendente humano pra lembrar de mandar algo pra UM cliente específico numa data futura (ex.: "lembrar a Dona
Maria da consulta daqui a 3 dias", sem precisar criar uma campanha inteira pra isso).

**Comparação com ZapFlow:** não existe hoje — todo envio passa por `campaigns` (em massa) ou pelo fluxo de
resposta automática. Um "agendar mensagem avulsa pra 1 contato" é um caso de uso real e comum (equipe de
atendimento humano querendo lembrar de algo pontual) que o ZapFlow não cobre.

---

## 8. Integrações e API / Pagamentos / Estrutura

**Confiança: BAIXA** — estas 3 seções apareceram só como cartão de título + fala da apresentadora nos frames
amostrados (a cada 15s); nenhuma tela de produto real caiu na amostragem pra essas 3 seções especificamente.
Não é possível descrever o conteúdo com confiança — **tratar como lacuna, não como ausência de feature**. Se for
importante detalhar essas 3 áreas, vale reprocessar o vídeo com amostragem mais fina (ex.: 1 frame a cada 5s)
especificamente nos trechos onde esses cartões de título aparecem, ou extrair o áudio pra transcrição.

---

## 9. Modelo White Label — confirma e reforça um padrão já conhecido (Bolten)

**Confiança: ALTA** (frame ~080, cartão de título "Modelo White Label"; toda a instância mostrada no vídeo já
roda sob a marca "GOL", não "Helena")

`FEATURES.md` já documentava que a Bolten tem um modelo de revenda 70/30 ou repasse. Este vídeo **confirma que a
HelenaCRM (ou o produto por trás da marca GOL, presumivelmente Helena) também opera em modelo white-label** —
parceiros revendem a plataforma inteira sob a própria marca. Isso não estava confirmado antes para a Helena
especificamente (`FEATURES.md` só tinha a hipótese de billing mais profundo via aquisição pela Asaas, nada sobre
white-label).

**Relevância pro ZapFlow:** isso é uma decisão de modelo de negócio, não uma feature de produto isolada — mas é
exatamente o tipo de informação que muda a estratégia de "como competir": se os dois concorrentes de referência
(Bolten e Helena) têm programa de parceiro/revenda white-label, isso é um padrão de distribuição de mercado que
o ZapFlow pode considerar mais adiante (fora do escopo de qualquer fase técnica atual — decisão do Leonardo, não
um requirement de produto).

---

## 10. Resumo — o que muda de confiança, o que é genuinamente novo

| Item | Antes (`FEATURES.md`) | Agora (vídeo) |
|---|---|---|
| Campos personalizados | Hipótese, confiança BAIXA (docs 404) | **Confirmado visualmente**, configurável por funil |
| "Carteiras" / dono de lead | Hipótese, mecanismo desconhecido | **Confirmado**: campo "Responsável" simples + filtro "meus itens" |
| Auditoria/histórico | Inferido por padrão de mercado | **Confirmado**: fala explícita "tudo fica registrado na auditoria" |
| Kanban/funil como núcleo | Já sabido (Bolten/Kommo) | Detalhado: multi-funil, 3 modos de visualização, campos por funil |
| Ganho/Perda com motivo + timeout automático | Não mencionado | **Novo** |
| Dashboard de relatório do funil (conversão, ciclo, motivos, por atendente) | Não mencionado | **Novo** |
| Classificação estruturada de encerramento de atendimento | Não mencionado | **Novo** |
| Agentes de IA por papel + Supervisor roteador | Vago ("agentes de IA", Fase 4) | **Novo, concreto**: papéis presets + camada de supervisor |
| Chatbot determinístico separado de Agente de IA | Não mencionado | **Novo** (mas ZapFlow já tem o embrião via `automations`) |
| Sequências multi-etapa com janela dia/hora por etapa | Não mencionado | **Novo** |
| Mensagem agendada avulsa por contato | Não mencionado | **Novo** |
| White-label confirmado na Helena (não só Bolten) | Só hipótese de billing (Asaas) | **Novo** (decisão de negócio, não de produto) |
| Campanha usa modelo de mensagem aprovado (Meta oficial) | N/A | **Confirmado, e sinalizado como NÃO portável** pro Z-API do ZapFlow |

---

*Análise realizada em 2026-07-06 a partir de inspeção visual de 85 frames extraídos do vídeo fornecido pelo
usuário. Sem transcrição de áudio — recomenda-se revisitar com áudio transcrito se detalhes de comportamento
(não só de tela) forem necessários antes de planejar implementação real de qualquer item aqui.*
