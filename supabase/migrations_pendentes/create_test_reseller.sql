-- Cria conta de teste de revendedor (pilot), já marcada is_reseller=true
-- e com login real provisionado (mesma mecânica do client-provision).
-- Rode tudo de uma vez no SQL Editor do Supabase.

with new_client as (
  insert into clients (name, plan, segment, status, access_key, is_reseller)
  values ('Revendedor Teste', 'Starter', 'Serviços', 'active', 'test-zap-flow-reseller', true)
  returning id, name
),
pw as (
  -- senha sintética gerada uma vez só, reusada no auth.users e no
  -- client_auth_secrets (client-login devolve ela pro front logar) —
  -- se não baterem, signInWithPassword falha com credencial inválida.
  select new_client.id as client_id, new_client.name as client_name,
         (replace(gen_random_uuid()::text, '-', '') || 'Aa1!') as password
  from new_client
),
new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'client-' || pw.client_id || '@zapflow.internal',
    crypt(pw.password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', false,
    '', '', '', ''
  from pw
  returning id, email
),
ins_profile as (
  insert into profiles (id, client_id, role, full_name, email)
  select new_user.id, pw.client_id, 'client', pw.client_name, new_user.email
  from new_user, pw
  returning id
)
insert into client_auth_secrets (client_id, synthetic_email, synthetic_password, auth_user_id, updated_at)
select pw.client_id, new_user.email, pw.password, new_user.id, now()
from new_user, pw;

-- Mostra a chave de acesso pra você logar e testar em /login:
select id, name, access_key, is_reseller from clients where access_key = 'test-zap-flow-reseller';
