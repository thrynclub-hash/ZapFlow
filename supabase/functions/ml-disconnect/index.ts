// ZapFlow — desconecta a conta Mercado Livre do próprio cliente logado
// (self-service, igual o connect). Não apaga a linha, só marca active =
// false — reconectar depois cria um registro novo via ml-oauth-callback
// (upsert por client_id+platform já existente lá).
//
// Deploy: supabase functions deploy ml-disconnect
// Requer JWT do usuário.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAsUser.auth.getUser();
    if (!user) return ok({ ok: false, error: "Não autenticado." });

    const { data: profile } = await supabaseAsUser.from("profiles").select("client_id").eq("id", user.id).single();
    const clientId = profile?.client_id;
    if (!clientId) return ok({ ok: false, error: "Conta sem cliente vinculado." });

    const { error } = await supabaseService
      .from("marketplace_channels")
      .update({ active: false })
      .eq("client_id", clientId)
      .eq("platform", "mercadolivre");
    if (error) return ok({ ok: false, error: error.message });

    return ok({ ok: true });
  } catch (e: any) {
    return ok({ ok: false, error: e?.message || String(e) });
  }
});
