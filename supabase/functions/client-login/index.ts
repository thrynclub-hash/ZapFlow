// ZapFlow — Troca access_key por credencial de sessão real
// Deploy: supabase functions deploy client-login --no-verify-jwt
// (público, sem JWT — é o próprio mecanismo de login)
//
// Recebe { access_key }, valida contra `clients` usando a service role
// (ignora RLS com segurança, pois faz a checagem aqui dentro), e
// devolve { email, password } sintéticos — o frontend usa isso para
// chamar supabase.auth.signInWithPassword() e estabelecer uma sessão
// REAL (com auth.uid() funcionando), em vez do esquema antigo que só
// guardava dados no localStorage sem sessão nenhuma.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  try {
    const { access_key } = await req.json();
    if (!access_key) {
      return new Response(JSON.stringify({ error: "access_key é obrigatório" }), { status: 400 });
    }

    const { data: client, error } = await adminClient
      .from("clients")
      .select("id, name, status")
      .eq("access_key", String(access_key).trim().toLowerCase())
      .eq("status", "active")
      .single();

    if (error || !client) {
      return new Response(JSON.stringify({ error: "Chave de acesso inválida ou expirada." }), { status: 401 });
    }

    const { data: secret } = await adminClient
      .from("client_auth_secrets")
      .select("synthetic_email, synthetic_password")
      .eq("client_id", client.id)
      .single();

    if (!secret?.synthetic_email) {
      // Cliente ainda não foi provisionado — o admin precisa rodar
      // client-provision para este client_id antes do login funcionar.
      return new Response(
        JSON.stringify({ error: "Este cliente ainda não tem login configurado. Peça para o administrador provisionar o acesso." }),
        { status: 412 },
      );
    }

    return new Response(
      JSON.stringify({ email: secret.synthetic_email, password: secret.synthetic_password }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
