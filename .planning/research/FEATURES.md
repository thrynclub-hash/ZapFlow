# FEATURES.md — Fase 2 (Mini-CRM leve): Pesquisa de Concorrência

> Escopo desta pesquisa: **apenas a camada leve de CRM** (status/ciclo de vida de contato, tags/segmentação,
> visibilidade de consumo de plano, status de cobrança, import de leads externos). Features de IA/agentes
> conversacionais, inbox multiatendente e funil Kanban completo são território de Fase 3/4 e só aparecem
> aqui quando ajudam a entender o padrão de mercado.
>
> Método: WebSearch + WebFetch em bolten.io, bolten.gitbook.io/bolten-docs, helenacrm.com, docs.helena.app,
> e busca aberta sobre Kommo, respond.io, Take Blip, Zenvia. Nem toda página de doc pública devolveu
> conteúdo (várias rotas do gitbook da Bolten e do docs.helena.app deram 404 ou só Termos de Uso no
> momento da pesquisa — sinalizado explicitamente onde a confiança é baixa por isso).

---

## 1. Bolten — o que existe de fato nesta camada

**Fonte confiável:** `bolten.gitbook.io/bolten-docs/en/tools/conversion-management` (única página de docs que
respondeu com conteúdo real na pesquisa).

- O módulo relevante **não se chama "CRM"** e sim **"Conversion Management"** — é tratado como uma ferramenta
  separada do Kanban de oportunidades (que os parceiros costumam chamar informalmente de "CRM"/"Sales Funnel").
  Ou seja: na Bolten, status de lead e funil visual já são a MESMA coisa — não existe uma camada "leve" separada
  do Kanban completo.
- **Modelagem de lead:** telefone (vinculado ao WhatsApp), origem/canal de entrada (Instagram, blog, site, Meta
  Ads), e um campo único de **"Current Status"** = posição atual no funil.
- **Ciclo de vida de status:** configurado em 3 passos — (1) criar o estágio inicial do funil, (2) definir
  **"source phrases"**: frases-gatilho que, quando ditas/recebidas na conversa de WhatsApp, registram
  automaticamente um lead novo naquele estágio (case-insensitive, sem emoji, match por conter-a-frase em
  qualquer posição do texto), (3) para os estágios seguintes, definir **"follow-up phrases"**: frases que,
  quando o vendedor as envia na conversa, avançam automaticamente o lead pro próximo estágio.
- **Mudança manual de status:** dropdown na listagem de conversões ("Current Status" column) — também aceito,
  não só automático via frase.
- **Auditoria:** toda transição de estágio é **gravada permanentemente** e conta para as métricas do funil;
  dá pra apagar uma transição individual (afeta as métricas retroativamente).
- **Ordenação de estágios:** drag-and-drop, refletido nos dashboards.
- **Integração cross-módulo:** o módulo de "Opportunities/Kanban" avança automaticamente em paralelo quando
  telefone bate e nome do estágio é idêntico — ou seja, dois módulos distintos (Conversion Management e
  Kanban/Opportunities) ficam sincronizados por convenção de nomenclatura, não por um único modelo de dados.
- **Import de leads / contatos:** não encontrado nenhum detalhe de CSV import, dedup ou mapeamento de campo
  na documentação pública acessível — **gap de confiança**, não é possível afirmar como a Bolten faz isso.
- **Plano/consumo:** a doc de Conversion Management não menciona limite de uso. A página de pricing
  (`platform-user-guide/products-and-pricing`) retornou o seguinte:
  - Preço mínimo por produto, que o parceiro pode revender mais caro: CRM com WhatsApp a partir de R$20/usuário/mês;
    AI Chatbot a partir de R$60/projeto/mês (**com teto de uso explícito: até 500 interações/mês**, acima disso
    a Bolten aciona revisão de preço com o time comercial); Conversion Management a partir de R$20/projeto/mês;
    Social Media Management a partir de R$10/projeto/mês.
  - Dois modelos de repasse pro parceiro: **70/30** (Bolten cobra o cliente final direto na plataforma e repassa
    70% pro parceiro automaticamente) ou **"repasse"/pass-through** (Bolten cobra o parceiro o preço mínimo, o
    parceiro cobra o cliente final o quanto quiser e fica com 100% da margem acima do mínimo).
  - Ambiente de teste gratuito de 7 dias, sem custo de setup/domínio/infra.
  - **Confiança:** MÉDIA-ALTA para o modelo de pricing/split (página respondeu com conteúdo específico); BAIXA
    para "como o consumo é exibido visualmente ao cliente final" (não documentado publicamente — o teto de 500
    interações do chatbot é o único número de limite que apareceu, e é tratado como gatilho comercial, não como
    um "medidor" visual de consumo no produto).

---

## 2. HelenaCRM — o que existe de fato nesta camada

**Fontes:** `helenacrm.com` (marketing), `docs.helena.app` (documentação — a maioria das páginas específicas
tentadas retornou 404 ou apenas Termos de Uso no momento da pesquisa; `llms-full.txt` do site só trouxe ToS).
**Confiança geral desta seção: BAIXA-MÉDIA** — baseada majoritariamente em texto de marketing/resumos de busca,
não em documentação técnica primária confirmada por WebFetch direto.

- Posicionamento: "CRM conversacional" — cada conversa (WhatsApp/Instagram/site/e-mail) vira automaticamente
  um **perfil de cliente com rastreamento em tempo real**, sem cópia manual de dado entre inbox e CRM.
- **Funil configurável por operação:** ao contrário da Bolten (que usa frases-gatilho fixas), a HelenaCRM deixa
  o cliente **criar as etapas do funil conforme o contexto do negócio** e usar **campos personalizados**
  (custom fields) para garantir que os dados necessários existam no CRM. Não foi possível confirmar detalhes
  de implementação (nomes de campo, tipos suportados) via doc primária.
- **Automação de movimentação de card:** os agentes de IA (fora do escopo desta fase, mas relevante como
  padrão) conseguem localizar o card do cliente num painel — inclusive filtrando por tag — e mover para o
  estágio correto (ex.: de "Qualificação" para "Proposta Enviada") como parte da conversa. Ou seja, na Helena
  a movimentação de status é tipicamente **acionada por agente/IA dentro da própria conversa**, não por
  frase-gatilho configurada manualmente como na Bolten.
- **Rastreabilidade de mudanças:** o sistema registra toda ação relevante independente da origem —
  interface manual, API, chatbot, ou **importação de planilha** — sugerindo um log de auditoria unificado
  parecido em espírito com o da Bolten.
- **Import de contatos:** a busca (não o WebFetch direto, que deu 404 na página específica) indica que o fluxo
  é CRM → Contatos → "Importar Contatos", com suporte a **Google Sheets, MS Excel, CSV e vCard** como formatos
  de origem. Não foi possível confirmar via doc primária: comportamento de dedup, mapeamento de coluna, ou
  como tag/origem é atribuída automaticamente ao lead importado — **gap de confiança**, tratar como hipótese,
  não fato.
- **"Carteiras" (wallets/ownership):** existe uma página de docs dedicada a "Carteiras" — sugere um conceito de
  atribuição de contatos/leads a donos (vendedor/atendente responsável), mas o conteúdo não foi recuperado —
  não é possível descrever o mecanismo.
- **Plano/consumo/billing:** nenhuma informação encontrada sobre como a Helena exibe consumo de plano ou
  status de assinatura ao cliente final. Contexto de negócio relevante (já no seu resumo): a Helena foi
  adquirida pela Asaas (empresa de pagamentos) por R$150M — plausível que a integração de billing seja mais
  profunda do que a da Bolten (que usa Pagar.me como processador externo), mas isso é **inferência, não fato
  documentado**.

---

## 3. Outros players — existe um padrão emergente?

Pesquisa mais rasa (só WebSearch, sem WebFetch profundo por limite de contexto) em **Kommo**, **respond.io**,
**Take Blip** e **Zenvia**. Confiança: MÉDIA para Kommo (tem docs técnicas públicas ricas), BAIXA para os
outros três (só resumos de blogs/comparativos de terceiros).

### Kommo (ex-amoCRM) — o mais próximo do "padrão de mercado" para CSV import
- Modelo de dados: **Leads** e **Contacts** são entidades separadas (lead = oportunidade de venda; contact =
  pessoa/empresa) — mais rico que o modelo Bolten (um único registro "conversion").
- **Import CSV/planilha** com UI de mapeamento de coluna explícito: cada coluna do arquivo é casada com um
  campo do Kommo pelo **nome exato** (incluindo maiúsculas/minúsculas) — se não bate com nenhum campo
  existente, a UI mostra "Do not import" pra aquela coluna. Isso é mapeamento **por nome**, não um assistente
  visual de "arraste a coluna pro campo".
  Fonte: `kommo.com/support/crm/import-settings/`, `kommo.com/support/crm/import-advanced/`.
- **Import direto pra estágio do funil**: por padrão todo import cai no primeiro pipeline/primeiro estágio,
  mas o usuário pode adicionar duas colunas extras no arquivo (nome do pipeline + nome do estágio, grafados
  identicamente ao que existe no Kommo) pra já importar os leads direto no estágio certo.
- Se a planilha também tiver colunas de contato/empresa, o Kommo **cria e vincula automaticamente** os
  registros de Contact e Company ao Lead importado (evita import "solto" sem dono).
- Pipeline visual é o centro do produto — não existe uma versão "sem Kanban" do CRM da Kommo; a mensageria
  (WhatsApp etc.) é tratada como fonte de lead de primeira classe dentro desse pipeline.

### respond.io, Take Blip, Zenvia — sinais fracos, tratar como direcional
- Todos os três se posicionam mais para **inbox/atendimento multicanal em escala** do que para CRM leve —
  respond.io é citado como mais adequado para times de 20+ agentes; Blip Desk é descrito como inbox unificado
  multicanal (WhatsApp/Instagram/Messenger) para operações grandes; Zenvia é citado como CPaaS/plataforma de
  mensageria em massa na América Latina.
- Nenhuma fonte primária consultada detalhou o modelo de status/lifecycle de contato desses três de forma
  específica o suficiente para citar como fato — **não usar estes três como referência de implementação**,
  apenas como confirmação de que "funil + inbox unificado" é a direção geral do mercado acima de ZapFlow V1.

### Padrão emergente (o que se repete em 3+ fontes)
1. Todo concorrente pesquisado trata **status de contato/lead como um valor de posição num funil configurável**,
   não como um enum fixo tipo "Ativo/Inativo" — é sempre N estágios nomeados pelo próprio cliente.
2. **Auditoria de transição de estágio é tratada como recurso de produto**, não só um log técnico — Bolten
   grava e permite apagar transições individuais; Kommo e Helena têm histórico de ação por origem
   (manual/API/import/bot).
3. Import de contatos por planilha é **tabela estaca** — todos os players relevantes (Bolten indiretamente via
   Kanban/Conversion, Helena, Kommo) suportam CSV/Excel/Sheets. O nível de sofisticação varia: Kommo tem
   mapeamento de coluna nomeado + roteamento direto pro estágio certo; Helena aceita mais formatos (inclui
   vCard) mas com menos detalhe documentado sobre dedup.
4. **Nenhum concorrente pesquisado expõe publicamente um "medidor de consumo de plano" como feature de
   destaque** (contatos usados/limite, números usados/limite) — isso é tratado como parte do back-office de
   billing, não como uma tela de produto anunciada. Isso é um dado importante para a Fase 2 do ZapFlow: pode
   ser um ponto de diferenciação real, não commodity.

---

## 4. Classificação para escopo de Fase 2

### Table stakes (usuário vai esperar isso mesmo num "Fase 2" ainda leve)

| Feature | Por quê é table stakes | Quem já faz |
|---|---|---|
| Status de contato como **posição num funil nomeável** (não só Ativo/Inativo binário) | Bolten, Helena e Kommo tratam isso como o dado central do produto | Bolten (Conversion Management), Helena (funil configurável), Kommo (pipeline) |
| Import de planilha (CSV/Excel) com mapeamento de coluna e feedback de erro | ZapFlow V1 já faz isso (`Contacts.jsx`) — manter esse nível é mínimo aceitável, mas hoje sem roteamento de estágio | Kommo (mapeamento nomeado + estágio direto), Helena (múltiplos formatos) |
| Auditoria/histórico de mudança de status (quem/quando/como mudou) | Todos os 3 concorrentes com dados confiáveis tratam isso como parte do produto, não só log técnico | Bolten (transições gravadas, editáveis), Kommo/Helena (histórico por origem) |
| Tags/segmentação vinculada ao status ou origem do contato | Já existe no ZapFlow V1; concorrentes usam tag pra filtrar card no funil (Helena) ou pra Kanban (Bolten) | Helena, Bolten |

### Differentiators (faria o ZapFlow se destacar, dado que nenhum concorrente expõe isso claramente hoje)

| Feature | Por quê diferencia | Evidência de gap |
|---|---|---|
| **Painel de consumo de plano visível ao cliente final** (contatos vs. limite, números vs. limite, campanhas/mês) | Nenhum dos concorrentes pesquisados anuncia isso como tela de produto — é tratado como back-office/gatilho comercial (ex.: teto de 500 interações da Bolten aciona só "revisão de preço com o time comercial", não um medidor visual pro usuário) | Bolten: sem UI de consumo documentada; Helena: nenhuma menção encontrada |
| **Status de assinatura (Ativa/Em atraso/Cancelada) integrado visualmente ao CRM**, já ligado ao Mercado Pago existente no ZapFlow | Bolten usa Pagar.me como processador externo com split 70/30 mas não documenta uma tela de status de cobrança pro cliente final; Helena foi comprada por uma fintech (Asaas) mas isso não foi confirmado como feature de produto | Nenhuma fonte confirmou essa tela em nenhum concorrente |
| Import de leads com **origem/tag automática por fonte** (ex.: "LinkedIn CSV" vira tag `origem:linkedin` + rota pra campanha de boas-vindas) sem precisar reconfigurar frases-gatilho (como a Bolten exige) | Bolten depende de frases-gatilho manuais pra classificar entrada; Kommo precisa que as colunas do CSV já venham com nome de pipeline/estágio idêntico ao existente — nenhum dos dois automatiza "criar tag de origem + disparar automação" a partir de um import simples | Comparado direto: Kommo (`import-settings`), Bolten (`conversion-management`) |

### Anti-features (deliberadamente NÃO fazer na Fase 2, com porquê)

| Feature | Por quê pular agora | Quem faz isso hoje (mas não é o alvo do ZapFlow ainda) |
|---|---|---|
| Kanban visual completo (drag-and-drop de card) | Já definido como Fase 3/4 no PROJECT.md; construir isso agora sem o inbox multiatendente por trás entrega um Kanban "de vitrine" sem dado real de conversa fluindo pra dentro dele | Bolten (Opportunities/Kanban), Kommo (pipeline como núcleo do produto) |
| Frases-gatilho / follow-up phrases pra mover estágio automaticamente dentro da conversa | Depende de o ZapFlow ter uma camada de conversa/inbox rica o suficiente pra "ouvir" a frase — isso é Fase 4 (agentes/IA), tentar antes é gambiarra em cima do webhook de keyword atual | Bolten (source/follow-up phrases) |
| Múltiplos formatos de import (vCard, Google Sheets nativo) | CSV/Excel já cobre o caso de uso real (Hassum, LinkedIn export) — adicionar vCard/Sheets nativo é esforço sem sinal de demanda | Helena (aceita vCard) |
| "Carteiras" / atribuição de dono por vendedor no CRM | ZapFlow ainda não tem múltiplos atendentes por cliente — conceito de "dono do lead" não tem quem usar ainda; é pré-requisito de Fase 4 (inbox multiatendente), não de Fase 2 | Helena (Carteiras) |

---

## 5. Gaps de confiança explícitos (para não contaminar o requirements com achismo)

- **Não confirmado por doc primária:** como a Bolten faz dedup/mapeamento de coluna no import de contato pro
  Kanban/CRM (a única página de docs que respondeu com conteúdo real foi Conversion Management, que é sobre
  funil por frase-gatilho, não sobre import de planilha).
- **Não confirmado por doc primária:** estrutura exata de custom fields e "Carteiras" da HelenaCRM — as páginas
  de docs específicas (`documentacao/crm/contato/importacao-de-contatos`, `configurando-sua-plataforma/crm`)
  retornaram 404 ou conteúdo genérico no momento da pesquisa; `llms-full.txt` só trouxe Termos de Uso.
- **Não confirmado em nenhum concorrente:** uma tela de "medidor de consumo de plano" visível ao cliente final
  — se isso existir em algum deles, não apareceu em nenhuma fonte consultada (busca + fetch), o que reforça a
  leitura de que é um diferencial real, mas também significa que não há benchmark de UI pra copiar — o ZapFlow
  desenharia isso do zero.
- **Take Blip, Zenvia, respond.io:** tratados apenas como confirmação direcional de mercado ("funil + inbox
  multicanal é a direção"), não como fonte de padrão de implementação — pesquisa não foi profunda o
  suficiente (sem WebFetch em doc primária) para citar specifics com confiança.

---

*Pesquisa realizada via WebSearch/WebFetch em bolten.io, bolten.gitbook.io/bolten-docs, helenacrm.com,
docs.helena.app, kommo.com, e busca aberta sobre respond.io/Take Blip/Zenvia. Sessão interrompida por limite
de contexto antes de aprofundar Take Blip/Zenvia/respond.io com WebFetch direto — se necessário, retomar
pesquisa especificamente nesses três antes de fechar requirements definitivos de Fase 2.*
