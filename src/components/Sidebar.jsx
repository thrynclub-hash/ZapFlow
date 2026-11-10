import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Megaphone, Cake, BarChart2, Settings,
  LogOut, Shield, Building2, Tag, Smartphone, Workflow, X, MessageCircle,
  Package, DollarSign, ShoppingCart, Wallet, Bot, Sparkles, Calculator, Landmark, ShoppingBag, Truck
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Navegação Enterprise (Padrão de Sistema Corporativo / Desktop)
// Organizado em blocos de Operação, Atendimento e Automação.
// Sem botões apelativos de disparo no topo.

const clientNavGroups = [
  {
    title: null,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Centro de Comando' },
    ],
  },
  {
    title: 'Operação & Vendas',
    items: [
      { to: '/pdv', icon: ShoppingCart, label: 'Terminal PDV', module: 'pdv' },
      { to: '/caixa', icon: Wallet, label: 'Caixa da Loja', module: 'pdv' },
      { to: '/carne-leao', icon: Calculator, label: 'Apoio Carnê-Leão', module: 'pdv' },
      { to: '/financeiro', icon: Landmark, label: 'Contas a Pagar/Receber', module: 'financeiro' },
      { to: '/stock', icon: Package, label: 'Catálogo & Estoque', module: 'estoque' },
      { to: '/marketplace', icon: ShoppingBag, label: 'Pedidos Marketplace', module: 'estoque' },
      { to: '/fornecedores', icon: Truck, label: 'Fornecedores', module: 'estoque' },
      { to: '/negocios', icon: DollarSign, label: 'Negócios & Pedidos', module: 'crm' },
      { to: '/contacts', icon: Users, label: 'Contatos & Clientes' },
    ],
  },
  {
    title: 'Atendimento WhatsApp',
    items: [
      { to: '/conversations', icon: MessageCircle, label: 'Bandeja de Conversas' },
      { to: '/ai-agent', icon: Bot, label: 'Estúdio da IA (Sofia)', module: 'ia_agent' },
      { to: '/birthdays', icon: Cake, label: 'Aniversários' },
    ],
  },
  {
    title: 'Automações & Marketing',
    items: [
      { to: '/automations', icon: Workflow, label: 'Fluxos Visuais (n8n)' },
      { to: '/campaigns', icon: Megaphone, label: 'Campanhas & Histórico' },
      { to: '/reports', icon: BarChart2, label: 'Relatórios Operacionais' },
    ],
  },
  {
    title: 'Ajustes',
    items: [
      { to: '/settings', icon: Settings, label: 'Configurações da Loja' },
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
      { to: '/admin/pricing', icon: Tag, label: 'Precificação & Margem' },
    ],
  },
]

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

  const modules = profile?.client?.modules || {}
  const navGroups = rawNavGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.module || modules[i.module] === true),
    }))
    .filter((g) => g.items.length > 0)

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
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}

      <aside className={`w-64 shrink-0 bg-card border-r border-border flex flex-col h-screen fixed md:static top-0 left-0 z-50 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        {/* Logo / Marca */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between border-b border-border/70">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {brandLogo ? (
                <img src={brandLogo} alt={brandName} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border" />
              ) : (
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-display font-bold text-sm shrink-0 shadow-xs">
                  {brandName[0]}
                </div>
              )}
              <span className="font-display font-bold text-ink text-base truncate">{brandName}</span>
            </div>
            <p className="mt-1 font-mono text-[10px] tracking-wider text-muted uppercase">
              {isReseller ? 'Painel do Parceiro' : isAdmin ? 'Painel Admin' : 'ERP & Vendas Comercial'}
            </p>
          </div>
          <button onClick={onClose} className="md:hidden text-muted hover:text-ink p-1 shrink-0" aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        {/* Informações da Loja */}
        {!isAdmin && profile?.client && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-surface/70 border border-border/60">
            <p className="text-[9px] text-muted font-mono uppercase tracking-wide">Empresa Ativa</p>
            <p className="text-xs text-ink font-body font-bold truncate">{profile.client.name}</p>
            <span className="inline-block mt-1 px-2 py-0.2 rounded font-mono text-[9px] font-semibold bg-accent/10 text-accent">
              Plano {(profile.client.plan || 'Growth').toUpperCase()}
            </span>
          </div>
        )}

        {/* Menu de Navegação */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {navGroups.map((group, i) => (
            <div key={group.title ?? i} className="space-y-0.5">
              {group.title && (
                <span className="px-2.5 mb-1.5 block font-mono text-[10px] tracking-wider text-muted/80 uppercase font-semibold">
                  {group.title}
                </span>
              )}
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/admin' || to === '/dashboard'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-body font-medium transition-all ${
                      isActive
                        ? 'bg-accent text-white font-bold shadow-xs'
                        : 'text-muted hover:text-ink hover:bg-surface/80'
                    }`
                  }
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Modo Alternativo para Admin */}
        {profile?.role === 'admin' && (
          <div className="px-3 pb-1 border-t border-border pt-2">
            {isAdmin ? (
              <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted hover:text-ink font-body">
                <LayoutDashboard size={14} />
                <span>Ver como Loja</span>
              </NavLink>
            ) : (
              <NavLink to="/admin" onClick={onClose} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-accent hover:text-accent-dim font-body font-bold">
                <Shield size={14} />
                <span>Painel Admin</span>
              </NavLink>
            )}
          </div>
        )}

        {/* Rodapé do Usuário Operador */}
        <div className="mx-3 mb-3 p-2.5 rounded-xl border border-border/80 bg-surface/50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-accent/15 text-accent font-bold text-xs flex items-center justify-center shrink-0">
              {initials(userName)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-bold text-ink truncate">{userName}</p>
              <p className="text-[10px] text-muted font-mono truncate">{isAdmin ? 'Admin' : 'Operador'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="text-muted hover:text-red-500 p-1 rounded-lg transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  )
}
