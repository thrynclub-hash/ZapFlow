import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import {
  Menu, ShoppingCart, Search, Bell, Clock, ShieldCheck, ChevronDown,
  LogOut, User, Store, Smartphone, Zap
} from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Layout Desktop Enterprise (Padrão de Sistema Instalado)
// Barra de controle superior com status operacional em tempo real,
// atalho direto de PDV e perfil da loja.

export default function Layout({ isAdmin = false, isReseller = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, client, resellerBrand, logout } = useAuth()
  const navigate = useNavigate()

  // Relógio em tempo real de Brasília
  const [currentTime, setCurrentTime] = useState('')
  useEffect(() => {
    function updateClock() {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  const brand = isAdmin ? null : isReseller ? client : resellerBrand
  const brandName = brand?.name || client?.name || 'ZapFlow'

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Menu Lateral */}
      <Sidebar
        isAdmin={isAdmin}
        isReseller={isReseller}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Área Central com Barra de Comando Superior */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra Superior Desktop & Mobile (Enterprise Workstation) */}
        <header className="bg-card border-b border-border h-14 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          {/* Lado Esquerdo: Mobile Trigger + Status do Sistema */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-ink p-1 -ml-1 rounded-lg hover:bg-surface"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 font-semibold border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </span>
              <span className="text-muted/60">|</span>
              <span className="text-muted font-body font-medium flex items-center gap-1">
                <Store size={13} className="text-muted" />
                <strong className="text-ink font-semibold">{brandName}</strong>
              </span>
            </div>

            <span className="sm:hidden font-display font-bold text-sm text-ink truncate max-w-[160px]">
              {brandName}
            </span>
          </div>

          {/* Lado Direito: Atalho de PDV Balcão + Relógio + Perfil */}
          <div className="flex items-center gap-3">
            {/* Relógio do Sistema */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-muted bg-surface/60 px-3 py-1.5 rounded-lg border border-border/80">
              <Clock size={13} />
              <span className="tabular-nums font-medium">{currentTime || '00:00:00'}</span>
            </div>

            {/* Atalho Rápido para o PDV */}
            {!isAdmin && (
              <Link
                to="/pdv"
                className="bg-accent hover:bg-accent-dim text-white text-xs font-display font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
              >
                <ShoppingCart size={13} />
                <span className="hidden sm:inline">Terminal PDV</span>
                <span className="text-[10px] font-mono opacity-80">(F2)</span>
              </Link>
            )}

            {/* Operador Logado */}
            <div className="flex items-center gap-2 pl-2 border-l border-border/80">
              <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center font-bold text-xs text-ink border border-border">
                {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="hidden md:block text-left text-xs leading-none">
                <p className="font-medium text-ink truncate max-w-[110px]">{profile?.full_name || profile?.email?.split('@')[0]}</p>
                <span className="text-[10px] text-muted font-mono">{isAdmin ? 'Admin' : 'Operador'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo da Tela */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 md:p-8 animate-fadein">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
