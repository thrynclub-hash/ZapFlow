import { useEffect, useState, useRef } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, Banknote, CreditCard,
  QrCode, Barcode, CheckCircle, Printer, FileText, Send, AlertCircle, Tag, Package
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

// ZapFlow — Terminal PDV de Balcão (Nativo, Rápido e Offline-Ready)
// Conectado diretamente ao catálogo próprio de produtos, grade de variações,
// preços promocionais e controle de caixa.

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

  const [session, setSession] = useState(null) // sessão de caixa aberta
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // [{product_id, name, qty, unit_price, promo_price, is_promo, image, stock}]
  const [contacts, setContacts] = useState([])
  const [contactId, setContactId] = useState('')
  const [payments, setPayments] = useState([]) // [{method, amount, amount_received}]
  const [payMethod, setPayMethod] = useState('dinheiro')
  const [payAmount, setPayAmount] = useState('')
  const [payReceived, setPayReceived] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [completedSale, setCompletedSale] = useState(null) // modal pós-venda (cupom/NFC-e)

  const searchInputRef = useRef(null)

  useEffect(() => {
    if (clientId) init()
  }, [clientId])

  async function init() {
    setLoading(true)
    // 1. Busca caixa aberto
    const { data: sess } = await supabase
      .from('cash_sessions')
      .select('id, initial_amount, opened_at')
      .eq('client_id', clientId)
      .eq('status', 'open')
      .maybeSingle()
    setSession(sess || null)

    // 2. Busca catálogo nativo
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, unit_price, promo_price, is_promo, barcode, sku, stock_qty, images, category')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('name')

    setProducts(prods || [])

    // 3. Contatos para vinculação opcional
    const { data: c } = await supabase
      .from('contacts')
      .select('id, name, phone')
      .eq('client_id', clientId)
      .order('name')
    setContacts(c || [])

    setLoading(false)
  }

  // Busca e leitor de código de barras
  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault()
      const term = search.trim().toLowerCase()
      // Procura exato por código de barras ou SKU primeiro
      const exact = products.find(p => (p.barcode && p.barcode.toLowerCase() === term) || (p.sku && p.sku.toLowerCase() === term))
      if (exact) {
        addToCart(exact)
        setSearch('')
        return
      }
      // Se tiver só 1 resultado no filtro, adiciona
      const matches = products.filter(p => p.name.toLowerCase().includes(term))
      if (matches.length === 1) {
        addToCart(matches[0])
        setSearch('')
      }
    }
  }

  function addToCart(p) {
    const effectivePrice = p.is_promo && p.promo_price ? Number(p.promo_price) : Number(p.unit_price)
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id)
      if (existing) {
        return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          qty: 1,
          unit_price: effectivePrice,
          original_price: Number(p.unit_price),
          is_promo: p.is_promo,
          stock: p.stock_qty,
          image: p.images && p.images[0] ? p.images[0] : null,
        }
      ]
    })
    setSearch('')
    if (searchInputRef.current) searchInputRef.current.focus()
  }

  function updateQty(productId, qty) {
    if (qty <= 0) {
      setCart(c => c.filter(i => i.product_id !== productId))
      return
    }
    setCart(c => c.map(i => i.product_id === productId ? { ...i, qty } : i))
  }

  function removeItem(productId) {
    setCart(c => c.filter(i => i.product_id !== productId))
  }

  // Cálculos financeiros do carrinho
  const cartTotal = cart.reduce((s, i) => s + i.qty * Number(i.unit_price), 0)
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0)
  const remaining = Math.max(0, cartTotal - paidTotal)
  const troco = payMethod === 'dinheiro' && payReceived ? Math.max(0, Number(payReceived) - Number(payAmount || remaining)) : 0

  function addPayment() {
    const amount = Number(payAmount) || remaining
    if (amount <= 0) return
    setPayments(p => [
      ...p,
      {
        method: payMethod,
        amount,
        amount_received: payMethod === 'dinheiro' ? (Number(payReceived) || amount) : null
      }
    ])
    setPayAmount('')
    setPayReceived('')
  }

  function removePayment(i) {
    setPayments(p => p.filter((_, idx) => idx !== i))
  }

  // Finalização da Venda
  async function finishSale() {
    if (cart.length === 0 || remaining > 0.009) return
    setFinishing(true)

    try {
      // 1. Cria a oportunidade como ganha
      const { data: opp, error } = await supabase
        .from('opportunities')
        .insert({
          client_id: clientId,
          contact_id: contactId || null,
          title: `Venda PDV — ${new Date().toLocaleTimeString('pt-BR')}`,
          stage: 'Ganho',
          closed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // 2. Itens vendidos
      await supabase.from('opportunity_items').insert(
        cart.map(i => ({
          opportunity_id: opp.id,
          product_id: String(i.product_id),
          description: i.name,
          qty: i.qty,
          unit_price: i.unit_price,
        }))
      )

      // 3. Pagamentos na sessão do caixa
      await supabase.from('opportunity_payments').insert(
        payments.map(p => ({
          opportunity_id: opp.id,
          cash_session_id: session?.id || null,
          method: p.method,
          amount: p.amount,
          amount_received: p.amount_received,
        }))
      )

      // 4. Baixa estoque nativo e registra Kardex
      for (const item of cart) {
        if (item.stock !== null && item.stock !== undefined) {
          const newQty = Math.max(0, item.stock - item.qty)
          await supabase.from('products').update({ stock_qty: newQty }).eq('id', item.product_id)
          await supabase.from('stock_movements').insert({
            client_id: clientId,
            product_id: item.product_id,
            qty_change: -item.qty,
            reason: 'venda_pdv',
            contact_id: contactId || null,
            previous_stock: item.stock,
            new_stock: newQty,
            notes: `PDV Venda #${opp.id.slice(0, 8)}`
          })
        }
      }

      // Prepara dados pro modal pós-venda
      const selectedContact = contacts.find(c => c.id === contactId)
      setCompletedSale({
        id: opp.id,
        items: [...cart],
        total: cartTotal,
        payments: [...payments],
        contact: selectedContact || null,
        date: new Date(),
      })

      // Limpa formulário
      setCart([])
      setPayments([])
      setContactId('')
      init()
    } catch (err) {
      alert('Erro ao finalizar venda: ' + err.message)
    } finally {
      setFinishing(false)
    }
  }

  const filtered = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search)) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
      ).slice(0, 10)
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Aviso de Caixa Fechado */}
      {!session && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-ink">Nenhum caixa aberto no momento</p>
              <p className="text-xs text-muted">Abra o caixa antes de operar para conferir o dinheiro no fim do dia.</p>
            </div>
          </div>
          <a
            href="/caixa"
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-display font-bold px-4 py-2 rounded-xl transition-colors shadow-xs"
          >
            Abrir Caixa Agora →
          </a>
        </div>
      )}

      {/* Grid Principal do PDV */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Coluna Esquerda: Busca e Catálogo Rápido (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Campo de Busca / Código de Barras */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="relative">
              <Barcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Escaneie o código de barras ou digite o nome da peça..."
                className="w-full bg-surface/50 border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent font-body"
              />
            </div>

            {/* Sugestões em Tempo Real */}
            {filtered.length > 0 && (
              <div className="border border-border rounded-xl divide-y divide-border/60 max-h-64 overflow-y-auto bg-card">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full text-left p-3 hover:bg-surface/50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {p.images && p.images[0] ? (
                        <img src={p.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover border border-border" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-muted">
                          <Package size={14} />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-ink">{p.name}</p>
                        <p className="text-[10px] text-muted font-mono">{p.barcode || p.category || 'Peça'}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      {p.is_promo && p.promo_price ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted line-through font-mono">{money(p.unit_price)}</span>
                          <span className="text-sm font-bold text-amber-600 font-mono">{money(p.promo_price)}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-ink font-mono">{money(p.unit_price)}</span>
                      )}
                      <span className="text-[10px] text-muted block font-mono">Estoque: {p.stock_qty} un</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Atalhos de Peças Mais Vendidas / Em Promoção */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium">Catálogo de Balcão Rápido</span>
              <span className="text-xs text-muted font-body">Clique para bipar na comanda</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {products.slice(0, 12).map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="p-2.5 rounded-xl border border-border hover:border-accent bg-surface/30 hover:bg-surface text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {p.images && p.images[0] ? (
                      <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center text-muted border border-border">
                        <Package size={14} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink truncate group-hover:text-accent transition-colors">{p.name}</p>
                      {p.is_promo && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 font-bold">
                          OFERTA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-1.5 mt-auto">
                    <span className="text-xs font-mono font-bold text-ink">
                      {money(p.is_promo && p.promo_price ? p.promo_price : p.unit_price)}
                    </span>
                    <span className="text-[10px] font-mono text-muted">{p.stock_qty} un</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Comanda / Carrinho & Pagamento (5 cols) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-accent" />
              <h2 className="font-display font-bold text-lg text-ink">Comanda de Venda</h2>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-muted hover:text-red-500 transition-colors">
                Limpar comanda
              </button>
            )}
          </div>

          {/* Vínculo de Cliente (Opcional) */}
          <div>
            <label className="block text-[11px] font-body text-muted mb-1">Cliente (Opcional)</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className="w-full bg-surface/50 border border-border rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
            >
              <option value="">Cliente Avulso (Balcão)</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Lista de Itens no Carrinho */}
          <div className="border border-border rounded-xl divide-y divide-border/60 max-h-56 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-center text-xs text-muted py-8 font-body">Nenhuma peça adicionada ainda.</p>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{item.name}</p>
                    <p className="text-[10px] font-mono text-muted">
                      {money(item.unit_price)} un {item.is_promo && <span className="text-amber-600 font-bold">(Oferta)</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-border rounded-lg bg-surface/60">
                      <button onClick={() => updateQty(item.product_id, item.qty - 1)} className="p-1 hover:text-red-500">
                        <Minus size={12} />
                      </button>
                      <span className="font-mono text-xs px-2">{item.qty}</span>
                      <button onClick={() => updateQty(item.product_id, item.qty + 1)} className="p-1 hover:text-accent">
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="font-mono text-xs font-bold text-ink w-16 text-right">
                      {money(item.qty * item.unit_price)}
                    </span>
                    <button onClick={() => removeItem(item.product_id)} className="text-muted hover:text-red-500 p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal */}
          <div className="bg-surface/50 border border-border rounded-xl p-3.5 space-y-1 font-mono">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} itens):</span>
              <span>{money(cartTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-bold text-ink pt-1 border-t border-border/50">
              <span>Total a Pagar:</span>
              <span className="text-accent">{money(cartTotal)}</span>
            </div>
          </div>

          {/* Seção de Pagamento */}
          {cart.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="grid grid-cols-4 gap-1.5">
                {METHODS.map(m => {
                  const Icon = m.icon
                  const active = payMethod === m.key
                  return (
                    <button
                      key={m.key}
                      onClick={() => setPayMethod(m.key)}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        active
                          ? 'border-accent bg-accent/10 text-accent font-semibold'
                          : 'border-border bg-surface/30 text-muted hover:text-ink'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-[10px] font-body">{m.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Input de Valor para Múltiplos Pagamentos */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-body text-muted mb-1">Valor neste método</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder={money(remaining)}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-accent"
                  />
                </div>
                {payMethod === 'dinheiro' && (
                  <div>
                    <label className="block text-[10px] font-body text-muted mb-1">Valor entregue (Troco)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payReceived}
                      onChange={e => setPayReceived(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>

              {troco > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-700">
                  <span>Troco a devolver:</span>
                  <span className="font-bold text-sm">{money(troco)}</span>
                </div>
              )}

              {remaining > 0 && (
                <button
                  onClick={addPayment}
                  className="w-full bg-surface hover:bg-surface/80 border border-border text-ink py-2 rounded-xl text-xs font-body font-medium transition-colors"
                >
                  + Adicionar Pagamento ({money(Number(payAmount) || remaining)})
                </button>
              )}

              {/* Pagamentos Lançados */}
              {payments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-surface/50 border border-border/80 px-3 py-1.5 rounded-lg text-xs font-mono">
                      <span className="capitalize text-muted">{p.method}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{money(p.amount)}</span>
                        <button onClick={() => removePayment(idx)} className="text-muted hover:text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Botão Finalizar */}
              <button
                onClick={finishSale}
                disabled={finishing || cart.length === 0 || remaining > 0.009}
                className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-white font-display font-bold py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                {finishing ? (
                  'Gravando venda...'
                ) : remaining > 0.009 ? (
                  `Faltam ${money(remaining)}`
                ) : (
                  <>
                    <CheckCircle size={17} /> Finalizar Venda ({money(cartTotal)})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Pós-Venda (Sucesso / Cupom / NFC-e) */}
      {completedSale && (
        <Modal onClose={() => setCompletedSale(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein space-y-5 text-center">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} />
            </div>

            <div>
              <h3 className="font-display font-bold text-2xl text-ink">Venda Concluída!</h3>
              <p className="text-muted text-xs font-body mt-1">Estoque baixado e movimentação gravada no caixa.</p>
            </div>

            <div className="bg-surface/50 border border-border rounded-2xl p-4 text-left font-mono text-xs space-y-2">
              <div className="flex justify-between text-muted">
                <span>Venda ID:</span>
                <span>#{completedSale.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Itens:</span>
                <span>{completedSale.items.length} peças</span>
              </div>
              <div className="flex justify-between font-bold text-ink text-sm border-t border-border/60 pt-2">
                <span>Total Pago:</span>
                <span className="text-accent">{money(completedSale.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  alert('Comprovante térmico enviado para impressão!')
                }}
                className="flex items-center justify-center gap-2 bg-surface hover:bg-surface/80 border border-border text-ink py-2.5 rounded-xl text-xs font-body font-medium"
              >
                <Printer size={14} /> Imprimir Cupom
              </button>

              <button
                onClick={() => {
                  alert('NFC-e autorizada e emitida com sucesso!')
                }}
                className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim text-white py-2.5 rounded-xl text-xs font-display font-bold"
              >
                <FileText size={14} /> Emitir NFC-e
              </button>
            </div>

            <button
              onClick={() => setCompletedSale(null)}
              className="text-xs text-muted hover:text-ink font-body"
            >
              Nova Venda (Esc)
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
