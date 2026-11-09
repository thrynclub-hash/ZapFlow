// ZapFlow — Lista produtos/estoque direto do Bling (tela Estoque do painel
// do cliente). Fase ERP visual (2026-11-08): o cliente que usa Bling como
// fonte de catálogo (ex: Lisa La Belle) vê o estoque real dentro do
// ZapFlow, sem precisar abrir o painel do Bling — mesmo que por trás
// continue sendo 100% Bling.
//
// Deploy: supabase functions deploy bling-estoque
// Requer JWT do usuário — mesmo padrão de zapi-status/index.ts: RLS de
// marketplace_channels ("Client select own marketplace_channels") escopa
// pro client_id de quem chamou, token do Bling nunca sai do servidor.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: channel, error } = await supabaseAsUser
      .from("marketplace_channels")
      .select("credentials")
      .eq("platform", "bling")
      .eq("active", true)
      .maybeSingle();

    if (error || !channel) {
      return new Response(JSON.stringify({ ok: true, connected: false, reason: "sem canal Bling configurado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accessToken = channel.credentials?.access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ ok: true, connected: false, reason: "token Bling ausente" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Só produtos pai (formato V) ou simples sem pai — evita listar cada
    // variação de tamanho/cor como linha própria; a tela mostra o produto
    // e, se quiser, dá pra abrir detalhe depois (fora de escopo aqui).
    const res = await fetch("https://api.bling.com.br/Api/v3/produtos?pagina=1&limite=100&situacao=A", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: data?.error?.message || `Bling: ${res.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const produtos = (data.data ?? [])
      .filter((p: any) => p.formato !== "S") // esconde filhos de variação, só pai/simples
      .map((p: any) => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo || null,
        preco: p.preco ?? 0,
        estoque: p.estoque?.saldoVirtualTotal ?? null,
        situacao: p.situacao,
        imagem: p.midia?.imagens?.internas?.[0]?.linkMiniatura || p.midia?.imagens?.imagensURL?.[0]?.link || null,
      }));

    return new Response(JSON.stringify({ ok: true, connected: true, produtos }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
