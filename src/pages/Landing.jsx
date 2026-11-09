import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, CheckCircle, Send, Users, Cake, BarChart2, ArrowRight, Columns3,
  Package, MessageCircle, Bot, FileText, Boxes, ShoppingBag, Store, ChevronDown,
} from 'lucide-react'
import { APP_VERSION, BUILD_ID } from '../lib/appInfo'

// Reforma 2026-11-09: ZapFlow deixou de ser "só disparo de WhatsApp" pra
// virar o painel inteiro do negócio local — CRM/Pipeline, Estoque/ERP
// (integração invisível pro cliente final, nunca citamos o provedor aqui),
// nota fiscal, campanhas e Agente de IA. A landing antiga vendia 1/4 do
// produto real; esta reflete o que o painel faz hoje.

// Pulso ambiente atrás do hero — único momento de movimento na página,
// evocando o envio/recebimento de mensagem que dá nome à marca.
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

    const colors = ['13,91,255', '139,92,246'] // accent, violet
    function frame() {
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.82, cy = h * 0.4
      for (let i = 0; i < 3; i++) {
        const phase = (t + i * 70) % 210
        const r = phase * 1.4
        const alpha = Math.max(0, 1 - phase / 210) * 0.14
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

// Mockup do painel real — em CSS, não print estático. Mesma lógica visual
// da sidebar/dashboard de verdade (ver Sidebar.jsx/Dashboard.jsx), em
// miniatura, com uma "respiração" sutil pra parecer vivo sem ser bobo.
function ProductPreview() {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStage(s => (s + 1) % 3), 2600)
    return () => clearInterval(id)
  }, [])
  const rows = [
    { label: 'Novo', color: 'bg-blue-400', items: ['Camila R.', 'Pedro A.'] },
    { label: 'Ativo', color: 'bg-emerald-400', items: ['Studio Fit', 'João P.'] },
    { label: 'VIP', color: 'bg-amber-400', items: ['Lisa S.'] },
  ]
  return (
    <div className="relative rounded-2xl border border-border bg-card shadow-[0_24px_60px_-20px_rgba(13,91,255,0.25)] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-surface/60">
        <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 font-mono text-[10px] text-muted tracking-wide">app.zapflow · pipeline</span>
      </div>
      <div className="flex">
        <div className="w-32 shrink-0 border-r border-border px-3 py-4 space-y-1 hidden sm:block">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-accent/10 text-accent text-[11px] font-body font-semibold"><Columns3 size={12} /> Pipeline</div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted text-[11px] font-body"><Package size={12} /> Estoque</div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted text-[11px] font-body"><MessageCircle size={12} /> Conversas</div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted text-[11px] font-body"><Bot size={12} /> Agente IA</div>
        </div>
        <div className="flex-1 p-4 grid grid-cols-3 gap-2.5">
          {rows.map((r, i) => (
            <div key={r.label} className="rounded-xl border border-border bg-surface/50 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-muted"><span className={`w-1.5 h-1.5 rounded-full ${r.color}`} />{r.label}</span>
              </div>
              <div className="space-y-1.5">
                {r.items.map((name, j) => (
                  <div key={name} className={`rounded-lg bg-card border border-border px-2 py-1.5 text-[10px] font-body text-ink transition-all duration-700 ${stage === i && j === 0 ? 'ring-2 ring-accent/40 -translate-y-0.5' : ''}`}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Espelha os planos reais em plan_limits + AdminPricing.jsx (custo real ×
// 1,30 de lucro). Se mudar aqui, mudar também em AdminPricing.jsx.
const PLANS = [
  { name: 'Starter', monthly: 149, setup: 800, numbers: 1, contacts: 1000, features: ['1 número WhatsApp', '1.000 contatos', 'Campanhas automáticas', 'Histórico de campanhas'] },
  { name: 'Growth', monthly: 279, setup: 1500, numbers: 2, contacts: 2000, best: true, features: ['2 números WhatsApp', '2.000 contatos', 'Pipeline de vendas (CRM)', 'Mensagens de aniversário', 'Relatórios e exportação'] },
  { name: 'Scale', monthly: 669, setup: 2800, numbers: 5, contacts: 5000, features: ['5 números WhatsApp', '5.000 contatos', 'Estoque e catálogo integrado', 'Automações com resposta automática', 'Suporte prioritário'] },
  { name: 'Enterprise', monthly: 1319, setup: 4500, numbers: 10, contacts: null, features: ['10 números WhatsApp', 'Contatos ilimitados', 'Agente de IA no atendimento', 'SLA e consultoria mensal'] },
]

const PILLARS = [
  {
    icon: MessageCircle,
    tag: 'Atendimento',
    title: 'Toda conversa, organizada',
    desc: 'Dispara campanha, responde cliente e acompanha o funil de vendas num só painel — sem abrir o WhatsApp Web pra cada coisa.',
    bullets: ['Campanhas com imagem e agendamento', 'Pipeline visual (Novo → Ativo → VIP)', 'Respostas automáticas e Agente de IA'],
  },
  {
    icon: Boxes,
    tag: 'Estoque e vendas',
    title: 'Seu catálogo, sempre certo',
    desc: 'Produto, preço e estoque em tempo real dentro do ZapFlow — cadastra, edita e ajusta sem abrir nenhum outro sistema.',
    bullets: ['Catálogo com fotos e preço', 'Estoque sincronizado com marketplaces', 'Nota fiscal emitida direto no painel'],
  },
  {
    icon: Bot,
    tag: 'Automação',
    title: 'O trabalho repetitivo, sozinho',
    desc: 'Aniversário, lembrete e primeira resposta acontecem sem alguém da equipe precisar lembrar de fazer.',
    bullets: ['Mensagem de aniversário automática', 'Lembretes e reativação de clientes parados', 'Relatórios prontos, sem planilha'],
  },
]

const STEPS = [
  { n: '01', title: 'Conta configurada pra seu negócio', desc: 'A gente monta o painel do jeito que seu negócio funciona — loja física, e-commerce, clínica, o que for.' },
  { n: '02', title: 'Conecta seu número de WhatsApp', desc: 'Sem precisar trocar de aparelho ou perder o histórico — conecta e já começa a usar.' },
  { n: '03', title: 'Cliente atendido, estoque e vendas em dia', desc: 'Você acompanha tudo pelo painel. O que for automático, roda sozinho.' },
]

const FAQ = [
  { q: 'Preciso saber mexer em sistema complicado?', a: 'Não. O ZapFlow foi feito pra quem toca o negócio no dia a dia, não pra área de TI. Se você usa WhatsApp, usa o ZapFlow.' },
  { q: 'Funciona pra loja física ou só e-commerce?', a: 'Os dois. Loja de roupa física, e-commerce, clínica, restaurante — o painel se adapta ao que seu negócio precisa.' },
  { q: 'Perco meu número de WhatsApp atual?', a: 'Não, o número continua seu. O ZapFlow conecta nele, não substitui.' },
  { q: 'Dá pra integrar com o sistema que eu já uso pro estoque?', a: 'Na maioria dos casos sim — conversamos sobre o que você já usa e configuramos a integração certa pra você.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg font-body">
      {/* Nav */}
      <nav className="border-b border-border px-6 md:px-8 py-4 flex items-center justify-between sticky top-0 bg-bg/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-bg" fill="currentColor" />
          </div>
          <span className="font-display font-bold text-white">ZapFlow</span>
        </div>
        <div className="hidden md:flex items-center gap-7">
          <a href="#produto" className="text-muted text-sm hover:text-white transition-colors">Produto</a>
          <a href="#como-funciona" className="text-muted text-sm hover:text-white transition-colors">Como funciona</a>
          <a href="#planos" className="text-muted text-sm hover:text-white transition-colors">Planos</a>
        </div>
        <Link to="/login" className="bg-accent hover:bg-accent-dim text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
          Entrar
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative px-6 md:px-8 pt-20 pb-24 max-w-6xl mx-auto overflow-hidden">
        <HeroPulse />
        <div className="relative grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-7">
              <Store size={12} className="text-accent" />
              <span className="text-accent text-xs font-body">Pra negócios locais — loja, clínica, e-commerce</span>
            </div>
            <h1 className="font-display font-bold text-[2.75rem] md:text-5xl text-white leading-[1.08] mb-6">
              O painel que roda<br />seu negócio <span className="text-accent">pelo WhatsApp</span>
            </h1>
            <p className="text-muted text-lg max-w-xl mb-10 font-body leading-relaxed">
              Atendimento, campanhas, pipeline de vendas e estoque — tudo num painel só, feito pra loja de roupa, clínica ou qualquer negócio local. Sem planilha, sem sistema separado pra cada coisa.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/login" className="bg-accent hover:bg-accent-dim text-bg px-8 py-4 rounded-xl font-display font-bold text-base flex items-center justify-center gap-2 transition-colors">
                Acessar meu painel <ArrowRight size={18} />
              </Link>
              <a href="#planos" className="border border-border text-white px-8 py-4 rounded-xl font-body text-base flex items-center justify-center gap-2 hover:bg-surface transition-colors">
                Ver planos
              </a>
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Produto — 3 pilares */}
      <section id="produto" className="px-6 md:px-8 py-24 max-w-6xl mx-auto">
        <div className="max-w-2xl mb-14">
          <span className="font-mono text-[11px] tracking-[0.1em] text-accent uppercase">O produto</span>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-white mt-3">Não é só disparo de mensagem.</h2>
          <p className="text-muted font-body mt-3 leading-relaxed">É o painel inteiro do seu negócio — atendimento, vendas e estoque, todos se falando.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {PILLARS.map(({ icon: Icon, tag, title, desc, bullets }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-7 flex flex-col">
              <div className="w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center mb-5">
                <Icon size={20} className="text-accent" />
              </div>
              <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase mb-2">{tag}</span>
              <h3 className="font-display font-bold text-white text-lg mb-2.5">{title}</h3>
              <p className="text-muted text-sm font-body leading-relaxed mb-5">{desc}</p>
              <ul className="space-y-2 mt-auto">
                {bullets.map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm font-body text-ink">
                    <CheckCircle size={14} className="text-accent mt-0.5 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="px-6 md:px-8 py-24 bg-surface/50 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <span className="font-mono text-[11px] tracking-[0.1em] text-accent uppercase">Como funciona</span>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-white mt-3">Três passos. Sem complicação.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <span className="font-display font-bold text-5xl text-accent/15">{s.n}</span>
                <h3 className="font-display font-bold text-white text-lg mt-2 mb-2">{s.title}</h3>
                <p className="text-muted text-sm font-body leading-relaxed">{s.desc}</p>
                {i < STEPS.length - 1 && <ArrowRight size={16} className="hidden md:block text-border absolute top-2 -right-7" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades (grid compacto, reforça escopo completo) */}
      <section className="px-6 md:px-8 py-24 max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-white text-center mb-12">Tudo incluso, de verdade</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { icon: Send, title: 'Campanhas sem esforço', desc: 'Sobe a imagem, escreve a mensagem e agenda — o sistema cuida do envio sozinho, respeitando o limite seguro pra nunca correr risco de bloqueio.' },
            { icon: Users, title: 'Importação de contatos', desc: 'Importe sua lista atual em Excel ou CSV. O sistema organiza automaticamente.' },
            { icon: Cake, title: 'Aniversários automáticos', desc: 'O sistema identifica quem faz aniversário e manda mensagem personalizada no dia certo, sem você fazer nada.' },
            { icon: FileText, title: 'Nota fiscal pelo painel', desc: 'Emite nota direto no ZapFlow — por trás, o sistema certo cuida da parte fiscal, você não precisa abrir nada a mais.' },
            { icon: ShoppingBag, title: 'Marketplaces conectados', desc: 'Estoque e preço sincronizados com os canais de venda que você já usa, sem atualizar manual em cada um.' },
            { icon: BarChart2, title: 'Relatórios completos', desc: 'Veja quantas mensagens foram enviadas, com qual taxa de entrega e como estão as vendas. Exportação em Excel.' },
          ].map(({ icon: Icon, title, desc }) => (
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
      <section id="planos" className="px-6 md:px-8 py-24 max-w-6xl mx-auto">
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

      {/* FAQ */}
      <section className="px-6 md:px-8 py-24 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-white text-center mb-12">Perguntas frequentes</h2>
        <div className="space-y-3">
          {FAQ.map(f => <FaqItem key={f.q} {...f} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-8 py-24">
        <div className="max-w-2xl mx-auto bg-card border border-accent/20 rounded-2xl p-12 text-center">
          <Zap size={32} className="text-accent mx-auto mb-4" fill="currentColor" />
          <h2 className="font-display font-bold text-3xl text-white mb-4">Pronto pra tirar seu negócio da planilha?</h2>
          <p className="text-muted font-body mb-8">Fale com nosso time e comece hoje mesmo.</p>
          <a href="https://wa.me/5519997051919?text=Quero+saber+mais+sobre+o+ZapFlow" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg px-8 py-4 rounded-xl font-display font-bold transition-colors">
            Falar pelo WhatsApp <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 md:px-8 py-8 max-w-2xl mx-auto text-center">
        <p className="font-bold text-white text-sm font-display">ZapFlow</p>
        <p className="text-muted text-xs font-body mt-1">Um produto de Marusso Produções · Leonardo Marusso · CPF 473.503.798-54 · Indaiatuba - SP</p>
        <p className="text-muted text-xs font-body mt-1">leonardomarusso1@gmail.com · (19) 99705-1919</p>
        <p className="text-muted text-xs font-body mt-3 flex flex-wrap justify-center gap-x-2 gap-y-1">
          <Link to="/termos" className="hover:text-white">Termos de Uso</Link> ·
          <Link to="/privacidade" className="hover:text-white">Privacidade</Link> ·
          <Link to="/cookies" className="hover:text-white">Cookies</Link> ·
          <Link to="/contrato-assinatura" className="hover:text-white">Contrato de Assinatura</Link>
        </p>
        <p className="text-muted text-xs font-body mt-3">
          © {new Date().getFullYear()} Marusso Produções. Todos os direitos reservados. · v{APP_VERSION} · build {BUILD_ID}
        </p>
      </footer>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-body font-semibold text-white text-sm">{q}</span>
        <ChevronDown size={16} className={`text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-4 text-muted text-sm font-body leading-relaxed">{a}</p>}
    </div>
  )
}
