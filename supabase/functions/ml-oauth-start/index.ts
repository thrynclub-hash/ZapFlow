// ZapFlow — gera URL de autorização OAuth do Mercado Livre. Mesmo padrão
// do bling-oauth-start: só admin usa (Admin > Clientes > Integrações),
// cliente final nunca vê "Mercado Livre" como provedor, só o resultado.
//
// Deploy: supabase functions deploy ml-oauth-start
// Requer secrets: ML_CLIENT_ID (app criado em https://developers.mercadolivre.com.br).
//
// state = client_id + HMAC(client_id) com ML_CLIENT_SECRET como chave —
// mesmo mecanismo anti-forjamento do bling-oauth-start, sem tabela nova.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const mlClientId = Deno.env.get("ML_CLIENT_ID") ?? "";
const mlClientSecret = Deno.env.get("ML_CLIENT_SECRET") ?? "";
const redirectUri = `${supabaseUrl}/functions/v1/ml-oauth-callback`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(mlClientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!mlClientId || !mlClientSecret) {
      return new Response(JSON.stringify({ ok: false, error: "App Mercado Livre não configurado (ML_CLIENT_ID/SECRET ausentes)." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAsUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: "Não autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabaseAsUser.from("profiles").select("client_id, role").eq("id", user.id).single();

    let targetClientId = profile?.client_id;
    const body = await req.json().catch(() => ({}));
    // origem fica no state (assinada junto, pra não dar pra forjar) — o
    // callback usa isso só pra saber pra ONDE mandar o navegador de volta
    // (admin volta pra /admin/clients, self-service volta pra /settings).
    // Bug real achado ao vivo: callback sempre mandava pra /admin/clients,
    // mesmo quando quem conectou foi o próprio cliente (Lisa) via Settings.
    let origin = "self";
    if (body?.client_id) {
      if (profile?.role !== "admin") return new Response(JSON.stringify({ ok: false, error: "Só admin pode conectar em nome de outro cliente." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      targetClientId = body.client_id;
      origin = "admin";
    }
    if (!targetClientId) return new Response(JSON.stringify({ ok: false, error: "Nenhum cliente informado." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sig = await hmac(`${targetClientId}.${origin}`);
    const state = `${targetClientId}.${origin}.${sig}`;
    const url = new URL("https://auth.mercadolivre.com.br/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", mlClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return new Response(JSON.stringify({ ok: true, url: url.toString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
