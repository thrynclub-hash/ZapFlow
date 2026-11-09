// ZapFlow — Webhook da API oficial da Meta (Cloud API/WABA). Fase 2, Phase 6
// (piloto, META-03/META-04) — SEPARADO do zapi-webhook (payload e auth
// diferentes), nunca toca client_numbers/message_logs da V1 Z-API. Reusa
// contacts/inbound_messages (mesmas tabelas da V1) mas só por coluna aditiva
// (meta_number_id, ver supabase_meta_fase6.sql) — zero ALTER/DROP.
//
// ponytail: SCAFFOLD ainda, mas a lógica de negócio (resolver número →
// cliente, achar/criar contato, logar inbound, tocar lifecycle) está
// completa e seguindo o mesmo padrão de zapi-webhook/index.ts. Sem
// META_ACCESS_TOKEN/WABA real — não testado contra payload real da Meta
// ainda. O handshake GET (verificação de webhook) é lógica real e funciona
// sem credencial nenhuma, só com o secret que você escolher.
//
// Deploy: supabase functions deploy meta-webhook --no-verify-jwt
// Rodar supabase_meta_fase6.sql ANTES de usar isto (cria meta_numbers,
// meta_templates, inbound_messages.meta_number_id).
// Depois de ter um phone_number_id real da Meta, inserir uma linha em
// meta_numbers (client_id, label, phone_number_id) — sem isso todo payload
// é ignorado (número desconhecido).
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
    // payload.entry[].changes[].value.contacts[].wa_id = telefone de quem mandou
    const entry = payload?.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    const messages = value?.messages ?? [];
    const phoneNumberId = value?.metadata?.phone_number_id ?? null;

    if (messages.length === 0 || !phoneNumberId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    const { data: number } = await supabase.from("meta_numbers").select("*").eq("phone_number_id", phoneNumberId).maybeSingle();
    if (!number) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "phone_number_id não corresponde a nenhum meta_numbers cadastrado" }), { headers: { "Content-Type": "application/json" } });
    }
    if (number.active === false) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "número inativo" }), { headers: { "Content-Type": "application/json" } });
    }

    for (const msg of messages) {
      const waId: string | null = msg.from ?? null;
      const waProfileName: string | null = value?.contacts?.find((c: any) => c.wa_id === waId)?.profile?.name ?? null;
      const text: string | null = msg.text?.body ?? null;

      if (!waId) {
        console.warn("meta-webhook: mensagem sem 'from', ignorada:", JSON.stringify(msg));
        continue;
      }

      // Match pelos últimos 8 dígitos, mesmo critério de zapi-webhook (tolera
      // DDI/9º dígito). Se não existe, cria contato novo — diferente da V1
      // (onde contato sempre vem de import/cadastro manual), porque aqui é a
      // ÚNICA porta de entrada: ninguém cadastra manualmente quem manda
      // mensagem pela primeira vez via Meta.
      const { data: candidates } = await supabase.from("contacts").select("*").eq("client_id", number.client_id);
      let contact = (candidates ?? []).find((c: any) => last8(c.phone) === last8(waId));

      if (!contact) {
        const { data: created, error: createErr } = await supabase
          .from("contacts")
          .insert({ client_id: number.client_id, name: waProfileName || waId, phone: waId, tags: ["Meta"] })
          .select()
          .single();
        if (createErr) {
          console.error("meta-webhook: erro ao criar contato:", createErr);
          continue;
        }
        contact = created;
      }

      await supabase.from("inbound_messages").insert({
        client_id: number.client_id,
        contact_id: contact.id,
        meta_number_id: number.id,
        phone: waId,
        message: text,
      });

      await touchLifecycle(contact);
    }

    return new Response(JSON.stringify({ ok: true, logged: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro no meta-webhook:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
