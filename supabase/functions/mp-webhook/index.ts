// ZapFlow — Webhook do Mercado Pago: confirma pagamento de add-on e
// libera o limite automaticamente (sem clique manual do Leonardo).
// Deploy: supabase functions deploy mp-webhook --no-verify-jwt
// (público de propósito — quem chama é o servidor do Mercado Pago)
//
// Configurar no painel do Mercado Pago (Sua conta > Configurações >
// Webhooks, ou direto na criação de cada preapproval/preference via
// notification_url):
//   https://<seu-projeto>.functions.supabase.co/mp-webhook
//
// Requer secret: MP_ACCESS_TOKEN (mesma usada em mp-create-preapproval)
//
// Processa DOIS tipos de notificação, um por tipo de add-on (ver
// mp-create-preapproval): "preapproval"/"subscription_preapproval" para o
// add-on de número (recorrente), e "payment" para o add-on de contatos
// (pagamento único, adicionado em 2026-07-03 — antes o webhook ignorava
// notificações de "payment" avulso, o que não fazia diferença enquanto
// tudo era assinatura, mas passaria batido agora que contatos é one-time).
//
// O Mercado Pago manda a notificação de formas um pouco diferentes
// dependendo de onde veio (query string ?type=X&data.id=Y, ou corpo
// { type, data: { id } }) — este webhook aceita os dois formatos.
// ATENÇÃO: não validado ao vivo nesta sessão — testar com uma compra/
// assinatura de teste antes de divulgar. Loga tudo (console.log) pra
// facilitar debug no Supabase Dashboard > Edge Functions > Logs se algo
// vier diferente.

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
      type = type || (body?.type ?? body?.topic ?? null);
    }

    console.log("mp-webhook recebido:", { type, preapprovalId });

    const isSubscriptionEvent = type === "preapproval" || type === "subscription_preapproval";
    const isPaymentEvent = type === "payment";

    if (!preapprovalId || (!isSubscriptionEvent && !isPaymentEvent)) {
      // Ignora qualquer outro tipo de notificação que não seja assinatura
      // (add-on de número) nem pagamento avulso (add-on de contatos).
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Consulta a API certa dependendo do tipo — preapproval (assinatura,
    // add-on de número) ou payment (pagamento único, add-on de contatos).
    const mpRes = isSubscriptionEvent
      ? await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        })
      : await fetch(`https://api.mercadopago.com/v1/payments/${preapprovalId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("Erro ao consultar Mercado Pago:", mpData);
      return new Response(JSON.stringify({ ok: false, error: mpData }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const addonRowId = mpData.external_reference;
    if (!addonRowId) return new Response(JSON.stringify({ ok: true, no_reference: true }), { headers: { "Content-Type": "application/json" } });

    let newStatus: string | null = null;
    if (isSubscriptionEvent) {
      if (mpData.status === "authorized") newStatus = "active";
      else if (mpData.status === "cancelled" || mpData.status === "paused") newStatus = "cancelled";
    } else {
      // Pagamento único: "approved" ativa de vez (não tem renovação pra
      // acompanhar); "rejected"/"cancelled" cancela o pedido pendente.
      if (mpData.status === "approved") newStatus = "active";
      else if (mpData.status === "rejected" || mpData.status === "cancelled") newStatus = "cancelled";
    }

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
