// ZapFlow — Checa status de conexão de um número Z-API (Settings.jsx)
// Deploy: supabase functions deploy zapi-status
//
// BUG DE SEGURANÇA real corrigido em 2026-07-03: Settings.jsx antes fazia
// select('*') em client_numbers (que inclui zapi_token, credencial real da
// Z-API) e chamava a Z-API DIRETO DO NAVEGADOR com esse token — ou seja,
// qualquer cliente logado conseguia abrir o DevTools e pegar o próprio
// zapi_token pra mandar mensagem direto pela Z-API, por fora de TUDO que
// esse sistema construiu (limite diário, opt-out, spintax, message_logs).
// Esta function resolve isso: o navegador manda só o number_id, e o token
// nunca sai do servidor.
//
// Requer JWT do usuário (client ou admin) — por isso SEM --no-verify-jwt,
// diferente dos webhooks públicos (zapi-webhook, mp-webhook).

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const ZAPI_BASE = "https://api.z-api.io/instances";
// Token de Segurança da Conta (Z-API Dashboard > Segurança > "Token de
// Segurança da Conta") — descoberto em 2026-07-06 quando o primeiro número
// real (Clínica Hassum) foi pago/conectado: é um token de CONTA, diferente
// do token de instância (client_numbers.zapi_token). O header Client-Token
// precisa ser este, não o token da instância — a Z-API rejeita silenciosamente
// (connected: false / erro genérico) quando esse recurso de segurança da
// conta está ativado e o header vem com o valor errado.
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

Deno.serve(async (req: Request) => {
  try {
    // Client com a ANON key + o JWT de quem chamou no Authorization — é
    // esse JWT (não a apikey) que o PostgREST usa pra aplicar RLS, então
    // isso respeita exatamente as mesmas políticas de "Numbers own"/"Admin
    // all numbers" já existentes: cliente só enxerga os próprios números,
    // admin vê todos. Nada de service role aqui — não precisa bypassar RLS.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { number_id } = await req.json().catch(() => ({}));
    if (!number_id) {
      return new Response(JSON.stringify({ ok: false, error: "number_id obrigatório" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { data: number, error } = await supabaseAsUser
      .from("client_numbers")
      .select("zapi_instance_id, zapi_token")
      .eq("id", number_id)
      .single();

    if (error || !number) {
      return new Response(JSON.stringify({ ok: false, error: "número não encontrado ou sem permissão" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (!number.zapi_instance_id || !number.zapi_token) {
      return new Response(JSON.stringify({ ok: true, connected: false, reason: "não configurado" }), { headers: { "Content-Type": "application/json" } });
    }

    const res = await fetch(`${ZAPI_BASE}/${number.zapi_instance_id}/token/${number.zapi_token}/status`, {
      headers: { "Client-Token": ZAPI_CLIENT_TOKEN },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: true, connected: false }), { headers: { "Content-Type": "application/json" } });
    }
    const data = await res.json();
    // Só devolve o que a tela precisa — nunca o token de volta pro navegador.
    return new Response(JSON.stringify({ ok: true, connected: !!data.connected, phone: data.phone }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro em zapi-status:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
