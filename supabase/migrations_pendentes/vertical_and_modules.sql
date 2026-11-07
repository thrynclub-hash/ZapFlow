-- Base pra ZapFlow virar plataforma configurável por vertical (CRM+ERP),
-- não só CRM de mensagem. Aditivo — Hassum/Sodie ficam com vertical='crm'
-- e modules='{}' (comportamento idêntico ao de hoje).
alter table clients add column if not exists vertical text not null default 'crm';
alter table clients add column if not exists modules jsonb not null default '{}'::jsonb;
-- modules exemplo: {"estoque": true, "agenda": true, "ifood": false, "ia_agent": true}
