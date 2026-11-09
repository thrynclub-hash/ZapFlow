-- print_jobs so tinha policy de admin -- cliente nao conseguia criar
-- etiqueta/comanda direto da tela de Estoque. Client-facing porque e
-- so "manda imprimir isso", sem credencial nenhuma na tabela (ao
-- contrario de marketplace_channels).
drop policy if exists "Client insert own print_jobs" on print_jobs;
create policy "Client insert own print_jobs" on print_jobs for insert
  with check (client_id = my_client_id());
drop policy if exists "Client select own print_jobs" on print_jobs;
create policy "Client select own print_jobs" on print_jobs for select
  using (client_id = my_client_id());
