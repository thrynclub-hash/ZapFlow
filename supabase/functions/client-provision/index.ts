// ZapFlow — Provisiona login real (Supabase Auth) para um cliente
// Deploy: supabase functions deploy client-provision
// (SEM --no-verify-jwt: só admin logado pode chamar essa função)
//
// O que faz: cria um usuário oculto no Supabase Auth para o cliente
// (e-mail sintético, senha aleatória), grava um profiles vinculando
// esse usuário ao client_id com role='client', e guarda a credencial
// em client_auth_secrets (só a service role lê essa tabela).
//
// Idempotente: se o cliente já tem credencial provisionada, retorna a
// existente em vez de criar de novo.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}


function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) + "!Aa1";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Só admin pode chamar: valida o JWT de quem chamou e checa profiles.role
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: corsHeaders });
    }
    const { data: callerProfile } = await adminClient
      .from("profiles").select("role").eq("id", userData.user.id).single();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), { status: 403, headers: corsHeaders });
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id é obrigatório" }), { status: 400, headers: corsHeaders });
    }

    // Já provisionado? retorna sem recriar
    const { data: existing } = await adminClient
      .from("client_auth_secrets").select("*").eq("client_id", client_id).single();
    if (existing?.synthetic_email) {
      return new Response(JSON.stringify({ ok: true, already_provisioned: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client, error: clientErr } = await adminClient
      .from("clients").select("id, name").eq("id", client_id).single();
    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), { status: 404, headers: corsHeaders });
    }

    const syntheticEmail = `client-${client_id}@zapflow.internal`;
    const password = randomPassword();

    const { data: authUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
    });
    if (createErr || !authUser?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "Erro criando usuário" }), { status: 500, headers: corsHeaders });
    }

    await adminClient.from("profiles").upsert({
      id: authUser.user.id,
      client_id: client.id,
      role: "client",
      full_name: client.name,
      email: syntheticEmail,
    });

    await adminClient.from("client_auth_secrets").upsert({
      client_id: client.id,
      synthetic_email: syntheticEmail,
      synthetic_password: password,
      auth_user_id: authUser.user.id,
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, already_provisioned: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
