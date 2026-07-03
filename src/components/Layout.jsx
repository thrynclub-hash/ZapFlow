import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

// Sidebar virou drawer em telas pequenas (2026-07-03) — antes disso ela
// era sempre visível com w-56 fixo, mesmo em celular, o que sozinho já
// ocupava boa parte de uma tela de 375px de largura. Barra superior com
// hamburguer só aparece abaixo do breakpoint md; em telas maiores o layout
// continua idêntico ao de antes (sidebar sempre visível, sem essa barra).
export default function Layout({ isAdmin = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar isAdmin={isAdmin} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1 -ml-1" aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <span className="font-display font-bold text-white text-base">ZapFlow</span>
        </div>
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 md:p-8 animate-fadein">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
