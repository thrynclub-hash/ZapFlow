# Changelog — Sessão real de Auth para clientes (2026-07-01)

## Por que isso foi necessário

O login por chave de acesso (`loginWithKey`) nunca criava uma sessão real do Supabase Auth — só guardava dados no `localStorage`. Só que quase toda regra de segurança (RLS) do banco depende de `auth.uid()` (via a função `my_client_id()`). Sem sessão real, o Supabase tratava o "cliente logado" como anônimo, e isso quebrava silenciosamente:

- `client_numbers` aparecia vazio em Disparos/Configurações (mesmo com números cadastrados)
- Adicionar contato manualmente falhava
- Automações (feature nova) também estariam bloqueadas do mesmo jeito

Além disso, achamos uma policy aberta em `contacts` (`"Make read contacts"`, `using (true)`) expondo nome/telefone/data de nascimento de todos os contatos de todos os clientes pra qualquer requisição anônima.

## O que mudou

- **`supabase_client_real_auth.sql`** — remove a policy aberta de `contacts`, prepara `client_auth_secrets`
- **`supabase/functions/client-provision`** — cria um usuário oculto no Supabase Auth por cliente (e-mail sintético, senha aleatória), vincula via `profiles`, guarda a credencial (só admin pode chamar)
- **`supabase/functions/client-login`** — troca a chave de acesso por essa credencial (público, sem JWT — é o próprio login)
- **`AuthContext.jsx`** — reescrito para usar sessão real do Supabase Auth tanto pra admin quanto pra cliente (antes eram dois sistemas paralelos)
- **`AdminClients.jsx`** — botão de chave (🔑) por cliente pra provisionar/reprovisionar login; clientes novos são provisionados automaticamente ao criar

## Passos manuais obrigatórios (nesta ordem)

1. Rodar `supabase_client_real_auth.sql` no SQL Editor
2. Deploy das functions:
   ```bash
   npx supabase functions deploy client-provision
   npx supabase functions deploy client-login --no-verify-jwt
   ```
3. Merge deste PR (atualiza o frontend)
4. No painel Admin → Clientes, clicar no ícone de chave 🔑 de **cada cliente existente** (Clínica Hassum, Sodie Indaiatuba) pra provisionar o login real deles — clientes criados depois disso já são provisionados automaticamente
5. Testar login de novo com a chave de acesso da Dra. Hassum — deve continuar entrando normal, mas agora `client_numbers`/`contacts` devem aparecer de verdade

## O que NÃO mudou

- A chave de acesso continua sendo a mesma (`access_key`) — o cliente não percebe nenhuma diferença de uso
- O login de admin (e-mail + senha) não muda
