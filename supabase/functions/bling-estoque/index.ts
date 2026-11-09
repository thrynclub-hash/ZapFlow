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
    precoCusto: p.precoCusto ?? null,
    descricaoCurta: p.descricaoCurta || null,
    estoque: p.estoque?.saldoVirtualTotal ?? null,
    situacao: p.situacao,
    formato: p.formato,
    imagem: p.midia?.imagens?.internas?.[0]?.linkMiniatura || p.midia?.imagens?.imagensURL?.[0]?.link || null,
  };
}

// Cria um produto simples no Bling (usado tanto pra produto sem variação
// quanto pra cada variação filha de um produto "V"). imagemUrl vira o
// mesmo formato que já lemos em mapProduto (midia.imagens.imagensURL).
async function createBlingProduto(clientId: string, fields: { nome: string; codigo?: string; preco?: number; precoCusto?: number; descricaoCurta?: string; imagemUrl?: string; formato: "S" | "V"; produtoPaiId?: number }) {
  const payload: any = {
    nome: fields.nome,
    tipo: "P",
    situacao: "A",
    formato: fields.formato,
  };
  if (fields.codigo) payload.codigo = fields.codigo;
  if (fields.preco != null) payload.preco = Number(fields.preco) || 0;
  if (fields.precoCusto != null && fields.precoCusto !== "") payload.precoCusto = Number(fields.precoCusto) || 0;
  if (fields.descricaoCurta) payload.descricaoCurta = fields.descricaoCurta;
  if (fields.imagemUrl) payload.midia = { imagens: { imagensURL: [{ link: fields.imagemUrl }] } };
  if (fields.produtoPaiId) payload.produtoPai = { id: fields.produtoPaiId };

  const res = await blingFetch(clientId, "/produtos", { method: "POST", body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error?.description || `Bling: ${res.status}`);
  return data?.data?.id as number;
}

async function setInitialStock(clientId: string, produtoId: number, quantidade: number) {
  if (!quantidade || quantidade <= 0) return;
  const { channel } = await getValidToken(clientId);
  const depositoId = channel?.credentials?.deposito_id;
  if (!depositoId) return;
  await blingFetch(clientId, "/estoques", {
    method: "POST",
    body: JSON.stringify({ produto: { id: produtoId }, deposito: { id: Number(depositoId) }, operacao: "B", quantidade: Number(quantidade), observacoes: "Estoque inicial via ZapFlow" }),
  }).catch(() => {}); // produto já foi criado; falha de estoque não desfaz a criação
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
      const { nome, codigo, preco, precoCusto, descricaoCurta, imagemUrl, estoque_inicial, variacoes } = body;
      if (!nome) return ok({ ok: false, error: "Nome é obrigatório." });
      try {
        // Produto com variações (tamanho/cor): cria o pai formato "V" (sem
        // código/preço próprio — quem carrega isso é cada variação) e um
        // filho formato "S" por variação, com produtoPai apontando pro pai.
        // Mesmo padrão que a listagem já reconhece (ver mapProduto/filter).
        if (Array.isArray(variacoes) && variacoes.length > 0) {
          const paiId = await createBlingProduto(clientId, { nome, descricaoCurta, imagemUrl, formato: "V" });
          for (const v of variacoes) {
            if (!v.nome) continue;
            const filhoId = await createBlingProduto(clientId, {
              nome: `${nome} - ${v.nome}`, codigo: v.codigo, preco: Number(v.preco) || Number(preco) || 0,
              produtoPaiId: paiId, formato: "S",
            });
            await setInitialStock(clientId, filhoId, Number(v.estoque) || 0);
          }
          return ok({ ok: true, id: paiId });
        }

        const novoId = await createBlingProduto(clientId, { nome, codigo, preco: Number(preco) || 0, precoCusto, descricaoCurta, imagemUrl, formato: "S" });
        await setInitialStock(clientId, novoId, Number(estoque_inicial) || 0);
        return ok({ ok: true, id: novoId });
      } catch (e: any) {
        return ok({ ok: false, error: e?.userMessage || e?.message || String(e) });
      }
    }

    if (action === "update") {
      const { id, nome, codigo, preco, precoCusto, descricaoCurta, imagemUrl } = body;
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

      const payload: any = {
        nome, codigo: codigo || current.codigo, preco: preco != null ? Number(preco) : current.preco,
        tipo: current.tipo, situacao: current.situacao, formato: current.formato,
      };
      if (precoCusto != null && precoCusto !== "") payload.precoCusto = Number(precoCusto);
      if (descricaoCurta != null) payload.descricaoCurta = descricaoCurta;
      if (imagemUrl) payload.midia = { imagens: { imagensURL: [{ link: imagemUrl }] } };

      const res = await blingFetch(clientId, `/produtos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
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
