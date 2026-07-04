import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { APP_VERSION, BUILD_ID } from '../lib/appInfo'

const legalLinks = [
  { to: '/termos', label: 'Termos de Uso' },
  { to: '/privacidade', label: 'Privacidade' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/contrato-assinatura', label: 'Contrato de Assinatura' },
]

export default function LegalPageShell({ title, updatedAt, children }) {
  return (
    <div className="min-h-screen bg-bg">
      <nav className="flex items-center justify-between px-8 py-6 max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-bg" fill="currentColor" />
          </div>
          <span className="font-display font-bold text-white">ZapFlow</span>
        </Link>
        <Link to="/" className="text-muted text-sm hover:text-white transition-colors">Voltar ao início</Link>
      </nav>

      <article className="px-8 py-10 max-w-3xl mx-auto">
        <p className="text-accent text-xs font-body font-semibold uppercase tracking-wider">{title}</p>
        <h1 className="font-display font-bold text-3xl md:text-4xl text-white mt-2">{title}</h1>
        <p className="text-muted text-sm font-body mt-2">Última atualização: {updatedAt}</p>

        <div className="legal-content mt-8 space-y-5 text-sm font-body leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-white [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-display [&_h3]:font-bold [&_h3]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-accent [&_a:hover]:text-accent-dim [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-surface [&_th]:p-2 [&_th]:text-left [&_th]:text-white [&_td]:border [&_td]:border-border [&_td]:p-2 [&_strong]:text-white">
          {children}
        </div>
      </article>

      <footer className="border-t border-border px-8 py-8 max-w-3xl mx-auto text-xs font-body text-muted">
        <p className="font-bold text-white">ZapFlow</p>
        <p className="mt-1">Um produto de Marusso Produções · Leonardo Marusso · CPF 473.503.798-54 · Indaiatuba - SP</p>
        <p className="mt-1">leonardomarusso1@gmail.com · (19) 99705-1919</p>
        <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
          {legalLinks.map((link, i) => (
            <span key={link.to}>
              <Link to={link.to} className="hover:text-white">{link.label}</Link>
              {i < legalLinks.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>
        <p className="mt-3">
          © {new Date().getFullYear()} Marusso Produções. Todos os direitos reservados. · v{APP_VERSION} · build {BUILD_ID}
        </p>
      </footer>
    </div>
  )
}
