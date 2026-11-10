import { useEffect, useState } from 'react'
import { ShoppingBag, Printer, RefreshCw, Package, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ZapFlow — Pedidos de Marketplace (Mercado Livre por enquanto).
// A etiqueta de envio AQUI vem do próprio marketplace (Mercado Envios já
// gera a etiqueta quando o comprador paga) — zero provedor de frete
// externo, zero token pro cliente configurar. Shopee/TikTok Shop entram
// quando a API de parceiro deles for aprovada (não documentada pra
// desenvolvedor não-parceiro hoje).

function money(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
}

const STATUS_LABELS = {
  paid: 'Pago', confirmed: 'Confirmado', payment_required: 'Aguardando pagamento',
  payment_in_process: 'Pagamento em processo', cancelled: 'Cancelado', invalid: 'Inválido',
}

export default function MarketplaceOrders() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(null)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [printingId, setPrintingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: fnError } = await supabase.functions.invoke('ml-orders', { body: {} })
    if (fnError || !data?.ok) {
      setError(data?.error || fnError?.message || 'Erro ao buscar pedidos.')
      setLoading(false)
      return
    }
    setConnected(data.connected)
    setOrders(data.orders || [])
    setLoading(false)
  }

  async function printLabel(order) {
    if (!order.shipping_id) { alert('Esse pedido não tem envio associado ainda.'); return }
    setPrintingId(order.id)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ml-shipment-label', { body: { shipment_id: order.shipping_id } })
      if (fnError || !data?.ok) { alert('Erro ao buscar etiqueta: ' + (data?.error || fnError?.message)); return }
      const byteChars = atob(data.pdf_base64)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      alert('Erro ao abrir etiqueta: ' + e.message)
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Pedidos de Marketplace</h1>
          <p className="text-muted text-sm font-body mt-1">Mercado Livre — etiquetas geradas pelo próprio marketplace, prontas pra imprimir.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 bg-card border border-border hover:border-accent text-ink font-body font-medium px-4 py-2.5 rounded-xl transition-colors text-sm">
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-2">
          <AlertCircle size={28} className="text-amber-500 mx-auto" />
          <p className="text-sm text-ink font-body">{error}</p>
        </div>
      ) : connected === false ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-2">
          <ShoppingBag size={28} className="text-muted mx-auto" />
          <p className="text-sm text-ink font-body">Mercado Livre ainda não conectado nesta loja.</p>
          <p className="text-xs text-muted font-body">Peça pro suporte conectar em Admin &gt; Integrações.</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-2">
          <Package size={28} className="text-muted mx-auto" />
          <p className="text-sm text-ink font-body">Nenhum pedido recente no Mercado Livre.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface/40">
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Pedido</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Comprador</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Itens</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Etiqueta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-3.5 text-xs font-mono text-muted">#{String(o.id).slice(-8)}</td>
                    <td className="px-5 py-3.5 text-sm text-ink font-body">{o.buyer}</td>
                    <td className="px-5 py-3.5 text-xs text-muted font-body">
                      {o.items.map(i => `${i.quantity}x ${i.title}`).join(', ')}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-mono">
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono text-right text-ink">{money(o.total)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => printLabel(o)}
                        disabled={!o.shipping_id || printingId === o.id}
                        className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-dim disabled:opacity-40 text-white text-xs font-display font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Printer size={13} /> {printingId === o.id ? 'Abrindo...' : 'Imprimir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
