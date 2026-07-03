// ZapFlow — Webhook de mensagens recebidas (Z-API "on-message-received")
// Deploy: supabase functions deploy zapi-webhook --no-verify-jwt
// (público de propósito — quem chama é o servidor da Z-API, não o navegador
// de ninguém; validado formato oficial em developer.z-api.io/webhooks/on-message-received)
//
// Configurar no painel da Z-API, por instância:
//   PUT https://api.z-api.io/instances/{instanceId}/token/{token}/update-webhook-received
//   body: { "value": "https://bhiggyigsrqfabqhutne.functions.supabase.co/zapi-webhook" }
// (ou pelo próprio painel visual da Z-API, campo "Webhook ao receber")
//
// O que faz:
//  1. Loga TODA mensagem recebida em inbound_messages (isso é o que
//     permite follow-up saber "esse contato já respondeu" e destrava
//     a condição has_replied nas automações).
//  2. Roda o mini-fluxo "EU QUERO" -> pergunta turno -> confirma ->
//     notifica o número interno (reply_flows.notify_phone), usando
//     conversation_states como máquina de estado (já existe e já tem
//     RLS correta desde supabase_security_fixes.sql).
//  3. Todo envio feito por este webhook passa pelo mesmo limite diário
//     global (try_consume_daily_send_budget) que o resto do sistema.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const ZAPI_BASE = "https://api.z-api.io/instances";
const DAILY_CAP = 100;

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "55");
}

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (combining marks pós-NFD)
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Casa pelos últimos 8 dígitos — cobre variações de DDI (55) e do 9º dígito
function last8(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.slice(-8);
}

async function sendViaBudget(numberId: string, instanceId: string, token: string, phone: string, message: string) {
  const { data: allowed } = await supabase.rpc("try_consume_daily_send_budget", { p_number_id: numberId, p_daily_cap: DAILY_CAP });
  if (!allowed) {
    console.warn(`Limite diário atingido para número ${numberId}, resposta automática não enviada agora.`);
    return false;
  }
  const res = await fetch(`${ZAPI_BASE}/${instanceId}/token/${token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": token },
    body: JSON.stringify({ phone: formatPhone(phone), message }),
  });
  if (!res.ok) console.error("Erro ao enviar resposta automática:", await res.text().catch(() => ""));
  return res.ok;
}

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json().catch(() => ({}));

    // Ignora eventos que não são mensagem de texto recebida de verdade
    if (payload.type !== "ReceivedCallback" || payload.fromMe || payload.isGroup) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }
    const inboundText = payload.text?.message;
    const inboundPhone = payload.phone;
    const instanceId = payload.instanceId;
    if (!inboundText || !inboundPhone || !instanceId) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "payload sem texto/phone/instanceId" }), { headers: { "Content-Type": "application/json" } });
    }

    const { data: number } = await supabase.from("client_numbers").select("*").eq("zapi_instance_id", instanceId).single();
    if (!number) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "instanceId não corresponde a nenhum número cadastrado" }), { headers: { "Content-Type": "application/json" } });
    }

    // Match do contato pelos últimos 8 dígitos (tolera 55/9º dígito)
    const { data: candidates } = await supabase.from("contacts").select("*").eq("client_id", number.client_id);
    const contact = (candidates ?? []).find((c: any) => last8(c.phone) === last8(inboundPhone));

    // 1. Loga sempre — mesmo sem contato reconhecido, mesmo sem match de fluxo
    await supabase.from("inbound_messages").insert({
      client_id: number.client_id,
      contact_id: contact?.id ?? null,
      number_id: number.id,
      phone: inboundPhone,
      message: inboundText,
    });

    if (!contact) {
      return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: false }), { headers: { "Content-Type": "application/json" } });
    }

    const normalizedText = normalize(inboundText);

    // 2. Opt-out — pedido pra sair da lista. Prioridade sobre qualquer outro
    // fluxo (adicionado em 2026-07-03): antes disso, quem respondia "PARAR"/
    // "SAIR" só ficava logado em inbound_messages e continuava recebendo as
    // próximas campanhas normalmente — provável maior gatilho real de
    // denúncia/bloqueio de número no WhatsApp (mais do que volume puro).
    // Marca status='Inativo' (mesmo campo que já exclui contato de
    // sendCampaignBatch/processFollowUpCampaigns) + tag "Descadastrado" pra
    // distinguir de uma inativação manual, e confirma pro contato.
    const OPT_OUT_KEYWORDS = ["parar", "sair", "descadastrar", "cancelar", "remover", "nao quero mais", "pare de mandar", "stop"];
    const isOptOut = OPT_OUT_KEYWORDS.some((k) => normalizedText === k || normalizedText.includes(k));
    if (isOptOut && contact.status === "Ativo") {
      const tags = new Set(contact.tags ?? []);
      tags.add("Descadastrado");
      await supabase.from("contacts").update({ status: "Inativo", tags: Array.from(tags) }).eq("id", contact.id);
      await sendViaBudget(
        number.id, number.zapi_instance_id, number.zapi_token, contact.phone,
        "Combinado! Você não vai mais receber nossas mensagens. Se mudar de ideia, é só chamar por aqui de novo a qualquer momento.",
      );
      return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, opted_out: true }), { headers: { "Content-Type": "application/json" } });
    }

    // 3. Fluxo "EU QUERO" (se habilitado para este cliente)
    const { data: flow } = await supabase.from("reply_flows").select("*").eq("client_id", number.client_id).single();
    if (!flow || !flow.enabled) {
      return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, reply_flow: "desabilitado" }), { headers: { "Content-Type": "application/json" } });
    }

    // trigger_keyword pode conter várias variações separadas por vírgula
    // (ex: "eu quero, quero, eu qro, qro, bora, quero sim, pode ser") —
    // qualquer uma delas dispara o fluxo. Pedido do usuário: reconhecer
    // "EU QUERO" ou alguma variação, não só o texto exato.
    const keywordVariants = (flow.trigger_keyword || "eu quero")
      .split(",")
      .map((k: string) => normalize(k))
      .filter((k: string) => k.length > 0);
    const matchesKeyword = keywordVariants.some((k: string) => normalizedText.includes(k));

    // Campanha mais recente enviada a este contato (pra associar o estado da conversa)
    const { data: lastLog } = await supabase
      .from("message_logs")
      .select("campaign_id, sent_at")
      .eq("contact_id", contact.id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const campaignId = lastLog?.campaign_id ?? null;

    const { data: state } = await supabase
      .from("conversation_states")
      .select("*")
      .eq("contact_id", contact.id)
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (matchesKeyword && (!state || state.state === "initial")) {
      await supabase.from("conversation_states").upsert(
        { client_id: number.client_id, contact_id: contact.id, campaign_id: campaignId, state: "asked_schedule", updated_at: new Date().toISOString() },
        { onConflict: "contact_id,campaign_id" },
      );
      const msg = (flow.ask_period_message || "").replace("{{nome}}", contact.name || "");
      await sendViaBudget(number.id, number.zapi_instance_id, number.zapi_token, contact.phone, msg);
      return new Response(JSON.stringify({ ok: true, step: "asked_schedule" }), { headers: { "Content-Type": "application/json" } });
    }

    if (state?.state === "asked_schedule") {
      let preference: string | null = null;
      if (normalizedText.includes("manh")) preference = "manha";
      else if (normalizedText.includes("tard")) preference = "tarde";

      if (preference) {
        await supabase.from("conversation_states").update({ state: "confirmed", preference, updated_at: new Date().toISOString() })
          .eq("contact_id", contact.id).eq("campaign_id", campaignId);

        await sendViaBudget(number.id, number.zapi_instance_id, number.zapi_token, contact.phone, flow.confirm_message || "");

        if (flow.notify_phone) {
          const turnoLabel = preference === "manha" ? "manhã" : "tarde";
          const notifyMsg = `🔔 Novo agendamento pelo WhatsApp:\n${contact.name}\n${contact.phone}\nTurno: ${turnoLabel}`;
          await sendViaBudget(number.id, number.zapi_instance_id, number.zapi_token, flow.notify_phone, notifyMsg);
        } else {
          console.warn(`reply_flows.notify_phone não configurado para client_id=${number.client_id} — notificação interna não enviada.`);
        }
        return new Response(JSON.stringify({ ok: true, step: "confirmed", preference }), { headers: { "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, no_flow_action: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro no webhook:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
