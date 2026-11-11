import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart, Package, Wallet, MessageCircle, ArrowUpRight, Plus,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Users, ArrowRight,
  Boxes, FileText, QrCode, Barcode, ChevronRight, Store, DollarSign
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Centro de Comando Operacional (ERP + CRM Nativo)
// Visão em tempo real de faturamento do dia, gaveta de caixa, estoque e atendimentos.
// Zero chamadas para Bling ou terceiros.

function money(val) {
  return `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function qtyLabel(n, singular, plural) {
  return n === 1 ? singular : plural
}

export default function Dashboard() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const itemNoun = profile?.client?.item_noun || 'Produto'
  const itemNounPlural = (itemNoun + 's').toLowerCase()
  // Bug real achado ao vivo (2026-11-10): Dashboard sempre mostrava Vendas
  // de Hoje, Gaveta do Caixa, Estoque e botão "Abrir PDV" pra QUALQUER
  // cliente — inclusive Clínica Hassum, que é só CRM de conversa via
  // WhatsApp, não vende nada pelo ZapFlow. Sidebar.jsx já escondia esses
  // links do menu (via modules.pdv/estoque), mas o Centro de Comando
  // nunca checava o mesmo módulo — por isso a tela "vazava" módulo que
  // nem aparece no menu.
  const modules = profile?.client?.modules || {}
  const hasSales = modules.pdv === true
  const hasStock = modules.estoque === true
  const isCrmOnly = !hasSales && !hasStock

  const [loading, setLoading] = useState(true)
  const [todaySales, setTodaySales] = useState({ total: 0, count: 0 })
  const [cashSession, setCashSession] = useState(null)
  const [stockSummary, setStockSummary] = useState({ totalItems: 0, totalValue: 0, lowStockItems: [] })
  const [conversationsCount, setConversationsCount] = useState(0)
  const [lifecycleCounts, setLifecycleCounts] = useState({})
  const [recentSales, setRecentSales] = useState([])
  const [paymentBreakdown, setPaymentBreakdown] = useState([]) // [{method, total}] — hoje, dados reais

  useEffect(() => {
    if (clientId) loadDashboardData()
  }, [clientId])

  async function loadDashboardData() {
    setLoading(true)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayIso = today.toISOString()

      // 1. Vendas de Hoje (Oportunidades ganhas) — só pra quem tem módulo PDV
      if (hasSales) {
        const { data: opps } = await supabase
          .from('opportunities')
          .select(`
            id, title, stage, closed_at,
            opportunity_payments (amount, method)
          `)
          .eq('client_id', clientId)
          .eq('stage', 'Ganho')
          .gte('closed_at', todayIso)
          .order('closed_at', { ascending: false })

        let sumToday = 0
        const list = (opps || []).map(o => {
          const total = (o.opportunity_payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
          sumToday += total
          return {
            id: o.id,
            title: o.title,
            total,
            time: new Date(o.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            method: o.opportunity_payments?.[0]?.method || 'dinheiro'
          }
        })

        setTodaySales({ total: sumToday, count: list.length })
        setRecentSales(list.slice(0, 5))

        const byMethod = {}
        for (const o of opps || []) {
          for (const p of (o.opportunity_payments || [])) {
            const m = p.method || 'outro'
            byMethod[m] = (byMethod[m] || 0) + Number(p.amount || 0)
          }
        }
        setPaymentBreakdown(Object.entries(byMethod).map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total))

        // 2. Caixa Aberto
        const { data: cash } = await supabase
          .from('cash_sessions')
          .select(`
            id, initial_amount, opened_at,
            cash_movements (type, amount)
          `)
          .eq('client_id', clientId)
          .eq('status', 'open')
          .maybeSingle()

        setCashSession(cash || null)
      }

      // 3. Estoque Nativo — só pra quem tem módulo de estoque
      if (hasStock) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, stock_qty, unit_price, cost_price, min_stock_alert, images')
          .eq('client_id', clientId)
          .eq('active', true)

        let totalQty = 0
        let totalVal = 0
        const lowItems = []

        for (const p of prods || []) {
          totalQty += p.stock_qty || 0
          totalVal += (p.stock_qty || 0) * Number(p.unit_price || 0)
          if ((p.stock_qty || 0) <= (p.min_stock_alert || 2)) {
            lowItems.push(p)
          }
        }

        setStockSummary({
          totalItems: totalQty,
          totalValue: totalVal,
          lowStockItems: lowItems.slice(0, 5)
        })
      }

      // 4. Conversas / Contatos (sempre — é o core de qualquer cliente)
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('lifecycle_stage')
        .eq('client_id', clientId)

      setConversationsCount((contactsData || []).length)

      if (isCrmOnly) {
        const counts = {}
        for (const c of contactsData || []) {
          const stage = c.lifecycle_stage || 'Novo'
          counts[stage] = (counts[stage] || 0) + 1
        }
        setLifecycleCounts(counts)
      }
    } catch (err) {
      console.error('Erro ao carregar Dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      <div className="glass-backdrop" aria-hidden="true" />
      {/* Topo do Centro de Comando */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink">
            Centro de Comando
          </h1>
          <p className="text-muted text-xs sm:text-sm font-body mt-0.5">
            {isCrmOnly
              ? 'Visão unificada de atendimento e conversas no WhatsApp.'
              : 'Visão unificada de vendas físicas, WhatsApp, saldo de caixa e estoque.'}
          </p>
        </div>

        {/* Atalhos Rápidos */}
        {(hasSales || hasStock) && (
          <div className="flex items-center gap-2">
            {hasSales && (
              <Link
                to="/pdv"
                className="bg-accent hover:bg-accent-dim text-white text-xs font-display font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2"
              >
                <ShoppingCart size={15} />
                <span>Abrir PDV (F2)</span>
              </Link>
            )}
            {hasStock && (
              <Link
                to="/stock"
                className="bg-card hover:bg-surface border border-border text-ink text-xs font-display font-bold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>Cadastrar {itemNoun}</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Grid de KPIs Principais (4 Colunas Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Vendas do Dia — só com módulo PDV */}
        {hasSales && (
          <div className="glass-panel rounded-2xl p-4.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-mono uppercase tracking-wider">Vendas de Hoje</span>
              <span className="p-1.5 rounded-lg bg-gold/10 text-gold">
                <TrendingUp size={15} />
              </span>
            </div>
            <p className="font-display font-bold text-2xl text-ink tabular-nums">
              {money(todaySales.total)}
            </p>
            <div className="flex items-center justify-between text-xs text-muted font-mono pt-1 border-t border-border/50">
              <span>{todaySales.count} pedidos fechados</span>
              <Link to="/negocios" className="text-accent hover:underline flex items-center">
                Ver pedidos <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        )}

        {/* KPI 2: Caixa Aberto — só com módulo PDV */}
        {hasSales && (
          <div className="glass-panel rounded-2xl p-4.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-mono uppercase tracking-wider">Gaveta do Caixa</span>
              <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
                <Wallet size={15} />
              </span>
            </div>
            <p className="font-display font-bold text-2xl text-ink tabular-nums">
              {cashSession ? money(cashSession.initial_amount) : 'Fechado'}
            </p>
            <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-border/50">
              <span className={cashSession ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                {cashSession ? '● Aberto hoje' : 'Necessita abertura'}
              </span>
              <Link to="/caixa" className="text-accent hover:underline flex items-center">
                Conferir <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        )}

        {/* KPI 3: Estoque Imobilizado — só com módulo de estoque */}
        {hasStock && (
          <div className="glass-panel rounded-2xl p-4.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-muted text-xs">
              <span className="font-mono uppercase tracking-wider">Estoque Ativo</span>
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
                <Package size={15} />
              </span>
            </div>
            <p className="font-display font-bold text-2xl text-ink tabular-nums">
              {stockSummary.totalItems} <span className="text-sm font-normal text-muted">{qtyLabel(stockSummary.totalItems, itemNoun.toLowerCase(), itemNounPlural)}</span>
            </p>
            <div className="flex items-center justify-between text-xs text-muted font-mono pt-1 border-t border-border/50">
              <span>Valor: {money(stockSummary.totalValue)}</span>
              <Link to="/stock" className="text-accent hover:underline flex items-center">
                Catálogo <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        )}

        {/* KPI 4: Atendimentos WhatsApp */}
        <div className="glass-panel rounded-2xl p-4.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted text-xs">
            <span className="font-mono uppercase tracking-wider">Atendimento WhatsApp</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <MessageCircle size={15} />
            </span>
          </div>
          <p className="font-display font-bold text-2xl text-ink tabular-nums">
            {conversationsCount} <span className="text-sm font-normal text-muted">{qtyLabel(conversationsCount, 'cliente', 'clientes')}</span>
          </p>
          <div className="flex items-center justify-between text-xs text-muted font-mono pt-1 border-t border-border/50">
            {modules.ia_agent ? (
              <span className="text-emerald-600 font-bold">IA Sofia Ativa</span>
            ) : (
              <span className="text-muted">Atendimento manual</span>
            )}
            <Link to="/conversations" className="text-accent hover:underline flex items-center">
              Abrir chat <ChevronRight size={11} />
            </Link>
          </div>
        </div>
      </div>

      {/* Grid Central: Vendas Recentes x Alertas de Estoque — só pra quem
          tem esses módulos. Cliente CRM-only (ex: Clínica Hassum) vê o
          funil real de contatos no lugar, não "vendas" que não existem. */}
      {isCrmOnly ? (
        <div className="glass-panel rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-accent" />
              <h3 className="font-display font-bold text-base text-ink">Funil de Contatos</h3>
            </div>
            <Link to="/contacts" className="text-xs text-accent font-semibold hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['Novo', 'Ativo', 'Dormindo', 'VIP'].map(stage => (
              <div key={stage} className="p-3 rounded-xl bg-surface/50 border border-border text-center">
                <p className="font-display font-bold text-xl text-ink">{lifecycleCounts[stage] || 0}</p>
                <span className="text-[10px] text-muted font-mono uppercase">{stage}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tabela de Vendas Recentes (7 cols) */}
        {hasSales && (
        <div className="lg:col-span-7 glass-panel rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={17} className="text-accent" />
              <h3 className="font-display font-bold text-base text-ink">Últimas Vendas Realizadas</h3>
            </div>
            <Link to="/negocios" className="text-xs text-accent font-semibold hover:underline">
              Ver todas →
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <p className="text-center text-xs text-muted py-8 font-body">Nenhuma venda registrada hoje ainda.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {recentSales.map(sale => (
                <div key={sale.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-ink">{sale.title}</p>
                    <span className="text-[10px] text-muted font-mono">
                      Horário: {sale.time} · Método: <strong className="uppercase">{sale.method}</strong>
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-emerald-600 text-sm">{money(sale.total)}</span>
                    <span className="block text-[10px] text-muted">Pago & Baixado</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Alertas de Reposição de Estoque (5 cols) */}
        {hasStock && (
        <div className="lg:col-span-5 glass-panel rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-amber-500" />
              <h3 className="font-display font-bold text-base text-ink">Alertas de Reposição</h3>
            </div>
            <Link to="/stock" className="text-xs text-accent font-semibold hover:underline">
              Gerenciar estoque →
            </Link>
          </div>

          {stockSummary.lowStockItems.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
              <p className="text-xs text-muted font-body">{itemNounPlural.endsWith('as') ? 'Todas as' : 'Todos os'} {itemNounPlural} estão com estoque saudável!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stockSummary.lowStockItems.map(item => (
                <div key={item.id} className="p-2.5 rounded-xl bg-surface/50 border border-border flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-ink truncate">{item.name}</p>
                    <span className="text-[10px] text-muted font-mono">
                      Mínimo alertado: {item.min_stock_alert || 2} un
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-red-500/10 text-red-600 shrink-0">
                    {item.stock_qty} un restando
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Quebra de Pagamentos de Hoje (dados reais, mesma query de vendas) */}
      {hasSales && paymentBreakdown.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 space-y-3 shadow-xs">
          <h3 className="font-display font-bold text-sm text-ink">Pagamentos de Hoje por Forma</h3>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-surface/60">
            {paymentBreakdown.map((p, i) => (
              <div
                key={p.method}
                style={{ width: `${(p.total / todaySales.total * 100) || 0}%`, background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-mono">
            {paymentBreakdown.map((p, i) => (
              <span key={p.method} className="flex items-center gap-1.5 text-muted capitalize">
                <span className="w-2 h-2 rounded-full" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                {p.method} <strong className="text-ink">{money(p.total)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const PAYMENT_COLORS = ['#0D5BFF', '#C9A227', '#10B981', '#8B5CF6']
