-- =============================================
-- ZapFlow — Controle de vencimento de plano por cliente (2026-07-01)
--
-- Pergunta do Leonardo: "como eu vou ter controle de qual cliente ta em
-- qual plano, quando acaba? eu preciso ter controle disso"
--
-- Contexto importante: hoje o pagamento do PLANO em si (a mensalidade
-- base, diferente dos add-ons que já usam Mercado Pago) ainda é cobrado
-- fora do sistema (Pix manual, boleto, o que for combinado com cada
-- cliente) — não existe ainda um checkout recorrente pro plano principal.
-- Então isso aqui NÃO cobra automaticamente nem bloqueia o cliente
-- sozinho; é um painel de controle manual pra você (admin) saber, de
-- relance, quem está em dia e quem está vencendo/atrasado, e marcar
-- "renovado" quando o pagamento cair.
--
-- Colunas novas em "clients":
--   plan_next_charge_at   -> data em que o próximo pagamento é esperado
--                             (você define na mão ao cadastrar/editar o
--                             cliente, ou clica em "Renovar" pra avançar)
--   plan_billing_cycle_days -> de quantos em quantos dias cobra (default
--                             30 = mensal). Usado só pelo botão "Renovar"
--                             pra saber quanto avançar a próxima data.
--
-- Não inventamos status guardado no banco (ex: "em_dia"/"atrasado") de
-- propósito — isso é CALCULADO na hora, no frontend, a partir da data,
-- pra nunca ficar desatualizado/mentindo se alguém esquecer de rodar
-- algum job. O SQL só guarda o fato bruto (a data).
-- =============================================

alter table clients add column if not exists plan_next_charge_at timestamptz;
alter table clients add column if not exists plan_billing_cycle_days int not null default 30;

comment on column clients.plan_next_charge_at is 'Próxima data esperada de cobrança do plano principal (controle manual, não gera cobrança automática)';
comment on column clients.plan_billing_cycle_days is 'Ciclo de cobrança em dias (30 = mensal), usado pelo botão Renovar pra avançar a próxima data';
