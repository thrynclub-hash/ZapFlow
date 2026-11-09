// ZapFlow — recebe eventos da Wiven (pagamento de assinatura confirmado,
// etc) e calcula a comissão do parceiro (split), mas NÃO transfere
// dinheiro sozinho — só registra um repasse pendente em wiven_transfers
// pro admin conferir e enviar pela própria Wiven. Motivo: o endpoint de
// transferência da Wiven e o nome exato dos eventos de webhook não foram
// confirmados (ver notas do Leonardo, 2026-11-09) — isso é dinheiro real,
// não arrisco mover automático em cima de um payload adivinhado.
//
// Deploy: supabase functions deploy wiven-webhook --no-verify-jwt
// (público — quem chama é a Wiven, sem Authorization nosso; a validação
// real é o campo `token` que a Wiven manda no corpo, comparado com
// WIVEN_WEBHOOK_TOKEN).
//
// NÃO TESTADO AO VIVO — nomes de evento (TRANSACTION_*/SUBSCRIPTION_*) e
// o campo exato do valor pago são inferidos da descrição do Leonardo, não
// de um payload real. Primeira chamada de verdade: logar o body inteiro
// (já faz isso abaixo) e ajustar os caminhos de campo se precisar.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const WIVEN_WEBHOOK_TOKEN = Deno.env.get("WIVEN_WEBHOOK_TOKEN") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    console.log("wiven-webhook body:", JSON.stringify(body));

    if (WIVEN_WEBHOOK_TOKEN && body?.token !== WIVEN_WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "token inválido" }), { status: 401, headers: corsHeaders });
    }

    const event = body?.event || body?.type || "";
    const isPaymentConfirmed = typeof event === "string" && (event.includes("SUBSCRIPTION") || event.includes("TRANSACTION")) && !event.includes("REFUND") && !event.includes("CANCEL") && !event.includes("CHARGED_BACK");
    if (!isPaymentConfirmed) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const identifier: string = body?.identifier || body?.data?.identifier || "";
    const amount: number = Number(body?.value || body?.amount || body?.data?.value || 0);
    const reference: string = body?.id || body?.transaction_id || body?.subscription_id || "";

    // identifier no formato zapflow:<client_id>:plan:<plano>
    const match = identifier.match(/^zapflow:([^:]+):/);
    const clientId = match?.[1];
    if (!clientId || !amount) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "identifier ou valor não reconhecido" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: client } = await supabase.from("clients").select("id, reseller_id").eq("id", clientId).maybeSingle();
    if (!client?.reseller_id) {
      return new Response(JSON.stringify({ ok: true, no_split: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: reseller } = await supabase.from("clients").select("id, commission_pct, wiven_pix_key").eq("id", client.reseller_id).single();
    const commissionPct = Number(reseller?.commission_pct ?? 70);
    const commissionAmount = Math.round(amount * (commissionPct / 100) * 100) / 100;

    await supabase.from("wiven_transfers").insert({
      reseller_client_id: client.reseller_id,
      source_client_id: clientId,
      wiven_reference: reference || null,
      amount: commissionAmount,
      status: "pending",
      notes: reseller?.wiven_pix_key ? null : "Parceiro sem chave Pix cadastrada — preencher antes de enviar.",
    });

    return new Response(JSON.stringify({ ok: true, commission_amount: commissionAmount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("wiven-webhook erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
