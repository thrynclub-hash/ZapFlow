// ZapFlow — puxa a etiqueta de envio que o PRÓPRIO Mercado Livre já gerou
// pro pedido (Mercado Envios), em PDF, pro cliente só imprimir pelo
// painel do ZapFlow. Não usa nenhum provedor de frete externo — a
// etiqueta já existe no lado do marketplace, aqui só busca e devolve.
//
// Deploy: supabase functions deploy ml-shipment-label
// Requer JWT do usuário. Body: { shipment_id }

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

    const body = await req.json().catch(() => ({}));
    const shipmentId = body?.shipment_id;
    if (!shipmentId) return ok({ ok: false, error: "shipment_id obrigatório." });

    const { data: channel } = await supabaseService
      .from("marketplace_channels")
      .select("credentials")
      .eq("client_id", clientId)
      .eq("platform", "mercadolivre")
      .eq("active", true)
      .maybeSingle();
    if (!channel) return ok({ ok: false, error: "Mercado Livre não conectado." });

    const accessToken = channel.credentials?.access_token;
    if (!accessToken) return ok({ ok: false, error: "Token Mercado Livre ausente — reconecte." });

    const res = await fetch(`https://api.mercadolibre.com/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 400 && errText.includes("INVALID_SHIPMENT_FF_PUBLIC")) {
        return ok({ ok: false, error: "Esse envio é Fulfillment (Full) — etiqueta é gerada pelo próprio centro de distribuição do Mercado Livre, não pela API." });
      }
      return ok({ ok: false, error: `Mercado Livre (etiqueta): ${res.status} ${errText}` });
    }

    const buffer = await res.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return ok({ ok: true, pdf_base64: base64 });
  } catch (e: any) {
    return ok({ ok: false, error: e?.message || String(e) });
  }
});
