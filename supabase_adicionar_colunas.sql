-- Execute isso no SQL Editor do Supabase
-- Adiciona colunas necessárias para chave de acesso

alter table clients add column if not exists access_key text unique;
alter table clients add column if not exists auth_email text;
alter table clients add column if not exists auth_password text;
alter table birthday_configs add column if not exists image_url text;

-- Cria index para busca rápida por chave
create index if not exists clients_access_key_idx on clients(access_key);
