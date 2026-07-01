// ZapFlow — Motor de Execução (automações + campanhas agendadas/diárias)
// Deploy: supabase functions deploy run-automations --no-verify-jwt
// Agendar (Supabase Dashboard > Database > Cron, ou pg_cron) para rodar
// a cada 5 minutos, chamando esta função.
//
// Por que "run-automations" cuida também de campanhas agendadas/diárias:
// nenhum motor server-side existia antes disso (ver SECURITY-FINDINGS-2026-07-01.md,
// item 6) — construir os dois juntos evita ter duas engines de fila
// redundantes no mesmo produto.
//
// Requer envs (já disponíveis por padrão em toda Edge Function do Supabase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const ZAPI_BASE = "https://api.z-api.io/instances";

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "55");
}

async function sendTextMessage(instanceId: string, token: string, phone: string, message: string) {
  const url = `${ZAPI_BASE}/${instanceId}/token/${token}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": token },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Z-API error: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------
// PARTE 1 — ENROLL: entrar contatos elegíveis em automações de gatilho
// MVP: só o gatilho "birthday" é avaliado por varredura periódica.
// "tag_added" e "first_purchase" ainda não têm evento real disparando
// (ver README da função, seção TODO) — não fingir que funcionam.
// ---------------------------------------------------------------------
async function enrollBirthdayTriggers() {
  const today = new Date();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");

  const { data: automations, error: autoErr } = await supabase
    .from("automations")
    .select("id, client_id, status, automation_steps(id, kind, block, order_index)")
    .eq("status", "active");

  if (autoErr) {
    console.error("Erro buscando automações ativas:", autoErr);
    return;
  }

  for (const automation of automations ?? []) {
    const steps = (automation as any).automation_steps ?? [];
    const trigger = steps.find((s: any) => s.kind === "trigger" && s.block === "birthday");
    if (!trigger) continue;

    const firstStep = steps
      .filter((s: any) => s.kind !== "trigger")
      .sort((a: any, b: any) => a.order_index - b.order_index)[0];
    if (!firstStep) continue;

    // Contatos do mesmo cliente, aniversariantes de hoje (mês/dia)
    const { data: contacts, error: contactsErr } = await supabase
      .from("contacts")
      .select("id, birth_date")
      .eq("client_id", (automation as any).client_id)
      .not("birth_date", "is", null);

    if (contactsErr) {
      console.error("Erro buscando contatos:", contactsErr);
      continue;
    }

    for (const contact of contacts ?? []) {
      const bd = new Date(contact.birth_date);
      const bdMm = String(bd.getUTCMonth() + 1).padStart(2, "0");
      const bdDd = String(bd.getUTCDate()).padStart(2, "0");
      if (bdMm !== mm || bdDd !== dd) continue;

      // Evita duplicar: já existe run criado hoje para este contato+automação?
      const { data: existing } = await supabase
        .from("automation_runs")
        .select("id")
        .eq("automation_id", (automation as any).id)
        .eq("contact_id", contact.id)
        .gte("created_at", `${today.toISOString().slice(0, 10)}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("automation_runs").insert({
        automation_id: (automation as any).id,
        contact_id: contact.id,
        client_id: (automation as any).client_id,
        current_step_id: firstStep.id,
        status: "running",
      });
    }
  }
}

// ---------------------------------------------------------------------
// PARTE 2 — PROCESS: avançar automation_runs prontos para rodar
// ---------------------------------------------------------------------
async function processRuns() {
  const nowIso = new Date().toISOString();

  const { data: runs, error } = await supabase
    .from("automation_runs")
    .select("*")
    .in("status", ["running"])
    .limit(200);

  const { data: waitingRuns } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("status", "waiting")
    .lte("resume_at", nowIso)
    .limit(200);

  const allRuns = [...(runs ?? []), ...(waitingRuns ?? [])];
  if (error) console.error("Erro buscando runs:", error);

  for (const run of allRuns) {
    await advanceRun(run);
  }
}

async function advanceRun(run: any) {
  if (!run.current_step_id) {
    await supabase.from("automation_runs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", run.id);
    return;
  }

  const { data: step, error: stepErr } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("id", run.current_step_id)
    .single();

  if (stepErr || !step) {
    await logRun(run.id, run.current_step_id, "error", "step não encontrado");
    await supabase.from("automation_runs").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", run.id);
    return;
  }

  try {
    let nextStepId: string | null = step.next_step_id;
    let waitUntil: string | null = null;

    if (step.kind === "action") {
      await executeAction(run, step);
    } else if (step.kind === "condition") {
      const result = await evaluateCondition(run, step);
      nextStepId = result ? step.next_step_id : step.next_step_id_if_false;
    }

    if (step.block === "wait") {
      const days = step.config?.days ?? 0;
      const hours = step.config?.hours ?? 0;
      const resume = new Date();
      resume.setUTCDate(resume.getUTCDate() + days);
      resume.setUTCHours(resume.getUTCHours() + hours);
      waitUntil = resume.toISOString();
    }

    await logRun(run.id, step.id, "ok", null);

    if (waitUntil) {
      await supabase
        .from("automation_runs")
        .update({ status: "waiting", resume_at: waitUntil, current_step_id: nextStepId, updated_at: new Date().toISOString() })
        .eq("id", run.id);
    } else if (nextStepId) {
      await supabase
        .from("automation_runs")
        .update({ status: "running", current_step_id: nextStepId, updated_at: new Date().toISOString() })
        .eq("id", run.id);
    } else {
      await supabase
        .from("automation_runs")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", run.id);
    }
  } catch (e) {
    await logRun(run.id, step.id, "error", String(e));
    await supabase.from("automation_runs").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", run.id);
  }
}

async function executeAction(run: any, step: any) {
  if (step.block === "send_whatsapp") {
    const { data: contact } = await supabase.from("contacts").select("*").eq("id", run.contact_id).single();
    const { data: automation } = await supabase.from("automations").select("number_id").eq("id", run.automation_id).single();
    const { data: number } = await supabase.from("client_numbers").select("*").eq("id", automation?.number_id).single();
    if (!contact || !number) throw new Error("contato ou número não encontrado");

    const message = (step.config?.message || "").replace("{{nome}}", contact.name || "");
    await sendTextMessage(number.zapi_instance_id, number.zapi_token, formatPhone(contact.phone), message);
  } else if (step.block === "add_tag") {
    const tag = step.config?.tag;
    if (!tag) return;
    const { data: contact } = await supabase.from("contacts").select("tags").eq("id", run.contact_id).single();
    const tags = new Set(contact?.tags ?? []);
    tags.add(tag);
    await supabase.from("contacts").update({ tags: Array.from(tags) }).eq("id", run.contact_id);
  } else if (step.block === "wait") {
    // tratado em advanceRun (calcula resume_at) — nada a fazer aqui
  } else {
    throw new Error(`ação desconhecida: ${step.block}`);
  }
}

async function evaluateCondition(run: any, step: any): Promise<boolean> {
  if (step.block === "has_tag") {
    const tag = step.config?.tag;
    const { data: contact } = await supabase.from("contacts").select("tags").eq("id", run.contact_id).single();
    return (contact?.tags ?? []).includes(tag);
  }
  if (step.block === "has_replied") {
    // TODO: não implementado — depende de um webhook de mensagens recebidas
    // da Z-API, que ainda não existe no projeto. Sempre retorna false por
    // enquanto para não fingir um comportamento que não existe de verdade.
    console.warn("condição 'has_replied' ainda não implementada — requer webhook de inbound");
    return false;
  }
  throw new Error(`condição desconhecida: ${step.block}`);
}

async function logRun(runId: string, stepId: string | null, result: string, detail: string | null) {
  await supabase.from("automation_run_logs").insert({ run_id: runId, step_id: stepId, result, detail });
}

// ---------------------------------------------------------------------
// PARTE 3 — CAMPANHAS agendadas/diárias (resolve o gap descrito em
// SECURITY-FINDINGS-2026-07-01.md item 6 — a UI já promete isso, mas
// nada rodava no servidor até esta função existir)
// ---------------------------------------------------------------------
async function processScheduledCampaigns() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*, client_numbers:number_id(*)")
    .in("type", ["scheduled", "daily"])
    .in("status", ["sending", "draft"]);

  if (error) {
    console.error("Erro buscando campanhas agendadas:", error);
    return;
  }

  for (const campaign of campaigns ?? []) {
    const number = (campaign as any).client_numbers;
    if (!number) continue;

    if (campaign.type === "scheduled") {
      if (!campaign.scheduled_for || campaign.scheduled_for > new Date().toISOString()) continue;
      if (campaign.status === "completed") continue;
      await sendCampaignBatch(campaign, number, null); // sem limite diário: manda tudo pendente
    } else if (campaign.type === "daily") {
      if (campaign.last_daily_run === today) continue; // já rodou hoje
      await sendCampaignBatch(campaign, number, campaign.daily_limit ?? 100);
      await supabase.from("campaigns").update({ last_daily_run: today, daily_sent_today: 0 }).eq("id", campaign.id);
    }
  }
}

async function sendCampaignBatch(campaign: any, number: any, limit: number | null) {
  // Contatos do cliente que ainda não receberam esta campanha
  const { data: alreadySent } = await supabase
    .from("message_logs")
    .select("contact_id")
    .eq("campaign_id", campaign.id);

  const sentIds = new Set((alreadySent ?? []).map((r: any) => r.contact_id));

  let query = supabase.from("contacts").select("*").eq("client_id", campaign.client_id).eq("status", "Ativo");
  const { data: contacts } = await query;
  const pending = (contacts ?? []).filter((c: any) => !sentIds.has(c.id));
  const batch = limit ? pending.slice(0, limit) : pending;

  for (const contact of batch) {
    try {
      await sendTextMessage(number.zapi_instance_id, number.zapi_token, formatPhone(contact.phone), campaign.caption || "");
      await supabase.from("message_logs").insert({
        campaign_id: campaign.id, client_id: campaign.client_id, contact_id: contact.id,
        status: "sent", sent_at: new Date().toISOString(),
      });
    } catch (e) {
      await supabase.from("message_logs").insert({
        campaign_id: campaign.id, client_id: campaign.client_id, contact_id: contact.id,
        status: "error", error_detail: String(e),
      });
    }
  }

  if (pending.length <= batch.length) {
    await supabase.from("campaigns").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", campaign.id);
  }
}

// ---------------------------------------------------------------------
Deno.serve(async (_req: Request) => {
  try {
    await enrollBirthdayTriggers();
    await processRuns();
    await processScheduledCampaigns();
    return new Response(JSON.stringify({ ok: true, ran_at: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro geral na execução:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
