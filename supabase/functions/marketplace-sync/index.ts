// ZapFlow — processa marketplace_sync_jobs pendentes (2026-11-08)
// Deploy: supabase functions deploy marketplace-sync --no-verify-jwt
// Agendar: Supabase Dashboard > Edge Functions > marketplace-sync > Cron (ex: a cada 1 min)
//
// MVP: só push de stock_qty/unit_price pra item JÁ cadastrado no marketplace
// (vínculo product_channel_links.external_id é manual). Criação de anúncio
// novo (fotos, categoria, descrição) é fase 2 — não coberto aqui.
//
// mercadolivre e nuvemshop: implementados de verdade.
// tiktokshop, shopee, shein, netshoes: stub (erro explicativo) até termos
// credenciais de parceiro aprovadas — ver NÃO TESTADO abaixo.
//
// NÃO TESTADO AO VIVO — nenhum canal real conectado ainda.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function pushMercadoLivre(credentials: any, externalId: string, product: any) {
  const res = await fetch(`https://api.mercadolibre.com/items/${externalId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${credentials.access_token}` },
    body: JSON.stringify({ available_quantity: product.stock_qty, price: product.unit_price }),
  });
  if (!res.ok) throw new Error(`Mercado Livre: ${res.status} ${await res.text()}`);
}

async function pushNuvemshop(credentials: any, externalId: string, product: any) {
  // externalId no formato "variant_id" — o product_id do produto na Nuvemshop
  // vai em credentials por link (ver nota no product_channel_links.external_id).
  const res = await fetch(
    `https://api.nuvemshop.com.br/v1/${credentials.store_id}/products/variants/${externalId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authentication: `bearer ${credentials.access_token}`,
        "User-Agent": "ZapFlow (contato@zapflow.app)",
      },
      body: JSON.stringify({ stock: product.stock_qty, price: String(product.unit_price) }),
    },
  );
  if (!res.ok) throw new Error(`Nuvemshop: ${res.status} ${await res.text()}`);
}

const ADAPTERS: Record<string, (credentials: any, externalId: string, product: any) => Promise<void>> = {
  mercadolivre: pushMercadoLivre,
  nuvemshop: pushNuvemshop,
  tiktokshop: async () => { throw new Error("TikTok Shop: aguardando aprovação de Partner API"); },
  shopee: async () => { throw new Error("Shopee: aguardando aprovação de Partner API"); },
  shein: async () => { throw new Error("Shein: aguardando aprovação de Partner API"); },
  netshoes: async () => { throw new Error("Netshoes: integração não documentada publicamente — verificar com o marketplace"); },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { data: jobs } = await supabase
      .from("marketplace_sync_jobs")
      .select("id, product_id, channel_id")
      .eq("status", "pending")
      .limit(20);

    let done = 0, failed = 0;
    for (const job of jobs || []) {
      const { data: product } = await supabase.from("products").select("stock_qty, unit_price").eq("id", job.product_id).single();
      const { data: channel } = await supabase.from("marketplace_channels").select("platform, credentials").eq("id", job.channel_id).single();
      const { data: link } = await supabase.from("product_channel_links").select("external_id").eq("product_id", job.product_id).eq("channel_id", job.channel_id).single();

      try {
        if (!product || !channel || !link) throw new Error("produto/canal/vínculo não encontrado");
        const adapter = ADAPTERS[channel.platform];
        if (!adapter) throw new Error(`plataforma desconhecida: ${channel.platform}`);
        await adapter(channel.credentials, link.external_id, product);

        await supabase.from("marketplace_sync_jobs").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", job.id);
        await supabase.from("product_channel_links").update({ sync_status: "synced", last_synced_at: new Date().toISOString(), last_error: null })
          .eq("product_id", job.product_id).eq("channel_id", job.channel_id);
        done++;
      } catch (e) {
        const msg = String(e);
        await supabase.from("marketplace_sync_jobs").update({ status: "error", processed_at: new Date().toISOString(), error: msg }).eq("id", job.id);
        await supabase.from("product_channel_links").update({ sync_status: "error", last_error: msg })
          .eq("product_id", job.product_id).eq("channel_id", job.channel_id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: (jobs || []).length, done, failed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("marketplace-sync erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
