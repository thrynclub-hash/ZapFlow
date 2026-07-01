-- =============================================
-- ZapFlow — Corrige delete de imagem em Criativos (2026-07-01)
--
-- Achado real: supabase_schema.sql só criava policies de SELECT e INSERT
-- pro bucket "creatives" — nunca existiu policy de DELETE (nem UPDATE).
-- Por isso o botão de excluir em Criativos.jsx "funcionava" na tela (o
-- estado local sumia) mas a chamada real de storage.remove() era barrada
-- pelo RLS silenciosamente — e a imagem reaparecia ao dar F5, porque
-- nunca saiu do bucket de verdade.
-- =============================================

drop policy if exists "Authenticated delete creatives" on storage.objects;
create policy "Authenticated delete creatives"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'creatives');

drop policy if exists "Authenticated update creatives" on storage.objects;
create policy "Authenticated update creatives"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'creatives');

-- Nota de segurança (não corrigido agora, registrado pra decisão futura):
-- essas policies liberam qualquer usuário autenticado do sistema (de
-- QUALQUER empresa cliente) a apagar/sobrescrever arquivo de QUALQUER
-- outra empresa dentro do bucket "creatives" — porque a policy só olha
-- bucket_id, não o client_id dentro do caminho (biblioteca/{client_id}/...).
-- Hoje só existe 1 cliente real (Hassum) rodando, então o risco prático é
-- baixo, mas ao ter mais clientes ativos ao mesmo tempo isso deveria virar
-- algo como: using (bucket_id = 'creatives' and (storage.foldername(name))[2] = my_client_id()::text)
