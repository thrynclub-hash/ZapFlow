-- Variação de grade (cor/tamanho) hoje é um texto só em product_variants.name
-- ("Cinza Lisa 46 O G"), confuso de ler e sem foto própria. Separa em campos.
alter table product_variants add column if not exists color text;
alter table product_variants add column if not exists size text;
alter table product_variants add column if not exists image_url text;
