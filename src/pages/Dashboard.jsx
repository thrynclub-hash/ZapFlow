import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Megaphone, Cake, TrendingUp, Plus, ChevronRight, Boxes, DollarSign, AlertTriangle, Package } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Início (2026-11-09): ganha cara de painel de ERP de verdade
// (KPI financeiro/operacional + gráfico + lista acionável), não só
// métricas de campanha — senão o produto "ainda parece o ZapFlow" de
// antes, mesmo com Estoque/Negócios por baixo. Seções de Estoque/Negócios
// só aparecem se o módulo correspondente estiver ativo pro cliente.
function money(n) {
  return `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatCard({ icon: Icon, label, value, color = 'accent' }) {
  const colors = {
    accent: 'text-accent bg-accent/10',
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
  }
  return (
    <div className="bg-card border border-border rounded-[14px] p-5 transition-shadow hover:shadow-sm">
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-4 ${colors[color]}`}>
        <Icon size={19} strokeWidth={1.8} />
      </div>
      <p className="text-[28px] leading-none font-display font-bold text-white tabular-nums">{value}</p>
      <p className="text-muted text-[12.5px] font-mono tracking-wide uppercase mt-2">{label}</p>
    </div>
  )
}

const STAGE_ORDER = ['Novo', 'Orçamento', 'Negociação', 'Ganho', 'Perdido']

export default function Dashboard() {
  const { profile } = useAuth()
  const modules = profile?.client?.modules || {}
  const [stats, setStats] = useState({ contacts: 0, campaigns: 0, birthdays: 0, sent: 0 })
  const [recent, setRecent] = useState([])
  const [erp, setErp] = useState(null) // { stockValue, activeProducts, lowStock: [] }
  const [crm, setCrm] = useState(null) // { openValue, openCount, won30d, byStage: [], monthlyWon: [] }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.client_id) return
    fetchStats()
    if (modules.estoque) fetchErp()
    if (modules.crm) fetchCrm()
  }, [profile])

  async function fetchStats() {
    const clientId = profile.client_id

    const [contacts, campaigns, logs] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('campaigns').select('id', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('message_logs').select('id', { count: 'exact' }).eq('client_id', clientId).eq('status', 'sent'),
    ])

    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    let withBirthdate = [], bdFrom = 0
    while (true) {
      const { data } = await supabase.from('contacts').select('birth_date').eq('client_id', clientId).not('birth_date', 'is', null).range(bdFrom, bdFrom + 999)
      withBirthdate = withBirthdate.concat(data || [])
      if (!data || data.length < 1000) break
      bdFrom += 1000
    }
    const birthdays = withBirthdate.filter(c => { const p = c.birth_date.split('-'); return p[1] === mm && p[2] === dd }).length

    const { data: recentData } = await supabase
      .from('campaigns')
      .select('*, number:client_numbers(label)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5)

    setStats({ contacts: contacts.count || 0, campaigns: campaigns.count || 0, birthdays: birthdays || 0, sent: logs.count || 0 })
    setRecent(recentData || [])
    setLoading(false)
  }

  // Painel de estoque (via bling-estoque, mesma function da tela
  // Estoque) — valor total parado em estoque + o que precisa de atenção
  // agora (baixo/zerado), igual painel operacional de referência.
  async function fetchErp() {
    const { data } = await supabase.functions.invoke('bling-estoque', { body: { action: 'list' } })
    if (!data?.ok || !data.connected) { setErp(data?.connected === false ? { notConnected: true } : null); return }
    const produtos = data.produtos || []
    const stockValue = produtos.reduce((s, p) => s + (p.preco || 0) * (p.estoque || 0), 0)
    const lowStock = produtos.filter(p => p.estoque !== null && p.estoque <= 5).sort((a, b) => a.estoque - b.estoque).slice(0, 5)
    setErp({ stockValue, activeProducts: produtos.length, lowStock })
  }

  // Painel de negócios — funil em aberto (valor + contagem por estágio,
  // estilo "accounts receivable/payable" dos exemplos de ERP) e vendas
  // fechadas por mês (estilo "revenue vs expenses").
  async function fetchCrm() {
    const clientId = profile.client_id
    const { data: opps } = await supabase
      .from('opportunities')
      .select('stage, closed_at, created_at, opportunity_items(description, qty, unit_price)')
      .eq('client_id', clientId)

    const withTotal = (opps || []).map(o => ({ ...o, total: (o.opportunity_items || []).reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0) }))
    const open = withTotal.filter(o => o.stage !== 'Ganho' && o.stage !== 'Perdido')
    const byStage = STAGE_ORDER.map(stage => ({ stage, count: withTotal.filter(o => o.stage === stage).length, value: withTotal.filter(o => o.stage === stage).reduce((s, o) => s + o.total, 0) }))

    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { key: `${d.getFullYear()}-${d.getMonth()}`, name: d.toLocaleDateString('pt-BR', { month: 'short' }), ganho: 0 }
    })
    withTotal.filter(o => o.stage === 'Ganho' && o.closed_at).forEach(o => {
      const d = new Date(o.closed_at)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const m = months.find(m => m.key === key)
      if (m) m.ganho += o.total
    })

    // Curva ABC / produtos mais vendidos — só itens de negócios Ganhos,
    // agrupados por descrição (funciona com produto do catálogo local OU
    // descrição livre, já que opportunity_items aceita os dois). Classe A
    // = acumula até 80% da receita, B = até 95%, C = o resto (Pareto).
    const soldByName = {}
    withTotal.filter(o => o.stage === 'Ganho').forEach(o => {
      for (const item of o.opportunity_items || []) {
        const key = item.description || 'Item sem nome'
        const value = Number(item.qty) * Number(item.unit_price)
        if (!soldByName[key]) soldByName[key] = { name: key, qty: 0, value: 0 }
        soldByName[key].qty += Number(item.qty)
        soldByName[key].value += value
      }
    })
    const ranked = Object.values(soldByName).sort((a, b) => b.value - a.value)
    const totalSold = ranked.reduce((s, p) => s + p.value, 0)
    let cumulative = 0
    const topProducts = ranked.slice(0, 8).map(p => {
      cumulative += p.value
      const pct = totalSold > 0 ? cumulative / totalSold : 0
      const classe = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C'
      return { ...p, classe }
    })

    setCrm({
      openValue: open.reduce((s, o) => s + o.total, 0),
      openCount: open.length,
      byStage,
      monthlyWon: months,
      topProducts,
    })
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = profile?.full_name?.split(' ')[0] || 'por aí'

  const statusColors = { draft: 'text-muted bg-muted/10', sending: 'text-accent bg-accent/10', completed: 'text-green-400 bg-green-400/10', error: 'text-red-400 bg-red-400/10' }
  const statusLabels = { draft: 'Rascunho', sending: 'Enviando', completed: 'Concluído', error: 'Erro' }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2">
        <p className="text-muted text-xs font-body">{label}</p>
        <p className="text-accent font-body font-medium">{money(payload[0].value)}</p>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-sm font-body">{greeting} 👋</p>
          <h1 className="font-display font-bold text-3xl text-white mt-1">{name}</h1>
        </div>
        <Link to="/campaigns/new" className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg font-display font-bold px-5 py-2.5 rounded-lg transition-colors text-sm">
          <Plus size={16} /> Novo Disparo
        </Link>
      </div>

      {/* KPIs principais — relacionamento + (se ativo) ERP/negócios juntos
          na mesma grade, pra não parecer "ferramenta de mensagem com um
          extra" e sim um painel só. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Contatos cadastrados" value={stats.contacts.toLocaleString()} color="blue" />
        <StatCard icon={TrendingUp} label="Mensagens enviadas" value={stats.sent.toLocaleString()} color="green" />
        {modules.crm && crm && <StatCard icon={DollarSign} label="Em negociação" value={money(crm.openValue)} color="accent" />}
        {modules.estoque && erp && !erp.notConnected && <StatCard icon={Boxes} label="Valor em estoque" value={money(erp.stockValue)} color="purple" />}
        {!modules.crm && <StatCard icon={Megaphone} label="Campanhas criadas" value={stats.campaigns} color="accent" />}
        {!modules.estoque && <StatCard icon={Cake} label="Aniversários hoje" value={stats.birthdays} color="purple" />}
      </div>

      {/* Painel de negócios (CRM) */}
      {modules.crm && crm && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-display font-semibold text-white mb-6">Vendas fechadas por mês</h3>
            {crm.monthlyWon.every(m => m.ganho === 0) ? (
              <p className="text-muted text-sm font-body py-10 text-center">Nenhum negócio fechado ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={crm.monthlyWon} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E1E9E4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#5F6A65', fontSize: 12, fontFamily: 'Archivo' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#5F6A65', fontSize: 12, fontFamily: 'Archivo' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13,91,255,0.06)' }} />
                  <Bar dataKey="ganho" fill="#0D5BFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-white">Funil de vendas</h3>
              <Link to="/negocios" className="text-muted text-xs font-body hover:text-white transition-colors flex items-center gap-1">Ver <ChevronRight size={12} /></Link>
            </div>
            <div className="space-y-3">
              {crm.byStage.map(s => {
                const max = Math.max(...crm.byStage.map(x => x.count), 1)
                return (
                  <div key={s.stage}>
                    <div className="flex justify-between text-xs font-body mb-1">
                      <span className="text-muted">{s.stage}</span>
                      <span className="text-white">{s.count} · {money(s.value)}</span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Produtos mais vendidos / Curva ABC — só com negócios Ganhos
          registrados; classe A/B/C pelo critério clássico de Pareto
          (80/95/100% da receita acumulada). */}
      {modules.crm && crm && crm.topProducts?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-display font-semibold text-white mb-5">Produtos mais vendidos</h3>
          <div className="space-y-2">
            {crm.topProducts.map(p => (
              <div key={p.name} className="flex items-center justify-between bg-surface/60 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-mono font-bold ${
                    p.classe === 'A' ? 'bg-green-400/10 text-green-400' : p.classe === 'B' ? 'bg-amber-400/10 text-amber-400' : 'bg-muted/10 text-muted'
                  }`}>{p.classe}</span>
                  <span className="text-sm text-white font-body truncate">{p.name}</span>
                </div>
                <span className="text-sm text-muted font-body shrink-0 ml-3">{p.qty} un · {money(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Painel de estoque — o que precisa de atenção agora, não só a
          foto geral (igual painel "aguardando aprovação" de referência). */}
      {modules.estoque && erp && !erp.notConnected && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-semibold text-white flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /> Estoque baixo</h3>
            <Link to="/stock" className="text-muted text-xs font-body hover:text-white transition-colors flex items-center gap-1">Ver estoque <ChevronRight size={12} /></Link>
          </div>
          {erp.lowStock.length === 0 ? (
            <p className="text-muted text-sm font-body py-6 text-center">Nenhum produto com estoque baixo. 🎉</p>
          ) : (
            <div className="space-y-2">
              {erp.lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-surface/60 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-white font-body flex items-center gap-2"><Package size={13} className="text-muted" /> {p.nome}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-body ${p.estoque === 0 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'}`}>{p.estoque} un.</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aniversários alerta */}
      {stats.birthdays > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cake size={20} className="text-accent" />
            <div>
              <p className="text-white font-body font-medium">{stats.birthdays} aniversariante{stats.birthdays > 1 ? 's' : ''} hoje!</p>
              <p className="text-muted text-sm font-body">Não perca a oportunidade de enviar uma mensagem especial</p>
            </div>
          </div>
          <Link to="/birthdays" className="text-accent text-sm font-display font-bold hover:underline flex items-center gap-1">
            Ver <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Campanhas recentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-white">Últimas campanhas</h2>
          <Link to="/campaigns" className="text-muted text-sm font-body hover:text-white transition-colors">Ver todas →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Megaphone size={32} className="text-muted mx-auto mb-3" />
            <p className="text-muted font-body">Nenhuma campanha ainda.</p>
            <Link to="/campaigns/new" className="inline-block mt-4 text-accent text-sm font-display font-bold hover:underline">Criar primeiro disparo →</Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Campanha</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Loja</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Enviados</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Status</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(c => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-4 text-sm text-white font-body">{c.name || 'Disparo'}</td>
                    <td className="px-5 py-4 text-sm text-muted font-body">{c.number?.label || '—'}</td>
                    <td className="px-5 py-4 text-sm text-white font-body">{c.sent_count || 0}/{c.total_count || 0}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-body ${statusColors[c.status] || statusColors.draft}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted font-body">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
