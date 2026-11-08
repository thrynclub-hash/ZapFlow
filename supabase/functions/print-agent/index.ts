// ZapFlow — API do agente local de impressão (2026-11-07)
// Deploy: supabase functions deploy print-agent --no-verify-jwt
// (autentica por token próprio em print_agents, não por sessão Supabase)
//
// Chamado pelo programinha instalado no PC da loja (ver print-agent-local/
// na raiz do repo). Dois usos, via querystring ?action=:
//   poll — retorna até 10 print_jobs pendentes do cliente dono do token
//   ack  — marca um job como impresso (ou falho)
//
// NÃO TESTADO AO VIVO — scaffold funcional, mesma ressalva de ai-agent.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function authAgent(req: Request) {
  const token = req.headers.get("x-agent-token") || "";
  if (!token) return null;
  const { data } = await supabase.from("print_agents").select("id, client_id").eq("token", token).single();
  if (data) await supabase.from("print_agents").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const agent = await authAgent(req);
    if (!agent) return new Response(JSON.stringify({ error: "token inválido" }), { status: 401, headers: corsHeaders });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "poll") {
      const { data: jobs } = await supabase
        .from("print_jobs").select("*")
        .eq("client_id", agent.client_id).eq("status", "pending")
        .order("created_at", { ascending: true }).limit(10);
      return new Response(JSON.stringify({ ok: true, jobs: jobs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "ack") {
      const { job_id, success } = await req.json();
      if (!job_id) return new Response(JSON.stringify({ error: "job_id obrigatório" }), { status: 400, headers: corsHeaders });
      await supabase.from("print_jobs")
        .update({ status: success === false ? "failed" : "printed", printed_at: new Date().toISOString() })
        .eq("id", job_id).eq("client_id", agent.client_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "action inválida (use ?action=poll ou ?action=ack)" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
