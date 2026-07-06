# ZapFlow Architecture

**Version:** 1.0  
**Last Updated:** 2026-07-03  
**Pattern:** React SPA (Vite + TailwindCSS) + Supabase BaaS (Postgres + Auth + Edge Functions)  
**Deployment:** Vercel (frontend) + Supabase Cloud (backend/database)

---

## System Pattern: Three-Tier SPA + Edge Functions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                               │
│  React 18 App (src/*.jsx)                                               │
│  ├─ Router: react-router-dom v6 (SPA, lazy-loaded routes)               │
│  ├─ Auth: useAuth() context (session validation)                        │
│  └─ Data: supabase.from().select/insert/update (PostgreSQL queries)     │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    EDGE LAYER (Serverless)                              │
│  Supabase Edge Functions (Deno + TypeScript)                            │
│  ├─ send-message:       Direct campaign send (auth required)            │
│  ├─ run-automations:    Daily/scheduled campaigns + follow-ups          │
│  ├─ zapi-webhook:       Inbound message handler (public)                │
│  ├─ client-login:       Key→Auth exchange                               │
│  ├─ zapi-status:        Message status updates (from Z-API webhook)     │
│  └─ [mp-*]:             MercadoPago webhook handlers                    │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ SQL/JSON ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    POSTGRES (Relational DB)                             │
│  Schemas: public + auth (Supabase Auth tables)                          │
│  ├─ Tables: clients, profiles, client_numbers, contacts, campaigns,     │
│  │           message_logs, conversation_states, inbound_messages,       │
│  │           reply_flows, automations, etc.                             │
│  ├─ Row-Level Security (RLS): auth.uid() + my_client_id()             │
│  ├─ Functions (PL/pgSQL):                                               │
│  │  └─ try_consume_daily_send_budget(): Global 100 msg/day per number  │
│  └─ Cron: pg_cron triggers run-automations every 5 minutes              │
└─────────────────────────────────────────────────────────────────────────┘
           ↓ External Webhook ↓              ↓ REST API ↓
    ┌──────────────────┐            ┌──────────────────────┐
    │ Z-API            │            │ Storage (creatives)  │
    │ (WhatsApp gw)    │            │ Supabase S3 bucket   │
    │ send-text        │            │ campaigns/*.jpg|png  │
    │ send-image       │            │ image URLs → msgs    │
    │ send-button-list │            └──────────────────────┘
    │ on-message       │
    └──────────────────┘
```

---

## Data Model (Core Tables)

### `clients` (business account)
```
id (UUID) | name | email | phone | plan | status | 
monthly_limit | current_month_usage | zapi_api_key | created_at
```
- **Key concept:** One `client` = one business (e.g., dental clinic)
- **Pricing:** Fixed plan + usage tracking

### `profiles` (auth junction)
```
id (user.id from auth.users) | client_id | role ('admin'|'client') | 
full_name | email | created_at
```
- **Role:** `admin` = platform staff; `client` = business user
- **RLS:** Client can only see their own client_id; admin sees all

### `client_numbers` (WhatsApp accounts)
```
id (UUID) | client_id | label | phone | active | 
zapi_instance_id | zapi_token | created_at
```
- **Per client:** Multiple WhatsApp numbers possible (e.g., main + support)
- **Security:** zapi_token never read by browser (server-side only in edge functions)
- **Limit:** 100 messages/day/number, globally enforced via `try_consume_daily_send_budget()`

### `contacts` (subscriber list)
```
id | client_id | number_id | phone | name | email | status | 
tags (array) | birthday | created_at | updated_at
```
- **Status:** 'Ativo' | 'Inativo' (descadastrados)
- **Tags:** Ad-hoc classification (e.g., "VIP", "Descadastrado")
- **Pagination:** Fetch max 1000 per query (PostgREST limit); run-automations pages through all

### `campaigns` (message delivery jobs)
```
id | client_id | number_id | name | caption (template) | type | status | 
image_url | scheduled_for | stop_at | total_count | sent_count | error_count |
daily_limit | daily_start_hour | daily_end_hour | weekdays_only |
quick_replies (JSON array) | follow_up_of | follow_up_delay_days | created_at
```
- **Types:** `'scheduled'` = fixed date; `'daily'` = up to N/day; `'followup'` = linked to parent
- **Status:** `'scheduled'` → `'active'` → `'completed'` | `'stopped'`
- **Spintax:** `{option1|option2}` resolved per recipient; `{{nome}}` → contact.name

### `message_logs` (audit trail)
```
id | campaign_id | client_id | contact_id | status | sent_at | 
response_json (from Z-API) | error_detail | created_at
```
- **Dedup:** Check before resending (run-automations skips if already sent)
- **Status:** `'sent'` | `'error'` | `'delivered'` (from status webhook)

### `inbound_messages` (received messages)
```
id | client_id | number_id | contact_id | phone | message_text | 
received_at | raw_payload (from Z-API) | created_at
```
- **Purpose:** Used by zapi-webhook to determine if contact has replied (triggers follow-up skip)

### `conversation_states` (state machine for "EU QUERO" flow)
```
id | client_id | number_id | contact_id | phone | current_step | 
turn_choice | created_at | updated_at
```
- **Steps:** `null` (no flow) → `'turn_ask'` → `'confirm_ask'` → done
- **Used by:** zapi-webhook to track multi-step reply flows

### `reply_flows` (auto-reply configuration)
```
id | client_id | number_id | trigger_keyword | notify_phone | 
turno_question | created_at
```
- **Trigger:** When contact replies with a keyword (e.g., "EU QUERO"), flows through conversation_states
- **Notify:** Sends choice → notify_phone (internal WhatsApp number) to complete manually

---

## End-to-End Flows

### A. Campaign Send (Scheduled/Daily)

**Trigger:** `pg_cron` executes `run-automations` every 5 minutes (or manual invoke)

**Flow:**
1. **Check eligibility**
   - Campaign status = `'scheduled'` or `'active'`
   - If `type='scheduled'`: `scheduled_for` ≤ now → switch to `'active'`
   - If `type='daily'`: `stop_at` is null OR stop_at > now

2. **Fetch contacts** (paginated, max 1000 per loop)
   ```ts
   SELECT * FROM contacts 
   WHERE client_id = ? AND number_id = ? AND status = 'Ativo'
   ORDER BY created_at ASC
   LIMIT 1000 OFFSET ?
   ```

3. **Dedup check** (skip already sent)
   ```ts
   SELECT contact_id FROM message_logs 
   WHERE campaign_id = ? AND status = 'sent'
   ```

4. **Window check** (respect time window)
   - If within `daily_start_hour` to `daily_end_hour`?
   - If `weekdays_only=true`, skip weekends
   - Spread messages proportionally: `scheduled_at = random_within_window()`

5. **Respect daily limit**
   ```ts
   SELECT try_consume_daily_send_budget(number_id, 100)
   ```
   - If bucket empty → skip contact, retry next cycle
   - If bucket has room → proceed

6. **Personalize message** (`run-automations/index.ts`)
   ```ts
   const personalized = personalize(campaign.caption, contact.name);
   // → Replace {{nome}}, then resolve {option1|option2}
   ```

7. **Send via Z-API**
   ```ts
   if (campaign.image_url)
     await sendImageMessage(zapi_instance_id, zapi_token, phone, image_url, caption);
   else
     await sendTextMessage(zapi_instance_id, zapi_token, phone, caption);
   ```

8. **Log** to `message_logs` with status `'sent'`

9. **Follow-up check** (if eligible)
   - If `campaign.type='followup'` and parent was sent N days ago
   - If contact has NOT replied (check `inbound_messages`)
   - Schedule follow-up message in same cycle (same daily budget applies)

10. **Status update**
    - Count `sent_count` and `error_count` against `total_count`
    - If `sent_count >= total_count` → status = `'completed'`
    - If `stop_at` reached → status = `'stopped'`

**File references:**
- `supabase/functions/run-automations/index.ts` (main loop, pagination, personalization, Z-API calls)

---

### B. Quick-Reply Buttons (send-button-list)

**Client-side:** User configures buttons in `src/pages/NewCampaign.jsx` section 4
```json
{
  "quick_replies": [
    { "id": "yes", "label": "Quero sim! 🙌", "action": "trigger_flow" },
    { "id": "no", "label": "Não quero", "action": "stop_followup" }
  ]
}
```

**Send-side** (`run-automations`):
- If `campaign.quick_replies.length > 0`, use `sendButtonMessage()` instead of text
- Z-API endpoint: `/send-button-list`
- Format: `{ phone, message, buttonList: { buttons: [{id, label}] } }`
- Payload NOT validated live (first real test pending)

**Receive-side** (`zapi-webhook`):
- Detect button click via `buttonsResponseMessage` or `listResponseMessage` in payload
- Extract `buttonId` and match against campaign config
- Execute action: `trigger_flow` → flow start; `stop_followup` → skip this campaign's follow-ups; `opt_out` → full descadastro; `ask_choice` → nested flow

**File references:**
- `src/pages/NewCampaign.jsx` (button UI builder, lines 52–486)
- `supabase/functions/run-automations/index.ts` (sendButtonMessage, lines 170–192)
- `supabase/functions/zapi-webhook/index.ts` (extractButtonReply, lines 143–TBD)

---

### C. Manual Send (Frontend → Edge Function)

**Trigger:** User types message and hits "Enviar agora" (if button existed; currently removed as of 2026-07-01)

**Flow:**
1. Frontend: `POST /functions/v1/send-message` with auth JWT
   ```json
   { "number_id": "...", "phone": "...", "message": "...", "image_url": "...", "contact_id": "..." }
   ```

2. Edge function `send-message` validates:
   - Auth: JWT valid → extract user.id
   - Permission: profile.role = 'admin' OR profile.client_id = number.client_id
   - Z-API config: number.zapi_instance_id + zapi_token exist

3. Format phone: remove non-digits, prefix "55" if not present

4. Check budget: `try_consume_daily_send_budget(number_id, 100)`
   - If over limit → `HTTP 429` with `LIMITE_DIARIO_ATINGIDO`
   - Else → proceed

5. Send via Z-API (text or image)

6. Log to message_logs with status `'sent'` or `'error'`

**File references:**
- `src/pages/NewCampaign.jsx` (unused; formerly had "Enviar agora", now removed)
- `supabase/functions/send-message/index.ts`

---

### D. Inbound Message → Auto-Reply (Webhook)

**Trigger:** Z-API webhook call to `zapi-webhook` when contact replies

**Flow:**
1. Verify webhook auth (optional `ZAPI_WEBHOOK_SECRET` in query param)

2. Parse payload:
   - Extract `phone`, `message` (text), detect button click (`buttonId`)
   - Find `contact` by phone + number
   - Find `campaign` (to check reply_flows)

3. **Log inbound:**
   ```ts
   INSERT INTO inbound_messages (client_id, number_id, contact_id, phone, message_text, raw_payload)
   ```

4. **Keyword matching:**
   - Normalize message (lowercase, remove accents, etc.)
   - Check against `reply_flows.trigger_keyword` (e.g., "eu quero", "parar", "sair")

5. **Handle each keyword type:**
   - **"EU QUERO":** Start conversation flow (conversation_states)
     - Step 1: Send turno question (hard-coded or from reply_flows)
     - Step 2: Wait for response
     - Step 3: Send confirmation + notify reply_flows.notify_phone

   - **"PARAR"/"SAIR":** Opt-out
     - Set contact.status = 'Inativo'
     - Add tag "Descadastrado"
     - Send confirmation

6. **Button click handling:**
   - If `buttonId` matches action `'trigger_flow'` → start EU QUERO flow
   - If `'stop_followup'` → skip follow-up for this campaign (mark as has_replied)
   - If `'opt_out'` → call optOutContact()
   - If `'ask_choice'` → send nested question (with sub-buttons) + notify

7. **Respect daily budget:** Every auto-reply counts against 100 msg/day limit

**File references:**
- `supabase/functions/zapi-webhook/index.ts` (entire flow: auth, parsing, keyword, button, flow, opt-out)

---

### E. Authentication: Admin vs Client

**Admin Login** (email + password)
- `src/pages/AdminLogin.jsx` → `AuthContext.loginAdmin(email, password)`
- Supabase Auth: `signInWithPassword()`
- Check profile.role = 'admin' (else reject)
- Session stored in Supabase Auth

**Client Login** (access key)
- `src/pages/Login.jsx` → `AuthContext.loginWithKey(key)`
- Call edge function `client-login`:
  - Receive key → lookup client_key entry (or generate temp email+password)
  - Return `{ email, password }`
- Supabase Auth: `signInWithPassword(email, password)`
- Session stored in Supabase Auth

**Why real auth now** (vs. localStorage tokens):
- RLS rules depend on `auth.uid()` and `my_client_id()` (PL/pgSQL function)
- Before: localStorage key didn't create a real session → RLS saw anon user → empty results
- Now: both admin + client get a real Supabase Auth session → RLS works

**File references:**
- `src/contexts/AuthContext.jsx` (loginAdmin, loginWithKey, session management)
- `supabase/functions/client-login/index.ts` (key verification)

---

## Key Abstractions & Constraints

### Global Daily Limit: 100 msg/number/day
- **Single source of truth:** `try_consume_daily_send_budget(number_id, 100)` (PL/pgSQL)
- **Used by:** send-message, run-automations, zapi-webhook
- **Behavior:** Returns false if today's count >= 100; increments counter if allowed
- **Reset:** Midnight Brazil time (UTC-3)

### Pagination for Large Lists
- **Problem:** Supabase PostgREST caps 1000 rows per request
- **Solution:** Helper `fetchAllPages<T>()` in run-automations loops until < 1000 returned
- **Applies to:** contacts fetch, message_logs dedup check

### Spintax (Message Variation)
- **Syntax:** `{option1|option2|option3}` → pick one random per recipient
- **Applied:** After {{nome}} substitution (never before)
- **Used by:** NewCampaign UI, run-automations send, send-message, zapi-webhook replies
- **Resolver:** `resolveSpintax()` function (Deno TypeScript, duplicated across edge functions)

### Brazil Time Window
- **Fixed UTC-3** (no daylight saving since 2019)
- **Conversion:** `brazilNow() = new Date(Date.now() - 3*60*60*1000)`
- **Use:** Schedule checks, daily reset, window respecting

### Human-Like Delays
- **Problem:** 100 messages in sequence = too robotic for WhatsApp
- **Solution:** `humanDelay()` = 600–1500ms random between sends
- **Risk:** Edge Function timeout if delay too long (60s max execution)

### Row-Level Security (RLS)
- **Profile relation:** Clients see only their client_id rows; admins see all
- **Implementation:** Every table uses `client_id` column + RLS check
- **Function:** `my_client_id()` returns `(auth.jwt() -> 'app_metadata' -> 'client_id')::uuid` OR null for admin
- **Bypass:** Edge functions use SERVICE_ROLE_KEY (full access)

---

## Code Organization

### Frontend (`src/`)
```
src/
├── main.jsx              # React entry (Router + AuthProvider)
├── App.jsx               # Route config + PrivateRoute guards
├── index.css             # Global styles (Tailwind)
├── lib/
│   └── supabase.js       # Supabase client init
├── contexts/
│   └── AuthContext.jsx   # useAuth() hook + session logic
├── pages/
│   ├── Landing.jsx       # Public homepage
│   ├── Login.jsx         # Client key login
│   ├── AdminLogin.jsx    # Admin email+password
│   ├── Dashboard.jsx     # Client homepage
│   ├── Contacts.jsx      # Import/manage subscribers
│   ├── Campaigns.jsx     # Campaign history (view/edit/send)
│   ├── NewCampaign.jsx   # Campaign builder (scheduling, buttons, follow-up)
│   ├── Automations.jsx   # (TBD; follow-up config)
│   ├── Birthdays.jsx     # Auto-send on birthdays
│   ├── Creatives.jsx     # Image/template library
│   ├── Reports.jsx       # Analytics/usage
│   ├── Settings.jsx      # Account config
│   └── admin/
│       ├── AdminDashboard.jsx
│       ├── AdminClients.jsx
│       ├── AdminPricing.jsx
│       └── AdminNumbers.jsx
├── components/
│   ├── Layout.jsx        # Sidebar + content area
│   ├── Sidebar.jsx       # Navigation
│   ├── Modal.jsx         # Generic modal
│   └── LegalPageShell.jsx
└── pages/
    └── [legal pages]     # Termos, Privacidade, Cookies, etc.
```

### Edge Functions (`supabase/functions/`)
```
supabase/functions/
├── send-message/index.ts          # Direct send (auth required)
├── run-automations/index.ts       # Daily cron (scheduled, daily, follow-up)
├── zapi-webhook/index.ts          # Inbound message handler (public)
├── client-login/index.ts          # Key → auth exchange
├── zapi-status/index.ts           # Status webhook from Z-API
└── mp-*/                          # MercadoPago webhooks (payment processing)
```

---

## Data Flow Summary

```
User creates campaign (NewCampaign.jsx)
           ↓
campaigns table INSERT + image upload to storage
           ↓
[pg_cron every 5min calls run-automations]
           ↓
Check: scheduled? daily? follow-up due?
           ↓
Fetch contacts (paginate if >1000)
           ↓
Dedup: skip if message_logs shows sent
           ↓
Respect window: daily_start_hour → daily_end_hour + weekdays
           ↓
Check budget: try_consume_daily_send_budget() or exit
           ↓
Personalize: {{nome}} + {spintax} resolution
           ↓
Z-API send-text / send-image / send-button-list
           ↓
Log to message_logs (sent | error)
           ↓
[Contact replies]
           ↓
zapi-webhook receives inbound + button click
           ↓
Log to inbound_messages (dedup skip: this contact replied)
           ↓
Keyword/button matching → conversation flow / opt-out / follow-up skip
           ↓
Auto-reply via Z-API + respect daily budget
           ↓
Status webhook from Z-API updates message_logs
```

---

## Deployment & Environment

- **Frontend:** Deployed to Vercel (CI/CD auto on push to main)
- **Edge Functions:** Deployed to Supabase (CLI: `supabase functions deploy [name]`)
- **Database:** Supabase hosted PostgreSQL (automatic backups, RLS, PostgREST API)
- **Cron:** `pg_cron` extension in Supabase (triggers run-automations every 5 min)
- **Storage:** Supabase S3 bucket (`creatives/` folder for campaign images)

**Environment variables:**
- Frontend (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Edge Functions: Auto-injected `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` + optional `ZAPI_WEBHOOK_SECRET`

---

## Notable Design Decisions (2026-07-01 Fixes)

1. **Real Supabase Auth for clients** (not localStorage tokens)
   - Enables RLS rules that depend on `auth.uid()`

2. **100 msg/day global per number** (not per campaign)
   - Centralized `try_consume_daily_send_budget()` prevents overage risk

3. **Server-side send-message** (not direct from browser)
   - Z-API token never exposed to client
   - Avoids key leakage + enables budget enforcement

4. **Image support in scheduled/daily** (was text-only before)
   - `sendImageMessage()` now called from run-automations when `image_url` exists

5. **Button clicks + multi-step flows** (ask_choice action)
   - Allows interactive funnels (e.g., "which service?" → notify internal WhatsApp)

6. **Quick-reply buttons embedded in messages** (not separate)
   - Contact taps button instead of typing (lower friction)
   - Format still pending live validation from Z-API

7. **Pagination for >1000 contacts**
   - Ensures large lists aren't silently truncated

---

End of ARCHITECTURE.md
