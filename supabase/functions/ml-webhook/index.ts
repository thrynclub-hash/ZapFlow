// ZapFlow — recebe notificações push do Mercado Livre (orders, items,
// shipments). Por enquanto só confirma recebimento (200 OK rápido,
// exigência do ML — timeout vira retry agressivo deles) e loga; nenhuma
// ação automática ainda. Processamento real (ex: marcar pedido como
// despachado na hora) é melhoria futura, não bloqueia uso hoje — o sync
// de estoque/preço já funciona por trigger + polling via ml-orders.
//
// Deploy: supabase functions deploy ml-webhook --no-verify-jwt
// (público — quem chama é o Mercado Livre, sem Authorization nosso)
// Configurar no app ML: Tópicos > URL de retorno de chamada de notificação:
// https://bhiggyigsrqfabqhutne.supabase.co/functions/v1/ml-webhook

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return new Response("ok", { headers: corsHeaders }); // health check manual

  try {
    const body = await req.json().catch(() => ({}));
    console.log("ml-webhook recebido:", JSON.stringify(body).slice(0, 500));
  } catch (_e) {
    // corpo inválido não é motivo pra devolver erro pro ML (eles reenviam agressivo)
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
