// ZapFlow — Envio central de mensagens (texto ou imagem)
// Deploy: supabase functions deploy send-message
// (autenticado — precisa de sessão real de Supabase Auth, ver
// CHANGELOG-AUTH-REAL.md)
//
// TODO caminho de envio passa por aqui — disparo "agora" do frontend,
// campanhas agendadas/diárias, automações e follow-ups (esses três
// últimos chamam a função try_consume_daily_send_budget diretamente
// via RPC, pois já rodam com service role dentro do run-automations).
// Isso resolve dois problemas de uma vez:
//   1) zapi_token nunca mais é lido pelo navegador do cliente
//      (SECURITY-FINDINGS-2026-07-01.md item 3)
//   2) o limite de 100 mensagens/dia por número é global de verdade,
//      não "por campanha" — ninguém manda sem passar pelo contador.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

const ZAPI_BASE = "https://api.z-api.io/instances";
const DAILY_CAP = 100;
// Token de Segurança da Conta (Z-API Dashboard > Segurança) — ver nota
// detalhada em zapi-status/index.ts. Header Client-Token != token de instância.
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Bug real corrigido em 2026-07-06: só tratava o prefixo "0" antigo de
// discagem interurbana, mas contatos salvos direto como DDD+número (ex:
// "19997051919", sem código do país — o formato mais comum de import/
// cadastro manual) nunca ganhavam o "55". A Z-API aceita a chamada mesmo
// assim (por isso o Histórico mostrava "enviado"), só que a mensagem não
// roteia pra lugar nenhum de verdade. Número BR sem código do país tem
// 10 (DDD + 8 dígitos) ou 11 (DDD + 9 dígitos) dígitos — com código do
// país vira 12 ou 13. Só prefixa "55" quando ainda não tem.
function formatPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

// Variação de mensagens (spintax) — mesma lógica de run-automations/index.ts.
// {opção1|opção2} escolhe uma aleatoriamente a cada chamada (ex: usado pelo
// disparo de aniversário em Birthdays.jsx, que hoje manda a mesma mensagem
// pra todo mundo selecionado — isso deixa de ser 100% idêntico se quem
// configurou usar a sintaxe). Roda sobre o texto que já chegou (o
// {nome}/{{nome}} de cada tela já foi trocado ANTES de chamar esta função).
function resolveSpintax(text: string): string {
  let prev: string;
  let out = text;
  let guard = 0;
  do {
    prev = out;
    out = out.replace(/\{([^{}]+)\}/g, (_match, group: string) => {
      const options = group.split("|");
      return options[Math.floor(Math.random() * options.length)];
    });
    guard++;
  } while (out !== prev && guard < 10);
  return out;
}

async function sendTextMessage(instanceId: string, token: string, phone: string, message: string) {
  const res = await fetch(`${ZAPI_BASE}/${instanceId}/token/${token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone, message }),
  });
  const bodyText = await res.text();
  // DEBUG temporário (2026-07-06) — diagnosticar caso real de "relatório diz
  // enviado, mas não chega no WhatsApp" mesmo após corrigir formatPhone.
  // Loga o telefone formatado (sem dado sensível de credencial) e o corpo
  // completo da resposta da Z-API, sucesso ou erro.
  console.log("send-message: resposta da Z-API (send-text)", { phone, status: res.status, body: bodyText });
  if (!res.ok) {
    const err = JSON.parse(bodyText || "{}");
    throw new Error(err.message || `Z-API error: ${res.status}`);
  }
  return JSON.parse(bodyText || "{}");
}

async function sendImageMessage(instanceId: string, token: string, phone: string, image: string, caption: string) {
  const res = await fetch(`${ZAPI_BASE}/${instanceId}/token/${token}/send-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone, image, caption }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Z-API error: ${res.status}`);
  }
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: corsHeaders });

    // Client "com identidade do usuário" só pra descobrir quem está chamando
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await adminClient.from("profiles").select("role, client_id").eq("id", userData.user.id).single();
    if (!profile) return new Response(JSON.stringify({ error: "Perfil não encontrado." }), { status: 403, headers: corsHeaders });

    const { number_id, phone, message, image_url, contact_id, campaign_id } = await req.json();
    if (!number_id || !phone || !message) {
      return new Response(JSON.stringify({ error: "number_id, phone e message são obrigatórios." }), { status: 400, headers: corsHeaders });
    }

    const { data: number } = await adminClient.from("client_numbers").select("*").eq("id", number_id).single();
    if (!number) return new Response(JSON.stringify({ error: "Número não encontrado." }), { status: 404, headers: corsHeaders });

    // Defesa em profundidade: cliente só pode mandar pelo próprio número. Admin pode por qualquer um.
    if (profile.role !== "admin" && number.client_id !== profile.client_id) {
      return new Response(JSON.stringify({ error: "Sem permissão para este número." }), { status: 403, headers: corsHeaders });
    }
    if (!number.zapi_instance_id || !number.zapi_token) {
      return new Response(JSON.stringify({ error: "Número sem Z-API configurado." }), { status: 422, headers: corsHeaders });
    }

    // Teto REAL por número (2026-07-15) — antes usava sempre o DAILY_CAP
    // global fixo (100) aqui, então um envio manual avulso ("mandar agora")
    // podia furar um teto mais baixo que o cliente tivesse configurado pro
    // número (ver nota grande em run-automations/index.ts:resolveNumberCap
    // sobre o bloqueio real do número da Hassum).
    const dailyCap = number.daily_send_cap ?? DAILY_CAP;
    const { data: allowed } = await adminClient.rpc("try_consume_daily_send_budget", { p_number_id: number_id, p_daily_cap: dailyCap });
    if (!allowed) {
      if (contact_id) {
        await adminClient.from("message_logs").insert({
          campaign_id: campaign_id ?? null, client_id: number.client_id, contact_id,
          status: "error", error_detail: `Limite diário de ${dailyCap} mensagens atingido para este número.`,
        });
      }
      return new Response(
        JSON.stringify({ error: `LIMITE_DIARIO_ATINGIDO`, message: `Limite de ${dailyCap} mensagens/dia atingido para este número. O restante continua automaticamente amanhã.` }),
        { status: 429, headers: corsHeaders },
      );
    }

    const formattedPhone = formatPhone(String(phone));
    const resolvedMessage = resolveSpintax(message);
    try {
      if (image_url) await sendImageMessage(number.zapi_instance_id, number.zapi_token, formattedPhone, image_url, resolvedMessage);
      else await sendTextMessage(number.zapi_instance_id, number.zapi_token, formattedPhone, resolvedMessage);

      if (contact_id) {
        await adminClient.from("message_logs").insert({
          campaign_id: campaign_id ?? null, client_id: number.client_id, contact_id,
          status: "sent", sent_at: new Date().toISOString(),
        });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (sendErr) {
      // Bug real corrigido em 2026-07-06: a vaga do limite diário era
      // consumida ANTES de saber se o envio ia dar certo, e nunca voltava
      // se a Z-API recusasse depois (Client-Token errado, telefone mal
      // formatado, etc.) — um dia inteiro de tentativas falhas conseguia
      // esgotar o limite de 100/dia sem entregar UMA mensagem sequer.
      await adminClient.rpc("refund_daily_send_budget", { p_number_id: number_id });
      if (contact_id) {
        await adminClient.from("message_logs").insert({
          campaign_id: campaign_id ?? null, client_id: number.client_id, contact_id,
          status: "error", error_detail: String(sendErr),
        });
      }
      return new Response(JSON.stringify({ error: String(sendErr) }), { status: 502, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
