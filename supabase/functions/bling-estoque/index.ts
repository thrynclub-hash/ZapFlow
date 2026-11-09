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
//
// BUG REAL corrigido em 2026-11-09: access_token do Bling expira em 6h e
// NUNCA existiu refresh automático em lugar nenhum do sistema (nem aqui,
// nem em marketplace-sync) — todo teste anterior dependia de colar token
// novo manual. Agora, em qualquer 401 do Bling, tenta refresh com
// refresh_token + BLING_CLIENT_ID/BLING_CLIENT_SECRET (secrets da function,
// specifcos do app Bling, não por cliente) e GRAVA o token novo de volta em
// marketplace_channels via service role — RLS de "Client select own" só
// permite SELECT, não UPDATE, por isso precisa do client separado.
//
// Requer secrets (além de SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY, que já
// existem): BLING_CLIENT_ID, BLING_CLIENT_SECRET — mesmos usados na troca
// OAuth inicial do app Bling (central de apps do Bling > sua integração).

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const blingClientId = Deno.env.get("BLING_CLIENT_ID") ?? "";
const blingClientSecret = Deno.env.get("BLING_CLIENT_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function refreshBlingToken(refreshToken: string) {
  const basic = btoa(`${blingClientId}:${blingClientSecret}`);
  const res = await fetch("https://bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.error || `refresh falhou: ${res.status}`);
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

async function fetchBlingProdutos(accessToken: string) {
  return fetch("https://api.bling.com.br/Api/v3/produtos?pagina=1&limite=100&situacao=A", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: channel, error } = await supabaseAsUser
      .from("marketplace_channels")
      .select("id, credentials")
      .eq("platform", "bling")
      .eq("active", true)
      .maybeSingle();

    if (error || !channel) {
      return new Response(JSON.stringify({ ok: true, connected: false, reason: "sem canal Bling configurado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let accessToken = channel.credentials?.access_token;
    const refreshToken = channel.credentials?.refresh_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ ok: true, connected: false, reason: "token Bling ausente" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let res = await fetchBlingProdutos(accessToken);

    if (res.status === 401) {
      if (!refreshToken || !blingClientId || !blingClientSecret) {
        return new Response(JSON.stringify({ ok: false, error: "Token do Bling expirou e não há refresh_token/credenciais do app pra renovar sozinho — precisa reautorizar manual." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const refreshed = await refreshBlingToken(refreshToken);
        accessToken = refreshed.access_token;
        // Grava o token novo via service role — RLS do cliente só permite
        // leitura, não escrita, nesta tabela (de propósito, ver migration).
        const supabaseService = createClient(supabaseUrl, serviceRoleKey);
        await supabaseService
          .from("marketplace_channels")
          .update({ credentials: { ...channel.credentials, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token } })
          .eq("id", channel.id);
        res = await fetchBlingProdutos(accessToken);
      } catch (refreshErr) {
        return new Response(JSON.stringify({ ok: false, error: `Falha ao renovar token do Bling: ${String(refreshErr)}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 200 de propósito mesmo em erro — supabase.functions.invoke() trata
      // status != 2xx como erro de transporte e esconde o body real do
      // chamador; melhor sempre 200 com ok:false pra UI mostrar o motivo.
      return new Response(JSON.stringify({ ok: false, error: data?.error?.message || `Bling: ${res.status}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Só produtos pai (formato V) ou simples sem pai — evita listar cada
    // variação de tamanho/cor como linha própria; a tela mostra o produto
    // e, se quiser, dá pra abrir detalhe depois (fora de escopo aqui).
    const produtos = (data.data ?? [])
      .filter((p: any) => p.formato !== "S")
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
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
