// ZapFlow — Cria a cobrança no Mercado Pago para um add-on de order bump
// (+1 número WhatsApp ou +1000 contatos).
// Deploy: supabase functions deploy mp-create-preapproval
// (mantém verify_jwt=true — só usuário logado do próprio cliente pode chamar)
//
// Dois modelos de cobrança diferentes, por tipo de add-on (ver RECURRING):
// - "number": assinatura recorrente (/preapproval) — cobra todo mês, porque
//   custa Z-API todo mês de verdade.
// - "contacts_1000": pagamento único (/checkout/preferences) — cobra uma
//   vez só. Corrigido em 2026-07-03: antes os dois tipos usavam /preapproval,
//   cobrando o cliente todo mês por um add-on de contatos que devia ser
//   cobrado uma única vez.
//
// Requer secret: MP_ACCESS_TOKEN (Access Token de produção do Mercado
// Pago — NUNCA colocar isso no frontend). Configurar via:
//   supabase secrets set MP_ACCESS_TOKEN=seu_token_aqui
// (ou pelo Dashboard: Project Settings > Edge Functions > Secrets)
//
// ATENÇÃO: o contrato exato das APIs de Preapproval e Preferences do
// Mercado Pago não foi validado ao vivo nesta sessão — os campos abaixo
// seguem a documentação pública, mas teste com uma compra real de teste
// antes de divulgar pro cliente. Se algum campo vier com nome diferente do
// esperado, o erro da própria API do Mercado Pago (retornado no response)
// deve dizer qual.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Preço sugerido de cada add-on — mesma lógica usada no painel admin
// (AdminClients.jsx). Fica travado no servidor de propósito: o valor
// cobrado nunca deve depender do que o navegador manda.
//
// "number" é cobrança RECORRENTE mensal (custa Z-API todo mês de verdade,
// então o preço tem que se repetir). "contacts_1000" é PAGAMENTO ÚNICO
// (decisão do Leonardo, 2026-07-03 — corrigido de um bug onde os dois
// tipos usavam a API de assinatura recorrente do Mercado Pago, cobrando
// o cliente todo mês por um add-on que devia ser cobrado só uma vez).
const PRICES: Record<string, number> = {
  number: 150,
  contacts_1000: 59.90,
};
const RECURRING: Record<string, boolean> = {
  number: true,
  contacts_1000: false,
};
const LABELS: Record<string, string> = {
  number: "+1 número de WhatsApp",
  contacts_1000: "+1000 contatos",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    // Valida quem está chamando de verdade (sessão real do Supabase Auth,
    // mesmo padrão de defesa usado em send-message).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "sessão inválida" }, 401);

    const { addon_type } = await req.json();
    if (!PRICES[addon_type]) return json({ error: "addon_type inválido — use 'number' ou 'contacts_1000'" }, 400);

    // Confirma o client_id a partir do profile logado, não do que o body manda
    const { data: profile } = await supabase.from("profiles").select("client_id, email").eq("id", userData.user.id).single();
    if (!profile?.client_id) return json({ error: "perfil sem client_id vinculado" }, 400);

    // Prioriza o e-mail real da empresa (clients.email) sobre o e-mail
    // sintético usado só pro login (profiles.email/auth pode ser algo tipo
    // cliente-xyz@zapflow-interno.com, que não deve ir pro Mercado Pago).
    const { data: clientRow } = await supabase.from("clients").select("email").eq("id", profile.client_id).single();

    const price = PRICES[addon_type];
    const label = LABELS[addon_type];

    // 1. Cria o registro do add-on como "pending" — só vira "active" quando
    //    o webhook confirmar o pagamento.
    const { data: addonRow, error: addonErr } = await supabase
      .from("client_addons")
      .insert({ client_id: profile.client_id, addon_type, quantity: 1, monthly_price: price, status: "pending" })
      .select()
      .single();
    if (addonErr) return json({ error: "erro ao criar add-on: " + addonErr.message }, 500);

    const payerEmail = clientRow?.email || profile.email || userData.user.email;
    if (!payerEmail) {
      await supabase.from("client_addons").delete().eq("id", addonRow.id);
      return json({ error: "Este cliente não tem e-mail cadastrado (clients.email) — cadastre um e-mail real antes de comprar um add-on." }, 400);
    }

    const notificationUrl = `${supabaseUrl.replace(".supabase.co", ".functions.supabase.co")}/mp-webhook`;
    const isRecurring = RECURRING[addon_type];

    // 2a. Recorrente (número): assinatura via /preapproval, cobra todo mês.
    // 2b. Pagamento único (contatos): Checkout Pro via /checkout/preferences,
    //     cobra uma vez só — sem auto_recurring, sem mensalidade.
    const mpRes = isRecurring
      ? await fetch("https://api.mercadopago.com/preapproval", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${mpAccessToken}` },
          body: JSON.stringify({
            reason: `ZapFlow - ${label}`,
            external_reference: addonRow.id,
            payer_email: payerEmail,
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              transaction_amount: price,
              currency_id: "BRL",
            },
            back_url: "https://zapflow.vercel.app/settings",
            notification_url: notificationUrl,
            status: "pending",
          }),
        })
      : await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${mpAccessToken}` },
          body: JSON.stringify({
            items: [{ title: `ZapFlow - ${label}`, quantity: 1, unit_price: price, currency_id: "BRL" }],
            external_reference: addonRow.id,
            payer: { email: payerEmail },
            back_urls: {
              success: "https://zapflow.vercel.app/settings",
              pending: "https://zapflow.vercel.app/settings",
              failure: "https://zapflow.vercel.app/settings",
            },
            auto_return: "approved",
            notification_url: notificationUrl,
          }),
        });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      // Reverte o add-on criado se o Mercado Pago recusar
      await supabase.from("client_addons").delete().eq("id", addonRow.id);
      console.error("Erro Mercado Pago:", mpData);
      return json({ error: `Mercado Pago recusou a criação d${isRecurring ? "a assinatura" : "o pagamento"}`, detail: mpData }, 500);
    }

    // Guarda o id de referência (preapproval ou preference) pro webhook
    // conseguir consultar o status depois.
    await supabase.from("client_addons").update({ mp_preapproval_id: mpData.id }).eq("id", addonRow.id);

    return json({ checkout_url: mpData.init_point || mpData.sandbox_init_point });
  } catch (e) {
    console.error("Erro geral:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders() } });
}
