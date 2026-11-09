import { useEffect, useState } from 'react'
import { Package, RefreshCw, AlertCircle, Plus, Edit2, Trash2, Boxes, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

// ZapFlow — Estoque (ERP). Tudo pelo ZapFlow, nunca abrindo o ERP por
// trás (hoje Bling) — o cliente não sabe (nem precisa saber) que fonte é
// essa. Novo/editar/excluir/ajustar estoque escrevem de volta no ERP via
// bling-estoque (edge function, ações: list/create/update/delete/adjust_stock).
export default function Stock() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [produtos, setProdutos] = useState([])
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null = fechado, {} = novo, {id,...} = editar
  const [adjusting, setAdjusting] = useState(null) // produto com ajuste de estoque aberto

  useEffect(() => { fetchStock() }, [])

  async function call(action, payload = {}) {
    const { data, error: fnError } = await supabase.functions.invoke('bling-estoque', { body: { action, ...payload } })
    if (fnError) return { ok: false, error: 'Não foi possível falar com o estoque agora. Tenta de novo em instantes.' }
    return data
  }

  async function fetchStock() {
    setLoading(true)
    setError(null)
    const data = await call('list')
    if (!data?.ok) { setError(data?.error || 'Erro desconhecido ao consultar o estoque.'); setLoading(false); return }
    setConnected(!!data.connected)
    setProdutos(data.produtos || [])
    setLoading(false)
  }

  async function handleDelete(p) {
    if (!confirm(`Excluir "${p.nome}"? Isso remove o produto do catálogo.`)) return
    const data = await call('delete', { id: p.id })
    if (!data?.ok) { alert('Erro ao excluir: ' + data?.error); return }
    fetchStock()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Estoque</h1>
          <p className="text-muted text-sm font-body mt-1">Seu catálogo e estoque, em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStock} className="flex items-center gap-2 bg-card border border-border hover:border-accent text-white font-body font-medium px-4 py-2 rounded-lg transition-colors text-sm">
            <RefreshCw size={15} /> Atualizar
          </button>
          {connected && (
            <button onClick={() => setEditing({})} className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg font-display font-bold px-4 py-2 rounded-lg transition-colors text-sm">
              <Plus size={15} /> Novo produto
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-[14px] p-5 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-400 shrink-0" />
          <p className="text-white font-body text-sm">{error}</p>
        </div>
      )}

      {!error && !connected && (
        <div className="bg-card border border-border rounded-[14px] p-10 text-center">
          <Package size={32} className="text-muted mx-auto mb-3" />
          <p className="text-white font-body font-medium">Nenhuma integração de estoque ativa ainda.</p>
          <p className="text-muted text-sm font-body mt-1">Fale com o suporte pra ativar o Estoque na sua conta.</p>
        </div>
      )}

      {connected && produtos.length === 0 && (
        <div className="bg-card border border-border rounded-[14px] p-10 text-center">
          <Package size={32} className="text-muted mx-auto mb-3" />
          <p className="text-white font-body font-medium">Nenhum produto ainda.</p>
          <button onClick={() => setEditing({})} className="mt-3 text-accent text-sm font-display font-bold hover:underline">Adicionar primeiro produto →</button>
        </div>
      )}

      {connected && produtos.length > 0 && (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Produto</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Código</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Preço</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Estoque</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {p.imagem ? (
                          <img src={p.imagem} alt="" className="w-9 h-9 rounded-[8px] object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-[8px] bg-surface flex items-center justify-center shrink-0">
                            <Package size={14} className="text-muted" />
                          </div>
                        )}
                        <span className="text-sm text-white font-body">{p.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted font-body">{p.codigo || '—'}</td>
                    <td className="px-5 py-3 text-sm text-white font-body">
                      {p.preco ? `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => setAdjusting(p)} className={`px-2.5 py-1 rounded-full text-xs font-body transition-opacity hover:opacity-75 ${
                        p.estoque === null ? 'text-muted bg-muted/10'
                        : p.estoque === 0 ? 'text-red-400 bg-red-400/10'
                        : p.estoque <= 5 ? 'text-amber-400 bg-amber-400/10'
                        : 'text-green-400 bg-green-400/10'
                      }`} title="Clique pra ajustar o estoque">
                        {p.estoque === null ? '—' : p.estoque}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(p)} title="Editar" className="text-muted hover:text-white transition-colors p-1.5"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(p)} title="Excluir" className="text-muted hover:text-red-400 transition-colors p-1.5"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing !== null && <ProductModal product={editing} call={call} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchStock() }} />}
      {adjusting && <StockAdjustModal product={adjusting} call={call} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); fetchStock() }} />}
    </div>
  )
}

function ProductModal({ product, call, onClose, onSaved }) {
  const isNew = !product.id
  const [nome, setNome] = useState(product.nome || '')
  const [codigo, setCodigo] = useState(product.codigo || '')
  const [preco, setPreco] = useState(product.preco || '')
  const [estoqueInicial, setEstoqueInicial] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const data = isNew
      ? await call('create', { nome, codigo, preco, estoque_inicial: estoqueInicial })
      : await call('update', { id: product.id, nome, codigo, preco })
    setSaving(false)
    if (!data?.ok) { setErr(data?.error || 'Erro ao salvar.'); return }
    onSaved()
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-bold text-xl text-white">{isNew ? 'Novo produto' : 'Editar produto'}</h3>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Nome *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Código (SKU)</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Preço (R$)</label>
              <input type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
            </div>
          </div>
          {isNew && (
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Estoque inicial</label>
              <input type="number" min="0" value={estoqueInicial} onChange={e => setEstoqueInicial(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
            </div>
          )}
          {err && <p className="text-red-400 text-xs font-body">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">
              {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

function StockAdjustModal({ product, call, onClose, onSaved }) {
  const [quantidade, setQuantidade] = useState(product.estoque ?? 0)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const data = await call('adjust_stock', { id: product.id, quantidade })
    setSaving(false)
    if (!data?.ok) { setErr(data?.error || 'Erro ao ajustar estoque.'); return }
    onSaved()
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm animate-fadein">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-xl text-white flex items-center gap-2"><Boxes size={18} /> Ajustar estoque</h3>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <p className="text-muted text-sm font-body mb-5">{product.nome}</p>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Quantidade atual em estoque</label>
            <input type="number" min="0" value={quantidade} onChange={e => setQuantidade(e.target.value)} autoFocus
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-lg text-white font-body text-center focus:outline-none focus:border-accent" />
          </div>
          {err && <p className="text-red-400 text-xs font-body">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
