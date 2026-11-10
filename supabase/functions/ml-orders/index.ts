// ZapFlow — lista pedidos recentes do Mercado Livre do cliente logado,
// com o shipment_id de cada um (pra puxar a etiqueta que o PRÓPRIO
// Mercado Livre já gera — Mercado Envios). Zero provedor de frete novo
// necessário pra venda que veio do marketplace.
//
// Deploy: supabase functions deploy ml-orders
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

async function getChannel(clientId: string) {
  const { data } = await supabaseService
    .from("marketplace_channels")
    .select("id, credentials")
    .eq("client_id", clientId)
    .eq("platform", "mercadolivre")
    .eq("active", true)
    .maybeSingle();
  return data;
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

    const channel = await getChannel(clientId);
    if (!channel) return ok({ ok: true, connected: false, orders: [] });

    const { access_token, user_id } = channel.credentials || {};
    if (!access_token || !user_id) return ok({ ok: false, error: "Token Mercado Livre ausente — reconecte em Admin > Integrações." });

    const res = await fetch(`https://api.mercadolibre.com/orders/search?seller=${user_id}&sort=date_desc&limit=30`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return ok({ ok: false, error: data?.message || `Mercado Livre: ${res.status}` });

    const orders = (data.results || []).map((o: any) => ({
      id: o.id,
      status: o.status,
      date: o.date_created,
      total: o.total_amount,
      buyer: o.buyer?.nickname || o.buyer?.first_name || "Comprador ML",
      shipping_id: o.shipping?.id || null,
      items: (o.order_items || []).map((i: any) => ({ title: i.item?.title, quantity: i.quantity })),
    }));

    return ok({ ok: true, connected: true, orders });
  } catch (e: any) {
    return ok({ ok: false, error: e?.message || String(e) });
  }
});
