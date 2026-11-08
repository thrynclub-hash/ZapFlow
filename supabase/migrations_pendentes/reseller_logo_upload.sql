-- Logo do revendedor (white-label, 2026-11-07) — RPC em vez de policy de
-- UPDATE solta em `clients`: client não pode editar plan/access_key/status
-- da própria linha, só o próprio logo_url, via função security definer.
create or replace function update_own_logo(new_logo_url text)
returns void
language plpgsql security definer
as $$
begin
  update clients set logo_url = new_logo_url where id = my_client_id();
end;
$$;
