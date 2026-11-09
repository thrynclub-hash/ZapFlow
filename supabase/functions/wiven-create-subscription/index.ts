// ZapFlow — cria assinatura Pix recorrente na Wiven pro cliente (cobrança
// mensal automática), mesmo endpoint que o Toqy já usa em produção
// (POST /gateway/pix/subscription). Admin-only: chamado em Admin >
// Clientes ao ativar cobrança automática pra um cliente.
//
// Deploy: supabase functions deploy wiven-create-subscription
// Requer secrets: WIVEN_PUBLIC_KEY, WIVEN_SECRET_KEY.
//
// NÃO TESTADO AO VIVO — payload abaixo é o padrão confirmado pelo
// Leonardo (uso real no Toqy), mas nunca foi chamado a partir do
// ZapFlow. Testar com um valor pequeno antes de usar pra cliente real.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const WIVEN_BASE = "https://app.wiven.com.br/api/v1";
const WIVEN_PUBLIC_KEY = Deno.env.get("WIVEN_PUBLIC_KEY") ?? "";
const WIVEN_SECRET_KEY = Deno.env.get("WIVEN_SECRET_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!WIVEN_PUBLIC_KEY || !WIVEN_SECRET_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Wiven não configurada (WIVEN_PUBLIC_KEY/WIVEN_SECRET_KEY ausentes)." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAsUser.auth.getUser();
    const { data: profile } = await supabaseAsUser.from("profiles").select("role").eq("id", user?.id ?? "").single();
    if (profile?.role !== "admin") return new Response(JSON.stringify({ ok: false, error: "Só admin." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { client_id, plan_name, monthly_value } = await req.json();
    if (!client_id || !monthly_value) return new Response(JSON.stringify({ ok: false, error: "client_id e monthly_value são obrigatórios." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Identificador no mesmo padrão do Toqy: zapflow:<client_id>:plan:<plano>
    // — o webhook usa isso pra achar o cliente de volta.
    const identifier = `zapflow:${client_id}:plan:${plan_name || "default"}`;

    const res = await fetch(`${WIVEN_BASE}/gateway/pix/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-public-key": WIVEN_PUBLIC_KEY, "x-secret-key": WIVEN_SECRET_KEY },
      body: JSON.stringify({
        identifier,
        value: Number(monthly_value),
        periodicity: "monthly",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return new Response(JSON.stringify({ ok: false, error: data?.message || `Wiven: ${res.status}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const subscriptionId = data?.id || data?.subscription_id || null;
    if (subscriptionId) await supabase.from("clients").update({ wiven_subscription_id: subscriptionId }).eq("id", client_id);

    return new Response(JSON.stringify({ ok: true, subscription: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
