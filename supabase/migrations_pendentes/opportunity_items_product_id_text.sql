-- Bug real (2026-11-09): opportunity_items.product_id era uuid com FK pra
-- products(id) (catalogo LOCAL, erp_core.sql) -- mas a Lisa La Belle usa
-- Bling como catalogo real, cujo id de produto e numerico, nao uuid.
-- O seletor de produto em Negocios so conseguia listar os poucos itens
-- que sobraram na tabela local (de um import antigo), nunca o catalogo
-- Bling de verdade. Vira text sem FK -- product_id passa a guardar o id
-- de onde quer que o produto venha (uuid local OU id numerico do Bling),
-- so pra referencia; description/qty/unit_price continuam sendo os
-- campos de registro de verdade, nao dependem do FK pra nada.
alter table opportunity_items drop constraint if exists opportunity_items_product_id_fkey;
alter table opportunity_items alter column product_id type text using product_id::text;
