import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Megaphone, Plus, Cake,
  BarChart2, Settings, LogOut, Shield, Building2, Tag, Smartphone, Workflow, Image, X, MessageCircle,
  Package, Columns3, DollarSign
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Agrupado em seções (igual ao padrão vocero-crm: cada grupo é um bloco de
// "o que você faz" na ferramenta, não uma lista plana de 10 itens iguais).
const clientNavGroups = [
  {
    title: null,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
      { to: '/campaigns/new', icon: Plus, label: 'Novo Disparo', highlight: true },
    ],
  },
  {
    title: 'Relacionamento',
    items: [
      { to: '/contacts', icon: Users, label: 'Contatos' },
      { to: '/pipeline', icon: Columns3, label: 'Pipeline', module: 'crm' },
      { to: '/negocios', icon: DollarSign, label: 'Negócios', module: 'crm' },
      { to: '/conversations', icon: MessageCircle, label: 'Conversas' },
      { to: '/birthdays', icon: Cake, label: 'Aniversários' },
    ],
  },
  {
    title: 'ERP',
    module: 'estoque',
    items: [
      { to: '/stock', icon: Package, label: 'Estoque', module: 'estoque' },
    ],
  },
  {
    title: 'Campanhas',
    items: [
      { to: '/campaigns', icon: Megaphone, label: 'Histórico' },
      { to: '/creatives', icon: Image, label: 'Criativos' },
      { to: '/automations', icon: Workflow, label: 'Automações' },
      { to: '/reports', icon: BarChart2, label: 'Relatórios' },
    ],
  },
]

const adminNavGroups = [
  {
    title: null,
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Painel Admin' },
      { to: '/admin/clients', icon: Building2, label: 'Clientes' },
      { to: '/admin/numbers', icon: Smartphone, label: 'Números WPP' },
      { to: '/admin/pricing', icon: Tag, label: 'Precificação' },
    ],
  },
]

// Painel do revendedor (reforma white-label, 2026-11-07) — reusa as mesmas
// telas do admin (AdminClients/AdminNumbers), RLS já escopa pros clientes
// dele (ver migration "Reseller manages own clients"), nada de Precificação
// nem Painel Admin global aqui.
const resellerNavGroups = [
  {
    title: null,
    items: [
      { to: '/reseller/clients', icon: Building2, label: 'Meus Clientes' },
      { to: '/reseller/numbers', icon: Smartphone, label: 'Números WPP' },
    ],
  },
]

function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export default function Sidebar({ isAdmin, isReseller = false, open = false, onClose = () => {} }) {
  const { profile, client, resellerBrand, logout } = useAuth()
  const navigate = useNavigate()
  const rawNavGroups = isAdmin ? adminNavGroups : isReseller ? resellerNavGroups : clientNavGroups
  // Módulos opcionais (estoque, crm) — mesmo padrão de clients.modules.ia_agent
  // (zapi-webhook): sem o módulo ligado, zero mudança pro cliente (Hassum/
  // Sodie usam só o sistema de mensagens normal, não cadastrei Estoque/
  // Pipeline pra eles — não pode aparecer sozinho no menu).
  const modules = profile?.client?.modules || {}
  const navGroups = rawNavGroups
    .filter((g) => !g.module || modules[g.module] === true)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.module || modules[i.module] === true) }))
    .filter((g) => g.items.length > 0)
  // White-label: cliente final de revendedor vê a marca dele; o próprio
  // revendedor, gerenciando os clientes dele, vê a própria marca (se já
  // configurou logo_url/nome) — nunca "ZapFlow" nesses dois casos.
  const brand = isAdmin ? null : isReseller ? client : resellerBrand
  const brandName = brand?.name || 'ZapFlow'
  const brandLogo = brand?.logo_url || null
  const userName = profile?.name || profile?.email || 'Usuário'

  async function handleLogout() {
    await logout()
    navigate("/login")
  }

  return (
    <>
      {/* Fundo escuro atrás do menu, só em telas pequenas — clicar fora fecha */}
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}

      <aside className={`w-64 shrink-0 bg-card border-r border-border flex flex-col h-screen fixed md:static top-0 left-0 z-50 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} className="w-9 h-9 rounded-[11px] object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 bg-accent rounded-[11px] flex items-center justify-center shrink-0">
                <span className="text-bg font-display font-bold text-sm">{brandName[0]}</span>
              </div>
            )}
            <span className="font-display font-bold text-white text-[17px] truncate">{brandName}</span>
          </div>
          {/* "kicker" — rótulo técnico discreto em mono, igual ao padrão
              vocero-crm (ver app-nav.tsx: <span className="kicker">) — é
              o tipo de detalhe que separa "mais um SaaS" de um produto com
              ponto de vista próprio. */}
          <p className="mt-2 ml-0.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
            {isReseller ? 'Revendedor · WhatsApp' : isAdmin ? 'Painel Admin' : 'CRM · WhatsApp'}
          </p>
        </div>
        <button onClick={onClose} className="md:hidden text-muted hover:text-white p-1 shrink-0" aria-label="Fechar menu">
          <X size={18} />
        </button>
      </div>

      {/* Client info */}
      {!isAdmin && profile?.client && (
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-[10px] bg-surface/60">
          <p className="text-[10px] text-muted font-body uppercase tracking-wide">Empresa</p>
          <p className="text-sm text-white font-body font-medium truncate">{profile.client.name}</p>
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wide bg-accent/10 text-accent">
            {(profile.client.plan || 'Basic').toUpperCase()}
          </span>
        </div>
      )}

      {/* Nav, agrupada — cada grupo com rótulo pequeno (kicker), sem
          colapsar: lê-se de cima a baixo como uma lista do que existe. */}
      <nav className="flex-1 px-2.5 overflow-y-auto">
        {navGroups.map((group, i) => (
          <div key={group.title ?? i} className={`flex flex-col gap-0.5 ${i > 0 ? 'mt-4' : ''}`}>
            {group.title && (
              <span className="px-2.5 mb-1 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                {group.title}
              </span>
            )}
            {group.items.map(({ to, icon: Icon, label, highlight }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] text-[13.5px] font-body font-semibold transition-colors ${
                    highlight
                      ? isActive
                        ? 'bg-accent text-bg'
                        : 'bg-accent/15 text-accent hover:bg-accent hover:text-bg'
                      : isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted hover:text-white hover:bg-surface/60'
                  }`
                }
              >
                <Icon size={17} strokeWidth={1.8} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Switch mode (admin can go back to client view) */}
      {profile?.role === 'admin' && (
        <div className="px-2.5 pb-1">
          {isAdmin ? (
            <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-xs text-muted hover:text-white font-body transition-colors">
              <LayoutDashboard size={14} />
              Ver como cliente
            </NavLink>
          ) : (
            <NavLink to="/admin" onClick={onClose} className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-xs text-accent hover:text-white font-body transition-colors">
              <Shield size={14} />
              Painel admin
            </NavLink>
          )}
        </div>
      )}

      {/* Conta — avatar com iniciais + nome, igual ao bloco final do
          padrão vocero-crm (initials + nome + papel), em vez de só um
          botão "Sair" solto. */}
      <div className="mx-2.5 mb-3 mt-1 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 hover:bg-surface/60 transition-colors">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
          {initials(userName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-white">{userName}</span>
          <span className="block truncate text-[10.5px] text-muted">
            {isAdmin ? 'Admin' : isReseller ? 'Revendedor' : 'Cliente'}
          </span>
        </span>
        <button
          onClick={handleLogout}
          className="shrink-0 rounded p-1 text-muted hover:text-red-400 transition-colors"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
    </>
  )
}
