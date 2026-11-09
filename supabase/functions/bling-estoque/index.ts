// ZapFlow — Estoque (ERP) do painel do cliente: lista, cria, edita, exclui
// e ajusta estoque de produtos — tudo pelo ZapFlow, nunca abrindo o Bling.
// O cliente não sabe (nem precisa saber) que por trás é o Bling.
//
// Deploy: supabase functions deploy bling-estoque
// Requer JWT do usuário.
//
// BUG DE SEGURANÇA corrigido em 2026-11-09: antes esta function lia
// marketplace_channels via supabaseAsUser, dependendo de uma policy RLS
// "Client select own" que dava SELECT na linha inteira (incluindo
// access_token/refresh_token/client_secret) pra qualquer cliente que
// chamasse supabase.from('marketplace_channels').select('*') direto pelo
// navegador — RLS é row-level, não esconde colunas. Agora resolve o
// client_id via profiles (policy própria, segura) e lê marketplace_channels
// só por service role; a policy de SELECT direto foi removida.
//
// BUG REAL corrigido em 2026-11-09 (mais cedo): access_token do Bling
// expira em 6h e não existia refresh automático — agora em qualquer 401,
// tenta refresh com refresh_token + BLING_CLIENT_ID/SECRET e grava de volta.
//
// Requer secrets: BLING_CLIENT_ID, BLING_CLIENT_SECRET (app Bling, não por
// cliente — central de apps do Bling > sua integração).

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const blingClientId = Deno.env.get("BLING_CLIENT_ID") ?? "";
const blingClientSecret = Deno.env.get("BLING_CLIENT_SECRET") ?? "";
const supabaseService = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: Record<string, unknown>) {
  // 200 de propósito mesmo em erro — supabase.functions.invoke() trata
  // status != 2xx como erro de transporte e esconde o body real.
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function refreshBlingToken(refreshToken: string) {
  const basic = btoa(`${blingClientId}:${blingClientSecret}`);
  const res = await fetch("https://bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = typeof data?.error === "string" ? data.error : data?.error?.message;
    throw new Error(data?.error_description || errMsg || `refresh falhou: ${res.status}`);
  }
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

// Resolve o canal Bling ativo do client_id do chamador e devolve um
// access_token válido, renovando (e persistindo) se precisar.
async function getValidToken(clientId: string) {
  const { data: channel } = await supabaseService
    .from("marketplace_channels")
    .select("id, credentials")
    .eq("client_id", clientId)
    .eq("platform", "bling")
    .eq("active", true)
    .maybeSingle();
  if (!channel) return { channel: null, accessToken: null, error: "sem canal Bling configurado" };

  let accessToken = channel.credentials?.access_token;
  const refreshToken = channel.credentials?.refresh_token;
  if (!accessToken) return { channel, accessToken: null, error: "token Bling ausente" };

  return { channel, accessToken, refreshToken, error: null };
}

async function doRefresh(channel: any, refreshToken: string) {
  const refreshed = await refreshBlingToken(refreshToken);
  await supabaseService
    .from("marketplace_channels")
    .update({ credentials: { ...channel.credentials, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token } })
    .eq("id", channel.id);
  return refreshed.access_token as string;
}

// Chama o Bling com retry automático em 401 (refresh de token).
async function blingFetch(clientId: string, path: string, init: RequestInit = {}) {
  const { channel, accessToken, refreshToken, error } = await getValidToken(clientId);
  if (error || !accessToken) throw { userMessage: error === "sem canal Bling configurado" ? null : `Token do Bling: ${error}`, notConnected: error === "sem canal Bling configurado" };

  const headers = { ...(init.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  let res = await fetch(`https://api.bling.com.br/Api/v3${path}`, { ...init, headers });

  if (res.status === 401) {
    if (!refreshToken || !blingClientId || !blingClientSecret) {
      throw { userMessage: "Token do Bling expirou e não há como renovar sozinho — precisa reconectar em Admin > Integrações." };
    }
    const newToken = await doRefresh(channel, refreshToken);
    res = await fetch(`https://api.bling.com.br/Api/v3${path}`, { ...init, headers: { ...headers, Authorization: `Bearer ${newToken}` } });
  }
  return res;
}

function mapProduto(p: any) {
  return {
    id: p.id,
    nome: p.nome,
    codigo: p.codigo || null,
    preco: p.preco ?? 0,
    estoque: p.estoque?.saldoVirtualTotal ?? null,
    situacao: p.situacao,
    formato: p.formato,
    imagem: p.midia?.imagens?.internas?.[0]?.linkMiniatura || p.midia?.imagens?.imagensURL?.[0]?.link || null,
  };
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
    const action = body?.action || "list";

    if (action === "list") {
      let res;
      try {
        res = await blingFetch(clientId, "/produtos?pagina=1&limite=100&situacao=A");
      } catch (e: any) {
        if (e?.notConnected) return ok({ ok: true, connected: false, reason: "sem canal Bling configurado" });
        return ok({ ok: false, error: e?.userMessage || String(e) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return ok({ ok: false, error: data?.error?.message || `Bling: ${res.status}` });
      // Formato "S" com produtoPai = variação individual (cor/tamanho) de
      // um produto "V" — escondida da lista pra não duplicar linha; o
      // produto "V" pai é quem aparece (mesmo que preço/estoque próprio
      // dele venha zerado no Bling nesse caso — variação é quem carrega).
      const produtos = (data.data ?? []).filter((p: any) => !(p.formato === "S" && p.produtoPai)).map(mapProduto);
      return ok({ ok: true, connected: true, produtos });
    }

    if (action === "create") {
      const { nome, codigo, preco, estoque_inicial } = body;
      if (!nome) return ok({ ok: false, error: "Nome é obrigatório." });
      let res;
      try {
        res = await blingFetch(clientId, "/produtos", {
          method: "POST",
          body: JSON.stringify({ nome, codigo: codigo || undefined, preco: Number(preco) || 0, tipo: "P", situacao: "A", formato: "S" }),
        });
      } catch (e: any) {
        return ok({ ok: false, error: e?.userMessage || String(e) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return ok({ ok: false, error: data?.error?.message || data?.error?.description || `Bling: ${res.status}` });
      const novoId = data?.data?.id;

      if (novoId && Number(estoque_inicial) > 0) {
        const { channel } = await getValidToken(clientId);
        const depositoId = channel?.credentials?.deposito_id;
        if (depositoId) {
          await blingFetch(clientId, "/estoques", {
            method: "POST",
            body: JSON.stringify({ produto: { id: novoId }, deposito: { id: Number(depositoId) }, operacao: "B", quantidade: Number(estoque_inicial), observacoes: "Estoque inicial via ZapFlow" }),
          }).catch(() => {}); // produto já foi criado; falha de estoque não desfaz a criação
        }
      }
      return ok({ ok: true, id: novoId });
    }

    if (action === "update") {
      const { id, nome, codigo, preco } = body;
      if (!id || !nome) return ok({ ok: false, error: "id e nome são obrigatórios." });
      // Bling v3 exige payload completo no PUT (não aceita parcial) —
      // busca o produto atual primeiro pra preencher tipo/situacao/formato.
      let getRes;
      try {
        getRes = await blingFetch(clientId, `/produtos/${id}`);
      } catch (e: any) {
        return ok({ ok: false, error: e?.userMessage || String(e) });
      }
      const current = (await getRes.json().catch(() => ({})))?.data;
      if (!getRes.ok || !current) return ok({ ok: false, error: "Produto não encontrado no Bling." });

      const res = await blingFetch(clientId, `/produtos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ nome, codigo: codigo || current.codigo, preco: preco != null ? Number(preco) : current.preco, tipo: current.tipo, situacao: current.situacao, formato: current.formato }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return ok({ ok: false, error: data?.error?.message || `Bling: ${res.status}` });
      return ok({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) return ok({ ok: false, error: "id é obrigatório." });
      let res;
      try {
        res = await blingFetch(clientId, `/produtos/${id}`, { method: "DELETE" });
      } catch (e: any) {
        return ok({ ok: false, error: e?.userMessage || String(e) });
      }
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        return ok({ ok: false, error: data?.error?.message || `Bling: ${res.status}` });
      }
      return ok({ ok: true });
    }

    if (action === "adjust_stock") {
      const { id, quantidade } = body;
      if (!id || quantidade == null) return ok({ ok: false, error: "id e quantidade são obrigatórios." });
      const { channel } = await getValidToken(clientId);
      const depositoId = channel?.credentials?.deposito_id;
      if (!depositoId) return ok({ ok: false, error: "Depósito padrão não configurado — fale com o suporte." });
      let res;
      try {
        // operacao "B" = balanço: define a quantidade absoluta (não soma).
        res = await blingFetch(clientId, "/estoques", {
          method: "POST",
          body: JSON.stringify({ produto: { id: Number(id) }, deposito: { id: Number(depositoId) }, operacao: "B", quantidade: Number(quantidade), observacoes: "Ajuste manual via ZapFlow" }),
        });
      } catch (e: any) {
        return ok({ ok: false, error: e?.userMessage || String(e) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return ok({ ok: false, error: data?.error?.message || `Bling: ${res.status}` });
      return ok({ ok: true });
    }

    return ok({ ok: false, error: `Ação desconhecida: ${action}` });
  } catch (e) {
    return ok({ ok: false, error: String(e) });
  }
});
