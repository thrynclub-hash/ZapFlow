-- Bug real (2026-11-09): Stock/Dashboard/Pdv ganharam "Peça" hardcoded
-- (sessao paralela, pensando so em loja de roupa) -- quebra pra qualquer
-- outro nicho (Sodie e doceria: bolo, doce, nao "peca"). Nome do item
-- vira configuravel por cliente, default generico "Produto".
alter table clients add column if not exists item_noun text not null default 'Produto';
