# Changelog — Correções de billing, agendamento e anti-bloqueio (2026-07-03)

> Gerado via Mega Brain (Cowork) em 2026-07-03, a partir de pedidos diretos do Leonardo

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

## Passos manuais necessários (nenhum aplicado automaticamente)

1. Rodar `supabase_campaign_stop_date.sql` no SQL Editor do projeto (`bhiggyigsrqfabqhutne`)
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
