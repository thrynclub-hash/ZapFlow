# ZapFlow External Integrations & APIs

> **Document:** External API integrations, webhooks, and Supabase edge functions
> **Updated:** 2026-07-05
> **Status:** Active production

---

## Integrated External APIs

### 1. Z-API (WhatsApp Business Messaging)

**Purpose:** Send WhatsApp messages, receive inbound messages, manage chat instances

**API Base:** `https://api.z-api.io/instances`

**Authentication:**
- Instance ID + API Token (credentials stored in `client_numbers.zapi_instance_id`, `client_numbers.zapi_token`)
- Token is NEVER exposed to frontend — only edge functions access it

**Key Endpoints Used:**

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/instances/{instanceId}/token/{token}/send-text` | POST | Send text messages | `send-message`, `zapi-webhook`, `run-automations` |
| `/instances/{instanceId}/token/{token}/send-image` | POST | Send image with caption | `send-message` |
| `/instances/{instanceId}/token/{token}/send-button-list` | POST | Send quick reply buttons | `zapi-webhook` (response buttons), `run-automations` |
| `/instances/{instanceId}/token/{token}/status` | GET | Check connection status | `zapi-status` |
| `/instances/{instanceId}/token/{token}/update-webhook-received` | PUT | Configure webhook URL | Manual setup (not in code) |

**Webhook Inbound:** `POST https://<project>.functions.supabase.co/zapi-webhook`
- **Event Type:** `ReceivedCallback` (text message received)
- **Payload:**
  ```json
  {
    "type": "ReceivedCallback",
    "phone": "recipient_phone",
    "instanceId": "z-api_instance_id",
    "text": { "message": "message text" },
    "fromMe": false,
    "isGroup": false,
    "buttonsResponseMessage": { /* quick reply button click */ },
    "listResponseMessage": { /* list selection click */ }
  }
  ```
- **Authentication:** Optional token-based (query param `?token=ZAPI_WEBHOOK_SECRET`)
- **Rate Limit:** Daily send cap of 100 messages/number (anti-spam, managed by `try_consume_daily_send_budget` RPC)

**Configuration Required:**
```
Z-API Dashboard > Instance Settings > Webhooks:
  - "Webhook ao receber" (On Message Received):
    https://<your-project>.functions.supabase.co/zapi-webhook?token=<ZAPI_WEBHOOK_SECRET>
```

**Related Edge Functions:**
- `zapi-webhook` — Inbound message handler (receives messages, executes reply flows, button actions)
- `send-message` — Central message dispatch (text or image)
- `zapi-status` — Check connection status (security: token never leaves server)

---

### 2. Mercado Pago (Payment & Billing)

**Purpose:** Charge for add-ons (numbers, contacts), manage recurring subscriptions

**API Base:** 
- `/preapproval` — Recurring subscriptions (add-on: number)
- `/v1/payments` — One-time charges (add-on: contacts_1000)
- `/checkout/preferences` — Checkout page generation

**Authentication:**
- Access Token (stored in `MP_ACCESS_TOKEN` secret)
- Embedded in Authorization header: `Bearer <MP_ACCESS_TOKEN>`

**Pricing Config (Server-Side, Never Client-Side):**
```typescript
// In mp-create-preapproval/index.ts
PRICES: {
  "number": 150,              // R$ 150/month recurring
  "contacts_1000": 59.90      // R$ 59.90 one-time
}
RECURRING: {
  "number": true,             // Subscription (monthly)
  "contacts_1000": false      // Single payment
}
```

**Key Endpoints:**

| Endpoint | Method | Purpose | Used In |
|----------|--------|---------|---------|
| `/preapproval` | POST | Create recurring subscription | `mp-create-preapproval` |
| `/checkout/preferences` | POST | Create one-time checkout | `mp-create-preapproval` |
| `/preapproval/{id}` | GET | Fetch subscription status | `mp-webhook` |
| `/v1/payments/{id}` | GET | Fetch payment status | `mp-webhook` |

**Webhook Inbound:** `POST https://<project>.functions.supabase.co/mp-webhook`
- **Event Types:**
  - `preapproval` / `subscription_preapproval` — Recurring subscription status change
  - `payment` — One-time payment status change
- **Payload Formats:** Query params `?type=X&data.id=Y` OR body `{ type, data: { id } }`
- **Authentication:** Optional token-based (query param `?token=MP_WEBHOOK_SECRET`)
- **Status Values:** `authorized` (active), `cancelled`, `paused`, `approved`, `rejected`

**Configuration Required:**
```
Mercado Pago Dashboard > Account Settings > Webhooks:
  https://<your-project>.functions.supabase.co/mp-webhook?token=<MP_WEBHOOK_SECRET>
```

**Related Edge Functions:**
- `mp-create-preapproval` — Create subscription or one-time charge
- `mp-webhook` — Webhook receiver, updates `client_addons.status` when payment confirmed

**Bug Fixed (2026-07-03):** Previously, both `number` (should be recurring) and `contacts_1000` (should be one-time) were created via `/preapproval` (recurring API). Now `contacts_1000` correctly uses `/checkout/preferences` (one-time) so clients aren't charged monthly for a single-use add-on.

---

## Supabase Backend: Database & Authentication

### Database Tables (Key Entities)

| Table | Purpose | RLS Policy |
|-------|---------|-----------|
| `clients` | Client accounts | Admin only (select all), clients see none directly |
| `client_numbers` | WhatsApp numbers linked to clients | Clients see own numbers, admin sees all |
| `client_auth_secrets` | Synthetic email/password for client login | Service role only (never exposed to RLS) |
| `client_addons` | Purchased add-ons (numbers, contacts) | Clients see own, admin sees all |
| `contacts` | Contact list (phone, name, status, tags) | Clients see own, admin sees all |
| `campaigns` | Campaigns (message template, scheduling, quick_replies) | Clients see own, admin sees all |
| `message_logs` | Send/receive history (status, error detail) | Clients see own, admin sees all |
| `inbound_messages` | All received messages (used for follow-up dedup) | Clients see own, admin sees all |
| `conversation_states` | State machine for reply flow ("asked_schedule", "confirmed") | Clients see own, admin sees all |
| `reply_flows` | Configuration for "I WANT" reply automation flow | One per client, clients update own |

### Authentication System

**Pre-2026-07-01:** Insecure localStorage-only scheme (no session)
**Post-2026-07-01:** Real Supabase Auth + RLS

**Flow:**
1. Client logs in with `access_key` → `client-login` edge function
2. Function validates key against `clients.access_key`, retrieves synthetic credentials from `client_auth_secrets`
3. Returns synthetic email + password to frontend
4. Frontend calls `supabase.auth.signInWithPassword(email, password)` → establishes real Supabase Auth session
5. Session JWT used in `Authorization` header for subsequent requests (frontend and edge functions)
6. All database queries respect RLS (Row-Level Security) based on `auth.uid()`

**Related Edge Functions:**
- `client-login` — Swap access_key for synthetic credentials (no JWT required, public)
- `client-provision` — Create synthetic user + RLS profile (admin only)

### Key RPC Functions (PL/pgSQL)

| Function | Purpose | Params | Returns |
|----------|---------|--------|---------|
| `try_consume_daily_send_budget` | Atomic check-and-decrement daily message quota | `p_number_id`, `p_daily_cap` | boolean (true if under limit, decrements counter) |

---

## Edge Functions (Deno TypeScript)

All edge functions are TypeScript-based and deployed to Supabase's Deno runtime.

### Function: `client-login`

**Path:** `supabase/functions/client-login/index.ts`
**Auth:** None (`--no-verify-jwt`)
**Purpose:** Exchange access_key for login credentials
**Input:** `{ access_key: string }`
**Output:** `{ email: string, password: string }` OR `{ error: string }`
**Security Notes:**
- Validates against `clients` table
- Returns only synthetic credentials, never the real access_key or Z-API tokens
- Callers then use returned credentials with `supabase.auth.signInWithPassword()`

---

### Function: `client-provision`

**Path:** `supabase/functions/client-provision/index.ts`
**Auth:** Admin only (`verify_jwt: true`)
**Purpose:** Set up Supabase Auth user for a new client (idempotent)
**Input:** `{ client_id: string }`
**Output:** `{ ok: true, already_provisioned?: boolean }` OR `{ error: string }`
**Security Notes:**
- Only callable by users with `profiles.role = 'admin'`
- Creates synthetic email: `client-${client_id}@zapflow.internal`
- Generates random password, stores in `client_auth_secrets`
- Creates Supabase Auth user with email confirmed

---

### Function: `send-message`

**Path:** `supabase/functions/send-message/index.ts`
**Auth:** Real session (JWT required, verified against Supabase Auth)
**Purpose:** Central dispatch for sending text or image messages via Z-API
**Input:**
```json
{
  "number_id": "uuid",
  "phone": "recipient_phone",
  "message": "message text (supports {{nome}} substitution and {spintax})",
  "image_url": "optional_image_url",
  "contact_id": "optional_uuid (for logging)",
  "campaign_id": "optional_uuid (for logging)"
}
```
**Output:** `{ ok: true }` OR `{ error: string, message?: string }`
**Security Notes:**
- Verifies caller owns the number (unless admin)
- Never passes Z-API token to client — uses it server-side only
- Applies daily send quota via `try_consume_daily_send_budget`
- Logs send attempt to `message_logs` (with status, error_detail if failed)

**Features:**
- Spintax support: `{option1|option2}` randomly chooses one per contact
- Template substitution: `{{nome}}` replaced with contact name before spintax

---

### Function: `zapi-webhook`

**Path:** `supabase/functions/zapi-webhook/index.ts`
**Auth:** None (`--no-verify-jwt`), optional token validation via query param
**Purpose:** Receive inbound messages from Z-API, execute reply flows
**Inbound Payload:** Z-API webhook format (see Z-API section)
**Output:** `{ ok: true, ... }` with event details
**Security Notes:**
- Validates webhook authenticity via optional `ZAPI_WEBHOOK_SECRET` (query param token)
- Logs ALL inbound messages to `inbound_messages` (even if contact unrecognized)
- Only executes reply flows if contact matched and enabled

**Flow:**
1. **Log message** → `inbound_messages` (always, even if no action taken)
2. **Match contact** by phone (last 8 digits, tolerates DDI/9th digit variance)
3. **If button reply detected:** Check if it's a sub-choice reply (for `ask_choice` action) or main button action
4. **Execute button action:**
   - `opt_out` → Descadastro, marca contato como "Inativo"
   - `stop_followup` → Confirma que follow-up will pause (log stops it automatically)
   - `ask_choice` → Send 2nd-level buttons with sub-options, mark state as "awaiting_choice"
   - `trigger_flow` → Force trigger the main reply flow
5. **Else execute text flow:**
   - Check for opt-out keywords (PARAR, SAIR, etc.) → opt out if matched
   - Check for reply flow trigger keyword (default: "EU QUERO") → start schedule question
   - Manage multi-step conversation via `conversation_states` (state machine)

**Conversation State Machine:**
- `initial` → User hasn't interacted
- `asked_schedule` → Bot asked "morning or afternoon?"
- `awaiting_choice` → Bot asked sub-question with button options
- `confirmed` → User answered, notification sent to `reply_flows.notify_phone`

---

### Function: `mp-webhook`

**Path:** `supabase/functions/mp-webhook/index.ts`
**Auth:** None (`--no-verify-jwt`), optional token validation via query param
**Purpose:** Receive payment status from Mercado Pago, activate/cancel add-ons
**Inbound Payload:** `{ type: "preapproval" | "payment", data: { id: "mp_id" } }`
**Output:** `{ ok: true, status: newStatus? }` OR `{ ok: false, error }`
**Security Notes:**
- Validates webhook authenticity via optional `MP_WEBHOOK_SECRET` (query param token)
- Always verifies payment status by querying Mercado Pago API (never trusts webhook payload alone)
- External reference in MP metadata → `client_addons.id`

**Status Mapping:**
- Subscription: `authorized` → `active` | `cancelled`/`paused` → `cancelled`
- One-time: `approved` → `active` | `rejected`/`cancelled` → `cancelled`

---

### Function: `run-automations`

**Path:** `supabase/functions/run-automations/index.ts`
**Auth:** Callable via Cron (no JWT, service role auth internally)
**Purpose:** Execute scheduled campaigns, daily campaigns, follow-up automations
**Scheduling:** Cron job every 5 minutes (via Supabase Database > Cron or pg_cron)
**Security Notes:**
- Service role client (bypasses RLS intentionally, trusted background task)
- Implements pagination (PAGE_SIZE=1000) to handle clients with >1000 contacts

**Functions:**
- **Daily/Scheduled Campaigns:** Check `campaigns` table for next execution, send to all active contacts (dedup by `message_logs`)
- **Follow-up Automations:** Track campaign send times, send follow-up after configured delay (dedup by `inbound_messages` — stops if contact replied)
- **Button Messages:** Send `send-button-list` if campaign has `quick_replies` configured
- **Spintax Resolution:** Randomize message text per contact to avoid spam detection

**Features:**
- **Pagination:** Fetches contacts in 1000-row batches to work with Supabase 1000-row REST limit
- **Deduplication:** Never resends to who already got the campaign (via `message_logs.campaign_id`)
- **Follow-up Dedup:** Never sends follow-up to who replied (via `inbound_messages` since original send)
- **Budget Check:** Every send checks daily quota via `try_consume_daily_send_budget`

---

### Function: `zapi-status`

**Path:** `supabase/functions/zapi-status/index.ts`
**Auth:** Real session (JWT required, respects RLS)
**Purpose:** Check WhatsApp connection status for a number (Settings.jsx)
**Input:** `{ number_id: string }`
**Output:** `{ ok: true, connected: boolean, phone?: string }` OR `{ ok: false, error }`
**Security Notes:**
- Uses RLS to ensure client can only check own numbers (admin can check all)
- **CRITICAL FIX 2026-07-03:** Frontend NEVER sees `zapi_token` — function calls Z-API server-side only
- Previous bug: Settings.jsx was calling Z-API directly with token exposed in browser DevTools

---

### Function: `mp-create-preapproval`

**Path:** `supabase/functions/mp-create-preapproval/index.ts`
**Auth:** Real session (JWT required)
**Purpose:** Create Mercado Pago charge for add-on (number or contacts_1000)
**Input:** `{ addon_type: "number" | "contacts_1000" }`
**Output:** `{ init_point?: string, error?: string }` (or init_point for checkout redirect)
**Security Notes:**
- Prices hardcoded server-side (never from frontend)
- `addon_type` determines payment model:
  - `number` → `/preapproval` (recurring monthly)
  - `contacts_1000` → `/checkout/preferences` (one-time)
- Caller verified against Supabase Auth

**Bug Fixed (2026-07-03):** `contacts_1000` was incorrectly using `/preapproval` (recurring), now uses `/checkout/preferences` (one-time).

---

## Webhook Security Pattern

**Pattern:** Optional token-based validation for webhooks (query param `?token=SECRET`)

**Why Optional:**
- Webhooks from Z-API and Mercado Pago don't support header-based signing (common alternative)
- Query param is practical compromise between security and simplicity
- If `*_WEBHOOK_SECRET` env var is NOT set, webhook remains open (backward compatible)
- If set, attacker must know the secret to trigger the URL

**Implementation (Both Webhooks):**
```typescript
const WEBHOOK_SECRET = Deno.env.get("ZAPI_WEBHOOK_SECRET");
function isAuthorizedWebhookCall(req: Request): boolean {
  if (!WEBHOOK_SECRET) return true;  // No secret = always allow (legacy)
  return new URL(req.url).searchParams.get("token") === WEBHOOK_SECRET;
}
```

**Activation Steps:**
1. Set secret: `supabase secrets set ZAPI_WEBHOOK_SECRET=<random_value>`
2. Update Z-API webhook URL to include `?token=<random_value>`
3. Repeat for Mercado Pago if needed

---

## Environment Variables Summary

| Variable | Source | Scope | Notes |
|----------|--------|-------|-------|
| `VITE_SUPABASE_URL` | `.env.example` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.example` | Frontend | Anonymous key for auth |
| `SUPABASE_URL` | System env | Edge Functions | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | System env | Edge Functions | Auto-injected, trusted operations |
| `SUPABASE_ANON_KEY` | System env | Edge Functions | Auto-injected for RLS queries |
| `MP_ACCESS_TOKEN` | Manual secret | `mp-*` functions | Mercado Pago API token |
| `MP_WEBHOOK_SECRET` | Optional secret | `mp-webhook` | Optional webhook auth |
| `ZAPI_WEBHOOK_SECRET` | Optional secret | `zapi-webhook` | Optional webhook auth |

---

## Data Flow Diagrams

### Outbound Message Flow
```
Frontend (send-message component)
    ↓
send-message edge function (authenticated)
    ↓
Verify auth + permissions
    ↓
Check daily budget (try_consume_daily_send_budget RPC)
    ↓
Call Z-API: POST /send-text or /send-image
    ↓
Log to message_logs (status: sent or error)
```

### Inbound Message Flow
```
Z-API Server
    ↓
zapi-webhook edge function (public webhook)
    ↓
Validate token (optional ZAPI_WEBHOOK_SECRET)
    ↓
Log to inbound_messages (contact_id may be null if unrecognized)
    ↓
IF contact matched:
    ├→ Check for button action → execute (opt_out, stop_followup, ask_choice, trigger_flow)
    ├→ Check for opt-out keywords → execute opt_out flow
    └→ Check for reply flow trigger → start schedule conversation
```

### Payment Flow
```
Client adds add-on in UI
    ↓
mp-create-preapproval edge function (authenticated)
    ↓
Create preapproval (recurring) or preference (one-time) with Mercado Pago
    ↓
Return init_point (redirect to checkout)
    ↓
Client pays in Mercado Pago checkout
    ↓
Mercado Pago webhook
    ↓
mp-webhook edge function
    ↓
Verify payment status with Mercado Pago API
    ↓
Update client_addons.status (active or cancelled)
```

### Scheduled Automation Flow
```
Cron triggers run-automations every 5 minutes
    ↓
Fetch campaigns ready to execute (scheduled or daily)
    ↓
For each campaign, paginate contacts (1000 at a time)
    ↓
Skip contacts who already received (message_logs dedup)
    ↓
Check daily budget for number
    ↓
Send message (text or buttons) via Z-API
    ↓
Log to message_logs
    ↓
If follow-up configured, queue next send (time-based)
```

---

## Known Security Findings & Fixes (2026-07-01 to 2026-07-03)

| Issue | Status | Fix |
|-------|--------|-----|
| Z-API token exposed in Settings.jsx (browser calling API directly) | FIXED | Created `zapi-status` function, token never leaves server |
| `contacts_1000` charged monthly instead of one-time | FIXED | Changed `mp-create-preapproval` to use one-time checkout for contacts |
| No real Supabase Auth session | FIXED | Implemented `client-login` + `client-provision` with synthetic users |
| Webhook no signature validation (Z-API, Mercado Pago) | MITIGATED | Added optional token-based validation via query params |

---

## Testing Notes

**Not Validated at Live (2026-07-03):**
- Z-API button click payloads (`extractButtonReply()` — awaiting real click data)
- Mercado Pago webhook formats (both preapproval and payment types)
- `contacts_1000` payment flow (bugfix applied, needs live payment test)

**Recommended Before Production:**
1. Test Z-API button clicks with real number, log payload in Supabase dashboard
2. Test Mercado Pago with sandbox account, verify webhook triggers
3. Verify CSP in `vercel.json` allows all required cross-origin calls
