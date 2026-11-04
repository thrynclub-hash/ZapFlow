// ZapFlow — Webhook da API oficial da Meta (Cloud API/WABA). Fase 2, Phase 6
// (piloto, META-03) — SEPARADO do zapi-webhook (payload e auth diferentes),
// nunca toca client_numbers/contacts/message_logs da V1 Z-API.
//
// ponytail: SCAFFOLD. Sem credencial Meta real ainda (precisa app Meta
// Business + WABA + verificação de negócio) — não testado ao vivo. O
// handshake GET (verificação de webhook) é lógica real e funciona sem
// credencial nenhuma, só com o secret que você escolher. O POST (receber
// mensagem) segue o formato documentado da Cloud API mas não foi validado
// contra um payload real. Não referenciado por nenhum outro arquivo —
// deploy não quebra nada existente, mas também não faz nada sozinho até
// ser configurado no painel da Meta com uma WABA de teste.
//
// Deploy: supabase functions deploy meta-webhook --no-verify-jwt
// Configurar no painel Meta (App > WhatsApp > Configuration > Webhook):
//   Callback URL: https://<seu-projeto>.functions.supabase.co/meta-webhook
//   Verify token: o mesmo valor de META_WEBHOOK_VERIFY_TOKEN abaixo
//
// Requer secrets (nenhum existe ainda):
//   META_WEBHOOK_VERIFY_TOKEN — string qualquer que você escolhe, só
//     precisa bater dos dois lados (painel Meta + env desta function)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — já existem nas outras functions

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Handshake de verificação do webhook (Meta chama isso UMA vez, quando
  // você salva a Callback URL no painel). Único pedaço desta function que
  // dá pra testar sem credencial Meta nenhuma — já funciona de verdade.
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("meta-webhook recebido:", JSON.stringify(payload));

    // Formato documentado da Cloud API (não validado ao vivo):
    // payload.entry[].changes[].value.messages[] = mensagens recebidas
    // payload.entry[].changes[].value.metadata.phone_number_id = qual número
    const entry = payload?.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    const messages = value?.messages ?? [];
    const phoneNumberId = value?.metadata?.phone_number_id ?? null;

    if (messages.length === 0 || !phoneNumberId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    // TODO (precisa de meta_numbers real, ver migration): resolver
    // client_id/number_id a partir de phoneNumberId, achar/criar contato
    // pelo value.contacts[0].wa_id, inserir em inbound_messages (reusar a
    // mesma tabela da V1? ou tabela própria — decisão de META-04, pendente)
    // e disparar touchLifecycle como o zapi-webhook já faz.
    for (const msg of messages) {
      console.log("mensagem Meta (ainda não processada):", { from: msg.from, type: msg.type });
    }

    return new Response(JSON.stringify({ ok: true, logged: false, reason: "scaffold, nao implementado" }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro no meta-webhook:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
