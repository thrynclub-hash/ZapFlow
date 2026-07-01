// ZapFlow — Webhook do Mercado Pago: confirma pagamento de add-on e
// libera o limite automaticamente (sem clique manual do Leonardo).
// Deploy: supabase functions deploy mp-webhook --no-verify-jwt
// (público de propósito — quem chama é o servidor do Mercado Pago)
//
// Configurar no painel do Mercado Pago (Sua conta > Configurações >
// Webhooks, ou direto na criação de cada preapproval via notification_url):
//   https://<seu-projeto>.functions.supabase.co/mp-webhook
//
// Requer secret: MP_ACCESS_TOKEN (mesma usada em mp-create-preapproval)
//
// O Mercado Pago manda a notificação de formas um pouco diferentes
// dependendo de onde veio (query string ?type=preapproval&data.id=X, ou
// corpo { type, data: { id } }) — este webhook aceita os dois formatos.
// ATENÇÃO: não validado ao vivo nesta sessão — testar com uma assinatura
// de teste antes de divulgar. Loga tudo (console.log) pra facilitar debug
// no Supabase Dashboard > Edge Functions > Logs se algo vier diferente.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    let preapprovalId = url.searchParams.get("data.id") || url.searchParams.get("id");
    let type = url.searchParams.get("type") || url.searchParams.get("topic");

    if (!preapprovalId) {
      const body = await req.json().catch(() => ({}));
      preapprovalId = body?.data?.id ?? body?.id ?? null;
      type = type || body?.type ?? body?.topic ?? null;
    }

    console.log("mp-webhook recebido:", { type, preapprovalId });

    if (!preapprovalId || (type && type !== "preapproval" && type !== "subscription_preapproval")) {
      // Ignora outros tipos de notificação (ex: "payment" avulso) — o que
      // importa pro add-on é o status da ASSINATURA (preapproval).
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("Erro ao consultar preapproval no Mercado Pago:", mpData);
      return new Response(JSON.stringify({ ok: false, error: mpData }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const addonRowId = mpData.external_reference;
    if (!addonRowId) return new Response(JSON.stringify({ ok: true, no_reference: true }), { headers: { "Content-Type": "application/json" } });

    let newStatus: string | null = null;
    if (mpData.status === "authorized") newStatus = "active";
    else if (mpData.status === "cancelled" || mpData.status === "paused") newStatus = "cancelled";

    if (newStatus) {
      await supabase.from("client_addons").update({ status: newStatus }).eq("id", addonRowId);
      console.log(`client_addons ${addonRowId} -> status=${newStatus}`);
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro geral no mp-webhook:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
