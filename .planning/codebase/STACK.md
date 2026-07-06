# ZapFlow Tech Stack

> **Document:** Technology stack reference
> **Updated:** 2026-07-05
> **Status:** Active production

---

## Languages & Runtime

| Component | Language | Version | Notes |
|-----------|----------|---------|-------|
| **Frontend** | JavaScript/JSX | ES2022 module | React 18+ syntax |
| **Edge Functions** | TypeScript | 5.x | Deno runtime (Supabase) |
| **Backend Database** | PL/pgSQL | PostgreSQL 14+ | RLS policies, triggers, RPC functions |

---

## Frontend Framework & Libraries

### Core Framework
- **React** `18.3.1` — UI library
- **React Router DOM** `6.26.0` — Client-side routing (`src/pages/`)
- **React DOM** `18.3.1` — DOM rendering

### UI & Styling
- **Tailwind CSS** `3.4.10` — Utility-first CSS framework
- **PostCSS** `8.4.41` — CSS processing pipeline
- **Autoprefixer** `10.4.19` — Vendor prefixes

### Component Libraries & Icons
- **Lucide React** `0.383.0` — Icon component library (SVG-based)

### Data Visualization
- **Recharts** `2.12.0` — React charting library (reports, analytics)

### Data Processing
- **XLSX** `0.18.5` — Excel file parsing & generation (`Contacts.jsx` bulk import)

### Build Tools
- **Vite** `5.4.1` — Frontend bundler and dev server
- **@vitejs/plugin-react** `4.3.1` — React plugin for Vite

### Backend Client SDK
- **@supabase/supabase-js** `2.45.0` — Supabase JavaScript client (auth, database, realtime)

---

## Build & Deployment Configuration

### Vite Config (`vite.config.js`)
```javascript
- React plugin enabled
- Custom define: __BUILD_ID__ from VERCEL_GIT_COMMIT_SHA (7-char git hash)
- Fallback: "dev" for local development
```

### Tailwind Config (`tailwind.config.js`)
- **Design System:** Signal Ledger (2026-07-03)
- **Theme Colors:**
  - `bg: #F7F5F1` — Paper light premium background
  - `card: #FFFFFF` — Card surfaces
  - `border: #E7E2D8` — Border color
  - `accent: #FF4D6D` — Signature coral-magenta
  - `accent-dim: #E23F5C` — Dimmed accent variant
  - `violet: #8B5CF6` — Secondary gradient color
  - `muted: #6B6560` — Muted text
  - `surface: #FBFAF7` — Surface variant
  - `ink: #17141A` — Primary text (dark ink)
  - `white: #17141A` — Redefined from #FFFFFF (dark mode adjustment)

- **Typography:**
  - `display` font: Unbounded (headers)
  - `body` font: Manrope (body text)

- **Note:** `white` is intentionally redefined to dark ink (`#17141A`) to support dark-mode-first design (220+ text-white usages across 17 files). Light white elements use `bg-[#ffffff]` literal instead.

### PostCSS Config (`postcss.config.js`)
```javascript
- Tailwind CSS plugin
- Autoprefixer plugin
```

### Vercel Deployment Config (`vercel.json`)
- **Rewrites:** All routes → `/` (SPA fallback)
- **Security Headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - **CSP:** Restricts scripts to self, styles to self/Google Fonts, fonts to self/Google, images to self/data/https, connect to Supabase origin

---

## Backend: Supabase & Edge Functions

### Supabase Stack
- **Database:** PostgreSQL 14+ with RLS (Row-Level Security)
- **Authentication:** Supabase Auth (email/password, synthetic accounts)
- **Realtime:** WebSocket subscriptions (PostgREST)
- **Edge Functions:** Deno TypeScript runtime

### Environment Variables (Required)

**Frontend (`.env.example`):**
```
VITE_SUPABASE_URL=https://bhiggyigsrqfabqhutne.supabase.co
VITE_SUPABASE_ANON_KEY=<anonymous_key_here>
```

**Edge Functions (System Provided):**
- `SUPABASE_URL` — Project URL (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (auto-injected, only in functions)
- `SUPABASE_ANON_KEY` — Anon key (auto-injected, for user-level queries)

**Edge Functions (Secrets - Manual Setup):**
- `MP_ACCESS_TOKEN` — Mercado Pago API access token (required for billing)
- `MP_WEBHOOK_SECRET` — Optional webhook authentication secret
- `ZAPI_WEBHOOK_SECRET` — Optional webhook authentication secret

---

## Source Structure

```
src/
├── App.jsx                 — Main app router & layout
├── main.jsx                — React DOM render entry
├── index.css               — Global styles
├── components/             — Reusable React components
├── contexts/               — React context providers (global state)
├── pages/                  — Route pages (Campaigns, Contacts, Settings, etc.)
└── lib/
    ├── supabase.js         — Supabase client initialization
    ├── zapi.js             — Z-API integration utilities
    └── appInfo.js          — App metadata & build info
```

### Key Client Libraries

**`src/lib/supabase.js`**
- Supabase client initialization with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Exported for use in components and contexts

**`src/lib/zapi.js`**
- Z-API utility functions (formatting, API calls)
- Delegates actual sends to `send-message` edge function (never calls Z-API directly from browser)

**`src/lib/appInfo.js`**
- `__BUILD_ID__` from Vite define (`VERCEL_GIT_COMMIT_SHA`)
- Used for versioning and cache-busting

---

## Build & Development Scripts

```json
{
  "dev": "vite",                    // Start dev server with hot reload
  "build": "vite build",            // Production build (minified bundle)
  "preview": "vite preview"         // Preview production build locally
}
```

---

## Edge Functions Deployment

All functions deployed to Supabase Edge Functions (Deno runtime):

```bash
supabase functions deploy <function_name>
```

**Deployment Notes:**
- Public functions (webhooks) use `--no-verify-jwt` flag
- Authenticated functions keep default JWT verification
- All functions read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from system env

---

## Browser Compatibility

- **Tailwind:** Modern browsers (CSS Grid, Flexbox, custom properties)
- **React 18:** Modern JavaScript (ES2020+, optional chaining, nullish coalescing)
- **XLSX:** Works in all modern browsers (client-side parsing)

---

## Performance & Optimizations

### Build Output
- Vite minification enabled
- Code splitting (React Router lazy loading ready)

### CSS
- Tailwind JIT compilation (only used classes included)
- PostCSS autoprefixer for vendor prefixes

### Frontend Caching
- `__BUILD_ID__` injected into app for cache-busting between deployments
- Vercel provides automatic edge caching for static assets

---

## No External Dependencies for Core Functions

- **No Express/Node server** — all backend via Supabase functions
- **No ORM** — direct PostgreSQL via Supabase PostgREST API
- **No state management library** — React Context for global state
- **No bundler besides Vite** — no webpack, rollup config needed
