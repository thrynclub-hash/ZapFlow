-- Etiqueta de produto com codigo de barras (2026-11-09) -- print_jobs ja
-- existia pra comanda/recibo (kind='receipt'); agora tambem serve pra
-- etiqueta de prateleira/despacho (kind='label'), com um campo opcional
-- de codigo pra impressora renderizar como barras, nao so texto.
alter table print_jobs add column if not exists barcode text;
