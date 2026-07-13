import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Megaphone, Plus, Cake,
  BarChart2, Settings, LogOut, Shield, Building2, Tag, Smartphone, Workflow, Image, X, MessageCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const clientNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { to: '/contacts', icon: Users, label: 'Contatos' },
  { to: '/campaigns/new', icon: Plus, label: 'Novo Disparo', highlight: true },
  { to: '/campaigns', icon: Megaphone, label: 'Histórico' },
  { to: '/birthdays', icon: Cake, label: 'Aniversários' },
  { to: '/conversations', icon: MessageCircle, label: 'Conversas' },
  { to: '/creatives', icon: Image, label: 'Criativos' },
  { to: '/automations', icon: Workflow, label: 'Automações' },
  { to: '/reports', icon: BarChart2, label: 'Relatórios' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

const adminNav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Painel Admin' },
  { to: '/admin/clients', icon: Building2, label: 'Clientes' },
  { to: '/admin/numbers', icon: Smartphone, label: 'Números WPP' },
  { to: '/admin/pricing', icon: Tag, label: 'Precificação' },
]

export default function Sidebar({ isAdmin, open = false, onClose = () => {} }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const nav = isAdmin ? adminNav : clientNav

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
      <div className="px-5 py-6 border-b border-border flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-bg font-display font-bold text-sm">Z</span>
            </div>
            <span className="font-display font-bold text-white text-lg">ZapFlow</span>
          </div>
          {isAdmin && (
            <div className="mt-2 flex items-center gap-1 text-accent text-xs font-body">
              <Shield size={10} />
              <span>Admin</span>
            </div>
          )}
        </div>
        <button onClick={onClose} className="md:hidden text-muted hover:text-white p-1" aria-label="Fechar menu">
          <X size={18} />
        </button>
      </div>

      {/* Client info */}
      {!isAdmin && profile?.client && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs text-muted font-body">Empresa</p>
          <p className="text-sm text-white font-body font-medium truncate">{profile.client.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-accent/10 text-accent font-body">
            {profile.client.plan || 'Basic'}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, highlight }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-body transition-all ${
                highlight
                  ? isActive
                    ? 'bg-accent text-bg font-semibold'
                    : 'bg-accent/15 text-accent font-semibold hover:bg-accent hover:text-bg'
                  : isActive
                    ? 'bg-surface text-white font-medium'
                    : 'text-muted hover:text-white hover:bg-surface/60'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Switch mode (admin can go back to client view) */}
      {profile?.role === 'admin' && (
        <div className="px-3 pb-2">
          {isAdmin ? (
            <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted hover:text-white font-body transition-all">
              <LayoutDashboard size={14} />
              Ver como cliente
            </NavLink>
          ) : (
            <NavLink to="/admin" onClick={onClose} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-accent hover:text-white font-body transition-all">
              <Shield size={14} />
              Painel admin
            </NavLink>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 font-body transition-all w-full"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
    </>
  )
}
