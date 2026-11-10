// ZapFlow — lista os anúncios reais do Mercado Livre do cliente (pra tela
// de vínculo produto-local ↔ anúncio, em Admin > Clientes > Integrações).
// Só leitura. Mesmo padrão de resolução de client_id via profiles que
// bling-estoque usa.
//
// Deploy: supabase functions deploy ml-items
// Requer JWT do usuário (admin).

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

    const { data: profile } = await supabaseAsUser.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return ok({ ok: false, error: "Só admin." });

    const body = await req.json().catch(() => ({}));
    const clientId = body?.client_id;
    if (!clientId) return ok({ ok: false, error: "client_id obrigatório." });

    const { data: channel } = await supabaseService
      .from("marketplace_channels")
      .select("credentials")
      .eq("client_id", clientId)
      .eq("platform", "mercadolivre")
      .eq("active", true)
      .maybeSingle();
    if (!channel) return ok({ ok: true, connected: false, items: [] });

    const { access_token, user_id } = channel.credentials || {};
    if (!access_token || !user_id) return ok({ ok: false, error: "Token Mercado Livre ausente — reconecte." });

    const searchRes = await fetch(`https://api.mercadolibre.com/users/${user_id}/items/search?status=active`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const searchData = await searchRes.json().catch(() => ({}));
    if (!searchRes.ok) return ok({ ok: false, error: searchData?.message || `Mercado Livre: ${searchRes.status}` });

    const ids: string[] = (searchData.results || []).slice(0, 100);
    if (ids.length === 0) return ok({ ok: true, connected: true, items: [] });

    const itemsRes = await fetch(`https://api.mercadolibre.com/items?ids=${ids.join(",")}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const itemsData = await itemsRes.json().catch(() => ([]));
    const items = (Array.isArray(itemsData) ? itemsData : [])
      .filter((r: any) => r.code === 200)
      .map((r: any) => ({ id: r.body.id, title: r.body.title, price: r.body.price, available_quantity: r.body.available_quantity }));

    return ok({ ok: true, connected: true, items });
  } catch (e: any) {
    return ok({ ok: false, error: e?.message || String(e) });
  }
});
