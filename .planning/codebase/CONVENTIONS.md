# ZapFlow Codebase Conventions

> **Analysis Date:** 2026-07-05  
> **Framework:** React 18.3.1 + Vite 5.4.1  
> **Styling:** Tailwind CSS 3.4.10 + custom theme  
> **Backend:** Supabase (PostgreSQL + Auth)

---

## Directory Structure

```
src/
├── components/         # Reusable UI components
├── contexts/          # React Context (Auth)
├── lib/               # Utilities & clients (Supabase)
├── pages/             # Page components (routed)
│   └── admin/         # Admin-only pages
├── App.jsx            # Route definitions & RWD guards
├── main.jsx           # Entry point
└── index.css          # Tailwind + custom styles
```

---

## Naming Conventions

### Files & Components

| Pattern | Example | Location | Notes |
|---------|---------|----------|-------|
| **Page files** | `Campaigns.jsx`, `Dashboard.jsx` | `src/pages/` | PascalCase, one component per file |
| **Component files** | `Modal.jsx`, `Sidebar.jsx` | `src/components/` | PascalCase, reusable UI units |
| **Context files** | `AuthContext.jsx` | `src/contexts/` | PascalCase, exports hook (e.g., `useAuth`) |
| **Utility modules** | `supabase.js` | `src/lib/` | lowercase, client/config imports |

### Functions & Variables

- **Component names:** PascalCase  
  - Example: `function Campaigns()` in `src/pages/Campaigns.jsx` (line 81)
  - Example: `function StatCard()` in `src/pages/Dashboard.jsx` (line 7)

- **State variables:** camelCase  
  - Example: `const [campaigns, setCampaigns] = useState([])` in `src/pages/Campaigns.jsx` (line 84)
  - Example: `const [imageFile, setImageFile] = useState(null)` in `src/pages/NewCampaign.jsx` (line 34)

- **Helper functions:** camelCase  
  - Example: `function weekNum(c)` in `src/pages/Campaigns.jsx` (line 23)
  - Example: `function combineDateTime(date, time)` in `src/pages/Campaigns.jsx` (line 327)

- **Configuration objects:** camelCase  
  - Example: `const statusConfig = {}` in `src/pages/Campaigns.jsx` (line 8)

---

## Component Patterns

### Functional Components with Hooks

All components use **functional components with React Hooks**. No class components found.

**Example:** `src/pages/Campaigns.jsx` (lines 81-302)
```jsx
export default function Campaigns() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => { 
    if (clientId) fetchCampaigns() 
  }, [clientId])
  
  async function fetchCampaigns() {
    setLoading(true)
    supabase.from('campaigns')
      .select('*, number:client_numbers(label)')
      .eq('client_id', clientId)
      .then(({ data }) => { 
        setCampaigns(data || [])
        setLoading(false) 
      })
  }
  
  return (
    <div className="space-y-6">
      {/* JSX */}
    </div>
  )
}
```

### Props vs State Management

- **Props:** Minimal usage; most data comes from `useAuth()` context or Supabase queries
- **State:** Local component state (loading, UI toggles, form fields)
- **Context:** `AuthProvider` (session, profile, login/logout)

**Example:** `src/contexts/AuthContext.jsx` (lines 16-124)
- Exports `AuthProvider` wrapper component
- Exports `useAuth` hook for consuming components
- Manages Supabase Auth session + profile data

---

## State & Data-Fetching Patterns

### Direct Supabase Queries in Components

Components fetch data directly using `supabase` client (no centralized API layer).

**Pattern Observed:**

```jsx
// From src/pages/Campaigns.jsx (line 96-104)
async function fetchCampaigns() {
  setLoading(true)
  supabase.from('campaigns')
    .select('*, number:client_numbers(label)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .then(({ data }) => { 
      setCampaigns(data || [])
      setLoading(false) 
    })
}
```

**Characteristics:**
- `.then()` chaining (not async/await in queries themselves)
- Error checking: Minimal in some places, but **v2 architecture added explicit error checks** (see note below)

### Error Handling Pattern

**Real bug fix (2026-07-03)** documented in `src/pages/Campaigns.jsx` (lines 455-464):

```jsx
// BEFORE (buggy): Calls to Supabase were not checked for errors
const { error: campErr } = await supabase.from('campaigns').update(updates).eq('id', campaign.id)

// AFTER (fixed): Throw error if present
if (campErr) throw campErr
```

**Current pattern:** Explicit error checks with try/catch wrapping async operations.

**Example:** `src/pages/Campaigns.jsx` (lines 429-487)
```jsx
async function handleSave() {
  // ... validation ...
  setSaving(true)
  try {
    const scheduledDT = combineDateTime(scheduledDate, scheduledTime)
    // ... build updates ...
    const { error: campErr } = await supabase.from('campaigns').update(updates).eq('id', campaign.id)
    if (campErr) throw campErr
    
    if (followUp) {
      const { error: fuErr } = await supabase.from('campaigns').update({...}).eq('id', followUp.id)
      if (fuErr) throw fuErr
    }
    
    const { error: rfErr } = await supabase.from('reply_flows').upsert({...})
    if (rfErr) throw rfErr
    
    onSaved()
  } catch (e) {
    alert('Erro ao salvar: ' + (e.message || e.details || JSON.stringify(e)))
  } finally {
    setSaving(false)
  }
}
```

### Loading States

Standard pattern: `useState` boolean flags, conditional rendering.

**Example:** `src/pages/Dashboard.jsx` (lines 26-29, 36-75)
```jsx
const [stats, setStats] = useState({...})
const [recent, setRecent] = useState([])
const [loading, setLoading] = useState(true)

// In fetch function:
setLoading(true)
// ... query ...
setLoading(false)

// In render:
if (loading) return <div>Loading spinner...</div>
```

---

## Styling Approach

### Tailwind CSS with Custom Theme

**Config:** `tailwind.config.js`

Custom color palette (dark mode internally, but light theme colors):

| Token | Value | Usage |
|-------|-------|-------|
| `bg` | `#F7F5F1` | Page background (light paper) |
| `card` | `#FFFFFF` | Card backgrounds |
| `border` | `#E7E2D8` | Border color |
| `accent` | `#FF4D6D` | Primary CTA (coral-magenta) |
| `accent-dim` | `#E23F5C` | Hover state for accent |
| `muted` | `#6B6560` | Secondary text |
| `surface` | `#FBFAF7` | Input/form backgrounds |
| `ink` | `#17141A` | Text (redefines `white` token) |

**Typography:**
- `font-display`: Unbounded (headlines)
- `font-body`: Manrope (body text)

### Class Naming

Fully Tailwind utility classes; no CSS modules or BEM.

**Examples from** `src/pages/Campaigns.jsx`:

```jsx
// Line 164
<div className="bg-card border border-border rounded-xl p-5">

// Line 166
<div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${st.color}`}>

// Line 196
className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors"

// Line 232
className="flex items-center gap-1.5 bg-accent hover:bg-accent-dim text-bg px-3 py-2 rounded-lg text-xs font-display font-bold transition-colors"
```

### Custom Animations

Defined in `src/index.css` (lines 26-34):

```css
@keyframes fadeIn { 
  from { opacity: 0; transform: translateY(8px); } 
  to { opacity: 1; transform: translateY(0); } 
}
.animate-fadein { animation: fadeIn 0.25s ease both; }

@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,109,0.35); }
  50% { box-shadow: 0 0 0 8px rgba(255,77,109,0); }
}
.animate-pulse-ring { animation: pulse-ring 2s ease infinite; }
```

**Usage:** `className="animate-fadein"` applied to modals and fade-in elements.

---

## Code Organization Patterns

### Imports

Consistent top-level imports, grouped by source:

**Example:** `src/pages/Campaigns.jsx` (lines 1-6)
```jsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Megaphone, CheckCircle, Clock, ... } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
```

**Grouping order:**
1. React hooks
2. Router (react-router-dom)
3. Icons (lucide-react)
4. Clients & utilities (supabase)
5. Context hooks (useAuth)
6. Components (relative imports)

### Constants & Config Objects

Defined at module level, before component declaration.

**Example:** `src/pages/Campaigns.jsx` (lines 8-67)
```jsx
const statusConfig = {
  draft: { label: 'Rascunho — ...', icon: Clock, color: 'text-muted bg-muted/10' },
  scheduled: { label: 'Agendado', icon: CalendarClock, color: 'text-blue-300 bg-blue-400/10' },
  // ...
}

const GROUPS = [
  { key: 'running', title: '🟢 Rodando agora', hint: '...' },
  // ...
]

function weekNum(c) { /* ... */ }
function groupOf(c, byId) { /* ... */ }
function sortCampaigns(list) { /* ... */ }
```

### Comments

Extensive inline comments explaining:
- **Business logic decisions** (e.g., why follow-ups use grouped status)
- **Bug fixes** (e.g., follow-up scheduled_for handling, dated 2026-07-01)
- **Data structure details** (e.g., why filters happen in JS not DB)

**Example:** `src/pages/Campaigns.jsx` (lines 32-42)
```jsx
// Bug real corrigido em 2026-07-01: follow-ups nascem com status='scheduled'
// e scheduled_for=null pra sempre (eles não usam data marcada — disparam N
// dias depois de cada envio individual da campanha-base, via
// processFollowUpCampaigns no run-automations). Antes disso cair na regra
// "scheduled sem data futura = rodando", TODO follow-up aparecia em "Rodando
// agora" mesmo com a campanha-base ainda em rascunho, sem nunca ter
// disparado pra ninguém...
```

---

## Router & Code Splitting

**Pattern:** Route-based lazy loading via `React.lazy()`.

**File:** `src/App.jsx` (lines 1-34)

```jsx
const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
// ... all pages lazy-loaded

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        // ...
      </Routes>
    </Suspense>
  )
}
```

**Benefit:** Per-route code splitting reduces initial bundle (mentioned in comments as improvement from ~1.4MB single bundle).

---

## Form Handling

### Uncontrolled vs Controlled Inputs

**Controlled inputs** (state-bound):

**Example:** `src/pages/NewCampaign.jsx` (lines 18-32)
```jsx
const [form, setForm] = useState({
  name: '', number_id: '', caption: '',
  send_mode: 'scheduled',
  scheduled_date: '', scheduled_time: '09:00',
  // ...
})

// In form:
<input value={name} onChange={e => setName(e.target.value)} />
<textarea value={caption} onChange={e => setCaption(e.target.value)} />
```

### Form Submission & Validation

Validation **before async submission**:

**Example:** `src/pages/NewCampaign.jsx` (lines 143-149)
```jsx
async function handleSend(e) {
  e.preventDefault()
  if (!form.number_id) return alert('Selecione uma loja.')
  if (contacts.length === 0) return alert('Nenhum contato nesta loja.')
  if (!form.caption.trim()) return alert('Escreva a mensagem.')
  if (form.send_mode === 'scheduled' && !form.scheduled_date) 
    return alert('Escolha a data...')
  // ... then submit
}
```

---

## Modal Implementation

**Pattern:** React Portal (not DOM nesting).

**File:** `src/components/Modal.jsx`
```jsx
import { createPortal } from 'react-dom'

export default function Modal({ children }) {
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/45 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        {children}
      </div>
    </div>,
    document.body
  )
}
```

**Reason (from code comment):** Fixes z-index stacking context issue when modals are nested inside animated containers.

---

## Date & Time Handling

Utilities for splitting/combining ISO dates with local form fields.

**Example:** `src/pages/Campaigns.jsx` (lines 304-330)
```jsx
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDatePart(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}:00`)
}
```

**Design choice:** Separate date & time inputs (not `<input type="datetime-local">`) per Leonardo's request for clarity.

---

## Summary of Key Conventions

| Aspect | Convention | Example |
|--------|-----------|---------|
| **Component type** | Functional with Hooks | `function Campaigns() { ... }` |
| **State mgmt** | useState + useEffect | `const [campaigns, setCampaigns] = useState([])` |
| **Data fetching** | Direct Supabase in components | `supabase.from('campaigns').select()...` |
| **Error handling** | Try/catch + error checks | `if (error) throw error` |
| **Styling** | Tailwind utilities only | `className="bg-card border border-border rounded-xl p-5"` |
| **Naming files** | PascalCase components | `Campaigns.jsx`, `Modal.jsx` |
| **Naming vars** | camelCase state/functions | `setCampaigns`, `fetchCampaigns()` |
| **Comments** | Inline, explain decisions | "Bug real corrigido em 2026-07-01: ..." |
| **Routing** | React Router + lazy loading | `const Campaigns = lazy(() => import('./pages/Campaigns'))` |
| **Modals** | React Portal | `createPortal(..., document.body)` |
