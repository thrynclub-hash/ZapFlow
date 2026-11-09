import { useEffect, useMemo, useState } from 'react'
import { Package, RefreshCw, AlertCircle, Plus, Edit2, Trash2, Boxes, X, Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

// ZapFlow — Estoque (ERP). Tudo pelo ZapFlow, nunca abrindo o ERP por
// trás (hoje Bling) — o cliente não sabe (nem precisa saber) que fonte é
// essa. Novo/editar/excluir/ajustar estoque escrevem de volta no ERP via
// bling-estoque (edge function, ações: list/create/update/delete/adjust_stock).
//
// Variações (cor/tamanho): só dá pra criar junto com um produto novo, por
// enquanto — editar variações de um produto "V" já existente precisa de
// mais certeza sobre o schema do Bling pra não arriscar dado real do
// cliente; fica como próximo passo quando tiver confirmação.
export default function Stock() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [produtos, setProdutos] = useState([])
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null = fechado, {} = novo, {id,...} = editar
  const [adjusting, setAdjusting] = useState(null) // produto com ajuste de estoque aberto
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos') // todos | baixo | zerado

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return produtos.filter(p => {
      if (q && !p.nome.toLowerCase().includes(q) && !(p.codigo || '').toLowerCase().includes(q)) return false
      if (filter === 'zerado' && p.estoque !== 0) return false
      if (filter === 'baixo' && !(p.estoque !== null && p.estoque > 0 && p.estoque <= 5)) return false
      return true
    })
  }, [produtos, search, filter])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
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

      {connected && produtos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código..."
              className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white font-body placeholder-muted/60 focus:outline-none focus:border-accent" />
          </div>
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
            <SlidersHorizontal size={13} className="text-muted ml-2" />
            {[['todos', 'Todos'], ['baixo', 'Estoque baixo'], ['zerado', 'Zerado']].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-body transition-colors ${filter === key ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          <span className="text-muted text-xs font-mono ml-auto">{filtered.length} de {produtos.length}</span>
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
                {filtered.map((p) => (
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
                        <div className="min-w-0">
                          <span className="text-sm text-white font-body block truncate">{p.nome}</span>
                          {p.formato === 'V' && <span className="text-[10px] text-accent font-mono uppercase">com variações</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted font-body">{p.codigo || '—'}</td>
                    <td className="px-5 py-3 text-sm text-white font-body">
                      {p.preco ? `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => setAdjusting(p)} disabled={p.formato === 'V'} className={`px-2.5 py-1 rounded-full text-xs font-body transition-opacity hover:opacity-75 disabled:opacity-40 disabled:cursor-not-allowed ${
                        p.estoque === null ? 'text-muted bg-muted/10'
                        : p.estoque === 0 ? 'text-red-400 bg-red-400/10'
                        : p.estoque <= 5 ? 'text-amber-400 bg-amber-400/10'
                        : 'text-green-400 bg-green-400/10'
                      }`} title={p.formato === 'V' ? 'Produto com variações — ajuste pela variação específica no Bling' : 'Clique pra ajustar o estoque'}>
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
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted text-sm font-body">Nenhum produto encontrado.</td></tr>
                )}
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
  const [precoCusto, setPrecoCusto] = useState(product.precoCusto ?? '')
  const [descricaoCurta, setDescricaoCurta] = useState(product.descricaoCurta || '')
  const [imagemUrl, setImagemUrl] = useState(product.imagem || '')
  const [estoqueInicial, setEstoqueInicial] = useState('')
  const [temVariacoes, setTemVariacoes] = useState(false)
  const [variacoes, setVariacoes] = useState([{ nome: '', codigo: '', preco: '', estoque: '' }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  function updateVariacao(i, field, value) {
    setVariacoes(vs => vs.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }
  function addVariacao() { setVariacoes(vs => [...vs, { nome: '', codigo: '', preco: '', estoque: '' }]) }
  function removeVariacao(i) { setVariacoes(vs => vs.filter((_, idx) => idx !== i)) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const data = isNew
      ? await call('create', {
          nome, codigo, preco, precoCusto, descricaoCurta, imagemUrl, estoque_inicial: estoqueInicial,
          variacoes: temVariacoes ? variacoes.filter(v => v.nome.trim()) : undefined,
        })
      : await call('update', { id: product.id, nome, codigo, preco, precoCusto, descricaoCurta, imagemUrl })
    setSaving(false)
    if (!data?.ok) { setErr(data?.error || 'Erro ao salvar.'); return }
    onSaved()
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadein">
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
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Descrição curta</label>
            <textarea value={descricaoCurta} onChange={e => setDescricaoCurta(e.target.value)} rows={2}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
          </div>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">URL da foto</label>
            <input value={imagemUrl} onChange={e => setImagemUrl(e.target.value)} placeholder="https://..."
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
          </div>

          {!temVariacoes && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted font-body mb-1.5">Código (SKU)</label>
                <input value={codigo} onChange={e => setCodigo(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-muted font-body mb-1.5">Preço (R$)</label>
                <input type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-muted font-body mb-1.5">Custo (R$)</label>
                <input type="number" min="0" step="0.01" value={precoCusto} onChange={e => setPrecoCusto(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
              </div>
            </div>
          )}

          {isNew && !temVariacoes && (
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Estoque inicial</label>
              <input type="number" min="0" value={estoqueInicial} onChange={e => setEstoqueInicial(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
            </div>
          )}

          {isNew && (
            <label className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={temVariacoes} onChange={e => setTemVariacoes(e.target.checked)} className="w-4 h-4 accent-accent" />
              <span className="text-sm text-white font-body">Este produto tem variações (tamanho, cor...)</span>
            </label>
          )}

          {isNew && temVariacoes && (
            <div className="space-y-2.5 border border-border rounded-lg p-3">
              <p className="text-xs text-muted font-body">Cada variação vira um item com código/preço/estoque próprios (ex: "P", "M", "G").</p>
              {variacoes.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_80px_70px_auto] gap-2 items-center">
                  <input placeholder="Nome (ex: M)" value={v.nome} onChange={e => updateVariacao(i, 'nome', e.target.value)}
                    className="bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                  <input placeholder="Código" value={v.codigo} onChange={e => updateVariacao(i, 'codigo', e.target.value)}
                    className="bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                  <input type="number" min="0" step="0.01" placeholder="Preço" value={v.preco} onChange={e => updateVariacao(i, 'preco', e.target.value)}
                    className="bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                  <input type="number" min="0" placeholder="Estoq." value={v.estoque} onChange={e => updateVariacao(i, 'estoque', e.target.value)}
                    className="bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                  <button type="button" onClick={() => removeVariacao(i)} className="text-muted hover:text-red-400 p-1"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={addVariacao} className="text-accent text-xs font-display font-bold hover:underline">+ Adicionar variação</button>
            </div>
          )}

          {!isNew && product.formato === 'V' && (
            <p className="text-amber-400 text-xs font-body bg-amber-400/10 rounded-lg px-3 py-2">Produto com variações — editar cor/tamanho individual ainda não disponível aqui.</p>
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
