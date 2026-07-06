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
const DAILY_CAP = 100;
// Token de Segurança da Conta (Z-API Dashboard > Segurança) — ver nota
// detalhada em zapi-status/index.ts. Header Client-Token != token de instância.
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

// Bug real descoberto em 2026-07-01 (via Contacts.jsx, mesmo teto): o
// Supabase/PostgREST devolve no MÁXIMO 1000 linhas por select, mesmo sem
// LIMIT explícito no código — é um teto padrão do projeto (db-max-rows),
// e vale pra QUALQUER select feito por aqui também (o client Supabase do
// Edge Function fala com a mesma API REST). Sem paginar, um cliente com
// mais de 1000 contatos ativos nunca teria a campanha entregue pra quem
// passasse do milhar — e pior, o dedup de "quem já recebeu esta campanha"
// (message_logs) também ficaria incompleto acima de 1000 envios, o que
// reenviaria mensagem duplicada pra quem já tinha recebido. Helper genérico
// pra buscar TODAS as páginas antes de seguir.
const PAGE_SIZE = 1000;
async function fetchAllPages<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  let all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) { console.error("Erro paginando query:", error); break; }
    all = all.concat((data ?? []) as T[]);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// Único ponto de decisão "posso mandar mais uma mensagem hoje por este
// número?" — compartilhado com send-message e zapi-webhook via a mesma
// função Postgres. Ver supabase_automacoes_avancadas.sql.
async function consumeBudget(numberId: string): Promise<boolean> {
  const { data: allowed, error } = await supabase.rpc("try_consume_daily_send_budget", { p_number_id: numberId, p_daily_cap: DAILY_CAP });
  if (error) {
    console.error("Erro checando limite diário:", error);
    return false;
  }
  return !!allowed;
}

// Ver nota completa em send-message/index.ts (mesmo bug, corrigido 2026-07-06):
// número BR sem código do país (10 ou 11 dígitos) precisa do "55" na frente,
// não só quando começa com "0".
function formatPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

// Brasil não observa horário de verão desde 2019 — UTC-3 fixo o ano todo,
// então dá pra converter sem biblioteca de timezone: só subtrair 3h do
// horário UTC do servidor (Edge Functions rodam em UTC). O Date resultante
// tem os getters UTC (getUTCHours, getUTCDay etc.) já representando o
// horário de parede do Brasil.
function brazilNow(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}
function brazilDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Variação de mensagens (spintax) — pedido do Leonardo pra não mandar a
// MESMA copy, palavra por palavra, pra centenas/milhares de contatos (isso
// é um dos sinais que o WhatsApp usa pra detectar spam em massa). Sintaxe:
// {opção1|opção2|opção3} — escolhe uma aleatoriamente por contato. Suporta
// aninhamento simples: {Oi{,| tudo bem?}|Olá}. Roda SEMPRE depois de
// substituir {{nome}}, nunca antes — assim "{{nome}}" nunca é confundido
// com um grupo de spintax (chave dupla vs. chave simples).
function resolveSpintax(text: string): string {
  let prev: string;
  let out = text;
  let guard = 0; // evita loop infinito em spintax malformado (chave sem fechar, etc.)
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

function personalize(rawMessage: string, contactName?: string | null): string {
  const withName = (rawMessage || "").replace(/\{\{\s*nome\s*\}\}/gi, contactName || "");
  return resolveSpintax(withName);
}

// Pausa entre envios consecutivos pro mesmo número — antes disso, um lote de
// 100 mensagens saía em sequência direta, sem pausa nenhuma (padrão bem mais
// "robótico" do que qualquer humano mandando mensagem manualmente, um dos
// sinais que o WhatsApp usa pra identificar disparo automatizado). Intervalo
// aleatório (não fixo) — um delay sempre idêntico também é um padrão
// detectável. Mantido curto de propósito: Edge Functions do Supabase têm
// limite de tempo de execução; um delay longo demais em lote de 100 correria
// risco de a função ser encerrada no meio do envio (o que não perde nada —
// o dedup por message_logs continua de onde parou no próximo ciclo do cron
// — mas é mais sujo que terminar certinho). Ajuste os valores abaixo se
// perceber timeout nos logs do Supabase.
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function humanDelay() {
  await sleep(600 + Math.floor(Math.random() * 900)); // 600–1500ms
}

async function sendTextMessage(instanceId: string, token: string, phone: string, message: string) {
  const url = `${ZAPI_BASE}/${instanceId}/token/${token}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Z-API error: ${res.status}`);
  }
  return res.json();
}

// Bug real descoberto em 2026-07-01 (a partir da pergunta do Leonardo sobre
// o botão de imagem no Histórico): campanha agendada/diária e follow-up
// SEMPRE mandavam só texto por aqui, mesmo quando tinham image_url
// preenchido — só o disparo manual (Edge Function send-message, chamada
// pelo frontend) sabia mandar imagem de verdade. Ou seja, anexar imagem
// numa campanha agendada nunca teve efeito nenhum na mensagem que o
// contato recebia. Adicionado o mesmo envio de imagem que send-message já
// tinha, e as duas chamadas de sendTextMessage relevantes (campanha e
// follow-up) agora escolhem imagem-com-legenda quando existe image_url.
async function sendImageMessage(instanceId: string, token: string, phone: string, image: string, caption: string) {
  const url = `${ZAPI_BASE}/${instanceId}/token/${token}/send-image`;
  const res = await fetch(url, {
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

// Botões de resposta rápida (2026-07-03) — pedido do Leonardo pra oferecer
// opções prontas na própria mensagem (ex: "Quero sim! 🙌" / "Não quero
// receber esse tipo de mensagem"), além de já poder escrever "eu quero" na
// mão (fluxo que continua funcionando sem mudança nenhuma).
//
// ATENÇÃO — endpoint e formato do payload NÃO validados ao vivo nesta
// sessão (nenhum número real ligado ainda, Z-API só será ativado quando o
// Leonardo pagar o plano). Segue o formato documentado publicamente da
// Z-API para "mensagem com lista de botões" (send-button-list). Se o
// formato real divergir quando o primeiro número for ligado, o erro cai em
// message_logs (status='error', com o detalhe da resposta da Z-API) em vez
// de travar o resto do envio — vale conferir os logs do Supabase Functions
// e o response_json de um erro real pra ajustar o payload se necessário.
async function sendButtonMessage(
  instanceId: string,
  token: string,
  phone: string,
  message: string,
  buttons: Array<{ id: string; label: string }>,
) {
  const url = `${ZAPI_BASE}/${instanceId}/token/${token}/send-button-list`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({
      phone,
      message,
      buttonList: { buttons: buttons.map((b) => ({ id: b.id, label: b.label })) },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Z-API error (send-button-list): ${res.status}`);
  }
  return res.json();
}

async function sendCampaignMessage(
  instanceId: string,
  token: string,
  phone: string,
  message: string,
  imageUrl?: string | null,
  quickReplies?: Array<{ id: string; label: string; action: string }> | null,
) {
  if (quickReplies && quickReplies.length > 0) {
    // Foto sem legenda (se houver) + o texto de verdade vai na mensagem de
    // botões, pra não repetir a mesma legenda duas vezes pro contato.
    if (imageUrl) await sendImageMessage(instanceId, token, phone, imageUrl, "");
    return sendButtonMessage(instanceId, token, phone, message, quickReplies);
  }
  if (imageUrl) return sendImageMessage(instanceId, token, phone, imageUrl, message);
  return sendTextMessage(instanceId, token, phone, message);
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

    // Contatos do mesmo cliente, aniversariantes de hoje (mês/dia) — paginado
    // (ver fetchAllPages acima) pra não perder ninguém acima de 1000 contatos.
    const contacts = await fetchAllPages<{ id: string; birth_date: string }>((from, to) =>
      supabase.from("contacts").select("id, birth_date").eq("client_id", (automation as any).client_id).not("birth_date", "is", null).range(from, to)
    );

    for (const contact of contacts) {
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

    const allowed = await consumeBudget(number.id);
    if (!allowed) throw new Error(`limite diário de ${DAILY_CAP} mensagens atingido para este número — tenta de novo amanhã`);

    const message = personalize(step.config?.message || "", contact.name);
    try {
      await sendTextMessage(number.zapi_instance_id, number.zapi_token, formatPhone(contact.phone), message);
    } catch (e) {
      // Ver nota completa em send-message/index.ts (mesmo bug, corrigido
      // 2026-07-06): devolve a vaga se o envio falhar de verdade, senão
      // tentativas falhas esgotam o limite diário sem entregar nada.
      await supabase.rpc("refund_daily_send_budget", { p_number_id: number.id });
      throw e;
    }
    await humanDelay();
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
    // Implementado em 2026-07-01 via supabase/functions/zapi-webhook, que
    // loga toda mensagem recebida em inbound_messages. "Respondeu" =
    // existe pelo menos 1 mensagem recebida deste contato desde que o
    // run desta automação começou.
    const since = run.created_at ?? new Date(0).toISOString();
    const { data: replies } = await supabase
      .from("inbound_messages")
      .select("id")
      .eq("contact_id", run.contact_id)
      .gte("received_at", since)
      .limit(1);
    return (replies?.length ?? 0) > 0;
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
  // BUG real encontrado em 2026-07-01: o frontend (NewCampaign.jsx) grava
  // status='scheduled' ao agendar, mas esse filtro só pegava
  // 'sending'/'draft' — ou seja, NENHUMA campanha agendada/diária criada
  // pela UI jamais era processada por esta função. Corrigido incluindo
  // 'scheduled' também.
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*, client_numbers:number_id(*)")
    .in("type", ["scheduled", "daily"])
    .in("status", ["scheduled", "sending", "draft"]);

  if (error) {
    console.error("Erro buscando campanhas agendadas:", error);
    return;
  }

  const nowIso = new Date().toISOString();

  // BUG real encontrado em 2026-07-03 (a partir do relato do Leonardo sobre
  // a campanha da Hassum): daily_start_hour existia na UI desde sempre, mas
  // NUNCA era checado aqui — assim que a campanha virava elegível (data
  // passou / ainda não rodou hoje), o motor mandava o lote inteiro (até 100
  // mensagens) de uma vez, em poucos minutos (só o humanDelay de
  // 600-1500ms entre uma e outra). Isso é uma rajada bem mais "robótica" do
  // que qualquer humano mandando mensagem — pior sinal de automação em
  // massa do que o volume em si. Agora TODA campanha (scheduled e daily)
  // respeita uma janela de horário comercial (daily_start_hour até
  // daily_end_hour, horário do Brasil) e espalha os envios proporcionalmente
  // ao tempo decorrido dentro dela, em vez de despejar tudo de uma vez.
  const brNow = brazilNow();
  const todayBR = brazilDateKey(brNow);
  const hourBR = brNow.getUTCHours();
  const minuteBR = brNow.getUTCMinutes();
  const dowBR = brNow.getUTCDay(); // 0=domingo, 6=sábado — já no horário do Brasil

  for (const campaign of campaigns ?? []) {
    const number = (campaign as any).client_numbers;
    if (!number) continue;

    // Data/hora de término (stop_at, opcional) — pedido do Leonardo pra
    // conseguir dizer "para de mandar a partir do dia X" mesmo com gente
    // ainda pendente na lista. Checado ANTES de mandar qualquer mensagem
    // deste ciclo: se já passou, marca como 'stopped' (distinto de
    // 'completed', que significa "alcançou todo mundo") e não envia mais nada.
    if (campaign.stop_at && campaign.stop_at <= nowIso) {
      if (campaign.status !== "stopped" && campaign.status !== "completed") {
        await supabase.from("campaigns").update({ status: "stopped", completed_at: nowIso }).eq("id", campaign.id);
      }
      continue;
    }

    if (campaign.status === "completed") continue;
    if (campaign.type === "scheduled" && (!campaign.scheduled_for || campaign.scheduled_for > nowIso)) continue;

    // weekdays_only tem default true no banco — undefined (campanha antiga,
    // criada antes desta coluna existir) também conta como "só dias úteis".
    if (campaign.weekdays_only !== false && (dowBR === 0 || dowBR === 6)) continue;

    const startH = campaign.daily_start_hour ?? 9;
    const endH = campaign.daily_end_hour ?? 18;
    if (hourBR < startH || hourBR >= endH) continue; // fora da janela de hoje

    const dailyCap = campaign.type === "daily" ? (campaign.daily_limit ?? 100) : DAILY_CAP;
    const isNewDay = campaign.last_daily_run !== todayBR;
    const sentToday = isNewDay ? 0 : (campaign.daily_sent_today ?? 0);

    // Quantas deveriam ter saído até AGORA, proporcional ao quanto da janela
    // já passou hoje (ex: janela 9h-18h = 540min; às 13h30 já passou 270min
    // = 50% => já deveria ter mandado metade do daily_cap).
    const windowMinutes = Math.max(1, (endH - startH) * 60);
    const elapsedMinutes = (hourBR - startH) * 60 + minuteBR;
    const proportion = Math.min(1, Math.max(0, elapsedMinutes / windowMinutes));
    const targetByNow = Math.ceil(proportion * dailyCap);
    // Teto de 15 por ciclo mesmo se "devia" mais (ex: cron ficou parado um
    // tempo) — evita rajada mesmo num cenário de atraso acumulado.
    const due = Math.max(0, Math.min(targetByNow - sentToday, 15));

    if (due === 0) {
      if (isNewDay) await supabase.from("campaigns").update({ last_daily_run: todayBR, daily_sent_today: 0 }).eq("id", campaign.id);
      continue;
    }

    const attempted = await sendCampaignBatch(campaign, number, due);
    await supabase.from("campaigns").update({ last_daily_run: todayBR, daily_sent_today: sentToday + attempted }).eq("id", campaign.id);
  }
}

async function sendCampaignBatch(campaign: any, number: any, limit: number | null): Promise<number> {
  // Contatos do cliente que ainda não receberam esta campanha — paginado
  // (ver fetchAllPages): acima de 1000 envios já registrados, um select sem
  // paginação perderia parte do dedup e reenviaria mensagem duplicada.
  const alreadySent = await fetchAllPages<{ contact_id: string }>((from, to) =>
    supabase.from("message_logs").select("contact_id").eq("campaign_id", campaign.id).range(from, to)
  );
  const sentIds = new Set(alreadySent.map((r) => r.contact_id));

  // Ordem determinística (created_at asc) — garante que "manda 100 hoje,
  // 100 amanhã" sempre continua exatamente de onde parou, sem repetir e
  // sem pular ninguém, não importa em que ordem o Postgres devolveria por padrão.
  // target_tags filtra o público por tag — NULL/vazio = manda pra todo mundo
  // Ativo, igual antes. Com 2+ tags marcadas é OR (.overlaps): contato que
  // tem QUALQUER uma das tags marcadas entra, não precisa ter todas ao mesmo
  // tempo (ex: marcar "Antigo" + "vip" manda pra quem é Antigo OU vip, não
  // só pra quem é as duas coisas — é assim que ferramenta de marketing
  // normalmente trata seleção múltipla de tag/segmento).
  // Também paginado — cliente com mais de 1000 contatos ativos não pode
  // ficar com a campanha travada só nos primeiros 1000.
  const contacts = await fetchAllPages<any>((from, to) => {
    let q = supabase.from("contacts").select("*").eq("client_id", campaign.client_id).eq("status", "Ativo").order("created_at", { ascending: true }).range(from, to);
    if (campaign.target_tags && campaign.target_tags.length > 0) q = q.overlaps("tags", campaign.target_tags);
    return q;
  });
  const pending = contacts.filter((c: any) => !sentIds.has(c.id));
  // `limit` é o teto da PRÓPRIA campanha (daily_limit) — o teto real de
  // verdade é sempre o orçamento diário GLOBAL do número (try_consume_daily_send_budget),
  // checado mensagem a mensagem logo abaixo. Isso garante que duas
  // campanhas ativas ao mesmo tempo no mesmo número nunca somem mais de
  // DAILY_CAP envios juntas.
  const batch = limit ? pending.slice(0, limit) : pending;

  let budgetExhausted = false;
  let attempted = 0; // conta sent + error — cada um é uma chamada real à Z-API, é isso que pauta o ritmo (ver daily_sent_today em processScheduledCampaigns)
  for (const contact of batch) {
    if (budgetExhausted) break;
    const allowed = await consumeBudget(number.id);
    if (!allowed) { budgetExhausted = true; break; }
    attempted++;
    try {
      const message = personalize(campaign.caption || "", contact.name);
      await sendCampaignMessage(number.zapi_instance_id, number.zapi_token, formatPhone(contact.phone), message, campaign.image_url, campaign.quick_replies);
      await supabase.from("message_logs").insert({
        campaign_id: campaign.id, client_id: campaign.client_id, contact_id: contact.id,
        status: "sent", sent_at: new Date().toISOString(),
      });
    } catch (e) {
      // Ver nota completa em send-message/index.ts (mesmo bug, corrigido
      // 2026-07-06): devolve a vaga se o envio falhar de verdade.
      await supabase.rpc("refund_daily_send_budget", { p_number_id: number.id });
      await supabase.from("message_logs").insert({
        campaign_id: campaign.id, client_id: campaign.client_id, contact_id: contact.id,
        status: "error", error_detail: String(e),
      });
    }
    await humanDelay();
  }

  const stillPending = pending.length > batch.length || budgetExhausted;
  if (!stillPending) {
    await supabase.from("campaigns").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", campaign.id);
  } else if (campaign.type === "scheduled") {
    // "scheduled" original mandava tudo de uma vez; se bateu no teto
    // diário no meio, vira efetivamente uma campanha que continua nos
    // próximos dias (o dedup por message_logs já cuida de não repetir).
    await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaign.id);
  }
  return attempted;
}

// ---------------------------------------------------------------------
// PARTE 4 — FOLLOW-UPS: campanha B só vai pra quem recebeu a campanha A
// há N dias e não respondeu nada desde então (inbound_messages).
// ---------------------------------------------------------------------
async function processFollowUpCampaigns() {
  const { data: followUps, error } = await supabase
    .from("campaigns")
    .select("*, client_numbers:number_id(*)")
    .eq("type", "followup")
    .in("status", ["scheduled", "sending"]);

  if (error) {
    console.error("Erro buscando follow-ups:", error);
    return;
  }

  for (const followUp of followUps ?? []) {
    const number = (followUp as any).client_numbers;
    if (!number || !followUp.follow_up_of) continue;

    const delayDays = followUp.follow_up_delay_days ?? 2;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - delayDays);

    // Quem recebeu a campanha-base há >= delayDays dias — paginado (ver
    // fetchAllPages), senão campanha-base com mais de 1000 envios já feitos
    // perderia gente na fila do follow-up.
    const baseSends = await fetchAllPages<{ contact_id: string; sent_at: string }>((from, to) =>
      supabase.from("message_logs").select("contact_id, sent_at").eq("campaign_id", followUp.follow_up_of).eq("status", "sent").lte("sent_at", cutoff.toISOString()).range(from, to)
    );

    if (baseSends.length === 0) continue;

    // Quem já recebeu ESTE follow-up (não reenviar) — mesmo cuidado de paginação.
    const alreadyFollowedUp = await fetchAllPages<{ contact_id: string }>((from, to) =>
      supabase.from("message_logs").select("contact_id").eq("campaign_id", followUp.id).range(from, to)
    );
    const alreadyIds = new Set(alreadyFollowedUp.map((r) => r.contact_id));

    for (const baseSend of baseSends) {
      if (alreadyIds.has(baseSend.contact_id)) continue;

      // Respondeu qualquer coisa desde que recebeu a campanha-base? Se sim, pula.
      const { data: replies } = await supabase
        .from("inbound_messages")
        .select("id")
        .eq("contact_id", baseSend.contact_id)
        .gte("received_at", baseSend.sent_at)
        .limit(1);
      if (replies && replies.length > 0) continue;

      const { data: contact } = await supabase.from("contacts").select("*").eq("id", baseSend.contact_id).single();
      if (!contact || contact.status !== "Ativo") continue;

      const allowed = await consumeBudget(number.id);
      if (!allowed) break; // orçamento do dia acabou — resto tenta na próxima execução

      const message = personalize(followUp.caption || "", contact.name);
      try {
        await sendCampaignMessage(number.zapi_instance_id, number.zapi_token, formatPhone(contact.phone), message, followUp.image_url, followUp.quick_replies);
        await supabase.from("message_logs").insert({
          campaign_id: followUp.id, client_id: followUp.client_id, contact_id: contact.id,
          status: "sent", sent_at: new Date().toISOString(),
        });
      } catch (e) {
        // Ver nota completa em send-message/index.ts (mesmo bug, corrigido
        // 2026-07-06): devolve a vaga se o envio falhar de verdade.
        await supabase.rpc("refund_daily_send_budget", { p_number_id: number.id });
        await supabase.from("message_logs").insert({
          campaign_id: followUp.id, client_id: followUp.client_id, contact_id: contact.id,
          status: "error", error_detail: String(e),
        });
      }
      await humanDelay();
    }

    await supabase.from("campaigns").update({ status: "sending" }).eq("id", followUp.id);
  }
}

// ---------------------------------------------------------------------
Deno.serve(async (_req: Request) => {
  try {
    await enrollBirthdayTriggers();
    await processRuns();
    await processFollowUpCampaigns();
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
