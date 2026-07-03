# Relatório de QA — ZapFlow (2026-07-03)

> Gerado a partir dos templates em `core/templates/qa-prompts/` (mega-brain).
> Escopo: mobile/responsividade, performance, segurança, LGPD. Auditoria +
> correção direta no código, sem mudar nenhuma funcionalidade existente.
> Os dois templates de teste com usuário/BDD (`testes-funcionais-fluxos.md`,
> `teste-usabilidade-usuario.md`) não foram aplicados nesta rodada — são
> planos de teste com humanos reais, não algo que se corrige no código; me
> avise se quiser que eu gere esses roteiros também.

## 1. Responsividade / Mobile — ✅ corrigido

**Achado:** a barra lateral (`Sidebar.jsx`) era sempre visível com largura
fixa (`w-56` = 224px), em QUALQUER tamanho de tela — num celular de 375px de
largura, ela sozinha ocupava ~60% da tela. Não existia menu hambúrguer nem
qualquer colapso em mobile.

**Corrigido:**
- Sidebar virou um "drawer" (menu deslizante) abaixo do breakpoint `md`
  (768px) — escondida por padrão, abre com um botão hambúrguer numa barra
  superior nova, fecha ao tocar fora ou num item do menu. Em telas ≥768px
  continua exatamente como antes (sempre visível, sem essa barra).
- Padding do conteúdo principal reduzido em telas pequenas (`p-4` →
  `sm:p-6` → `md:p-8`, antes era sempre `p-8`).
- 6 tabelas (`Contacts.jsx`, `Dashboard.jsx`, `Reports.jsx` ×2,
  `AdminClients.jsx`, `AdminDashboard.jsx`) não tinham `overflow-x-auto` —
  numa tela estreita, ficavam espremidas ou geravam scroll horizontal na
  página inteira. Agora cada tabela rola só ela mesma, dentro do próprio
  container.
- Viewport meta tag já estava correta (`width=device-width,
  initial-scale=1.0`) — nenhuma mudança necessária aí.

**Não testado ao vivo:** as telas autenticadas (Dashboard, Contatos,
Campanhas) não puderam ser verificadas visualmente nesta sessão — não há
credenciais reais do Supabase disponíveis aqui pra fazer login de verdade.
Testei o quanto deu (Landing e Login, em viewport de 375px, sem erro de
console) e revisei o código, mas vale um teste manual num celular real
assim que possível.

## 2. Performance — ✅ corrigido

**Achado:** todo `npm run build` desta sessão veio com o aviso "chunks
maiores que 500kB" — o app inteiro (todas as páginas, cliente e admin)
virava um único bundle de ~1.4MB, baixado de uma vez na primeira visita,
mesmo que a pessoa só fosse usar uma tela.

**Corrigido:** code splitting por rota (`React.lazy` + `Suspense` em
`App.jsx`). Resultado real do build:
- Bundle principal: 1.4MB → ~400KB
- `xlsx` (biblioteca de planilha, usada só em Contatos): agora um chunk
  separado de 424KB, baixado só quando a página de Contatos é visitada
- `Reports.jsx` (gráficos/Recharts): chunk próprio de 382KB, só na tela de
  Relatórios
- Todas as outras páginas: chunks de 2-30KB cada

Aviso de "chunk grande" sumiu completamente do build. Sem mudança de
comportamento visível pro usuário (só carrega mais rápido).

## 3. Segurança — ✅ 2 correções reais + 1 opcional

### 3.1. Exposição de credencial real (achado mais sério desta rodada)

`Settings.jsx` (tela do cliente) e `AdminNumbers.jsx` (tela do admin)
chamavam a Z-API **direto do navegador**, usando `zapi_token` (a senha de
acesso à Z-API daquele número) buscado do banco pro front-end. Isso
significava: qualquer pessoa logada como cliente conseguia abrir o
DevTools do navegador, pegar o próprio `zapi_token` real, e mandar mensagem
direto pela Z-API — por fora do limite diário de 100/dia, da variação de
mensagem, do opt-out, e sem nenhum registro em `message_logs`. Ou seja,
tudo que construímos nesta sessão pra não bloquear o número dava pra
contornar completamente.

**Corrigido:** nova Edge Function `zapi-status` — o navegador manda só o
`number_id`, o servidor busca o token (respeitando RLS: cliente só vê os
próprios números) e chama a Z-API por trás. O token nunca mais sai do
servidor pra checagem de status. `AdminNumbers.jsx` continua trazendo o
token pro form de cadastro (isso é intencional — é a tela onde o admin
digita o token na criação/edição), só a chamada de teste de conexão que
mudou.

### 3.2. Webhooks públicos sem verificação de origem (opcional, desativado por padrão)

`zapi-webhook` e `mp-webhook` são públicos de propósito (quem chama é a
Z-API/Mercado Pago, não um usuário logado) — mas não validavam que quem
chamou é realmente a Z-API/Mercado Pago. Um invasor que descobrisse a URL
podia, em teoria, gastar o orçamento diário de envio do número mandando
"respostas automáticas" falsas, ou forçar opt-out de contatos reais.

**Corrigido (mas OFF por padrão):** as duas functions aceitam agora um
token secreto opcional via `?token=...` na URL — só passa a ser exigido se
você configurar a env var (`ZAPI_WEBHOOK_SECRET` / `MP_WEBHOOK_SECRET`) no
Supabase. **Sem configurar nada, o comportamento continua idêntico a hoje**
— não quebra nada que já está funcionando. Se quiser ativar essa proteção
mais pra frente (recomendado antes de escalar pra muitos clientes reais):
1. Gerar um valor aleatório longo (ex: `openssl rand -hex 24` ou qualquer
   gerador de senha)
2. Configurar `ZAPI_WEBHOOK_SECRET` (Supabase Dashboard → Edge Functions →
   zapi-webhook → Secrets) e `MP_WEBHOOK_SECRET` (idem, em mp-webhook)
3. Atualizar a URL cadastrada no painel da Z-API e do Mercado Pago pra
   incluir `?token=SEU_SEGREDO` no final

### 3.3. Cabeçalhos de segurança (headers)

`vercel.json` não tinha nenhum header de segurança. Adicionado: CSP,
`X-Frame-Options: DENY` (impede embutir o site num iframe de outro
domínio — clickjacking), `X-Content-Type-Options: nosniff`,
`Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`
(bloqueia câmera/microfone/localização, que o app não usa).

**⚠️ Vale conferir depois do próximo deploy:** CSP é uma configuração que
pode quebrar coisas se algo escapou da análise (ex: fonte não carregar,
chamada ao Supabase bloqueada). Depois de publicar, abra o site e o
DevTools → Console, veja se aparece algum erro tipo "Refused to ... because
it violates the following Content Security Policy directive" — se aparecer,
me manda a mensagem exata que eu ajusto o `vercel.json`.

### O que já estava correto (sem mudança)
- RLS habilitado em todas as tabelas, políticas por `client_id`
- Nenhuma credencial hardcoded no código (tudo via env vars)
- Nenhum uso de `dangerouslySetInnerHTML` ou `eval` encontrado
- Senhas de admin via Supabase Auth real (hash seguro, não é lógica própria)

## 4. LGPD / Privacidade — ⚠️ gap real, não corrigido (é decisão de negócio, não código)

**Achado:** não existe nenhuma página de política de privacidade, termos de
uso, ou aviso de cookies no ZapFlow. O sistema processa dados pessoais de
terceiros (nome, telefone, data de nascimento de pacientes/clientes finais
de cada cliente do ZapFlow, ex: pacientes da Dra. Thaís Hassum) — o ZapFlow
aqui atua como **operador** de dados (LGPD art. 5º, VII) por conta dos
clientes (controladores), o que traz obrigações específicas mesmo sem
relação direta com o titular dos dados.

**Checklist mínimo (OK / Ajustar):**

| Item | Status | Observação |
|---|---|---|
| Política de privacidade acessível | ❌ Ajustar | Não existe página nenhuma |
| Termos de uso | ❌ Ajustar | Não existe |
| Base legal para tratamento dos dados dos contatos (pacientes) | ⚠️ Depende do cliente | Cada cliente (dentista etc.) precisa ter coletado consentimento do próprio paciente pra receber WhatsApp — isso é responsabilidade de quem usa o ZapFlow, mas o contrato entre ZapFlow e o cliente deveria deixar isso explícito |
| Direito de exclusão de dados (contato) | ✅ OK | `Contacts.jsx` já tem exclusão real de contato |
| Direito de portabilidade | ❌ Ajustar | Não existe exportação de dados de um contato específico |
| Contrato de operador de dados (ZapFlow ↔ cliente) | ❌ Ajustar | Não existe termo formalizando essa relação |
| Registro de consentimento de opt-out | ✅ OK | Já implementado (tag "Descadastrado" + `status='Inativo'`, corrigido nesta sessão) |
| Retenção/exclusão de dados quando cliente cancela | ⚠️ Não verificado | Não há rotina de exclusão automática de dados após cancelamento de conta |

**Não implementei nada aqui porque:** política de privacidade e termos de
uso são texto jurídico — eu não tenho autoridade pra redigir isso como se
fosse aconselhamento legal definitivo. Recomendo gerar um rascunho com
ajuda de um advogado (ou peça pra mim gerar um rascunho inicial pra revisão
de advogado, deixando claro que não é validado juridicamente) antes de
publicar qualquer coisa como "política oficial".

## 5. Checklist de bolso (10 itens críticos antes de escalar pra mais clientes reais)

1. [x] Menu mobile funcional (corrigido)
2. [x] Tabelas não vazam da tela em mobile (corrigido)
3. [x] Bundle não carrega tudo de uma vez (corrigido)
4. [x] Token da Z-API nunca chega ao navegador do cliente (corrigido)
5. [ ] Testar visualmente em celular real (Dashboard, Contatos, Campanhas — autenticado)
6. [ ] Conferir CSP não quebrou nada após deploy (ver seção 3.3)
7. [ ] Decidir se ativa o token secreto nos webhooks (seção 3.2) antes de ter muitos clientes
8. [ ] Ter uma política de privacidade real (mesmo que simples) antes de processar dados de pacientes de terceiros em escala
9. [ ] Rodar `supabase_campaign_daily_window.sql` e os outros SQLs pendentes desta sessão (ver CHANGELOG)
10. [ ] Testar o fluxo real da campanha da Hassum (agendamento, janela de envio, botões) assim que o número Z-API estiver ativo
