import { useEffect, useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Banknote, CreditCard, QrCode } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — PDV (2026-11-09). Venda de balcão vira uma Opportunity criada
// já como "Ganho" com os itens — reaproveita o funil de Negócios em vez
// de inventar conceito de "venda" duplicado. Baixa estoque no Bling pelo
// mesmo bling-estoque (action adjust_stock) que a tela Estoque usa.
// Precisa de caixa aberto (ver Caixa.jsx) pra vincular o pagamento —
// isso é o que separa "venda" de "dinheiro contado no fechamento".
const METHODS = [
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { key: 'pix', label: 'Pix', icon: QrCode },
  { key: 'debito', label: 'Débito', icon: CreditCard },
  { key: 'credito', label: 'Crédito', icon: CreditCard },
]

function money(n) {
  return `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`
}

export default function Pdv() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [session, setSession] = useState(null) // caixa aberto ou null
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // [{product_id, name, qty, unit_price, stock}]
  const [contacts, setContacts] = useState([])
  const [contactId, setContactId] = useState('')
  const [payments, setPayments] = useState([]) // [{method, amount, amount_received}]
  const [payMethod, setPayMethod] = useState('dinheiro')
  const [payAmount, setPayAmount] = useState('')
  const [payReceived, setPayReceived] = useState('')
  const [finishing, setFinishing] = useState(false)

  useEffect(() => { if (clientId) init() }, [clientId])

  async function init() {
    setLoading(true)
    const { data: sess } = await supabase.from('cash_sessions').select('id, initial_amount, opened_at').eq('client_id', clientId).eq('status', 'open').maybeSingle()
    setSession(sess || null)
    // Bling primeiro (catálogo real de quem usa, ex: Lisa); cliente sem
    // Bling conectado cai no catálogo local (`products`, núcleo ERP
    // genérico) — PDV funciona pros dois jeitos, não só pra loja com Bling.
    const { data: blingData } = await supabase.functions.invoke('bling-estoque', { body: { action: 'list' } })
    if (blingData?.ok && blingData.connected) {
      setProducts((blingData.produtos || []).map(p => ({ id: p.id, name: p.nome, unit_price: p.preco || 0, stock: p.estoque, source: 'bling' })))
    } else {
      const { data: local } = await supabase.from('products').select('id, name, unit_price, stock_qty').eq('client_id', clientId).eq('active', true).order('name')
      setProducts((local || []).map(p => ({ id: p.id, name: p.name, unit_price: p.unit_price || 0, stock: p.stock_qty, source: 'local' })))
    }
    const { data: c } = await supabase.from('contacts').select('id, name').eq('client_id', clientId).order('name')
    setContacts(c || [])
    setLoading(false)
  }

  const filtered = search.trim() ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : []

  function addToCart(p) {
    setCart(c => {
      const existing = c.find(i => i.product_id === p.id)
      if (existing) return c.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...c, { product_id: p.id, name: p.name, qty: 1, unit_price: p.unit_price, stock: p.stock }]
    })
    setSearch('')
  }
  function updateQty(productId, qty) {
    if (qty <= 0) { setCart(c => c.filter(i => i.product_id !== productId)); return }
    setCart(c => c.map(i => i.product_id === productId ? { ...i, qty } : i))
  }
  function removeItem(productId) { setCart(c => c.filter(i => i.product_id !== productId)) }

  const cartTotal = cart.reduce((s, i) => s + i.qty * Number(i.unit_price), 0)
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0)
  const remaining = Math.max(0, cartTotal - paidTotal)
  const troco = payMethod === 'dinheiro' && payReceived ? Math.max(0, Number(payReceived) - Number(payAmount || remaining)) : 0

  function addPayment() {
    const amount = Number(payAmount) || remaining
    if (amount <= 0) return
    setPayments(p => [...p, { method: payMethod, amount, amount_received: payMethod === 'dinheiro' ? (Number(payReceived) || amount) : null }])
    setPayAmount(''); setPayReceived('')
  }
  function removePayment(i) { setPayments(p => p.filter((_, idx) => idx !== i)) }

  async function finishSale() {
    if (cart.length === 0 || remaining > 0.009) return
    setFinishing(true)
    try {
      const { data: opp, error } = await supabase.from('opportunities').insert({
        client_id: clientId, contact_id: contactId || null, title: `Venda PDV ${new Date().toLocaleString('pt-BR')}`,
        stage: 'Ganho', closed_at: new Date().toISOString(),
      }).select().single()
      if (error) throw error

      await supabase.from('opportunity_items').insert(cart.map(i => ({
        opportunity_id: opp.id, product_id: String(i.product_id), description: i.name, qty: i.qty, unit_price: i.unit_price,
      })))

      await supabase.from('opportunity_payments').insert(payments.map(p => ({
        opportunity_id: opp.id, cash_session_id: session?.id || null, method: p.method, amount: p.amount, amount_received: p.amount_received,
      })))

      // Baixa estoque — Bling (mesma action que a tela Estoque usa) ou
      // tabela local (products/stock_movements, núcleo ERP genérico),
      // conforme a origem de cada item.
      for (const item of cart) {
        if (item.stock == null) continue
        const newQty = Math.max(0, item.stock - item.qty)
        if (item.source === 'bling') {
          await supabase.functions.invoke('bling-estoque', { body: { action: 'adjust_stock', id: item.product_id, quantidade: newQty } })
        } else {
          await supabase.from('products').update({ stock_qty: newQty }).eq('id', item.product_id)
          await supabase.from('stock_movements').insert({ client_id: clientId, product_id: item.product_id, qty_change: -item.qty, reason: 'pdv_sale' })
        }
      }

      setCart([]); setPayments([]); setContactId('')
      alert('Venda registrada!')
      init()
    } catch (e) {
      alert('Erro ao finalizar venda: ' + e.message)
    } finally {
      setFinishing(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!session) return (
    <div className="bg-card border border-border rounded-[14px] p-10 text-center max-w-md mx-auto mt-10">
      <ShoppingCart size={32} className="text-muted mx-auto mb-3" />
      <p className="text-white font-body font-medium">Nenhum caixa aberto.</p>
      <p className="text-muted text-sm font-body mt-1 mb-4">Abra o caixa pra começar a vender.</p>
      <a href="/caixa" className="inline-block bg-accent hover:bg-accent-dim text-bg px-5 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">Ir pro Caixa</a>
    </div>
  )

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">PDV</h1>
          <p className="text-muted text-sm font-body mt-1">Caixa aberto desde {new Date(session.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</p>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto pra adicionar..." autoFocus
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-sm text-white font-body placeholder-muted/60 focus:outline-none focus:border-accent" />
          {filtered.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
              {filtered.slice(0, 8).map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface/60 text-left transition-colors">
                  <span className="text-sm text-white font-body">{p.name}</span>
                  <span className="text-xs text-muted font-body">{money(p.unit_price)} · {p.stock ?? '—'} un.</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {cart.length === 0 ? (
            <p className="text-muted text-sm font-body text-center py-14">Carrinho vazio. Busca um produto acima.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {cart.map(i => (
                  <tr key={i.product_id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-sm text-white font-body">{i.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button onClick={() => updateQty(i.product_id, i.qty - 1)} className="text-muted hover:text-white p-1"><Minus size={13} /></button>
                        <span className="text-sm text-white font-mono w-6 text-center">{i.qty}</span>
                        <button onClick={() => updateQty(i.product_id, i.qty + 1)} className="text-muted hover:text-white p-1"><Plus size={13} /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white font-body text-right">{money(i.qty * i.unit_price)}</td>
                    <td className="px-2 py-3"><button onClick={() => removeItem(i.product_id)} className="text-muted hover:text-red-400 p-1"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit sticky top-4">
        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Cliente (opcional)</label>
          <select value={contactId} onChange={e => setContactId(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
            <option value="">Cliente avulso</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex justify-between text-lg font-display font-bold text-white border-t border-border pt-3">
          <span>Total</span><span>{money(cartTotal)}</span>
        </div>

        {payments.length > 0 && (
          <div className="space-y-1.5">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-surface/60 rounded-lg px-3 py-1.5 text-xs font-body">
                <span className="text-white capitalize">{p.method}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted">{money(p.amount)}</span>
                  <button onClick={() => removePayment(i)} className="text-muted hover:text-red-400"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {remaining > 0.009 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs text-muted font-body">Falta pagar: <strong className="text-white">{money(remaining)}</strong></p>
            <div className="grid grid-cols-4 gap-1.5">
              {METHODS.map(m => (
                <button key={m.key} onClick={() => setPayMethod(m.key)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-body transition-colors ${payMethod === m.key ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-surface text-muted border border-transparent'}`}>
                  <m.icon size={14} /> {m.label}
                </button>
              ))}
            </div>
            <input type="number" min="0" step="0.01" placeholder={`Valor (padrão: ${money(remaining)})`} value={payAmount} onChange={e => setPayAmount(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white font-body focus:outline-none focus:border-accent" />
            {payMethod === 'dinheiro' && (
              <input type="number" min="0" step="0.01" placeholder="Valor recebido (pra calcular troco)" value={payReceived} onChange={e => setPayReceived(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white font-body focus:outline-none focus:border-accent" />
            )}
            {payMethod === 'dinheiro' && troco > 0 && <p className="text-amber-400 text-xs font-body">Troco: {money(troco)}</p>}
            <button onClick={addPayment} className="w-full bg-surface border border-border hover:border-accent text-white py-2 rounded-lg text-xs font-display font-bold transition-colors">Adicionar pagamento</button>
          </div>
        )}

        <button onClick={finishSale} disabled={cart.length === 0 || remaining > 0.009 || finishing}
          className="w-full bg-accent hover:bg-accent-dim disabled:opacity-40 text-bg py-3.5 rounded-lg text-sm font-display font-bold transition-colors">
          {finishing ? 'Finalizando...' : 'Finalizar venda'}
        </button>
      </div>
    </div>
  )
}
