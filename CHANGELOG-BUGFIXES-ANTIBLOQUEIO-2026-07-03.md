# Changelog — Correções de billing, agendamento e anti-bloqueio (2026-07-03)

> Gerado via Mega Brain (Cowork) em 2026-07-03, a partir de pedidos diretos do Leonardo

> **Ver também:** `RELATORIO-QA-2026-07-03.md` — auditoria de mobile/responsividade,
> performance e segurança (a partir dos templates em `core/templates/qa-prompts/`),
> incluindo uma correção de segurança real (token da Z-API exposto no navegador).

## O que mudou

### 1. Bug real de cobrança: add-on de contatos estava recorrente, devia ser único
`mp-create-preapproval` usava `/preapproval` (assinatura mensal do Mercado Pago) pros
**dois** tipos de add-on. Corrigido: `number` continua recorrente (custa Z-API todo mês
de verdade); `contacts_1000` agora usa `/checkout/preferences` (pagamento único).
`mp-webhook` atualizado pra processar notificações `payment` (pagamento único) além de
`preapproval`/`subscription_preapproval` (assinatura), que antes eram ignoradas.

Preços ajustados: número R$149→**R$150/mês**, contatos R$59→**R$59,90 (pagamento
único)**. Textos corrigidos em `Settings.jsx` (cliente) e `AdminClients.jsx` (admin,
inclusive o "Total extra/mês" que antes somava incorretamente add-ons únicos).

**Se algum cliente já comprou "+1000 contatos" antes desta correção**, ele pode estar
com uma assinatura recorrente ativa no Mercado Pago cobrando R$59/mês — vale conferir
manualmente no painel do Mercado Pago (Assinaturas) e cancelar se for o caso.

### 2. Data/hora de término para campanhas (`supabase_campaign_stop_date.sql`)
Nova coluna `campaigns.stop_at` (opcional). Campanha `scheduled`/`daily` para de
enviar sozinha na data marcada, mesmo com contatos pendentes — novo status
`'stopped'` (distinto de `'completed'`, que significa "alcançou todo mundo").
Editável na criação (`NewCampaign.jsx`) e depois, a qualquer momento, editando a
campanha no Histórico (`Campaigns.jsx`) — inclusive dá pra reabrir uma campanha
parada apagando/adiando a data.

### 3. Variação de mensagens (spintax) — `{opção1|opção2|opção3}`
Sintaxe nova, resolvida por contato (cada pessoa pode receber uma frase levemente
diferente): `{{nome}}` continua funcionando, spintax roda depois disso pra nunca
confundir com a chave dupla. Aplicado em **todo** caminho de envio em massa:
campanha principal (antes nem sequer tinha `{{nome}}`), follow-up, ação de
automação (`send_whatsapp`) e disparo de aniversário (`Birthdays.jsx` →
`send-message`). Dica de uso com exemplo adicionada no formulário de criação de
campanha.

### 4. Risco de bloqueio do WhatsApp — avaliação + 2 correções
Ver seção própria abaixo com a avaliação completa. Resumo do que mudou no código:
- **Pausa entre envios**: lote de 100 mensagens saía em sequência direta, sem
  pausa nenhuma — agora tem um intervalo aleatório de 600–1500ms entre cada
  envio (campanha, follow-up e ação de automação), mais parecido com um humano
  operando manualmente do que um disparo robótico instantâneo.
- **Opt-out real**: quem respondia "PARAR"/"SAIR"/"descadastrar"/etc. só ficava
  logado e continuava recebendo campanhas futuras normalmente. Agora
  `zapi-webhook` reconhece essas palavras-chave, marca o contato como
  `status='Inativo'` + tag `Descadastrado`, e confirma a saída — isso já
  exclui automaticamente o contato de `sendCampaignBatch`/
  `processFollowUpCampaigns` (que só mandam pra `status='Ativo'`).

## Avaliação de risco de bloqueio (pedido direto do Leonardo)

**O limite de 100/dia por número já era real e global** antes de hoje — não é
"por campanha", é um contador único por número+dia
(`try_consume_daily_send_budget`), somando campanhas, automações, aniversários e
follow-ups. Isso já estava correto.

**O que mais pesa pro risco de bloqueio, na prática:**
1. **Denúncia do destinatário** (a pessoa clicar "denunciar spam" no WhatsApp) é o
   gatilho mais comum de bloqueio — mais do que volume puro. Por isso opt-out real
   (item 4 acima) importa mais do que parece.
2. **Número novo/recém-conectado mandando 100/dia desde o primeiro dia** é mais
   arriscado do que um número com histórico — se algum número do ecossistema for
   novo, vale começar com volume bem menor (15-20/dia) na primeira semana e subir
   aos poucos ("warm-up"). Isso não está automatizado no sistema — é uma decisão
   manual de quando ligar cada número novo.
3. **Mensagem idêntica pra centenas de pessoas** é um padrão que ferramentas
   antispam reconhecem — resolvido parcialmente com a variação (item 3).
4. **Z-API é uma API não-oficial** (não é o WhatsApp Business Platform/Cloud API
   da Meta) — ela emula um WhatsApp Web comum. Isso significa que existe um risco
   estrutural de bloqueio que nenhuma configuração de volume elimina 100%,
   porque tecnicamente não é o canal "aprovado" pela Meta para esse tipo de uso.
   Reduzir volume e variar mensagem ajuda a mitigar, mas não zera esse risco de
   base — é bom o Leonardo (e os clientes) saberem disso como expectativa realista,
   não uma garantia.

**Nenhuma correção de código elimina 100% o risco de bloqueio** — o que dá pra
fazer (e foi feito) é reduzir os sinais mais óbvios de automação em massa
(rajada instantânea, mensagem idêntica, gente reclamando por não conseguir sair
da lista).

## Adição — horário explícito no agendamento + botões de resposta rápida (mesmo dia, pedido seguinte)

### 5. Data e horário sempre em 2 campos separados
`NewCampaign.jsx` e `Campaigns.jsx` (editar campanha) já aceitavam horário via
`datetime-local`, mas o campo de hora ficava escondido dentro do mesmo input da
data — pedido do Leonardo pra deixar isso óbvio. Agora início e término do
disparo (e o "parar de enviar em") sempre aparecem como 2 campos lado a lado:
data + horário, combinados em um só `Date` na hora de salvar.

### 6. Botões de resposta rápida na campanha (`campaigns.quick_replies`)
Nova coluna `quick_replies` (jsonb, `supabase_campaign_quick_replies.sql`) — array
de `{id, label, action}` por campanha. Padrão sugerido: "Quero sim! 🙌"
(`trigger_flow`) + "Não quero receber esse tipo de mensagem" (`stop_followup`).
Editável na criação (`NewCampaign.jsx`, seção 4) e depois no Histórico
(`Campaigns.jsx`, editar campanha) — 3 ações possíveis por botão:
- `trigger_flow`: mesmo fluxo de quem digita a palavra-chave (pergunta o turno)
- `stop_followup`: confirma pro contato e não manda mais o follow-up **desta
  campanha** pra essa pessoa (contato continua Ativo pra outras campanhas)
- `opt_out`: descadastra de vez, igual responder "PARAR"

**Como o "parar follow-up" funciona de verdade**: todo clique em botão é logado
em `inbound_messages` (mesma tabela de qualquer resposta de texto) — e
`processFollowUpCampaigns` (`run-automations`) já pula quem tem QUALQUER
mensagem recebida desde o envio da campanha-base, então o follow-up para
sozinho pra quem clicou em qualquer botão, não só no configurado como
"stop_followup". Zero mudança necessária nessa lógica existente.

O texto "eu quero" digitado na mão continua funcionando exatamente igual —
os botões são um atalho a mais, não uma substituição.

### 6.1. 4ª ação: "perguntar e continuar" (`ask_choice`) — caso da Hassum
Pedido real: no botão "Não quero a limpeza, prefiro outro serviço" da campanha
da Hassum, em vez de só parar o follow-up, perguntar **qual** procedimento a
pessoa prefere (com novos botões: Clareamento, Canal, Extração etc.) e, quando
ela escolher, notificar o WhatsApp interno (`reply_flows.notify_phone`) com
nome + telefone + escolha, pra o dentista continuar o atendimento na mão.

Cada botão pode agora ter `action: "ask_choice"` + `question` (a 2ª pergunta) +
`options` (array de `{id, label}`, as sub-opções). Fluxo:
1. Pessoa clica no botão de nível 1 (`ask_choice`) → `zapi-webhook` manda a
   pergunta configurada com as sub-opções como novos botões, e marca
   `conversation_states.state = 'awaiting_choice'` pra esse contato+campanha.
2. Pessoa clica numa sub-opção → `zapi-webhook` reconhece que este contato
   estava esperando (`awaiting_choice`), confirma pra ela, e manda a
   notificação pro `notify_phone` configurado na seção "Resposta automática"
   do Histórico.
3. Se a pessoa não clicar em nada, ou digitar texto livre em vez de tocar num
   botão, nada trava — cai no fluxo normal (nenhuma automação nova dispara,
   mas também não gera erro).

**Mesma ressalva de antes**: `send-button-list` (`zapi-webhook` e
`run-automations`) segue documentação pública não validada ao vivo.

## Passos manuais (SQL já rodado por você em 2026-07-03)

As migrações `supabase_campaign_stop_date.sql` e
`supabase_campaign_quick_replies.sql` já foram executadas no SQL Editor —
é por isso que salvar campanha (`stop_at`) e configurar botões
(`quick_replies`) já funcionam. Nenhuma migração nova é necessária pro
`ask_choice` (usa as mesmas colunas + `conversation_states`, que já existia).

### 7. Rajada de 100 mensagens em poucos minutos → espalhado ao longo do dia (`daily_end_hour`, `weekdays_only`)

**Bug real encontrado (relato do Leonardo sobre a campanha da Hassum):**
`daily_start_hour` existia na UI desde sempre, mas o motor (`run-automations`)
**nunca checava esse campo**. Assim que uma campanha virava elegível (data
passou / ainda não rodou hoje), ele mandava o lote inteiro — até 100
mensagens — de uma vez, em poucos minutos (só havia um delay de 600–1500ms
entre uma mensagem e outra). Isso é uma rajada muito mais "robótica" e
detectável do que qualquer humano mandando mensagem aos poucos.

**Correção:** nova coluna `daily_end_hour` (junto com `daily_start_hour` já
existente) define uma janela de horário comercial (padrão 9h–18h, horário do
Brasil, fixo em UTC-3 já que o país não observa mais horário de verão desde
2019). O motor agora calcula, a cada execução do cron, **quantas mensagens
já deveriam ter saído** proporcionalmente ao tempo decorrido dentro da
janela — e manda só a diferença entre isso e o que já foi enviado hoje (teto
de 15 por ciclo, mesmo que o cron tenha ficado parado e acumulado atraso).
Isso vale pra campanhas **scheduled** e **daily**, não só "por dia".

Nova coluna `weekdays_only` (padrão `true`) pula sábado e domingo — pra
negócios como a Hassum que só funcionam dias úteis.

Ambos os campos são editáveis por campanha, tanto na criação
(`NewCampaign.jsx`, seção "Quando enviar") quanto depois no Histórico
(`Campaigns.jsx`, editar campanha).

**Exemplo prático:** 1050 contatos, 100/dia, janela 9h–17h, só dias úteis —
o motor manda ~12-13 mensagens por hora dentro da janela (a cada ciclo do
cron de 5 min, ~1 mensagem), levando ~11 dias úteis pra alcançar todo mundo
(1050 ÷ 100 ≈ 10,5 dias), sem nunca mandar mais de ~15 de uma vez.

### 8. Como usar variação de mensagem (spintax) na prática

Sintaxe: `{opção 1|opção 2|opção 3}` — o sistema escolhe uma das opções
aleatoriamente, pra cada contato, sozinho. Não precisa numerar nada além de
separar por `|` (barra vertical) dentro de `{ }`. Exemplo real (campanha de
limpeza dental):

```
{Oi|Olá|E aí}, {{nome}}! {Já faz um tempo desde sua última limpeza|Está na hora de agendar sua limpeza|Sua limpeza semestral está chegando}. {Quer marcar um horário?|Vamos agendar?|Topa marcar?}
```

Cada pessoa da lista recebe uma combinação diferente das opções entre chaves
— e `{{nome}}` (sempre com chave dupla) continua virando o nome de cada
contato, sem conflitar com a spintax (chave simples). Essa dica com exemplo
já aparece no campo de mensagem da campanha, embaixo do textarea.

## Passos manuais desta rodada

1. Rodar `supabase_campaign_daily_window.sql` no SQL Editor
2. Deploy: `npx supabase functions deploy run-automations --no-verify-jwt`

**⚠️ NÃO VALIDADO AO VIVO** — como nenhum número Z-API real está ligado ainda
(Leonardo ainda vai pagar o plano pra ativar), o formato exato do payload de
"clique em botão" que a Z-API manda pro webhook (`buttonsResponseMessage` /
`listResponseMessage`) e o endpoint de envio (`send-button-list`) seguem a
documentação pública da Z-API, mas não foram testados com tráfego real nesta
sessão. `run-automations/index.ts` (`sendButtonMessage`) e
`zapi-webhook/index.ts` (`extractButtonReply`) têm comentários marcando
exatamente isso. **Assim que o primeiro número for ligado e a primeira campanha
com botões for enviada de verdade**: conferir os logs do Supabase Functions
(`send-button-list` e o payload recebido no webhook) pra confirmar se bateu com
o esperado — se não bater, é só ajustar essas duas funções, o resto do sistema
não depende do formato exato.

## Passos manuais necessários (nenhum aplicado automaticamente)

1. Rodar `supabase_campaign_stop_date.sql` **e** `supabase_campaign_quick_replies.sql`
   no SQL Editor do projeto (`bhiggyigsrqfabqhutne`)
2. Deploy das functions alteradas:
   ```bash
   npx supabase functions deploy mp-create-preapproval
   npx supabase functions deploy mp-webhook --no-verify-jwt
   npx supabase functions deploy run-automations --no-verify-jwt
   npx supabase functions deploy send-message
   npx supabase functions deploy zapi-webhook --no-verify-jwt
   ```
3. Conferir no painel do Mercado Pago se algum cliente já tem assinatura recorrente
   de "+1000 contatos" ativa de antes desta correção (ver item 1 acima)
4. Se algum número WhatsApp do ecossistema for novo/recém-conectado, considerar
   reduzir manualmente o `daily_limit` das campanhas dele nas primeiras semanas
5. Quando o primeiro número Z-API for ligado: mandar uma campanha de teste com
   botões de resposta rápida pra você mesmo e conferir nos logs do Supabase se
   o clique chegou no formato esperado (ver item 6 acima)
