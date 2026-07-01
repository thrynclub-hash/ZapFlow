# Automações e limite diário — 2026-07-01

## O que foi resolvido

### 1. Bug real: campanhas agendadas/diárias nunca rodavam
`processScheduledCampaigns` filtrava `status in ('sending','draft')`, mas o
frontend grava `status='scheduled'` ao agendar. Resultado: nenhuma campanha
agendada ou "por dia" criada pela UI era processada — mesmo com o motor
(`run-automations`) rodando a cada 5 min. Corrigido incluindo `'scheduled'`
no filtro.

### 2. Limite diário de 100 mensagens/dia por número — GLOBAL de verdade
Antes, `daily_limit` era "por campanha" (e o disparo "agora" nem checava
limite nenhum — ia tudo de uma vez, direto do navegador). Agora existe um
único contador por número+dia (`daily_send_counters` +
`try_consume_daily_send_budget()`), e **todo** caminho de envio passa por
ele antes de mandar qualquer mensagem: disparo manual "agora", campanha
agendada/diária, aniversários, automações e as respostas automáticas do
webhook. Se duas campanhas do mesmo número tentam mandar no mesmo dia, elas
dividem o mesmo teto de 100 — nunca somam mais que isso.

Efeito colateral bom: isso também fechou o item 3 do
`SECURITY-FINDINGS-2026-07-01.md` (token da Z-API exposto no navegador) —
`NewCampaign.jsx` e `Birthdays.jsx` não leem mais `zapi_token`/`zapi_instance_id`
do cliente; quem manda a mensagem agora é sempre a Edge Function
`send-message`, no servidor.

### 3. Import de contatos: dedup, mapeamento de coluna e data de importação
`Contacts.jsx` já fazia upsert por `client_id+phone` (dedup correto), mas:
- Cabeçalhos de coluna eram comparados por uma lista fixa de nomes exatos —
  agora normaliza (minúsculo, sem acento) e casa por alias, aceitando
  praticamente qualquer nome de coluna razoável de nome/telefone/nascimento.
- Data de nascimento em formato BR (`DD/MM/AAAA`) ou serial do Excel agora é
  convertida corretamente para `date` do Postgres — antes ia direto sem
  parse e provavelmente falhava silenciosamente em boa parte das linhas.
- Nova coluna `imported_at`: toda linha importada (nova ou atualizada) grava
  a data desta importação, sem mexer em `created_at`.
- Cliente com mais de um número/loja agora escolhe pra qual loja a
  importação vai, em vez de cair sempre no primeiro número cadastrado.

### 4. Resposta "EU QUERO" → pergunta turno → confirma → notifica interno
Novo webhook `zapi-webhook` (payload real conferido em
developer.z-api.io/webhooks/on-message-received) processa toda mensagem
recebida:
- Loga em `inbound_messages` (isso também destrava a condição `has_replied`
  nas automações, que antes sempre retornava `false`).
- Se o texto contém a palavra-chave configurada (`reply_flows.trigger_keyword`,
  default "eu quero"), pergunta manhã/tarde.
- Se a resposta seguinte contém "manh" ou "tard", confirma com o paciente e
  notifica `reply_flows.notify_phone` (WhatsApp interno — Paulo, no caso da
  Clínica Hassum) com nome, telefone e turno.
- Cada resposta automática também consome o mesmo orçamento diário de 100.

### 5. Follow-ups reais (campanha tipo `followup`)
Antes, o "follow-up por tipo no nome da campanha" citado na UI do
`NewCampaign.jsx` não tinha NENHUMA implementação por trás — promessa vazia
(mesmo padrão do item 6 do `SECURITY-FINDINGS`). Agora existe de verdade:
campanha com `type='followup'` e `follow_up_of=<campanha base>` dispara
automaticamente `follow_up_delay_days` (padrão 2) dias depois, só para quem
recebeu a campanha base e não mandou nenhuma mensagem desde então.

## Configurado para a Clínica Hassum (`supabase_seed_hassum.sql`)

4 campanhas semanais + 4 follow-ups + fluxo "EU QUERO", nas datas:
- Semana 1 (Limpeza): 02/07/2026
- Semana 2 (Clareamento): 09/07/2026
- Semana 3 (Harmonização): 16/07/2026
- Semana 4 (Implante): 23/07/2026

## Limitação real, sem maquiagem

1190 contatos ÷ 100 mensagens/dia = ~12 dias para UMA campanha alcançar todo
mundo. Com uma campanha nova entrando a cada 7 dias, o motor prioriza
follow-ups e a campanha mais antiga primeiro, mas na prática o rodízio das 4
campanhas vai demorar mais que 4 semanas para cobrir a base toda — é o preço
de nunca ultrapassar o limite seguro de envio. Isso é intencional (evitar
bloqueio do WhatsApp), não um bug.

## Pendências que só o Leonardo resolve

1. **Fotos**: fazer upload das 5 fotos da Dra. Thaís no bucket `creatives`,
   pasta `hassum/`, com estes nomes exatos (senão as imagens das campanhas
   ficam quebradas):
   - `foto2-blazer-mao-queixo.jpg`
   - `foto3-blazer-cruzado.jpg`
   - `foto4-fundo-branco-apontando.jpg`
   - `foto5-blusa-creme-cruzado.jpg`
2. **WhatsApp do Paulo**: rodar o `UPDATE` no final de
   `supabase_seed_hassum.sql` com o número real — sem isso, o paciente ainda
   recebe as respostas normalmente, só a notificação interna não sai.
3. **Webhook na Z-API**: configurar, no painel da Z-API (instância da
   Hassum), o webhook "ao receber" apontando para a Edge Function
   `zapi-webhook` (URL exata nas instruções de deploy).
4. **Z-API reconectado**: segue pendente por conta própria (número não pago
   ainda) — nada aqui muda isso, mas sem reconectar nada é enviado de
   verdade.
