// ZapFlow — gera a URL de autorização OAuth do Bling. Só o ADMIN usa isto
// (tela Admin > Clientes > Integrações) — o cliente final nunca vê "Bling"
// em lugar nenhum da plataforma, só o resultado (estoque, nota, etc) já
// dentro do ZapFlow. Admin pode conectar em nome de qualquer cliente
// passando { client_id } no body; sem isso, conecta pro próprio cliente
// de quem chamou (uso raro, mantido por simetria).
//
// Deploy: supabase functions deploy bling-oauth-start
// Requer secrets: BLING_CLIENT_ID (já existe, usado em bling-estoque).
//
// state = client_id + HMAC(client_id) usando BLING_CLIENT_SECRET como
// chave — só pra garantir, no callback, que o state não foi forjado
// (CSRF-ish check), sem precisar de tabela/secret novo pra isso.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const blingClientId = Deno.env.get("BLING_CLIENT_ID") ?? "";
const blingClientSecret = Deno.env.get("BLING_CLIENT_SECRET") ?? "";
const redirectUri = `${supabaseUrl}/functions/v1/bling-oauth-callback`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(blingClientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!blingClientId || !blingClientSecret) {
      return new Response(JSON.stringify({ ok: false, error: "App Bling não configurado (BLING_CLIENT_ID/SECRET ausentes)." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAsUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: "Não autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabaseAsUser.from("profiles").select("client_id, role").eq("id", user.id).single();

    let targetClientId = profile?.client_id;
    const body = await req.json().catch(() => ({}));
    if (body?.client_id) {
      if (profile?.role !== "admin") return new Response(JSON.stringify({ ok: false, error: "Só admin pode conectar em nome de outro cliente." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      targetClientId = body.client_id;
    }
    if (!targetClientId) return new Response(JSON.stringify({ ok: false, error: "Nenhum cliente informado." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sig = await hmac(targetClientId);
    const state = `${targetClientId}.${sig}`;
    const url = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", blingClientId);
    url.searchParams.set("state", state);

    return new Response(JSON.stringify({ ok: true, url: url.toString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
