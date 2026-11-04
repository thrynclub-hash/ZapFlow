// ZapFlow — Envio via API oficial da Meta (Cloud API). Fase 2, Phase 6
// (piloto, META-02) — SEPARADO de sendTextMessage/sendImageMessage do
// run-automations (Z-API), não reusado, não chamado por nenhum caminho
// de código existente.
//
// ponytail: SCAFFOLD. Sem META_ACCESS_TOKEN real (precisa app Meta
// Business aprovado) — nunca rodou contra a API de verdade. Estrutura
// segue a doc oficial da Cloud API (POST /{phone-number-id}/messages),
// mas nenhuma chamada foi validada. Não chamar em produção sem testar
// primeiro com o número de teste do piloto.
//
// Dois modos, porque fora da janela de 24h SÓ template aprovado funciona
// na API oficial (diferença central vs. Z-API, que manda texto livre
// sempre) — ver REQUIREMENTS.md META-02:
//   sendTemplate()  — fora da janela 24h, exige template pré-aprovado
//   sendFreeform()  — dentro da janela 24h, texto livre normal

const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const META_API_VERSION = "v21.0";

function metaUrl(phoneNumberId: string) {
  return `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`;
}

async function callMeta(phoneNumberId: string, body: Record<string, unknown>) {
  const res = await fetch(metaUrl(phoneNumberId), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${META_ACCESS_TOKEN}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Meta API error: ${res.status}`);
  return data;
}

// TODO: templateName/languageCode/params vêm de onde o template aprovado
// for cadastrado (meta_numbers? tabela própria de templates? decisão
// pendente de design, não bloqueia o scaffold).
async function sendTemplate(phoneNumberId: string, to: string, templateName: string, languageCode: string, params: string[] = []) {
  return callMeta(phoneNumberId, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: params.length > 0 ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [],
    },
  });
}

async function sendFreeform(phoneNumberId: string, to: string, message: string) {
  return callMeta(phoneNumberId, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: message },
  });
}

// Function HTTP não exposta ainda — chamada só internamente (import direto)
// até ter um fluxo real (UI de disparo, ou reuso do motor de campanha) que
// decida qual dos dois modos usar. Scaffold fica assim pra não precisar
// desfazer uma rota HTTP que ninguém chama ainda.
Deno.serve(async () => {
  return new Response(JSON.stringify({ ok: true, scaffold: true, reason: "meta-send ainda não está ligado a nenhum fluxo" }), {
    headers: { "Content-Type": "application/json" },
  });
});
