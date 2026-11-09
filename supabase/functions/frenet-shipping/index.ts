// ZapFlow — Cotação e etiqueta de envio via Frenet, tudo pelo ZapFlow.
// O lojista nunca abre o site da Frenet. Funciona com ou sem CNPJ: frete
// é logística, não exige inscrição fiscal (diferente de NFC-e).
//
// Deploy: supabase functions deploy frenet-shipping
// Requer JWT do usuário.
// Requer secret: FRENET_PARTNER_TOKEN (obtido com o time de Parcerias da
// Frenet — https://docs.frenet.com.br/docs/autenticacao — enquanto não
// tiver, as chamadas falham com "integração Frenet não configurada").
// Token por cliente fica em shipping_accounts.frenet_token (configurado
// pelo admin em Admin > Clientes, igual Bling).

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const frenetPartnerToken = Deno.env.get("FRENET_PARTNER_TOKEN") ?? "";
const supabaseService = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getAccount(clientId: string) {
  const { data } = await supabaseService
    .from("shipping_accounts")
    .select("frenet_token, origin_cep, origin_name")
    .eq("client_id", clientId)
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

    if (!frenetPartnerToken) {
      return ok({ ok: false, error: "Integração Frenet ainda não configurada (falta FRENET_PARTNER_TOKEN)." });
    }

    const account = await getAccount(clientId);
    if (!account) return ok({ ok: true, connected: false, reason: "sem conta Frenet configurada pro cliente" });

    const body = await req.json().catch(() => ({}));
    const action = body?.action || "quote";

    const headers = {
      "Content-Type": "application/json",
      token: account.frenet_token,
      "x-partner-token": frenetPartnerToken,
    };

    if (action === "quote") {
      const { destinationCep, weightKg, lengthCm, heightCm, widthCm, invoiceValue } = body;
      if (!destinationCep) return ok({ ok: false, error: "CEP de destino é obrigatório." });

      const res = await fetch("https://api.frenet.com.br/shipping/quote", {
        method: "POST",
        headers,
        body: JSON.stringify({
          SellerCEP: account.origin_cep,
          RecipientCEP: String(destinationCep).replace(/\D/g, ""),
          ShipmentInvoiceValue: Number(invoiceValue) || 0,
          ShippingItemArray: [{
            Weight: Number(weightKg) || 0.3,
            Length: Number(lengthCm) || 16,
            Height: Number(heightCm) || 4,
            Width: Number(widthCm) || 12,
            Quantity: 1,
          }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return ok({ ok: false, error: data?.Msg || `Frenet: ${res.status}` });
      const options = (data.ShippingSevicesArray ?? [])
        .filter((s: any) => !s.Error)
        .map((s: any) => ({ carrier: s.Carrier, service: s.ServiceDescription, price: Number(s.ShippingPrice), days: s.DeliveryTime }));
      return ok({ ok: true, connected: true, options });
    }

    if (action === "label") {
      const { opportunityId, destinationName, destinationCep, destinationAddress, carrier, serviceName, price } = body;
      if (!destinationCep || !destinationName) return ok({ ok: false, error: "Nome e CEP do destinatário são obrigatórios." });

      // Registra o envio no histórico; geração real de etiqueta/PDF via
      // API de postagem da Frenet entra quando o token de produção existir
      // — por ora grava o pedido de envio pra rastreio manual.
      const { data: shipment, error } = await supabaseService
        .from("shipments")
        .insert({
          client_id: clientId,
          opportunity_id: opportunityId || null,
          destination_name: destinationName,
          destination_cep: String(destinationCep).replace(/\D/g, ""),
          destination_address: destinationAddress || null,
          carrier: carrier || null,
          service_name: serviceName || null,
          price: Number(price) || null,
          status: "pending",
        })
        .select()
        .single();
      if (error) return ok({ ok: false, error: error.message });
      return ok({ ok: true, shipment });
    }

    return ok({ ok: false, error: "Ação inválida." });
  } catch (e: any) {
    return ok({ ok: false, error: e?.message || String(e) });
  }
});
