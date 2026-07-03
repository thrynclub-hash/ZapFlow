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
//  4. Detecta clique em botão de resposta rápida (campaigns.quick_replies,
//     2026-07-03) e executa a ação configurada pro botão (continuar o
//     fluxo "eu quero", parar o follow-up, ou descadastrar). O FORMATO DO
//     PAYLOAD de clique de botão da Z-API NÃO foi validado ao vivo nesta
//     sessão (nenhum número real ligado ainda) — o código abaixo tenta os
//     formatos documentados publicamente (buttonsResponseMessage /
//     listResponseMessage) e cai de volta pro fluxo de texto normal se não
//     reconhecer o payload. Vale conferir o payload real (console.log já
//     deixado abaixo) assim que o primeiro clique de botão acontecer de
//     verdade, e ajustar extractButtonReply() se o formato divergir.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const ZAPI_BASE = "https://api.z-api.io/instances";
const DAILY_CAP = 100;

// Verificação leve de autenticidade do webhook (2026-07-03) — OPCIONAL, só
// entra em vigor se a env var ZAPI_WEBHOOK_SECRET estiver configurada. Sem
// ela, o comportamento é IDÊNTICO a antes (qualquer chamada é aceita, como
// sempre foi) — não quebra nada que já está funcionando.
//
// Por quê: sem isso, QUALQUER UM que descubra esta URL pode chamar o
// webhook fingindo ser a Z-API — isso poderia gastar o orçamento diário de
// envio do número (100/dia) com respostas automáticas falsas, ou forçar
// opt-out de contatos reais. Z-API (nos planos usados aqui) não assina os
// webhooks que manda, então um segredo na própria URL é a defesa prática
// disponível — pra ativar, defina ZAPI_WEBHOOK_SECRET nas envs da function
// (Supabase Dashboard > Edge Functions > zapi-webhook > Secrets) E atualize
// a URL cadastrada no painel da Z-API ("Webhook ao receber") pra incluir
// "?token=SEU_SEGREDO" no final — sem isso, a Z-API vai levar 401 e as
// mensagens param de ser processadas.
const WEBHOOK_SECRET = Deno.env.get("ZAPI_WEBHOOK_SECRET");
function isAuthorizedWebhookCall(req: Request): boolean {
  if (!WEBHOOK_SECRET) return true;
  return new URL(req.url).searchParams.get("token") === WEBHOOK_SECRET;
}

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

// Mesma ressalva de run-automations/index.ts (sendButtonMessage): formato
// NÃO validado ao vivo, segue a documentação pública da Z-API. Duplicado
// aqui (em vez de importado) porque cada Supabase Edge Function neste
// projeto é publicada isoladamente, sem pasta `_shared` — mesmo padrão já
// usado no resto do arquivo (formatPhone, normalize, etc. também são
// próprios de cada function).
async function sendButtonMessage(
  numberId: string,
  instanceId: string,
  token: string,
  phone: string,
  message: string,
  buttons: Array<{ id: string; label: string }>,
) {
  // Mesmo orçamento diário global do número que todo o resto do sistema usa
  // (try_consume_daily_send_budget) — uma resposta automática com botões
  // não pode furar o limite anti-bloqueio.
  const { data: allowed } = await supabase.rpc("try_consume_daily_send_budget", { p_number_id: numberId, p_daily_cap: DAILY_CAP });
  if (!allowed) {
    console.warn(`Limite diário atingido para número ${numberId}, mensagem com botões não enviada agora.`);
    return false;
  }
  const res = await fetch(`${ZAPI_BASE}/${instanceId}/token/${token}/send-button-list`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": token },
    body: JSON.stringify({
      phone: formatPhone(phone),
      message,
      buttonList: { buttons: buttons.map((b) => ({ id: b.id, label: b.label })) },
    }),
  });
  if (!res.ok) console.error("Erro ao enviar mensagem com botões:", await res.text().catch(() => ""));
  return res.ok;
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

// Descadastro completo — reusado tanto pela palavra-chave (PARAR/SAIR/...)
// quanto por um botão configurado com action='opt_out'.
async function optOutContact(contact: any, number: any) {
  const tags = new Set(contact.tags ?? []);
  tags.add("Descadastrado");
  await supabase.from("contacts").update({ status: "Inativo", tags: Array.from(tags) }).eq("id", contact.id);
  await sendViaBudget(
    number.id, number.zapi_instance_id, number.zapi_token, contact.phone,
    "Combinado! Você não vai mais receber nossas mensagens. Se mudar de ideia, é só chamar por aqui de novo a qualquer momento.",
  );
}

// Tenta reconhecer um clique em botão de resposta rápida (send-button-list)
// nos formatos documentados publicamente da Z-API. NÃO VALIDADO AO VIVO —
// ver comentário no topo do arquivo. Retorna null se o payload não bater
// com nenhum dos formatos conhecidos (nesse caso, o fluxo de texto normal
// segue tratando o payload, sem quebrar nada do que já funcionava).
function extractButtonReply(payload: any): { buttonId: string | null; text: string | null } | null {
  const buttonsResp = payload?.buttonsResponseMessage;
  if (buttonsResp) {
    return { buttonId: buttonsResp.buttonId ?? null, text: buttonsResp.message ?? null };
  }
  const listResp = payload?.listResponseMessage;
  if (listResp) {
    return { buttonId: listResp.selectedRowId ?? listResp.buttonId ?? null, text: listResp.title ?? listResp.message ?? null };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  try {
    if (!isAuthorizedWebhookCall(req)) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const payload = await req.json().catch(() => ({}));

    // Ignora eventos que não são mensagem de texto recebida de verdade
    if (payload.type !== "ReceivedCallback" || payload.fromMe || payload.isGroup) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }
    // Clique em botão de resposta rápida (se for esse o tipo de payload) —
    // ver extractButtonReply() e o aviso de "não validado ao vivo" no topo
    // do arquivo. Se não for um clique de botão reconhecido, buttonReply
    // fica null e tudo segue exatamente como antes (texto normal).
    const buttonReply = extractButtonReply(payload);
    const inboundText = buttonReply?.text || payload.text?.message;
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

    // 1. Loga sempre — mesmo sem contato reconhecido, mesmo sem match de
    // fluxo. Isso vale IGUAL pra clique de botão: é o que garante que o
    // follow-up automático nunca dispara pra quem já interagiu (ver
    // processFollowUpCampaigns em run-automations, que checa inbound_messages
    // desde o envio da campanha-base) — independente da ação configurada
    // pro botão, tocar em qualquer um deles já conta como resposta.
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

    // Campanha mais recente enviada a este contato (pra associar o estado da
    // conversa, e também pra resolver a ação configurada do botão clicado).
    const { data: lastLog } = await supabase
      .from("message_logs")
      .select("campaign_id, sent_at")
      .eq("contact_id", contact.id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const campaignId = lastLog?.campaign_id ?? null;

    // 2a. Resposta a uma sub-pergunta de "ask_choice" (2026-07-03) — se o
    // contato já estava esperando escolher entre as sub-opções (ver
    // conversation_states.state === "awaiting_choice" abaixo), este clique é
    // a resposta a ISSO, não um clique novo nos botões principais da
    // campanha. Checado ANTES do matching normal de quick_replies pra não
    // confundir os dois níveis.
    if (buttonReply && campaignId) {
      const { data: choiceState } = await supabase
        .from("conversation_states")
        .select("*")
        .eq("contact_id", contact.id)
        .eq("campaign_id", campaignId)
        .eq("state", "awaiting_choice")
        .maybeSingle();

      if (choiceState) {
        const { data: sourceCampaign } = await supabase.from("campaigns").select("quick_replies").eq("id", campaignId).maybeSingle();
        const topOptions: Array<{ id: string; label: string; action: string; question?: string; options?: Array<{ id: string; label: string }> }> =
          Array.isArray(sourceCampaign?.quick_replies) ? sourceCampaign.quick_replies : [];
        const askChoiceOption = topOptions.find((o) => o.action === "ask_choice" && Array.isArray(o.options));
        const subMatch = askChoiceOption?.options?.find(
          (o) => (buttonReply.buttonId && o.id === buttonReply.buttonId) || (buttonReply.text && o.label === buttonReply.text),
        );

        if (subMatch) {
          await supabase.from("conversation_states").update({ state: "confirmed", preference: subMatch.label, updated_at: new Date().toISOString() })
            .eq("contact_id", contact.id).eq("campaign_id", campaignId);

          await sendViaBudget(
            number.id, number.zapi_instance_id, number.zapi_token, contact.phone,
            "Combinado! Já anotamos e alguém vai te chamar por aqui pra continuar.",
          );

          const { data: flowForNotify } = await supabase.from("reply_flows").select("notify_phone").eq("client_id", number.client_id).maybeSingle();
          if (flowForNotify?.notify_phone) {
            const notifyMsg = `🔔 Escolha via botão:\n${contact.name}\n${contact.phone}\nEscolheu: ${subMatch.label}`;
            await sendViaBudget(number.id, number.zapi_instance_id, number.zapi_token, flowForNotify.notify_phone, notifyMsg);
          } else {
            console.warn(`reply_flows.notify_phone não configurado para client_id=${number.client_id} — notificação de escolha não enviada.`);
          }
          return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, button_action: "ask_choice_answered", choice: subMatch.label }), { headers: { "Content-Type": "application/json" } });
        }
        // Clique não bateu com nenhuma sub-opção conhecida (ex: pessoa
        // digitou texto livre em vez de tocar num botão) — cai pro fluxo
        // normal abaixo, sem travar a conversa.
      }
    }

    // 2b. Ação configurada do botão clicado (campaigns.quick_replies) — tem
    // prioridade sobre o resto do fluxo, porque é uma escolha explícita e
    // sem ambiguidade da pessoa (diferente de tentar adivinhar por palavra-chave).
    let forceTriggerFlow = false;
    if (buttonReply && campaignId) {
      const { data: sourceCampaign } = await supabase.from("campaigns").select("quick_replies").eq("id", campaignId).maybeSingle();
      const options: Array<{ id: string; label: string; action: string; question?: string; options?: Array<{ id: string; label: string }> }> =
        Array.isArray(sourceCampaign?.quick_replies) ? sourceCampaign.quick_replies : [];
      const matched = options.find((o) => (buttonReply.buttonId && o.id === buttonReply.buttonId) || (buttonReply.text && o.label === buttonReply.text));

      if (matched?.action === "opt_out" && contact.status === "Ativo") {
        await optOutContact(contact, number);
        return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, button_action: "opt_out" }), { headers: { "Content-Type": "application/json" } });
      }
      if (matched?.action === "stop_followup") {
        // O follow-up já para sozinho por causa do insert em inbound_messages
        // acima (ver comentário lá) — aqui só confirma pro contato.
        await sendViaBudget(
          number.id, number.zapi_instance_id, number.zapi_token, contact.phone,
          "Combinado! Você não vai mais receber esse tipo de mensagem.",
        );
        return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, button_action: "stop_followup" }), { headers: { "Content-Type": "application/json" } });
      }
      if (matched?.action === "ask_choice" && matched.question && Array.isArray(matched.options) && matched.options.length > 0) {
        // Manda a 2ª pergunta com as sub-opções como botões, e marca que
        // este contato está esperando escolher uma delas (ver 2a acima).
        await supabase.from("conversation_states").upsert(
          { client_id: number.client_id, contact_id: contact.id, campaign_id: campaignId, state: "awaiting_choice", updated_at: new Date().toISOString() },
          { onConflict: "contact_id,campaign_id" },
        );
        await sendButtonMessage(number.id, number.zapi_instance_id, number.zapi_token, contact.phone, matched.question, matched.options);
        return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, button_action: "ask_choice_asked" }), { headers: { "Content-Type": "application/json" } });
      }
      if (matched?.action === "trigger_flow") forceTriggerFlow = true;
    }

    // 3. Opt-out — pedido pra sair da lista, por texto digitado (prioridade
    // sobre o resto do fluxo de texto, adicionado em 2026-07-03): antes
    // disso, quem respondia "PARAR"/"SAIR" só ficava logado em
    // inbound_messages e continuava recebendo as próximas campanhas
    // normalmente — provável maior gatilho real de denúncia/bloqueio de
    // número no WhatsApp (mais do que volume puro).
    const OPT_OUT_KEYWORDS = ["parar", "sair", "descadastrar", "cancelar", "remover", "nao quero mais", "pare de mandar", "stop"];
    const isOptOut = !buttonReply && OPT_OUT_KEYWORDS.some((k) => normalizedText === k || normalizedText.includes(k));
    if (isOptOut && contact.status === "Ativo") {
      await optOutContact(contact, number);
      return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, opted_out: true }), { headers: { "Content-Type": "application/json" } });
    }

    // 4. Fluxo "EU QUERO" (se habilitado para este cliente)
    const { data: flow } = await supabase.from("reply_flows").select("*").eq("client_id", number.client_id).single();
    if (!flow || !flow.enabled) {
      return new Response(JSON.stringify({ ok: true, logged: true, contact_matched: true, reply_flow: "desabilitado" }), { headers: { "Content-Type": "application/json" } });
    }

    // trigger_keyword pode conter várias variações separadas por vírgula
    // (ex: "eu quero, quero, eu qro, qro, bora, quero sim, pode ser") —
    // qualquer uma delas dispara o fluxo. Pedido do usuário: reconhecer
    // "EU QUERO" ou alguma variação, não só o texto exato. Um botão com
    // action='trigger_flow' também dispara, mesmo que o texto do botão não
    // bata com nenhuma keyword configurada (forceTriggerFlow).
    const keywordVariants = (flow.trigger_keyword || "eu quero")
      .split(",")
      .map((k: string) => normalize(k))
      .filter((k: string) => k.length > 0);
    const matchesKeyword = forceTriggerFlow || keywordVariants.some((k: string) => normalizedText.includes(k));

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
