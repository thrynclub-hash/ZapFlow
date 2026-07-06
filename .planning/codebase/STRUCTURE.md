# ZapFlow Code Structure & Conventions

**Version:** 1.0  
**Last Updated:** 2026-07-03  
**Framework:** Vite + React 18 + TailwindCSS (frontend) + Deno/TypeScript (edge functions)

---

## Directory Layout

### Project Root
```
ZapFlow/
├── .git/
├── .gitignore
├── .env.local                 # Local dev (git-ignored)
├── .env.example               # Template for required vars
│
├── package.json               # Node deps: react, react-router-dom, @supabase/supabase-js, lucide-react, recharts, xlsx
├── package-lock.json
│
├── vite.config.js             # Vite bundler config (lazy route code-splitting)
├── tailwind.config.js         # TailwindCSS theme + plugins
├── postcss.config.js          # PostCSS pipeline for Tailwind
│
├── index.html                 # HTML entry (Vite)
├── src/                       # ← FRONTEND SOURCE (React)
│   ├── main.jsx               # React entry: ReactDOM.createRoot()
│   ├── App.jsx                # Routes + PrivateRoute/AdminRoute guards
│   ├── index.css              # Global styles (Tailwind imports)
│   │
│   ├── lib/
│   │   └── supabase.js        # Client init: createClient(URL, ANON_KEY)
│   │
│   ├── contexts/
│   │   └── AuthContext.jsx    # Provider: useAuth() hook, loginAdmin, loginWithKey, logout
│   │
│   ├── components/
│   │   ├── Layout.jsx         # Shell: Sidebar + <Outlet /> for routes
│   │   ├── Sidebar.jsx        # Nav menu + logo
│   │   ├── Modal.jsx          # Generic reusable modal
│   │   └── LegalPageShell.jsx # Wrapper for legal pages (Termos, Privacidade)
│   │
│   └── pages/                 # ← Route components (lazy-loaded)
│       ├── Landing.jsx        # Public homepage
│       ├── Login.jsx          # Client key login → loginWithKey()
│       ├── AdminLogin.jsx     # Admin email+password → loginAdmin()
│       ├── ResetPassword.jsx  # (stub)
│       │
│       ├── Dashboard.jsx      # Client homepage (stats, quick actions)
│       ├── Contacts.jsx       # List/import contacts (xlsx, etc.)
│       ├── Campaigns.jsx      # Campaign history (list, view, edit, stop)
│       ├── NewCampaign.jsx    # **Campaign builder** (biggest page):
│       │                       # Sections: identification, creative (text+image),
│       │                       # scheduling (date/time/daily), quick-reply buttons,
│       │                       # follow-up config
│       ├── Automations.jsx    # (TBD; reply flows & automation rules)
│       ├── Birthdays.jsx      # Auto-send on birthdays
│       ├── Creatives.jsx      # Image/template library
│       ├── Reports.jsx        # Usage stats, message logs, analytics
│       ├── Settings.jsx       # Account settings
│       │
│       ├── Termos.jsx         # Legal page: terms of service
│       ├── Privacidade.jsx    # Legal page: privacy policy
│       ├── Cookies.jsx        # Legal page: cookie notice
│       ├── ContratoAssinatura.jsx
│       │
│       └── admin/             # Admin-only routes
│           ├── AdminDashboard.jsx
│           ├── AdminClients.jsx
│           ├── AdminPricing.jsx
│           └── AdminNumbers.jsx
│
├── supabase/                  # ← BACKEND (Edge Functions + SQL)
│   ├── config.toml            # Supabase local dev config
│   ├── seed.sql               # (optional) DB seed for local dev
│   │
│   ├── migrations/            # SQL migrations (version control)
│   │   ├── 20260601_init.sql                 # Initial schema
│   │   ├── 20260615_auth_fixes.sql           # Real Supabase Auth for clients
│   │   ├── 20260620_automations_advanced.sql # Campaigns, follow-ups, RLS
│   │   └── ...
│   │
│   └── functions/             # ← Deno Edge Functions (TypeScript)
│       ├── send-message/
│       │   └── index.ts       # Direct send (auth required)
│       ├── run-automations/
│       │   └── index.ts       # Daily cron worker (scheduled, daily, follow-up)
│       ├── zapi-webhook/
│       │   └── index.ts       # Inbound message handler (public webhook)
│       ├── zapi-status/
│       │   └── index.ts       # Status updates from Z-API (delivery, read, error)
│       ├── client-login/
│       │   └── index.ts       # Key → auth exchange
│       └── mp-*/              # MercadoPago integrations
│           ├── mp-webhook/index.ts
│           ├── mp-create-preapproval/index.ts
│           └── ...
│
├── docs/                      # Documentation
│   ├── CHANGELOG-AUTH-REAL.md
│   ├── SECURITY-FINDINGS-2026-07-01.md
│   └── ...
│
├── .planning/                 # (This directory)
│   └── codebase/
│       ├── ARCHITECTURE.md    # ← You are here
│       └── STRUCTURE.md       # ← This file
│
└── README.md
```

---

## Frontend File Naming & Patterns

### Pages (`src/pages/*.jsx`)
- **Naming:** PascalCase (e.g., `NewCampaign.jsx`, `AdminDashboard.jsx`)
- **Pattern:** Default export function component
- **Hooks:** `useAuth()`, `useState`, `useEffect`, `useNavigate`, etc.
- **Data fetching:** Direct `supabase.from().select/insert/update` calls
- **Auth:** Check `useAuth()` context at top of component (or let Layout wrap with PrivateRoute)

**Example structure:**
```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function MyPage() {
  const { profile, clientId } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('table_name')
        .select('*')
        .eq('client_id', clientId)
      setData(data || [])
      setLoading(false)
    }
    if (clientId) load()
  }, [clientId])

  return (
    <div className="...">
      {/* JSX */}
    </div>
  )
}
```

### Components (`src/components/*.jsx`)
- **Naming:** PascalCase (e.g., `Modal.jsx`, `Sidebar.jsx`)
- **Pattern:** Controlled components with props
- **No data fetching:** Keep components "dumb" (prop-driven)
- **Styling:** Tailwind classes inline in JSX

**Example:**
```jsx
export default function Modal({ isOpen, title, children, onClose }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-card rounded-xl p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {children}
        <button onClick={onClose} className="...">Close</button>
      </div>
    </div>
  )
}
```

### Context (`src/contexts/*.jsx`)
- **AuthContext.jsx:** Singleton provider + custom `useAuth()` hook
- **Pattern:** Create context → Provider component → export hook
- **Session state:** Managed by Supabase Auth (JWT in localStorage)

---

## Frontend Styling Conventions

### TailwindCSS
- **Config:** `tailwind.config.js` defines custom colors (e.g., `--accent`, `--bg`, `--card`)
- **Usage:** Inline utility classes only (no custom CSS files except `index.css`)
- **Color system:**
  - `bg` = main background (dark)
  - `card` = card/panel background (slightly lighter)
  - `surface` = input/surface background
  - `border` = border color
  - `muted` = secondary text
  - `accent` = primary action/brand color

**Pattern:**
```jsx
<div className="bg-card border border-border rounded-xl p-5 space-y-4">
  <h3 className="text-white font-semibold text-sm uppercase">Heading</h3>
  <input className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 
                    text-sm text-white placeholder-muted/50 
                    focus:outline-none focus:border-accent transition-colors" />
</div>
```

### Icons
- **Library:** `lucide-react`
- **Import:** `import { Icon } from 'lucide-react'`
- **Usage:** `<Icon size={16} className="text-accent" />`

### Forms & Inputs
- **No form library** (plain HTML + onChange handlers)
- **Validation:** Client-side in component before submit
- **Styling:** Consistent border, focus states (border-accent)

---

## Backend: Edge Functions Conventions

### File structure
```
supabase/functions/function-name/
├── index.ts              # Main Deno file (exports Deno.serve handler)
└── deno.json             # (optional) Deno config for local dev
```

### TypeScript patterns

**Imports:**
```ts
import { createClient } from "jsr:@supabase/supabase-js@2"
// JSR (Deno native) imports; NOT npm
```

**Handler pattern:**
```ts
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // Auth check (if needed)
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

    // Parse body
    const body = await req.json()

    // Do work (query DB, call external API, etc.)

    // Return success
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
```

**Supabase clients:**
```ts
// Service-role client (full access, used in edge functions)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// User client (from JWT header, for RLS verification)
const userClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
)
```

### Duplicated utility functions
**Why?** Each function is deployed independently; no shared imports across functions.

**Solution:** Duplicate helpers (e.g., `formatPhone()`, `resolveSpintax()`, `normalize()`) in each function that needs them.

**Affected functions:** `send-message`, `run-automations`, `zapi-webhook` all have:
- `formatPhone(phone)` → remove non-digits, prefix "55"
- `resolveSpintax(text)` → process `{option1|option2}`
- `sleep(ms)` → async delay
- `humanDelay()` → 600–1500ms random pause

### Naming conventions in edge functions
- **Function names:** camelCase (e.g., `sendTextMessage()`, `consumeBudget()`, `personalize()`)
- **Constants:** SCREAMING_SNAKE_CASE (e.g., `ZAPI_BASE`, `DAILY_CAP`, `PAGE_SIZE`)
- **Async functions:** Always marked `async`, errors thrown/caught with try/catch
- **Comments:** Explain WHY (not WHAT); reference issues, dates, decisions

---

## Database SQL Conventions

### Migration files (`supabase/migrations/`)
- **Naming:** `YYYYMMDD_description.sql` (e.g., `20260620_automations_advanced.sql`)
- **Order:** Chronological; applied in order
- **Content:** Idempotent (use `IF NOT EXISTS`, `CREATE OR REPLACE`)
- **RLS:** Every table includes `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

### Function naming
- **Stored procedures:** snake_case, verb-first (e.g., `try_consume_daily_send_budget()`, `check_campaign_eligibility()`)
- **Comments:** SQL comment block at top explaining purpose, params, returns

**Example:**
```sql
CREATE OR REPLACE FUNCTION try_consume_daily_send_budget(
  p_number_id UUID,
  p_daily_cap INT
) RETURNS BOOL AS $$
  -- Check if number has sent <p_daily_cap messages today (Brazil time).
  -- If yes, increment counter and return TRUE.
  -- If no, return FALSE (quota exhausted).
  DECLARE
    v_today_key TEXT := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE::TEXT;
  BEGIN
    -- Logic here
    RETURN TRUE;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## API Endpoints (Edge Functions)

| Function | Method | Auth | Route | Body | Response |
|----------|--------|------|-------|------|----------|
| send-message | POST | JWT | `/functions/v1/send-message` | `{number_id, phone, message, image_url?, contact_id?, campaign_id?}` | `{ok: true}` or error |
| run-automations | POST | service-role | `/functions/v1/run-automations` | (invoked by pg_cron) | JSON stats |
| zapi-webhook | POST | public* | `/functions/v1/zapi-webhook` | Z-API payload | `{ok: true}` |
| client-login | POST | public | `/functions/v1/client-login` | `{access_key}` | `{email, password}` |
| zapi-status | POST | public | `/functions/v1/zapi-status` | Z-API status payload | `{ok: true}` |

*zapi-webhook can validate `ZAPI_WEBHOOK_SECRET` query param if env var set

---

## Adding a New Feature: Step-by-Step

### Example: Add a new client page "Templates"

#### 1. Create page file
**Location:** `src/pages/Templates.jsx`

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Templates() {
  const { clientId } = useAuth()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      setTemplates(data || [])
      setLoading(false)
    }
    if (clientId) loadTemplates()
  }, [clientId])

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza?')) return
    await supabase.from('templates').delete().eq('id', id)
    setTemplates(t => t.filter(x => x.id !== id))
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Templates</h1>
        <button onClick={() => navigate('/templates/new')} 
          className="bg-accent hover:bg-accent-dim text-bg px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={18} /> Novo Template
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Carregando...</p>
      ) : templates.length === 0 ? (
        <p className="text-muted">Nenhum template criado ainda.</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{t.name}</p>
                <p className="text-muted text-sm">{t.message.slice(0, 60)}...</p>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-300 p-2">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

#### 2. Add route in App.jsx
```jsx
const Templates = lazy(() => import('./pages/Templates'))

// Inside <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
<Route path="templates" element={<Templates />} />
```

#### 3. Add sidebar link in components/Sidebar.jsx
```jsx
<NavLink to="/templates" className={...}>
  <Layout size={18} />
  Templates
</NavLink>
```

#### 4. (Optional) Create edge function for complex logic
**Location:** `supabase/functions/templates-export/index.ts`

```ts
Deno.serve(async (req: Request) => {
  // Export all templates to CSV or similar
  try {
    const authHeader = req.headers.get("Authorization") ?? ""
    // ... validation ...
    const { data: templates } = await supabase
      .from('templates')
      .select('*')
      .eq('client_id', clientId)
    // Process & return
  } catch (e) {
    // ...
  }
})
```

Deploy: `supabase functions deploy templates-export`

#### 5. Add database migration (if new table)
**Location:** `supabase/migrations/20260705_templates_table.sql`

```sql
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients see own templates"
  ON templates FOR ALL
  USING (client_id = (SELECT client_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admins see all templates"
  ON templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

Deploy: `supabase db push`

---

## Code Style Guidelines

### JavaScript/JSX
- **Semicolons:** Yes
- **Quotes:** Single (`'`) for strings, double (`"`) for JSX attributes
- **Indent:** 2 spaces
- **Line length:** 100–120 chars (flexible for readability)

### TypeScript (Edge Functions)
- **Strict mode:** Yes (`"strict": true` in deno.json)
- **Typing:** Explicit types for all functions (no implicit `any`)
- **Error handling:** Always `try/catch`; avoid silent failures

### Comments
- **Why over what:** Explain design decision, not implementation detail
- **TODO/FIXME:** Prefix with ticket number if possible (e.g., `// TODO ZF-123: Add webhook validation`)
- **Code examples:** Include in comments for complex functions

---

## Testing & Debugging

### Frontend
- **Local dev:** `npm run dev` (Vite hot-reload)
- **Build:** `npm run build` (production build)
- **Browser DevTools:** Console, Network tab, React DevTools extension
- **Supabase dashboard:** View real-time logs + database changes

### Edge Functions
- **Local test:** `supabase functions serve` (local emulator)
- **Deploy & test:** `supabase functions deploy [name]`, then use Postman/curl
- **Logs:** Supabase Dashboard > Edge Functions > [name] > Invocations tab

### Database
- **Migrations:** `supabase db push` (apply local → remote)
- **Rollback:** `supabase db reset` (dev only; resets to seed)
- **Query:** SQL Editor in Supabase Dashboard

---

## Common Patterns

### Fetch with error handling
```jsx
const [data, setData] = useState([])
const [error, setError] = useState(null)

useEffect(() => {
  async function load() {
    try {
      const { data, error: err } = await supabase.from('table').select('*')
      if (err) throw err
      setData(data || [])
    } catch (e) {
      setError(e.message)
    }
  }
  load()
}, [])

return error ? <p className="text-red-400">{error}</p> : <div>{/* render data */}</div>
```

### Mutation with optimistic update
```jsx
const handleCreate = async (newItem) => {
  setData([...data, newItem]) // optimistic
  try {
    const { data: result, error } = await supabase.from('table').insert(newItem).select()
    if (error) throw error
    setData(prev => [...prev.slice(0, -1), result[0]]) // replace with real
  } catch (e) {
    setData(prev => prev.slice(0, -1)) // rollback
    alert('Error: ' + e.message)
  }
}
```

### Pagination with cursor
```jsx
const [nextCursor, setNextCursor] = useState(null)

const loadMore = async () => {
  const { data, error } = await supabase
    .from('table')
    .select('*')
    .gt('id', nextCursor) // cursor position
    .limit(50)
  if (!error && data?.length > 0) {
    setData([...data, ...data])
    setNextCursor(data[data.length - 1].id)
  }
}
```

---

## Debugging Checklist

- [ ] Check browser console for JS errors
- [ ] Verify JWT token in localStorage (DevTools > Application > localStorage)
- [ ] Check Supabase project logs (Edge Functions > Invocations)
- [ ] Verify table RLS policies allow current user's `client_id`
- [ ] Confirm environment variables set (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Test edge function locally: `supabase functions serve` + curl
- [ ] Check that `pg_cron` job is enabled in Supabase dashboard (Database > Cron)

---

End of STRUCTURE.md
