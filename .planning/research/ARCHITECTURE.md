# Phase 2 — Architecture Research

**Scope:** How to integrate (1) contact status lifecycle, (2) plan-consumption dashboard, (3) subscription status, (4) LinkedIn CSV import into the existing ZapFlow architecture without duplicating or fighting `run-automations` (pg_cron/5min) or the `client_id` RLS pattern.

**Method:** Read `.planning/codebase/ARCHITECTURE.md` + `STRUCTURE.md`, then read the actual current code/SQL (which has moved ahead of those docs): `supabase/functions/mp-webhook/index.ts`, `client-provision/index.ts`, `run-automations/index.ts` (contact-fetch query), `src/pages/Contacts.jsx`, `src/pages/admin/AdminPricing.jsx`, and the loose migration files at repo root (`supabase_planos_limites.sql`, `supabase_plan_billing.sql`, `supabase_addons*.sql`, `supabase_tags_contatos_e_alvo_campanha.sql`). Findings below correct/extend the codebase docs where the running system already has infrastructure those docs don't mention.

---

## 0. Corrections to codebase/ARCHITECTURE.md (ground truth from code)

The codebase docs describe a system slightly behind what's actually implemented. Three things Phase 2 must build on top of, not reinvent:

1. **`plan_limits` table already exists** (`supabase_planos_limites.sql`): `plan` (PK text) → `numbers_limit`, `contacts_limit` (nullable = unlimited). RLS: readable by any authenticated user, writable only by `is_admin()`. `clients.plan` is a plain text FK-by-convention into this table (no formal FK constraint, but `Contacts.jsx:fetchPlanLimit()` joins them at query time).
2. **`client_addons` table already exists** (`supabase_addons.sql`, `supabase_addons_mercadopago.sql`) with columns including `client_id`, `addon_type` (`'contacts_1000'`, `'number'`), `quantity`, `status` (`'active'|'cancelled'|pending`). `mp-webhook/index.ts` **already** flips `client_addons.status` automatically based on Mercado Pago `preapproval` (recurring, for number add-on) and `payment` (one-time, for contacts add-on) events. This is a working, live automatic-status-from-webhook pattern — reuse its shape rather than inventing a new one.
3. **Plan billing (the base monthly plan, not add-ons) is deliberately manual**, by explicit design decision recorded in `supabase_plan_billing.sql`: `clients.plan_next_charge_at` + `clients.plan_billing_cycle_days` store only the raw due-date fact; "in good standing / overdue" is **computed client-side from the date**, never stored, specifically so it can never go stale if a job fails to run. This is a deliberate architectural stance Phase 2 must respect, not override with a stored enum.
4. **Campaign audience targeting by tag already exists**: `campaigns.target_tags text[]` (`supabase_tags_contatos_e_alvo_campanha.sql`). `NULL`/empty = send to all `status='Ativo'` contacts (today's default); `{'Antigo'}` or `{'Novo'}` = restrict to contacts carrying that tag. `run-automations` must already consult this column when building its contact query (the ARCHITECTURE.md contact-fetch snippet predates this column and only shows the `status='Ativo'` filter — `target_tags` filtering happens in addition to it).
5. **`contacts.status` is a 2-value flag consumed directly by the send engine**: `run-automations/index.ts:534` — `.eq("status", "Ativo")`. This is the single gate that decides whether a contact receives campaign messages. This is the load-bearing fact for feature (1) below.

---

## 1. Contact status lifecycle (Novo/Ativo/Dormindo/VIP/Opt-out)

### The core constraint
`run-automations` filters contacts with `.eq("status", "Ativo")` as its send-eligibility gate. If `status` becomes a 5-value lifecycle enum, that query silently breaks (a contact who ages into `"Dormindo"` would stop receiving campaigns whether or not that's the intent, and `"VIP"`/`"Novo"` would never match `"Ativo"` at all and get zero campaigns — likely not the intent).

**Decision: split the concern into two columns, don't overload one.**

- Keep `contacts.status` (or rename its role but keep 2 states) as the **send-eligibility gate**: `'Ativo'` (sendable) / `'Opt-out'` (not sendable — today's `'Inativo'`, already set by `zapi-webhook`'s "PARAR"/"SAIR" handler and by `Contacts.jsx:toggleStatus`). Zero changes to `run-automations`.
- Add `contacts.lifecycle_stage` (new column, values `'Novo' | 'Ativo' | 'Dormindo' | 'VIP'`, default `'Novo'`) as a **read/segmentation-only** dimension. `run-automations` never touches it. It can layer into `campaigns.target_tags`-style filtering later (or reuse `target_tags` directly if VIP is modeled as a tag instead of a lifecycle_stage value — see below) without any risk to the send engine.
- `Opt-out` in the milestone's 5-state model maps onto the existing `status='Inativo'` value (rename display label only, no data migration needed if `'Inativo'` is kept internally, or a one-time `UPDATE contacts SET status='Opt-out' WHERE status='Inativo'` if the literal string must change — cheap either way).

This means only 4 of the 5 requested states (`Novo`, `Ativo`, `Dormindo`, `VIP`) live in the new `lifecycle_stage` column; `Opt-out` stays where it already lives (`status`) because it's the one state that must affect sending, and that mechanism already exists and works.

**Alternative considered and rejected:** modeling `Dormindo`/`VIP`/`Novo` as entries in the existing `tags text[]` array (consistent with how `Novo`/`Antigo` already work by convention). Rejected because tags are explicitly user-editable free text with no schema enforcement (`Contacts.jsx:editTags` is a raw `prompt()`) — fine for a manual once-per-import label, wrong shape for a value an automated job overwrites on a schedule (a user's manual tag edit could be silently clobbered by the cron job, or the cron job's tag could be silently removed by a user editing tags for an unrelated reason). A dedicated column is unambiguous about who owns the value.

### Automatic transition mechanism: new pg_cron job, not an extension of `run-automations`, not a trigger alone

| Option | Verdict | Why |
|---|---|---|
| **Extend `run-automations`** | ❌ Reject | Wrong cadence (runs every 5 min; a "no interaction in N days" check only needs to run once/day — 288x wasted invocations/day for no benefit). Also mixes concerns: `run-automations` is already a time-boxed (60s Edge Function cap), budget-constrained sending engine; adding unrelated CRM housekeeping increases the blast radius of any bug there — a bug in lifecycle logic could break campaign sending. |
| **Pure Postgres trigger** (e.g., `AFTER INSERT` on `inbound_messages`/`message_logs`) | ❌ Reject alone | Triggers fire on events. "No interaction in N days" is a condition defined by the *absence* of an event — nothing fires to notice that N days have passed with silence. Triggers are the right tool for the *reactivation* half (contact replies → `Dormindo`/`Novo` → `Ativo`, event-driven, instant) but structurally cannot do the *decay* half alone. |
| **New standalone pg_cron job → PL/pgSQL function (no edge function)** | ✅ Recommended | Matches the existing precedent of `try_consume_daily_send_budget()` — pure data logic with no external API calls belongs in SQL, callable directly via `pg_cron.schedule('update-contact-lifecycle', '0 3 * * *', $$ SELECT update_contact_lifecycle_stages(); $$)`, no HTTP round-trip, no Edge Function timeout risk, runs once/day (or whatever cadence fits "N days"), fully decoupled from the sending cron. |

**Recommended shape:**
```sql
CREATE OR REPLACE FUNCTION update_contact_lifecycle_stages() RETURNS void AS $$
BEGIN
  -- Novo -> Ativo after first N days or first reply (reactivation can also be
  -- done instantly in zapi-webhook when inbound_messages gets a new row —
  -- cheap event-driven upgrade, doesn't need to wait for the nightly sweep)
  UPDATE contacts SET lifecycle_stage = 'Ativo'
    WHERE lifecycle_stage = 'Novo' AND created_at < now() - interval '7 days';

  -- Ativo -> Dormindo: no inbound_messages row in N days AND no message_logs
  -- 'sent' in N days (adjust definition of "interaction" per product decision)
  UPDATE contacts c SET lifecycle_stage = 'Dormindo'
    WHERE lifecycle_stage = 'Ativo'
      AND NOT EXISTS (
        SELECT 1 FROM inbound_messages im
        WHERE im.contact_id = c.id AND im.received_at > now() - interval '30 days'
      );

  -- VIP is presumably a manual/tag-driven promotion (business decides who's
  -- VIP), not decay-based — this function should not auto-assign or auto-
  -- remove VIP; leave that as a manual toggle in Contacts.jsx, same shape as
  -- today's toggleStatus().
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
Reactivation (`Dormindo`/`Novo` → `Ativo` on reply) is a 1-line `UPDATE` added inside `zapi-webhook`'s existing inbound-message-logging step — event-driven, instant, cheap, no new infrastructure.

**Risk flag for the roadmap:** this is the one feature of the four that touches a column the send engine reads. It should be built and tested last among the four, and the two-column split above is the mitigation.

---

## 2. Plan limits (contacts/numbers/campaigns per plan)

**Already solved — extend, don't re-architect.** `plan_limits` is exactly the "config table" option and it's already in production use (`Contacts.jsx:fetchPlanLimit`, `AdminPricing.jsx` references it directly in its own UI copy). `clients.plan` is already the derivation key into it.

Phase 2 needs only:
```sql
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS campaigns_limit int; -- null = unlimited
```
and to `INSERT ... ON CONFLICT DO UPDATE` the same 4 plan rows with a campaigns-per-month figure (mirroring the exact pattern already in `supabase_planos_limites.sql`).

The **consumption dashboard** is then three read-only queries per client, all against tables/columns that already exist:
- Contacts used: `count(*) FROM contacts WHERE client_id = ?` (already computed client-side in `Contacts.jsx` as `contacts.length`) vs. `plan_limits.contacts_limit` **plus** any active `client_addons` of type `contacts_1000` (the `+extra` logic already written in `Contacts.jsx:fetchPlanLimit` — copy that logic, don't reinvent it).
- Numbers used: `count(*) FROM client_numbers WHERE client_id = ? AND active = true` vs. `plan_limits.numbers_limit` plus active `number` add-ons.
- Campaigns this month: `count(*) FROM campaigns WHERE client_id = ? AND created_at >= date_trunc('month', now())` vs. the new `campaigns_limit`.

No new tables, no new RLS policy shape (same `client_id`-scoped read already used everywhere), no edge function required — this can be a page-level `useEffect` in a new `src/pages/Dashboard.jsx` section or a new `src/pages/Usage.jsx`, following the exact fetch pattern shown in `STRUCTURE.md`'s "Adding a New Feature" walkthrough.

**No dependency** on feature (1) or (3). It reads `contacts` regardless of `lifecycle_stage`/`status` value (today's count is unfiltered by status — keep it that way unless product wants "active only" counted against the limit, which would be a one-line `.eq()` addition, decided independently of the lifecycle feature's existence).

---

## 3. Subscription status surfaced from `mp-webhook`

Two subscription-shaped things exist today and they're currently separate; the milestone's "subscription status (Ativa/Em atraso/Cancelada) synced from mp-webhook" needs a decision about which one it's describing, because they have different degrees of "automatic":

- **Add-ons** (number/contacts add-ons): fully automatic today. `mp-webhook` already flips `client_addons.status` in real time from real MP `preapproval`/`payment` events.
- **The base plan itself**: deliberately **manual** today (Pix/boleto outside the system) — `clients.plan_next_charge_at` is operator-entered, and "Ativa/Em atraso" is computed client-side from that date, by explicit design (see §0.3) specifically so it can't drift from reality if a job doesn't run.

**Recommendation: don't add a new column or table on `clients` for this.** Two clean paths depending on what "subscription" means here:

- **If it means the add-on subscriptions**: no schema change needed at all — just build the dashboard read against `client_addons` (already updated automatically by the existing webhook) and display its `status` per addon. This is the *lowest-risk, zero-new-infrastructure* interpretation and is fully consistent with "sync from mp-webhook" as literally stated (mp-webhook already **is** the sync).
- **If the base plan itself is meant to move onto Mercado Pago recurring billing** (i.e., "Ativa/Em atraso/Cancelada" should reflect the *main* subscription, not just add-ons): model it as **another row in `client_addons`** with a new `addon_type = 'plan'` rather than a parallel status mechanism on `clients`. This reuses the exact webhook code path already live in `mp-webhook/index.ts` (it already branches on `isSubscriptionEvent` for `preapproval` — a plan-type MP preapproval would flow through the identical `newStatus` logic, just with a different `external_reference` pointing at the plan-addon row instead of a number-addon row). This is the "extend an existing mechanism" answer — it avoids maintaining two different places where "is this client's money current" can be asked, and doesn't disturb the already-shipped, explicitly-designed-to-be-manual `plan_next_charge_at` flow for clients who stay on manual billing.

Either way: **no new column on `clients`, no new table.** The manual date-based "Em dia/Atrasado" computation for manually-billed clients stays exactly as `supabase_plan_billing.sql` intentionally designed it (computed, never stored) — the new work is additive (surfacing `client_addons.status`), not a replacement of the existing manual mechanism. A client that's on manual billing simply won't have a `'plan'`-type `client_addons` row, and the dashboard falls back to the date-computed indicator; a client migrated to MP recurring billing for the plan gets the automatic one. Both can render into the same UI slot.

**Dependency:** none on features (1), (2), (4). Touches `mp-webhook` (additive branch, not a rewrite) and a new dashboard read.

---

## 4. LinkedIn CSV lead import with origin tagging → existing campaign

**This is close to already-supported by existing infrastructure — reuse, don't build a parallel import path.**

`Contacts.jsx:handleImportCSV` already:
- Accepts arbitrary column layouts via header-alias matching (`NAME_ALIASES`, `PHONE_ALIASES`, `BIRTH_ALIASES`, `normalizeHeader()`), including scanning the first 50 rows for a real header (built for messy real-world exports).
- Applies a single `importTag` to every genuinely-new contact in the batch (`allowedNewTagged`), while never touching tags on contacts that already existed.
- Enforces the plan's `contacts_limit` (+ add-on extra) at import time, same code path any other import would use.
- Dedupes by phone within the file and against existing contacts (`upsert onConflict client_id,phone`).

**"Origin tagging" = the existing `importTag` mechanism, used as-is.** A LinkedIn import is: open the same import UI, set the tag field to `"LinkedIn"` (or `"Origem: LinkedIn"`) instead of `"Novo"`. No new column, no new table — this is the same convention already established for `Novo`/`Antigo` (§0.4), just a new tag value. Consistent with the existing philosophy of using `tags` for informational/segmentation labels and reserving schema columns for things the system enforces or automates (see the rationale for *not* doing this for lifecycle in §1).

**"Routing into an existing campaign" = the existing `campaigns.target_tags` mechanism, used as-is.** Set (or confirm) `target_tags = '{LinkedIn}'` on the destination campaign — `run-automations`' contact query for that campaign then naturally picks up only tag-matching contacts. No campaign-model change needed.

**One real gap to flag for planning, not an architecture problem:** LinkedIn's native "Connections" CSV export does not include phone numbers (privacy — LinkedIn strips them). If the source is that native export rather than a lead-gen tool's export, `PHONE_ALIASES` will find no phone column and the existing `toInsert.filter(c => c.phone.length >= 8 && c.name)` will silently drop every row. This isn't an architecture decision (no schema/pattern change fixes it) — it's a product question of what the actual CSV source is, worth raising to whoever wrote the milestone before phase planning locks in scope. If it's a lead-gen/scraper export with phone numbers, the existing import path handles it with zero changes.

**Dependency:** none. Fully independent of features (1)–(3); in fact almost buildable with zero backend changes at all (arguably just a UI label + docs change), making it the lowest-risk, fastest feature of the four.

---

## Build order recommendation (risk-ordered, not just dependency-ordered)

None of the four features has a hard *data* dependency on another — they touch disjoint tables/columns except where noted. The ordering below is driven by **risk to the existing automation engine**, which is the thing most worth protecting:

1. **LinkedIn CSV import** — reuses existing `Contacts.jsx` + `target_tags` verbatim; near-zero new code, zero risk to `run-automations`. Build first to validate the "reuse tags/target_tags convention" pattern cheaply before other features lean on it.
2. **Plan-consumption dashboard** — purely additive reads against `plan_limits`/`client_addons`/`contacts`/`client_numbers`/`campaigns`; no writes to anything `run-automations` touches. Zero risk.
3. **Subscription status** — additive branch in `mp-webhook` (or a new `addon_type` value flowing through existing logic) + a dashboard read; doesn't touch `contacts`, `campaigns`, or the send loop at all. Low risk, isolated to the payments edge function.
4. **Contact status lifecycle** — build last. It's the only feature that touches a column (`contacts.status`) the send engine gates on, which is why the plan above splits it into `status` (untouched, still the send gate) + new `lifecycle_stage` (new, cron-owned, read-only to the send engine). Sequencing it last means the other three are shipped and stable before touching the highest-blast-radius table in the schema.

---

End of Phase 2 architecture research.
