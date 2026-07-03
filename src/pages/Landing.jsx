import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Zap, CheckCircle, Send, Users, Cake, BarChart2, ArrowRight } from 'lucide-react'

// Pulso ambiente atrás do hero — um único momento de movimento na página
// (não espalhado por vários lugares), evocando o envio/recebimento de
// mensagem que dá nome à marca. Lento e discreto de propósito: é textura de
// fundo, não o protagonista da tela. Respeita prefers-reduced-motion.
function HeroPulse() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    let raf
    let t = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const colors = ['255,77,109', '139,92,246'] // accent, violet
    function frame() {
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2, cy = h * 0.42
      for (let i = 0; i < 3; i++) {
        const phase = (t + i * 70) % 210
        const r = phase * 1.6
        const alpha = Math.max(0, 1 - phase / 210) * 0.16
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${colors[i % 2]},${alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      t += 0.35
      if (!reduceMotion) raf = requestAnimationFrame(frame)
    }
    frame()

    return () => { window.removeEventListener('resize', resize); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />
}

// Espelha os planos reais em plan_limits + AdminPricing.jsx (custo real ×
// 1,30 de lucro) — atualizado em 2026-07-01 junto com o enforcement de
// verdade no sistema. Se mudar aqui, mudar também em AdminPricing.jsx.
const PLANS = [
  { name: 'Starter', monthly: 149, setup: 800, numbers: 1, contacts: 1000, features: ['1 número WhatsApp', '1.000 contatos', 'Campanhas automáticas', 'Histórico de campanhas'] },
  { name: 'Growth', monthly: 279, setup: 1500, numbers: 2, contacts: 2000, best: true, features: ['2 números WhatsApp', '2.000 contatos', 'Tudo do Starter', 'Mensagens de aniversário', 'Relatórios e exportação'] },
  { name: 'Scale', monthly: 669, setup: 2800, numbers: 5, contacts: 5000, features: ['5 números WhatsApp', '5.000 contatos', 'Tudo do Growth', 'Automações com resposta automática', 'Suporte prioritário'] },
  { name: 'Enterprise', monthly: 1319, setup: 4500, numbers: 10, contacts: null, features: ['10 números WhatsApp', 'Contatos ilimitados', 'Tudo do Scale', 'SLA e consultoria mensal'] },
]

const FEATURES = [
  { icon: Send, title: 'Campanhas sem esforço', desc: 'Sobe a imagem, escreve a mensagem e agenda — o sistema cuida do envio sozinho, respeitando o limite diário seguro pra nunca correr risco de bloqueio no WhatsApp.' },
  { icon: Users, title: 'Importação de contatos', desc: 'Importe sua lista atual em Excel ou CSV. O sistema organiza por loja automaticamente.' },
  { icon: Cake, title: 'Aniversários automáticos', desc: 'O sistema identifica quem faz aniversário e envia uma mensagem personalizada no dia certo, sem você fazer nada.' },
  { icon: BarChart2, title: 'Relatórios completos', desc: 'Veja quantas mensagens foram enviadas, por qual loja e com qual taxa de entrega. Exportação em Excel disponível.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg font-body">
      {/* Nav */}
      <nav className="border-b border-border px-8 py-4 flex items-center justify-between sticky top-0 bg-bg/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-bg" fill="currentColor" />
          </div>
          <span className="font-display font-bold text-white">ZapFlow</span>
          <span className="text-muted text-xs ml-1">por TOQY</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#planos" className="text-muted text-sm hover:text-white transition-colors">Planos</a>
          <Link to="/login" className="bg-accent hover:bg-accent-dim text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
            Entrar
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-8 py-24 max-w-5xl mx-auto text-center overflow-hidden">
        <HeroPulse />
        <div className="relative inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-8">
          <Zap size={12} className="text-accent" />
          <span className="text-accent text-xs font-body">Automação WhatsApp para negócios locais</span>
        </div>
        <h1 className="font-display font-bold text-5xl md:text-6xl text-white leading-tight mb-6">
          Seus clientes no WhatsApp,<br />
          <span className="text-accent">sem trabalho manual</span>
        </h1>
        <p className="text-muted text-lg max-w-2xl mx-auto mb-10 font-body leading-relaxed">
          Dispare promoções, novidades e mensagens de aniversário para toda a sua lista de clientes com uma imagem e um clique. Funciona para lojas, clínicas, restaurantes e muito mais.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/login" className="bg-accent hover:bg-accent-dim text-bg px-8 py-4 rounded-xl font-display font-bold text-base flex items-center justify-center gap-2 transition-colors">
            Acessar meu painel <ArrowRight size={18} />
          </Link>
          <a href="#planos" className="border border-border text-white px-8 py-4 rounded-xl font-body text-base flex items-center justify-center gap-2 hover:bg-surface transition-colors">
            Ver planos
          </a>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="px-8 py-20 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-white text-center mb-12">Tudo que você precisa</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-6 flex gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center shrink-0 mt-1">
                <Icon size={18} className="text-accent" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white text-base mb-2">{title}</h3>
                <p className="text-muted text-sm font-body leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="px-8 py-20 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-white text-center mb-4">Planos e preços</h2>
        <p className="text-muted text-center mb-12 font-body">Comece com o que você precisa. Sem contrato, sem surpresas.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {PLANS.map(p => (
            <div key={p.name} className={`bg-card rounded-2xl p-6 flex flex-col ${p.best ? 'border-2 border-accent' : 'border border-border'}`}>
              {p.best && <span className="self-start text-xs bg-accent text-bg px-2 py-1 rounded font-body font-semibold mb-4">Mais escolhido</span>}
              <h3 className="font-display font-bold text-xl text-white">{p.name}</h3>
              <div className="mt-4 mb-6">
                <p className="text-4xl font-display font-bold text-accent">R$ {p.monthly}<span className="text-base text-muted font-body font-normal">/mês</span></p>
                <p className="text-xs text-muted font-body mt-1">+ R$ {p.setup.toLocaleString()} de setup único</p>
                <p className="text-xs text-muted font-body mt-1">{p.contacts ? `Até ${p.contacts.toLocaleString()} contatos` : 'Contatos ilimitados'}</p>
              </div>
              <ul className="space-y-3 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm font-body text-muted">
                    <CheckCircle size={14} className="text-accent mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={`https://wa.me/5519997051919?text=${encodeURIComponent(`Oi! Quero contratar o plano ${p.name} do ZapFlow (R$${p.monthly}/mês + R$${p.setup.toLocaleString()} de setup).`)}`} target="_blank" rel="noreferrer"
                className={`mt-8 py-3 rounded-xl text-sm font-display font-bold text-center transition-colors ${p.best ? 'bg-accent hover:bg-accent-dim text-bg' : 'border border-border text-white hover:bg-surface'}`}>
                Quero este plano
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-20">
        <div className="max-w-2xl mx-auto bg-card border border-accent/20 rounded-2xl p-12 text-center">
          <Zap size={32} className="text-accent mx-auto mb-4" fill="currentColor" />
          <h2 className="font-display font-bold text-3xl text-white mb-4">Pronto para automatizar seu WhatsApp?</h2>
          <p className="text-muted font-body mb-8">Fale com nosso time e comece hoje mesmo.</p>
          <a href="https://wa.me/5519997051919?text=Quero+saber+mais+sobre+o+ZapFlow" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg px-8 py-4 rounded-xl font-display font-bold transition-colors">
            Falar pelo WhatsApp <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-6 text-center">
        <p className="text-muted text-xs font-body">© {new Date().getFullYear()} ZapFlow by TOQY · Todos os direitos reservados</p>
      </footer>
    </div>
  )
}
