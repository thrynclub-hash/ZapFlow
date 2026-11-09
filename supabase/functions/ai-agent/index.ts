// ZapFlow — Agente de IA conversacional (módulo opcional, reforma ERP+IA
// 2026-11-07, inspirado no vocero-crm: conversa natural, não mensagem
// pronta — decide sozinho quando consultar estoque, agendar, avisar
// a equipe).
// Deploy: supabase functions deploy ai-agent --no-verify-jwt
// (chamada só server-to-server, por zapi-webhook, nunca pelo navegador)
//
// ANTHROPIC_API_KEY configurada em produção desde 2026-11-08 — zapi-webhook
// já roteia pra cá de verdade quando modules.ia_agent=true (ver
// zapi-webhook/index.ts linha ~440). Lisa La Belle usa isto ao vivo.
//
// Só é chamado quando clients.modules->>'ia_agent' = 'true' — clientes
// sem esse módulo (Hassum, Sodie hoje) continuam 100% no fluxo de regra
// antigo em zapi-webhook, sem nenhuma mudança de comportamento.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = "claude-sonnet-5-5";

const ZAPI_BASE = "https://api.z-api.io/instances";
const DAILY_CAP = 100;
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

const blingClientId = Deno.env.get("BLING_CLIENT_ID") ?? "";
const blingClientSecret = Deno.env.get("BLING_CLIENT_SECRET") ?? "";

// BUG REAL corrigido em 2026-11-09: check_stock/sell_product só liam a
// tabela local `products`, mas a Lisa La Belle (única cliente com o
// Agente de IA ativo até agora) usa Bling como catálogo — o agente nunca
// achava produto nenhum dela. Helpers Bling duplicados de bling-estoque
// (mesmo padrão sem pasta _shared já usado em todo o resto do projeto),
// adaptados pra rodar 100% server-side (ai-agent já é service role, sem
// JWT de usuário pra resolver — recebe client_id direto no payload).
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
  return data as { access_token: string; refresh_token: string };
}

async function getBlingChannel(clientId: string) {
  const { data } = await supabase.from("marketplace_channels").select("id, credentials").eq("client_id", clientId).eq("platform", "bling").eq("active", true).maybeSingle();
  return data;
}

async function blingFetch(clientId: string, channel: any, path: string, init: RequestInit = {}) {
  let accessToken = channel.credentials?.access_token;
  const headers = { ...(init.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  let res = await fetch(`https://api.bling.com.br/Api/v3${path}`, { ...init, headers });
  if (res.status === 401 && channel.credentials?.refresh_token && blingClientId && blingClientSecret) {
    const refreshed = await refreshBlingToken(channel.credentials.refresh_token);
    await supabase.from("marketplace_channels").update({ credentials: { ...channel.credentials, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token } }).eq("id", channel.id);
    res = await fetch(`https://api.bling.com.br/Api/v3${path}`, { ...init, headers: { ...headers, Authorization: `Bearer ${refreshed.access_token}` } });
  }
  return res;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Duplicado de zapi-webhook/send-message de propósito — cada Edge
// Function deste projeto é publicada isolada, sem pasta `_shared`
// (mesmo padrão já usado em todo o resto do código).
function formatPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

async function sendViaBudget(number: any, phone: string, message: string) {
  if (number.active === false) return false;
  const dailyCap = number.daily_send_cap ?? DAILY_CAP;
  const { data: allowed } = await supabase.rpc("try_consume_daily_send_budget", { p_number_id: number.id, p_daily_cap: dailyCap });
  if (!allowed) return false;
  const res = await fetch(`${ZAPI_BASE}/${number.zapi_instance_id}/token/${number.zapi_token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone: formatPhone(phone), message }),
  });
  if (!res.ok) console.error("ai-agent: erro ao enviar resposta:", await res.text().catch(() => ""));
  return res.ok;
}

// Ferramentas disponíveis pro agente — montadas por cliente conforme
// clients.modules (ex: cliente sem módulo de agenda nunca vê a
// ferramenta book_appointment, então o modelo nunca tenta usá-la).
function buildTools(modules: Record<string, boolean>) {
  const tools: any[] = [];
  if (modules.estoque) {
    tools.push({
      name: "check_stock",
      description: "Consulta se um produto existe e quantas unidades tem em estoque, pelo nome (busca parcial).",
      input_schema: {
        type: "object",
        properties: { product_name: { type: "string", description: "Nome ou parte do nome do produto" } },
        required: ["product_name"],
      },
    });
    tools.push({
      name: "sell_product",
      description: "Registra a venda de um produto: baixa a quantidade do estoque e avisa a equipe da loja. Só chame depois de confirmar com o cliente que ele quer comprar.",
      input_schema: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "id do produto (retornado por check_stock)" },
          qty: { type: "integer", description: "quantidade vendida" },
        },
        required: ["product_id", "qty"],
      },
    });
  }
  if (modules.agenda) {
    tools.push({
      name: "book_appointment",
      description: "Agenda um horário pro cliente. Use depois de confirmar data/hora e o motivo com ele.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "resumo do agendamento (ex: 'Corte de cabelo', 'Retirada de bolo')" },
          starts_at: { type: "string", description: "data/hora ISO 8601 (ex: 2026-11-10T15:00:00-03:00)" },
        },
        required: ["title", "starts_at"],
      },
    });
  }
  tools.push({
    name: "notify_staff",
    description: "Manda um aviso curto pra equipe da loja (pelo WhatsApp interno configurado). Use pra qualquer coisa que um humano precise saber ou decidir.",
    input_schema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  });
  return tools;
}

async function queuePrintJob(clientId: string, title: string, lines: string[]) {
  await supabase.from("print_jobs").insert({ client_id: clientId, kind: "receipt", title, lines });
}

async function runTool(name: string, input: any, ctx: { clientId: string; contactId: string | null; notifyPhone: string | null; number: any; modules: Record<string, boolean> }) {
  if (name === "check_stock") {
    const channel = await getBlingChannel(ctx.clientId);
    if (channel) {
      const res = await blingFetch(ctx.clientId, channel, "/produtos?pagina=1&limite=100&situacao=A");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: "não consegui consultar o estoque agora" };
      const q = String(input.product_name || "").toLowerCase();
      const produtos = (data.data ?? [])
        .filter((p: any) => !(p.formato === "S" && p.produtoPai) && p.nome.toLowerCase().includes(q))
        .slice(0, 5)
        .map((p: any) => ({ id: p.id, name: p.nome, stock_qty: p.estoque?.saldoVirtualTotal ?? null, unit_price: p.preco ?? null }));
      return { products: produtos };
    }
    const { data } = await supabase
      .from("products")
      .select("id, name, stock_qty, unit_price")
      .eq("client_id", ctx.clientId)
      .eq("active", true)
      .ilike("name", `%${input.product_name}%`)
      .limit(5);
    return { products: data || [] };
  }
  if (name === "sell_product") {
    const channel = await getBlingChannel(ctx.clientId);
    if (channel) {
      const getRes = await blingFetch(ctx.clientId, channel, `/produtos/${input.product_id}`);
      const current = (await getRes.json().catch(() => ({})))?.data;
      if (!getRes.ok || !current) return { error: "produto não encontrado" };
      const currentStock = current.estoque?.saldoVirtualTotal ?? 0;
      if (currentStock < input.qty) return { error: "estoque insuficiente", stock_qty: currentStock };
      const depositoId = channel.credentials?.deposito_id;
      if (!depositoId) return { error: "depósito não configurado, avise o suporte" };
      const newQty = currentStock - input.qty;
      const stockRes = await blingFetch(ctx.clientId, channel, "/estoques", {
        method: "POST",
        body: JSON.stringify({ produto: { id: Number(input.product_id) }, deposito: { id: Number(depositoId) }, operacao: "B", quantidade: newQty, observacoes: "Venda via Agente de IA" }),
      });
      if (!stockRes.ok) return { error: "não consegui registrar a venda agora" };
      if (ctx.notifyPhone) {
        await sendViaBudget(ctx.number, ctx.notifyPhone, `🛒 Venda via IA: ${input.qty}x ${current.nome} (restam ${newQty} em estoque).`);
      }
      if (ctx.modules.auto_print) {
        await queuePrintJob(ctx.clientId, "Comanda de venda", [
          `${input.qty}x ${current.nome}`,
          current.preco ? `Valor unit.: R$ ${Number(current.preco).toFixed(2)}` : "",
          `Total: R$ ${(Number(current.preco || 0) * input.qty).toFixed(2)}`,
        ].filter(Boolean));
      }
      return { ok: true, remaining_stock: newQty };
    }

    const { data: product } = await supabase.from("products").select("*").eq("id", input.product_id).eq("client_id", ctx.clientId).single();
    if (!product) return { error: "produto não encontrado" };
    if (product.stock_qty < input.qty) return { error: "estoque insuficiente", stock_qty: product.stock_qty };
    await supabase.from("products").update({ stock_qty: product.stock_qty - input.qty }).eq("id", product.id);
    await supabase.from("stock_movements").insert({
      client_id: ctx.clientId, product_id: product.id, qty_change: -input.qty,
      reason: "ia_agent_sale", contact_id: ctx.contactId,
    });
    if (ctx.notifyPhone) {
      await sendViaBudget(ctx.number, ctx.notifyPhone, `🛒 Venda via IA: ${input.qty}x ${product.name} (restam ${product.stock_qty - input.qty} em estoque).`);
    }
    if (ctx.modules.auto_print) {
      await queuePrintJob(ctx.clientId, "Comanda de venda", [
        `${input.qty}x ${product.name}`,
        product.unit_price ? `Valor unit.: R$ ${Number(product.unit_price).toFixed(2)}` : "",
        `Total: R$ ${(Number(product.unit_price || 0) * input.qty).toFixed(2)}`,
      ].filter(Boolean));
    }
    return { ok: true, remaining_stock: product.stock_qty - input.qty };
  }
  if (name === "book_appointment") {
    await supabase.from("appointments").insert({
      client_id: ctx.clientId, contact_id: ctx.contactId,
      title: input.title, starts_at: input.starts_at,
    });
    if (ctx.notifyPhone) {
      await sendViaBudget(ctx.number, ctx.notifyPhone, `📅 Novo agendamento via IA: ${input.title} em ${input.starts_at}.`);
    }
    return { ok: true };
  }
  if (name === "notify_staff") {
    if (ctx.notifyPhone) await sendViaBudget(ctx.number, ctx.notifyPhone, `🔔 ${input.message}`);
    return { ok: true };
  }
  return { error: "ferramenta desconhecida" };
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Checa se agora está dentro do horário de atendimento configurado pelo
// cliente (reply_flows.ai_business_hours). Sem config nenhuma = sempre
// aberto (comportamento anterior, não quebra quem não configurou ainda).
function isWithinBusinessHours(businessHours: Record<string, { start: string; end: string }> | null, timezone: string): boolean {
  if (!businessHours || Object.keys(businessHours).length === 0) return true;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone || "America/Sao_Paulo" }));
  const todayKey = WEEKDAY_KEYS[now.getDay()];
  const todayHours = businessHours[todayKey];
  if (!todayHours?.start || !todayHours?.end) return false; // dia sem horário definido = fechado
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = todayHours.start.split(":").map(Number);
  const [endH, endM] = todayHours.end.split(":").map(Number);
  return nowMinutes >= startH * 60 + startM && nowMinutes <= endH * 60 + endM;
}

async function callAnthropic(system: string, messages: any[], tools: any[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, system, messages, tools }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), { status: 500, headers: corsHeaders });
    }
    const { client_id, number, contact, message } = await req.json();
    if (!client_id || !number || !contact || !message) {
      return new Response(JSON.stringify({ error: "client_id, number, contact e message são obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    const { data: client } = await supabase.from("clients").select("name, vertical, modules").eq("id", client_id).single();
    const modules = client?.modules || {};
    const { data: flow } = await supabase.from("reply_flows").select("notify_phone, ai_business_hours, ai_handoff_message, ai_timezone").eq("client_id", client_id).single();
    const notifyPhone = flow?.notify_phone || null;

    // Handoff humano por horário (2026-11-09): fora do horário configurado,
    // nem chama o modelo — só avisa o cliente que vai demorar e notifica a
    // equipe, igual um atendente real faria. Economiza chamada de IA à toa
    // e evita o agente prometer algo fora de hora de funcionamento.
    if (!isWithinBusinessHours(flow?.ai_business_hours || null, flow?.ai_timezone || "America/Sao_Paulo")) {
      const handoffMessage = flow?.ai_handoff_message || "Nosso atendimento automático está fora do horário agora. Já avisei a equipe, te respondem assim que possível!";
      await sendViaBudget(number, contact.phone, handoffMessage);
      if (notifyPhone) await sendViaBudget(number, notifyPhone, `🔔 Mensagem fora do horário de ${contact.name || contact.phone}: "${message}"`);
      return new Response(JSON.stringify({ ok: true, reply: handoffMessage, handoff: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Contexto curto: últimas mensagens recebidas deste contato (sem
    // histórico de saída ainda — ver limitação no README do módulo).
    // ponytail: janela de contexto simples (só inbound), suficiente pra
    // MVP; se a conversa ficar confusa sem ver as próprias respostas,
    // trocar por uma tabela de conversation_messages com os dois lados.
    const { data: history } = await supabase
      .from("inbound_messages")
      .select("message, created_at")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(10);
    const recent = (history || []).reverse().map((h: any) => h.message).filter((m: string) => m !== message);

    const system = `Você é o atendente virtual da ${client?.name || "empresa"} (${client?.vertical || "negócio"}), conversando pelo WhatsApp com ${contact.name || "um cliente"}.
Converse como um humano de verdade conversaria — natural, direto, sem parecer script. Nunca mande mensagem robótica ou lista de opções numeradas.
Use as ferramentas disponíveis quando precisar checar estoque, registrar uma venda ou marcar um horário — não invente disponibilidade ou preço sem checar.
Se o cliente pedir pra falar com uma pessoa/atendente, ou perguntar algo que você não tem certeza, use notify_staff e avise o cliente que a equipe foi chamada.
Responda sempre em português do Brasil, em 1-3 frases curtas (é WhatsApp, não e-mail).`;

    const tools = buildTools(modules);
    const messages: any[] = [
      ...recent.map((m: string) => ({ role: "user", content: m })),
      { role: "user", content: message },
    ];

    let finalText = "";
    for (let turn = 0; turn < 5; turn++) {
      const response = await callAnthropic(system, messages, tools);
      const toolUses = (response.content || []).filter((b: any) => b.type === "tool_use");
      const textBlocks = (response.content || []).filter((b: any) => b.type === "text");
      finalText = textBlocks.map((b: any) => b.text).join(" ").trim();

      if (toolUses.length === 0) break;

      messages.push({ role: "assistant", content: response.content });
      const toolResults = [];
      for (const tu of toolUses) {
        const result = await runTool(tu.name, tu.input, { clientId: client_id, contactId: contact.id, notifyPhone, number, modules });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: toolResults });
    }

    if (finalText) await sendViaBudget(number, contact.phone, finalText);

    return new Response(JSON.stringify({ ok: true, reply: finalText }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-agent erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
