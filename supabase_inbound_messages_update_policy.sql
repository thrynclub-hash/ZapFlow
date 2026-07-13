-- =============================================
-- ZapFlow — Permite cliente atualizar status de inbound_messages (2026-07-13)
--
-- Bug real reportado pelo Leonardo: clicar "Marcar resolvido"/"Ignorar" na
-- tela Conversas não fazia nada — a policy de RLS "Inbound messages own"
-- só cobria leitura (polcmd='r'), então o UPDATE de status era
-- silenciosamente bloqueado (Supabase não gera erro visível quando RLS
-- filtra a linha do UPDATE, só afeta 0 linhas). Só is_admin() conseguia
-- escrever. Mesmo padrão que já existe em campaigns ("Campaigns own",
-- polcmd='*') — aqui só liberando UPDATE mesmo (insert/delete continuam
-- só via service_role do zapi-webhook, não precisam vir do cliente).
-- =============================================

create policy "Inbound messages own update" on inbound_messages
for update
using (client_id = my_client_id())
with check (client_id = my_client_id());
