# ZapFlow Technical Debt & Concerns

> **Date generated:** 2026-07-05
> **Scope:** Cross-reference with existing changelogs + new findings from codebase analysis
> **Status classifications:** 
> - 🔴 **CRITICAL** — blocks production/scale, security-level, or creates data loss risk
> - 🟠 **HIGH** — significantly impacts UX/reliability, operational burden, or moderate security concern
> - 🟡 **MEDIUM** — degraded experience, code quality debt, or optional hardening
> - 🟢 **LOW** — nice-to-have, future optimization, documentation

---

## 1. UNVALIDATED LIVE FEATURES (Blocking Feature Completeness)

### 1.1 Button Message Payload Format — Not Tested With Z-API
**Severity:** 🔴 CRITICAL (feature incomplete) | **Source:** CHANGELOG-BUGFIXES-ANTIBLOQUEIO-2026-07-03.md (item 6 + comment) + `run-automations/index.ts:162-170`, `zapi-webhook/index.ts:24-30`

**What it is:**
- `sendButtonMessage()` in both `run-automations` and `zapi-webhook` follow Z-API's public documentation for `send-button-list` endpoint
- `extractButtonReply()` in `zapi-webhook/index.ts:148-158` attempts to parse button clicks from documented Z-API formats (`buttonsResponseMessage` / `listResponseMessage`)
- **Neither has been tested against real Z-API traffic** — no Z-API number currently active in production

**Impact:**
- When first Z-API number connects and sends a campaign with quick-reply buttons:
  - Sending buttons: if Z-API format differs from documentation, `sendButtonMessage` will fail, responses logged as `status='error'` with Z-API's error detail (not transaction-blocking, retried next cron cycle)
  - Receiving button clicks: if Z-API's click payload differs, `extractButtonReply()` returns null, click falls through to text-only logic (no crash, but `ask_choice` flow doesn't advance)

**Remediation (Documented):**
1. First live button send/click: check Supabase Functions logs (`zapi-webhook` + `run-automations`) and `message_logs.response_json` for actual payload
2. Adjust `sendButtonMessage()` or `extractButtonReply()` if format diverges
3. Add integration test once known

**Current Status:** Awaiting Z-API activation (Leonardo pays for plan).

---

### 1.2 `ask_choice` Flow (Multi-Level Button Flow) — Not Live-Tested
**Severity:** 🟠 HIGH (partial feature) | **Source:** CHANGELOG-BUGFIXES-ANTIBLOQUEIO-2026-07-03.md (6.1 + 6.2)

**What it is:**
- Buttons can trigger `action: "ask_choice"` (ask a follow-up question with sub-buttons) → then route to `notify_phone`
- Uses `conversation_states.state = 'awaiting_choice'` to track multi-step flow
- Implemented in `zapi-webhook/index.ts` and `run-automations/index.ts`, but depends on 1.1 (button payload format)

**Impact:**
- Hassum's "Não quero limpeza, prefiro outro serviço" button → asks "Qual procedimento você prefere?" → person clicks option → notifies dentist
- If button format isn't right (1.1), conversation state machine never advances, person gets stuck

**Remediation:**
- Depends on fixing 1.1 first
- Then manually test the Hassum campaign end-to-end (sending button → clicking option → notification arrival)

---

### 1.3 Z-API Webhook Not Yet Configured in Production
**Severity:** 🔴 CRITICAL (feature offline) | **Source:** CHANGELOG-AUTOMACOES-HASSUM.md (item 3)

**What it is:**
- Inbound message webhook (`zapi-webhook` Edge Function) deployed but NOT registered in Z-API panel
- Without it, received messages are never logged → `has_replied` condition always returns false → follow-ups go to everyone always

**Impact:**
- Follow-up campaigns trigger even for people who already responded
- "EU QUERO" flow broken (person types "eu quero", nothing happens because webhook is offline)
- Button clicks not captured (depends on 1.1 + 1.3)

**Remediation:**
- Leonardo configures webhook in Z-API panel: `PUT https://api.z-api.io/instances/{instanceId}/token/{token}/update-webhook-received` with `{"value": "https://bhiggyigsrqfabqhutne.functions.supabase.co/zapi-webhook"}`
- Test: send a message to the Hassum number, check `inbound_messages` table

---

## 2. AUTOMATION TRIGGERS INCOMPLETE (Feature Gaps in Automations)

### 2.1 Trigger `tag_added` Requires Manual Event — Polling Not Implemented
**Severity:** 🟠 HIGH (feature advertised but not functional) | **Source:** CHANGELOG-MVP-AUTOMACOES.md (item 3), `run-automations/index.ts` + `supabase_automations.sql`

**What it is:**
- Automation trigger `tag_added` listed in automations UI but no mechanism to detect when a tag is added to a contact
- Currently, automations only trigger on `birthday` (on cron) or manual `scheduled`/`daily` campaigns
- Would require either:
  - A database trigger on `contacts.tags` JSONB column → fires notification → `run-automations` checks for matching automations (polling approach)
  - Or a webhook when tags change (not implemented)

**Impact:**
- Automation can't react to "tag added" events (feature promised but offline)

**Remediation:**
- Option A (Low effort): Add Postgres trigger on `contacts` UPDATE → notify `run-automations` of tag changes
- Option B (Not done): Implement tag-change webhook
- For now: document that `tag_added` trigger not available

---

### 2.2 Trigger `first_purchase` Not Implemented
**Severity:** 🟠 HIGH (feature advertised but not functional) | **Source:** CHANGELOG-MVP-AUTOMACOES.md (item 3)

**What it is:**
- "first_purchase" trigger listed but ZapFlow has no purchase/transaction tracking — it's a messaging tool for contact management, not a payment processor
- Likely confusion from earlier design docs

**Impact:**
- Feature doesn't work, confusing to users

**Remediation:**
- Remove from automation trigger UI, or document that it requires external event injection (not automatic)

---

### 2.3 Condition `has_replied` Requires Webhook (Offline Until 1.3 Fixed)
**Severity:** 🔴 CRITICAL (feature online but blocked) | **Source:** CHANGELOG-MVP-AUTOMACOES.md (item 3), `zapi-webhook/index.ts`

**What it is:**
- Automation condition `has_replied = true` checks if contact has sent any `inbound_message` since campaign dispatch
- Depends on webhook (1.3) to populate `inbound_messages`
- Without webhook, table stays empty → condition always returns false

**Impact:**
- Automations can't branch on "did the person respond?" (feature online but non-functional)

**Remediation:**
- Configure webhook (1.3)

---

## 3. PAGINATION LIMIT RISK — 1000 Row Hard Limit

**Severity:** 🟠 HIGH (bug waiting for scale) | **Source:** `run-automations/index.ts:22-44` (well-handled), but same limit affects client code

**What it is:**
- Supabase PostgREST API defaults to max 1000 rows per request (`db-max-rows` setting)
- `run-automations` correctly handles pagination with `fetchAllPages()` helper
- Frontend code (e.g., `Contacts.jsx`, `Dashboard.jsx`) may not paginate properly

**Impact:**
- Client with 1000+ contacts: dashboard tables truncated, contact search incomplete
- Campaigns to 1000+ contacts: dedup of who received the campaign (via `message_logs`) incomplete → potential re-sends

**Current State:**
- `run-automations`: ✅ Paginated correctly
- Frontend tables: ⚠️ Not verified (no live testing of authenticated screens in QA report)

**Remediation:**
- Audit `Contacts.jsx`, `Dashboard.jsx`, `Reports.jsx`, `AdminClients.jsx`, `AdminDashboard.jsx` for pagination (search for `select()` calls without pagination)
- Add page size parameter to large queries
- Test with 1500+ contact client

---

## 4. SECURITY & PRIVACY GAPS

### 4.1 Zero LGPD Compliance Documentation
**Severity:** 🔴 CRITICAL (legal risk) | **Source:** RELATORIO-QA-2026-07-03.md (section 4)

**What it is:**
- ZapFlow processes personal data (name, phone, birth date, WhatsApp messages) of third-party individuals (patients, customers) on behalf of clients
- No privacy policy, terms of service, portability export, or data retention policy
- No data processing agreement between ZapFlow and clients

**Impact:**
- LGPD liability for ZapFlow (as data processor/operator)
- Clients unaware of their own obligations to titleholders
- Regulatory risk if LGPD inspection occurs

**Remediation:**
1. Draft privacy policy + terms of service (with legal review)
2. Implement data export/portability (contact → JSON/CSV export)
3. Implement data retention/deletion after client cancellation (cron job to cascade-delete contacts 30 days after account deletion)
4. Add data processing agreement template for clients to sign
5. Add opt-out confirmation page (already implemented in-app, but needs legal notice)

---

### 4.2 Webhook Secret Validation OFF by Default
**Severity:** 🟠 HIGH (operational risk) | **Source:** RELATORIO-QA-2026-07-03.md (3.2), `zapi-webhook/index.ts:41-60`, `mp-webhook/index.ts`

**What it is:**
- Both `zapi-webhook` and `mp-webhook` accept optional secret token (`?token=X` in URL)
- **Secret is OFF by default** — no env vars set, so any request is accepted
- If attacker discovers webhook URL, can:
  - Call `zapi-webhook` → log fake "messages received" → trigger automations with false data
  - Call `mp-webhook` → log fake payment → grant incorrect billing credits
  - Consume daily sending budget (100 msgs) with fake webhook calls

**Impact:**
- Denial of service on message budget
- Billing manipulation
- Data pollution in `inbound_messages`

**Current Activation Status:** Off; activation requires:
1. Generate secret: `openssl rand -hex 24`
2. Set env vars in Supabase Functions: `ZAPI_WEBHOOK_SECRET`, `MP_WEBHOOK_SECRET`
3. Update webhook URLs in Z-API + Mercado Pago panels to include `?token=SECRET`

**Remediation:**
- **Before scaling to multiple paying clients:** activate webhook secrets
- Document in deployment checklist

---

### 4.3 Admin Password Exposure (Historical — Token Still in Git)
**Severity:** 🟠 HIGH (historical risk, present in git) | **Source:** CHANGELOG-MVP-AUTOMACOES.md (item 1)

**What it is:**
- Admin password was in plaintext in `supabase_schema.sql` (git history)
- Was removed from current code, but git history still contains it
- User was told to manually change admin password in Supabase Auth UI

**Impact:**
- If anyone clones this repo, `git log` will reveal old password
- Low risk if password was changed, but best practice is to rotate it anyway

**Remediation:**
- Change admin password in Supabase Auth again (already done per changelog)
- Consider `git filter-branch` or `git-filter-repo` to rewrite history if password change wasn't actually executed

---

## 5. UNIMPLEMENTED FEATURES / PLACEHOLDERS

### 5.1 `zapi_token` Still Read in AdminNumbers.jsx Form (By Design, But Risky)
**Severity:** 🟡 MEDIUM (design decision, not a bug) | **Source:** `pages/admin/AdminNumbers.jsx:89`

**What it is:**
- Admin form for editing Z-API number credentials includes `zapi_token` field (admin types the token)
- Token is sent to Supabase in the request → stored in database (secure server-side)
- This is intentional — it's the form where the token is **input**, not where it's **exposed**

**But:** Code comments note that `Settings.jsx` (client-facing) **used to** read token from DB and call Z-API directly (fixed in 07-03, now calls `zapi-status` Edge Function instead)

**Impact:** None currently (admin form is legitimate). Historical risk eliminated.

**No action needed** — just document that admin form display of `zapi_token` is safe by design.

---

### 5.2 Manual Z-API Provisioning & Photo Upload Pending
**Severity:** 🟠 HIGH (product incomplete) | **Source:** CHANGELOG-AUTOMACOES-HASSUM.md (items 1-3)

**What it is:**
- Hassum campaign won't send real messages until:
  1. Z-API number paid/activated (Leonardo's action)
  2. Photos uploaded to `creatives/hassum/` bucket (Leonardo's action)
  3. Webhook configured (1.3 above)
  4. Paulo's WhatsApp number updated in DB (Leonardo's action, already has default)

**Impact:**
- Hassum campaigns run through pipeline but fail silently (hit Z-API, get "number inactive" error, logged in `message_logs.response_json`)

**Remediation:**
- Operational checklist, not code fix

---

## 6. CODE QUALITY & ARCHITECTURAL DEBT

### 6.1 Code Duplication — `sendButtonMessage()` in Two Places
**Severity:** 🟡 MEDIUM (maintainability debt) | **Source:** `run-automations/index.ts:170-192` vs `zapi-webhook/index.ts:87-114`

**What it is:**
- Identical logic for sending button messages exists in both Edge Functions
- No shared code folder (each function is published independently)
- If Z-API format changes, must update two places

**Impact:**
- If button format needs adjustment, risk of inconsistency

**Remediation:**
- Extract to shared utility module (would require restructuring Supabase Functions deploy)
- For now: add comment with "also in X" cross-reference

---

### 6.2 No Schema Versioning / Migrations Folder
**Severity:** 🟡 MEDIUM (operational risk) | **Source:** Project root has 19 `.sql` files, no `migrations/` folder

**What it is:**
- SQL changes tracked as individual files in repo root (e.g., `supabase_automations.sql`, `supabase_campaign_stop_date.sql`)
- No formal migration version numbers or application order
- Unclear which migrations have been applied to production vs local dev

**Impact:**
- New developer unclear on deployment order
- Production schema state hard to track
- Difficult to rollback

**Remediation:**
- Move SQL to `supabase/migrations/` with numbered filenames: `001_initial_schema.sql`, `002_security_fixes.sql`, etc.
- Document which migrations have been applied to production
- Use Supabase CLI migration workflow

---

### 6.3 No Structured Error Logging / Observability
**Severity:** 🟡 MEDIUM (operational burden) | **Source:** Edge Functions have `console.error()` / `console.warn()`, but no structured logging

**What it is:**
- Edge Functions use `console.log()`, `console.error()`, `console.warn()` for debugging
- No JSON-structured logs, no log levels, no context propagation
- Supabase Function logs are viewable in Dashboard but hard to query/aggregate

**Impact:**
- Hard to debug production issues without manual log inspection
- No alerting on error patterns

**Remediation:**
- Implement structured logging helper (log function errors + stack + context as JSON)
- Document where to find logs for each function
- Set up Supabase log alerts if available

---

### 6.4 No Rate Limiting on Webhooks
**Severity:** 🟡 MEDIUM (abuse/DoS risk) | **Source:** `zapi-webhook`, `mp-webhook` have no rate limiting

**What it is:**
- Both webhooks accept any request (with optional secret token, but OFF by default)
- No rate limit: max requests per second / per IP / per account
- Attacker could spam webhook → burn Supabase Functions credits / exhaust quota

**Impact:**
- DoS vulnerability

**Remediation:**
- If/when webhook secrets are enabled (4.2), add basic rate limiting (e.g., max 100 calls/minute per token)
- Document rate limits in Edge Function code

---

### 6.5 Missing Integration Tests for Complex Flows
**Severity:** 🟡 MEDIUM (quality/confidence risk) | **Source:** No test files found in `src/` or `supabase/functions/`

**What it is:**
- New complex features (automations, campaigns, follow-ups, button flows) have no end-to-end tests
- All testing done manually ("test the Hassum campaign manually when Z-API is live")

**Impact:**
- Regressions not caught until production
- New developers have no tests to understand expected behavior

**Remediation:**
- Add Jest tests for React components (Contacts, Campaigns, Automations, etc.)
- Add Playwright/E2E tests for critical flows (login → create campaign → monitor dispatch → receive followup)
- Add tests for Edge Functions (mock Supabase + fetch calls, simulate webhook payloads)

---

## 7. OPERATIONAL & DEPLOYMENT GAPS

### 7.1 CSP Headers Need Post-Deploy Validation
**Severity:** 🟡 MEDIUM (risk of breaking after deploy) | **Source:** RELATORIO-QA-2026-07-03.md (3.3)

**What it is:**
- Content Security Policy headers added to `vercel.json` (blocks external scripts, fonts, etc.)
- CSP is strict and can break unexpected functionality

**Risk:** After next deploy, if any resource (font, API call, etc.) violates CSP, will get "Refused to..." errors in browser console.

**Remediation:**
- After deploy: open site in browser, check console for CSP violations
- If found, adjust `vercel.json` CSP rules

---

### 7.2 No Database Backup Strategy Documented
**Severity:** 🟡 MEDIUM (disaster recovery gap) | **Source:** No backup docs in codebase

**What it is:**
- Supabase provides daily backups by default (free tier), but:
  - Retention is 7 days (limited)
  - Restoration is manual
  - No documented procedure for emergency recovery

**Impact:**
- Data loss scenario has no documented recovery procedure

**Remediation:**
- Document Supabase backup retention + recovery procedure
- Consider upgrading to longer retention or external backup service

---

### 7.3 No Production Monitoring / Alerting
**Severity:** 🟡 MEDIUM (observability gap) | **Source:** No mention of monitoring in docs or code

**What it is:**
- No monitoring dashboard for:
  - Edge Function error rates
  - Daily message send budget consumption
  - Campaign delivery success rates
  - Webhook processing latency

**Impact:**
- Issues discovered by users, not by proactive monitoring

**Remediation:**
- Set up Vercel analytics (built-in)
- Add Supabase Function logging dashboard
- Create simple dashboard with KPIs:
  - Messages sent today / capacity
  - Failed webhook calls
  - Edge Function execution time

---

## 8. KNOWN ISSUES IN CHANGELOG — STILL OPEN

### 8.1 `access_key` Login Untested in Production
**Severity:** 🟠 HIGH (feature untested) | **Source:** CHANGELOG-AUTH-REAL.md, CHANGELOG-MVP-AUTOMACOES.md (item 4)

**What it is:**
- Client login via `access_key` was rebuilt to use real Supabase Auth (not just localStorage)
- Tested in dev, but explicitly flagged as "needs production testing"

**Impact:**
- If production login fails, all clients locked out

**Remediation:**
- Have Leonardo (or client) test live login with Hassum credentials after all other fixes are in place
- Document "first-login test procedure" for new clients

---

### 8.2 Mobile Testing Incomplete (Authenticated Screens)
**Severity:** 🟡 MEDIUM (UX debt) | **Source:** RELATORIO-QA-2026-07-03.md (section 1)

**What it is:**
- Mobile responsiveness fixed for public pages (Landing, Login)
- Authenticated screens (Dashboard, Contacts, Campaigns) not tested on physical mobile device

**Impact:**
- UX degradation for clients using phone to manage contacts/campaigns

**Remediation:**
- Test Dashboard, Contacts, Campaigns, Settings on iPhone 12 or Pixel 6 (375px width)
- Verify sidebar drawer, table scrolling, form inputs work

---

## 9. SUMMARY TABLE (Quick Reference)

| Issue | Severity | Category | Blocks Production? | Owner |
|-------|----------|----------|-------------------|-------|
| Button format not validated (1.1) | 🔴 | Feature incomplete | Awaiting Z-API | Z-API activation |
| `ask_choice` flow not tested (1.2) | 🟠 | Feature incomplete | Partial (test needed) | Test when 1.1 done |
| Webhook not configured (1.3) | 🔴 | Feature offline | Yes | Leonardo (Z-API panel) |
| `tag_added` trigger not impl. (2.1) | 🟠 | Feature gap | No (feature offline) | Engineer |
| `first_purchase` trigger not impl. (2.2) | 🟠 | Feature gap | No (feature offline) | Engineer |
| Pagination limit 1000 (3) | 🟠 | Bug at scale | Not yet (scale test) | Engineer |
| LGPD compliance gap (4.1) | 🔴 | Legal | Yes (before scale) | Legal + Engineer |
| Webhook secrets OFF (4.2) | 🟠 | Security | Before scaling clients | Engineer |
| Admin password in history (4.3) | 🟠 | Security | Partial (password changed?) | Engineer |
| Code duplication (6.1) | 🟡 | Quality | No | Engineer (nice-to-have) |
| No migrations folder (6.2) | 🟡 | Quality | No | Engineer |
| No structured logging (6.3) | 🟡 | Quality | No | Engineer |
| No rate limiting (6.4) | 🟡 | Security | No (low risk) | Engineer |
| No integration tests (6.5) | 🟡 | Quality | No | Engineer |
| CSP post-deploy check (7.1) | 🟡 | Operational | Maybe (post-deploy) | Leonardo (after deploy) |
| No backup strategy (7.2) | 🟡 | Operational | No | Engineer |
| No monitoring (7.3) | 🟡 | Operational | No | Engineer |
| `access_key` production untested (8.1) | 🟠 | Feature | Yes (before production) | Leonardo (test) |
| Mobile auth screens untested (8.2) | 🟡 | UX | No | Engineer |

---

## 10. RECOMMENDED ACTION PRIORITY (For Next Sprint)

### 🔴 **Must Do Before Production Scale:**
1. Configure webhook in Z-API panel (1.3) — unblocks all message-based features
2. Activate webhook secret validation (4.2)
3. Draft + review LGPD compliance docs + data deletion policy (4.1)
4. Test `access_key` login live (8.1)
5. Test button + `ask_choice` flows live (1.1, 1.2)

### 🟠 **Should Do Before Scaling to 5+ Clients:**
1. Implement pagination fix for frontend queries (3)
2. Implement `tag_added` trigger or remove from UI (2.1)
3. Post-deploy CSP validation (7.1)
4. Mobile auth screen testing (8.2)
5. Basic monitoring dashboard (7.3)

### 🟡 **Nice-to-Have (Next Phase):**
1. Code deduplication (6.1)
2. Migrations folder + numbered SQL (6.2)
3. Structured logging (6.3)
4. Rate limiting (6.4)
5. Integration tests (6.5)

---

## 11. FILES INVOLVED (For Quick Reference)

### Frontend
- `src/contexts/AuthContext.jsx` — auth logic
- `src/pages/Campaigns.jsx` — campaign mgmt (has TODO comment)
- `src/pages/Automations.jsx` — automation UI
- `src/pages/Contacts.jsx` — contact list (pagination risk)
- `src/pages/Dashboard.jsx` — dashboard (pagination risk)
- `src/pages/admin/AdminNumbers.jsx` — Z-API number config
- `src/pages/admin/AdminClients.jsx` — client mgmt
- `vercel.json` — CSP headers, deployment config

### Backend (Edge Functions)
- `supabase/functions/run-automations/index.ts` — campaign/automation engine (OK on pagination, but button format unvalidated)
- `supabase/functions/zapi-webhook/index.ts` — inbound messages (offline until 1.3)
- `supabase/functions/mp-webhook/index.ts` — Mercado Pago billing (webhook secret optional)
- `supabase/functions/send-message/index.ts` — message dispatch
- `supabase/functions/client-login/index.ts` — auth (untested in production)

### Database / Schema
- `supabase_automations.sql` — automation schema
- `supabase_campaign_*.sql` (4 files) — campaign features
- `supabase_client_real_auth.sql` — auth schema
- `supabase_security_fixes.sql` — RLS policies
- `supabase_automacoes_avancadas.sql` — daily budget tracking
- `supabase_seed_hassum.sql` — Hassum data (pending manual updates)

### Documentation
- `CHANGELOG-MVP-AUTOMACOES.md` — items 3, 4 (triggers, has_replied, zapi_token)
- `CHANGELOG-AUTOMACOES-HASSUM.md` — items 1-4 (pending setup)
- `CHANGELOG-BUGFIXES-ANTIBLOQUEIO-2026-07-03.md` — items 6, 6.1, 3.2, 3.3
- `CHANGELOG-AUTH-REAL.md` — access_key production test needed
- `RELATORIO-QA-2026-07-03.md` — sections 1 (mobile), 3 (CSP), 4 (LGPD)

---

## 12. CROSS-REFERENCES TO EXISTING CHANGELOG ITEMS

This document extracts and cross-references still-OPEN items from:

| Changelog File | Item | Status | Details |
|---|---|---|---|
| CHANGELOG-MVP-AUTOMACOES.md | "Gatilhos `tag_added`, `first_purchase`" | 🔴 Not implemented | See 2.1, 2.2 |
| CHANGELOG-MVP-AUTOMACOES.md | "Condição `has_replied` sempre false" | 🔴 Depends on webhook | See 2.3, 1.3 |
| CHANGELOG-MVP-AUTOMACOES.md | "`zapi_token` token exposição" | ✅ Fixed (07-03) | See 5.1 (historical, now safe) |
| CHANGELOG-MVP-AUTOMACOES.md | "Login por `access_key` untested" | 🟠 Needs prod test | See 8.1 |
| CHANGELOG-AUTOMACOES-HASSUM.md | "Webhook not configured" | 🔴 Pending Leonardo | See 1.3 |
| CHANGELOG-AUTOMACOES-HASSUM.md | "Z-API not connected" | 🔴 Pending Leonardo | See 5.2 |
| CHANGELOG-AUTOMACOES-HASSUM.md | "Photos not uploaded" | 🔴 Pending Leonardo | See 5.2 |
| CHANGELOG-BUGFIXES-ANTIBLOQUEIO-2026-07-03.md | "Button format not validated live" | 🔴 Unvalidated | See 1.1 |
| CHANGELOG-BUGFIXES-ANTIBLOQUEIO-2026-07-03.md | "`ask_choice` actions" | 🟠 Depends on 1.1 | See 1.2 |
| CHANGELOG-BUGFIXES-ANTIBLOQUEIO-2026-07-03.md | "CSP post-deploy check" | 🟡 Action item | See 7.1 |
| CHANGELOG-BUGFIXES-ANTIBLOQUEIO-2026-07-03.md | "Webhook secret optional" | 🟠 Should activate | See 4.2 |
| RELATORIO-QA-2026-07-03.md | "Mobile auth screens untested" | 🟡 QA gap | See 8.2 |
| RELATORIO-QA-2026-07-03.md | "LGPD compliance gap" | 🔴 Legal risk | See 4.1 |

---

**End of CONCERNS.md**
