# Segurança — Padrão para TODOS os projetos do Leonardo (ZapFlow, ToqyApp, futuros)

> Criado 2026-07-16 a pedido explícito: "entenda isso, planeje isso melhor,
> anote isso no megabrain para usar em todos meus projetos, sem exceção."
> Este documento existe em duas formas: aqui (repo do ToqyApp) e salvo na
> memória entre sessões do Claude — qualquer sessão futura, em qualquer
> projeto, deve consultar isso antes de tratar segurança como opcional.
>
> Cada item abaixo tem: o que significa (linguagem simples) → o que a
> auditoria REAL encontrou no ZapFlow e no ToqyApp (não teoria — código lido
> de verdade) → o que fazer.
>
> **Atualizado 2026-07-16 (mesmo dia)**: o Leonardo apontou que
> `core/templates/qa-prompts/` (raiz do Mega Brain) já tinha prompts prontos
> de QA — `seguranca-web-owasp.md` e `legal-lgpd-privacidade.md` — que a
> primeira auditoria não usou como checklist. Rechecagem contra esses dois
> templates específicos encontrou: (1) uma correção real — eu tinha
> recomendado "adotar Sentry" e ele **já está integrado e configurado**
> (`sentry.client/server/edge.config.ts`, DSN real, `@sentry/nextjs`) — erro
> meu, não uma recomendação válida; (2) headers de segurança (CSP, HSTS,
> X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
> Permissions-Policy) **já configurados corretamente** em `next.config.ts`,
> item que a primeira auditoria nem tinha checado; (3) um gap novo real: sem
> banner de consentimento de cookies (LGPD) apesar de já existir tracking de
> analytics próprio.

## Legenda

✅ Já está correto · ⚠️ Parcialmente feito, precisa reforço · ❌ Gap real, não existe hoje

---

## 1. Identidade e Acesso (quem é você, o que você pode fazer)

### Autenticação (provar quem você é) — JWT, sessões, cookies
**O que é**: depois do login, o sistema te dá um token (JWT) que prova quem
você é em cada requisição seguinte, sem pedir senha de novo toda hora. A
pergunta de segurança real é **onde esse token fica guardado no navegador**.

**Achado real — ❌ gap real nos dois projetos**: tanto ZapFlow
(`src/lib/supabase.js:6`) quanto ToqyApp (`src/lib/supabaseClient.ts:10-16`)
usam a configuração padrão do Supabase, que guarda o token de sessão no
**`localStorage`** do navegador. `localStorage` é legível por **qualquer
script JavaScript rodando na página** — se algum dia existir uma
vulnerabilidade de XSS (mesmo pequena, tipo um campo que renderiza HTML sem
escapar), o atacante rouba a sessão de qualquer usuário logado, sem precisar
de senha nenhuma. É exatamente o motivo de "o localStorage não pode conter
tokens de autenticação" que você mencionou.

**O que fazer**: migrar sessão pra **cookie httpOnly + Secure** (o cookie que
você pediu) — o navegador guarda o token, mas o JavaScript da própria página
NÃO consegue ler (só o servidor lê). No Next.js (ToqyApp), isso é o pacote
oficial `@supabase/ssr` (substitui o cliente atual, guarda sessão em cookie
gerenciado pelo servidor). No ZapFlow (Vite/SPA puro, sem servidor Next.js
por trás), é mais difícil fazer 100% httpOnly porque é só frontend estático —
a mitigação real lá é: **CSP forte** (Content-Security-Policy) pra reduzir a
superfície de XSS a quase zero, já que não dá pra tirar o token do
JavaScript sem um backend intermediário.

### Autorização (o que você pode acessar) — roles e permissões
**O que é**: depois de saber QUEM você é, o sistema decide O QUE você pode
ver/mudar. No Supabase isso é RLS (Row Level Security) — regra no banco, não
só no código.

**Achado real — ✅ já está bem feito**: RLS aplicado consistentemente nos
dois projetos (`profiles`, `client_numbers`, `toqy_qr_codes`,
`toqy_referrals` etc. — todas as tabelas criadas nesta sessão já nasceram
com RLS). Este é o item que sua base já faz certo, sem exceção encontrada.

### OAuth 2.0 / SSO (login com Google/GitHub) e MFA
**O que é**: deixar o usuário logar com a conta Google/GitHub que ele já
tem (mais seguro que senha nova pra cada site) e exigir um segundo fator
(código no celular) além da senha.

**Achado real — ❌ não implementado em nenhum dos dois** (login é só
email+senha). Supabase Auth já suporta os dois nativamente (OAuth Google/
GitHub é literalmente um toggle no painel do Supabase, MFA também já existe
pronto) — não precisa trocar de provedor de auth pra ter isso, só ativar.

---

## 2. Manter Dados Ilegíveis (mesmo se alguém roubar o banco)

### Hash de senha (bcrypt, nunca MD5, nunca texto puro)
**Achado real — ✅ já está correto**: senha nunca passa pelo seu código —
Supabase Auth já faz o hash (bcrypt) internamente antes de gravar. Você
nunca vê nem armazena a senha em nenhum dos dois projetos.

### Criptografia em repouso (dados no banco protegidos mesmo se roubados)
**Achado real — ✅ coberto pela infraestrutura**: Supabase roda em cima de
infraestrutura (AWS) com criptografia em repouso por padrão — não é algo
que você precisa configurar linha de código nenhuma, já vem assim.

### Criptografia em trânsito (HTTPS/TLS em todo lugar)
**Achado real — ✅ coberto pela infraestrutura**: Vercel força HTTPS
automaticamente (ToqyApp), Supabase só aceita conexão TLS. Não achei nenhum
`http://` (sem "s") sendo usado pra chamada real de API em nenhum dos dois.

### Mascaramento de dados (nunca logar senha, token, cartão)
**Achado real — ⚠️ parcial**: não achei nenhum log explícito de senha/token
(bom sinal), mas também não existe uma DISCIPLINA formal de log — é mais
"por acaso não vazou" do que "impossível vazar". Ver item 6 (logging).

---

## 3. Nunca Confiar no Input do Usuário

### Validação e sanitização (tipo, tamanho, formato antes de processar)
**Achado real — ⚠️ parcial**: existe validação pontual (ex: `pixBrCode.ts`
sanitiza nome/cidade antes de montar o BR Code), mas não é sistemática em
toda rota que recebe dado de usuário.

### Prevenção de SQL Injection (queries parametrizadas, nunca string bruta)
**Achado real — ✅ já está correto nos dois projetos**: 100% das consultas
usam o query builder do Supabase (`.from().select().eq(...)`), que já
parametriza tudo por baixo — nenhuma string SQL montada na mão foi
encontrada em nenhum arquivo lido nesta sessão inteira.

### Prevenção de XSS (escapar output, nunca renderizar HTML do usuário)
**Achado real — ✅ geralmente ok** (React/Next escapam texto por padrão,
não há uso de `dangerouslySetInnerHTML` com dado de usuário identificado),
**mas ⚠️ ponto de atenção real**: o upload de logo (gerador de arte de
plaquinha, `plaque-designs/generate/route.ts:61`) aceita `image/\w+` — isso
inclui `image/svg+xml`. **SVG pode conter `<script>` embutido** — é um
vetor de XSS real se esse arquivo for servido/exibido depois sem sanitizar.
Recomendo: bloquear explicitamente `svg` desse upload específico (só
aceitar png/jpeg/webp).

### Validação de upload (tipo e tamanho, nunca confiar na extensão)
**Achado real — ⚠️ parcial**: `imageStorage.ts` tem limite de 8MB no bucket
(bom, é enforced pelo Storage, não só no frontend) e checa o `Content-Type`
declarado — mas não abre o arquivo pra confirmar que os bytes batem com o
tipo declarado (alguém pode renomear um arquivo malicioso pra `.png` e o
`Content-Type` do browser pode mentir). Nível de risco baixo aqui porque
quem recebe o arquivo é sempre um provedor de IA (processa como imagem ou
falha), não um servidor que executa o conteúdo — mas vale registrar.

---

## 4. Proteger os Endpoints

### Rate limiting (impedir um usuário de derrubar a API)
**Achado real — ❌ gap real, não existe em NENHUM lugar dos dois projetos.**
Endpoints públicos e sem limite algum: `api/kiwify/webhook`,
`api/analytics/track` (qualquer um pode inserir milhões de eventos falsos),
`api/sites/[slug]/verify-key` (**este é sério — é literalmente uma checagem
de senha/chave de acesso, e sem rate limit dá pra tentar força bruta sem
limite nenhum**), e no ZapFlow: `zapi-webhook`, `mp-webhook`.
**Prioridade alta**: `verify-key` primeiro (é o mais parecido com um login
sem proteção nenhuma), depois os webhooks públicos.

### Configuração de CORS (nunca `*` em produção)
**Achado real — ❌ gap real no ZapFlow** (ToqyApp não tem esse problema —
Next.js API routes são same-origin por padrão, sem CORS explícito). No
ZapFlow, 5 Edge Functions usam `"Access-Control-Allow-Origin": "*"`:
`client-login`, `client-provision`, `mp-create-preapproval` (**cria
cobrança de pagamento** — origem devia ser restrita), `send-message`
(**manda mensagem de WhatsApp de verdade**), `zapi-status`. Como todas
exigem JWT válido, o risco prático é menor do que pareceria (um site
malicioso não consegue forjar seu JWT), mas é uma camada de defesa a menos
— deveria ser o domínio real de produção, não `*`.

### Versionamento de API (não quebrar cliente antigo)
**Achado real — não avaliado a fundo, mas** nenhum dos dois projetos expõe
API pública versionada pra terceiros hoje (são só o próprio frontend
consumindo) — baixa prioridade até existir integração externa de verdade.

### Esconder erros internos (nunca mandar stack trace pro cliente)
**Achado real — ❌ gap real no ToqyApp**, pelo menos 10 rotas devolvem
`error.message` direto pro cliente (`api/biosite/save`, `api/biosites`,
`api/plaque-designs/generate`, `api/qr-codes`, `api/upload-image`, entre
outras). Não é stack trace completo, mas mensagem de erro do Postgres pode
revelar nome de tabela/coluna/constraint — informação que ajuda um
atacante a entender sua estrutura de banco. **Fix simples e de baixo
risco**: logar o erro real no servidor (`console.error`), devolver uma
mensagem genérica pro cliente.

---

## 5. Proteger o Ambiente

### Gerenciamento de secrets (.env, nunca hardcode)
**Achado real — ✅ correto nos dois**: `.gitignore` exclui `.env*` nos dois
repos, confirmado que nunca foi commitado historicamente (`git log --all --
.env` vazio nos dois), e busca ampla por chave hardcoded (`sk-...`, service
role embutido) não achou nada fora de arquivo `.env`.

### Variáveis NEXT_PUBLIC_/VITE_ nunca em chave secreta
**Achado real — ✅ correto nos dois**: só URL pública e anon key (que É
pra ser pública, é assim que o Supabase funciona) têm o prefixo; service
role key e chave da OpenAI ficam sem prefixo, só acessíveis no servidor.

### Vulnerabilidade de dependências (pacote desatualizado é porta aberta)
**Achado real — números reais, não estimativa**:
- ToqyApp: `npm audit` → 2 moderadas, 0 alta/crítica
- ZapFlow: `npm audit` → **2 altas**, 1 moderada, 0 crítica — as duas altas
  são `vite` e `xlsx`; `xlsx` **não tem correção disponível do fornecedor**
  pra essa vulnerabilidade (ReDoS/prototype pollution conhecidos) — ou
  aceita o risco monitorado (é usado só na exportação de relatórios, não
  em caminho crítico), ou substitui a lib.

### Proteção contra DDoS / Firewall e whitelist de IP
**Achado real — ❌ não existe hoje em nenhum dos dois** — nem Cloudflare
na frente, nem whitelist de IP no banco. Hoje quem protege é só o rate
limit da própria Vercel/Supabase (genérico, não configurado por você).

---

## 6. Saber Quando Der Errado

### Logging estruturado, alertas, trilha de auditoria
**Achado real — ❌ gap real nos dois** — logging hoje é `console.error`
solto (vai pro log da Vercel/Supabase, mas ninguém é avisado ativamente, e
não tem busca/estrutura). Não existe alerta de atividade suspeita, nem
trilha de auditoria formal (quem fez o quê, quando) além do que a própria
tabela de negócio já registra incidentalmente (ex: `created_at`).

---

## Stack recomendado (avaliando o que você listou, com critério — não é "usa tudo")

| Categoria | Já usa | Recomendação | Por quê |
|---|---|---|---|
| Banco + Auth | Supabase | **Manter** | Já é usado por empresas grandes de verdade, tem RLS real, MFA/OAuth prontos (só ativar), criptografia em repouso/trânsito por padrão. Trocar pra Clerk (auth) seria migração grande pra ganho pequeno — o problema não é o Supabase, é como está configurado (localStorage em vez de cookie) |
| Hosting | Vercel | **Manter** | HTTPS automático, já integrado, padrão de mercado |
| Domínio | Namecheap | **Manter registro, adicionar Cloudflare na frente** | Não precisa trocar de registrador — Cloudflare como proxy/DNS resolve DDoS + WAF + esconder IP de origem, é a peça que falta, não substitui o Namecheap |
| Pagamento (planos normais) | Kiwify | **Manter pro Essencial/Freelancer** | Já integrado, resolve Pix/boleto bem, não há problema de segurança encontrado nele em si |
| Pagamento (revenue-share Agência) | — | **Avaliar Stripe Connect OU Pagar.me/Asaas "split de pagamento"** | Isso é o que resolve a Fase 2 do roadmap (comissão 70/30 automática) — Kiwify não tem split dinâmico por transação de forma nativa. Stripe Connect é o padrão internacional pra isso, mas tem mais atrito com Pix/CPF no Brasil; Pagar.me/Asaas têm split feito pro mercado brasileiro especificamente — decisão pra aprofundar quando a Fase 2 for planejada de verdade, não decidir às pressas aqui |
| Erro/monitoramento | **Sentry (ToqyApp)** — já integrado (`sentry.client/server/edge.config.ts`, `@sentry/nextjs`, DSN real configurado) | **Manter, e confirmar que ZapFlow também tem** — correção: eu tinha recomendado "adotar" sem checar, já existe no ToqyApp. Verificar se está capturando erro server-side (API routes) e não só client-side, e replicar no ZapFlow se não tiver |
| Rate limiting | — | **Adotar Upstash Ratelimit** | Serverless-native, funciona direto na Vercel/Edge Function, resolve o gap mais sério encontrado (`verify-key` sem proteção) |
| Email transacional | — | **Adotar Resend, se ainda não usa algo assim** | Supabase manda email básico, mas com limite de taxa baixo e pouco controle de entregabilidade — Resend é o padrão atual pra isso |
| Analytics de produto | — | **PostHog é opcional** | Não é segurança, é produto — útil, mas menor prioridade que o resto desta lista |
| Vetor/embeddings (Pinecone) | — | **Não precisa agora** | Não existe hoje nenhuma feature de busca semântica/agente de IA com memória no Toqy ou ZapFlow — reavaliar só se um dia construir algo assim |
| Hotmart | — | **Não é a peça certa aqui** | É mais uma plataforma de infoproduto/curso com afiliado embutido — se um dia o ebook/curso da Fase 9 (Conteúdo) for vendido separadamente, pode fazer sentido só pra ISSO, não como parte do core do SaaS |
| GitHub | Já usa | **Ativar Dependabot + secret scanning** (config, não troca de ferramenta) | Resolve "vulnerabilidade de dependência" automaticamente, é grátis, só precisa ligar nas configurações do repo |

## Headers de segurança (checado 2026-07-16, via template `seguranca-web-owasp.md`)

**Achado real — ✅ ToqyApp já está muito bem feito** (`next.config.ts:34-46`):
CSP configurada (`frame-ancestors 'none'`, `object-src 'none'`, restringe
`connect-src` só pro Supabase/Sentry), `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
(bloqueia câmera/microfone/geolocalização por padrão), HSTS com preload.
Isso é melhor do que a maioria dos SaaS reais tem — nenhuma ação necessária.
**Não verificado ainda no ZapFlow** (é Vite/SPA + Vercel, headers
precisariam estar em `vercel.json`, não em `next.config` — checar depois).

## CSRF (checado 2026-07-16)

**Achado real — não é risco ativo hoje**: como a autenticação das APIs usa
Bearer token no header `Authorization` (não cookie automático), CSRF
clássico não se aplica do jeito tradicional — o navegador não anexa esse
header sozinho em requisição cross-site. **Mas isso muda se a recomendação
do item 1 (sessão em cookie httpOnly) for implementada** — cookie SIM é
anexado automaticamente pelo navegador em request cross-site, então virar
cookie sem adicionar proteção CSRF (`SameSite=Strict`/`Lax` no cookie, ou
token CSRF em formulário) recriaria um problema novo pra resolver outro.
**Registrar como parte do MESMO trabalho, não depois.**

## LGPD (checado 2026-07-16, via template `legal-lgpd-privacidade.md`)

**Achado real — ⚠️ parcial**: `/privacidade` (131 linhas) e `/cookies` (59
linhas) existem com conteúdo real, não são páginas vazias — isso é bom.
**Gap real**: não existe nenhum banner de consentimento de cookies
interativo (só as páginas estáticas descrevendo a política) — como o
ToqyApp agora tem analytics próprio (`toqy_analytics_events`, construído
nesta mesma sessão), formalmente isso pede um aviso/consentimento na
primeira visita, mesmo sendo analytics próprio (não é rastreamento de
terceiro/ads, o que reduz a gravidade, mas não zera a pendência).

## Prioridade de execução sugerida (por impacto real, não por ordem da lista)

1. **`verify-key` sem rate limit** — é o gap mais parecido com "porta sem tranca" dos achados todos
2. **Token em localStorage → cookie httpOnly + proteção CSRF junto** (ver seção CSRF acima — são a mesma mudança, não duas separadas)
3. **Esconder erro real do Postgres nas respostas de API**
4. **CORS `*` no ZapFlow → domínio real**
5. **Upload: bloquear SVG no upload de logo**
6. **Banner de consentimento de cookies (LGPD)**
7. Resto (Cloudflare, OAuth/MFA, dependências, logging estruturado) — conforme prioridade de negócio

---
*Auditoria real feita 2026-07-16, código lido diretamente (não teoria) nos
dois repositórios. Válido até o próximo pente-fino — código muda, isto aqui
não é permanente, é um retrato do dia.*
