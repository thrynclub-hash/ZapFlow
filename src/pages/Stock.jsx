import { useEffect, useMemo, useState } from 'react'
import {
  Package, RefreshCw, AlertCircle, Plus, Edit2, Trash2, Boxes, X, Search,
  SlidersHorizontal, Tag, Image as ImageIcon, History, Barcode, Check, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

// ZapFlow — Estoque & Catálogo Nativo (100% Independente, Zero Bling)
// Gerenciamento completo de grade de peças (tamanhos/cores), múltiplas fotos,
// promoções ativas, código de barras e rastreabilidade total via Kardex.

function money(val) {
  return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`
}

export default function Stock() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  // Nome do item configurável por cliente (Peça, Doce, Bolo...) — bug real
  // 2026-11-09: "Cadastrar Peça" hardcoded quebrava pra quem não vende roupa.
  const itemNoun = profile?.client?.item_noun || 'Produto'
  const itemNounPlural = itemNoun + 's'

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos') // todos | promo | baixo | zerado
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [categories, setCategories] = useState([])

  // Modais
  const [editing, setEditing] = useState(null) // null = fechado, {} = novo, {...prod} = editar
  const [adjusting, setAdjusting] = useState(null) // produto selecionado para ajuste de estoque
  const [kardexProduct, setKardexProduct] = useState(null) // produto selecionado para ver histórico
  const [previewPhoto, setPreviewPhoto] = useState(null) // foto em tamanho expandido
  const [importing, setImporting] = useState(false) // modal de importação inicial de catálogo (onboarding)

  useEffect(() => {
    if (clientId) fetchStock()
  }, [clientId])

  async function fetchStock() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (*)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])

      // Extrai categorias únicas
      const cats = Array.from(new Set((data || []).map(p => p.category).filter(Boolean)))
      setCategories(cats)
    } catch (err) {
      console.error('Erro ao buscar estoque nativo:', err)
    } finally {
      setLoading(false)
    }
  }

  // Toggle rápido de promoção
  async function togglePromo(product) {
    const nextState = !product.is_promo
    const { error } = await supabase
      .from('products')
      .update({ is_promo: nextState })
      .eq('id', product.id)

    if (!error) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_promo: nextState } : p))
    }
  }

  async function handleDelete(product) {
    if (!confirm(`Excluir "${product.name}" do catálogo? As variações e fotos também serão removidas.`)) return
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      alert('Erro ao excluir produto: ' + error.message)
      return
    }
    fetchStock()
  }

  // Métricas de topo do painel
  const stats = useMemo(() => {
    const totalItems = products.reduce((acc, p) => acc + (p.stock_qty || 0), 0)
    const totalValue = products.reduce((acc, p) => acc + ((p.stock_qty || 0) * (p.unit_price || 0)), 0)
    const inPromo = products.filter(p => p.is_promo).length
    const lowStock = products.filter(p => (p.stock_qty || 0) <= (p.min_stock_alert || 2) && (p.stock_qty || 0) > 0).length
    const zeroStock = products.filter(p => (p.stock_qty || 0) === 0).length

    return { totalItems, totalValue, inPromo, lowStock, zeroStock }
  }, [products])

  // Filtragem
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(p => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.barcode || '').toLowerCase().includes(q) && !(p.sku || '').toLowerCase().includes(q)) {
        return false
      }
      if (categoryFilter !== 'todas' && p.category !== categoryFilter) return false
      if (filter === 'promo' && !p.is_promo) return false
      if (filter === 'zerado' && p.stock_qty !== 0) return false
      if (filter === 'baixo' && !(p.stock_qty > 0 && p.stock_qty <= (p.min_stock_alert || 2))) return false
      return true
    })
  }, [products, search, filter, categoryFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-3xl text-ink">Catálogo & Estoque</h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              Motor Nativo
            </span>
          </div>
          <p className="text-muted text-sm font-body mt-1">
            Controle de grade, fotos de {itemNounPlural.toLowerCase()} para o WhatsApp, leitor de código e promoções.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStock}
            className="flex items-center gap-2 bg-card border border-border hover:border-accent text-ink font-body font-medium px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            <RefreshCw size={15} /> Atualizar
          </button>
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 bg-card border border-border hover:border-accent text-ink font-body font-medium px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            <Boxes size={15} /> Importar Catálogo
          </button>
          <button
            onClick={() => setEditing({})}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white font-display font-bold px-4 py-2.5 rounded-xl transition-colors text-sm shadow-sm"
          >
            <Plus size={16} /> Cadastrar {itemNoun}
          </button>
        </div>
      </div>

      {/* Cards de Métricas em Destaque */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted font-body uppercase tracking-wider">Total em Estoque</p>
          <p className="font-display font-bold text-2xl text-ink mt-1">{stats.totalItems} <span className="text-xs font-normal text-muted">unidades</span></p>
          <p className="text-[11px] font-mono text-muted mt-1">Valor: {money(stats.totalValue)}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted font-body uppercase tracking-wider">{itemNounPlural} em Promoção</p>
            <Tag size={14} className="text-amber-500" />
          </div>
          <p className="font-display font-bold text-2xl text-amber-600 mt-1">{stats.inPromo}</p>
          <p className="text-[11px] text-muted font-body mt-1">Ativas no WhatsApp e PDV</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted font-body uppercase tracking-wider">Estoque Baixo</p>
            <AlertCircle size={14} className="text-amber-400" />
          </div>
          <p className="font-display font-bold text-2xl text-ink mt-1">{stats.lowStock}</p>
          <p className="text-[11px] text-muted font-body mt-1">Abaixo do limite de alerta</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted font-body uppercase tracking-wider">Zerados</p>
            <Boxes size={14} className="text-red-400" />
          </div>
          <p className="font-display font-bold text-2xl text-red-500 mt-1">{stats.zeroStock}</p>
          <p className="text-[11px] text-muted font-body mt-1">Sem pronta entrega</p>
        </div>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="bg-card border border-border rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, código EAN ou SKU..."
            className="w-full bg-surface/50 border border-border/80 rounded-xl pl-10 pr-3 py-2 text-sm text-ink placeholder-muted/70 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Categoria */}
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-surface/50 border border-border/80 rounded-xl px-3 py-2 text-xs text-ink font-body focus:outline-none focus:border-accent"
          >
            <option value="todas">Todas Categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Status */}
        <div className="flex items-center gap-1 bg-surface/60 border border-border/80 rounded-xl p-1">
          {[
            ['todos', 'Todos'],
            ['promo', 'Em Promoção'],
            ['baixo', 'Estoque Baixo'],
            ['zerado', 'Zerados']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body transition-colors ${
                filter === key ? 'bg-accent text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-muted text-xs font-mono ml-auto px-2">
          {filtered.length} de {products.length} itens
        </span>
      </div>

      {/* Tabela de Produtos */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Package size={24} className="text-accent" />
          </div>
          <h3 className="font-display font-bold text-lg text-ink">Catálogo vazio</h3>
          <p className="text-muted text-sm font-body mt-1 max-w-sm mx-auto">
            Cadastre {itemNounPlural.toLowerCase()} com grade de tamanhos, fotos e preços para alimentar o PDV e o WhatsApp.
          </p>
          <button
            onClick={() => setEditing({})}
            className="mt-4 bg-accent hover:bg-accent-dim text-white font-display font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            + Cadastrar Primeiro {itemNoun}
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface/40">
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">{itemNoun}</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Código / EAN</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Preço</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Promoção</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Grade & Estoque</th>
                  <th className="sticky right-0 z-10 bg-surface/40 text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const hasVariants = (p.product_variants || []).length > 0
                  const isLow = p.stock_qty > 0 && p.stock_qty <= (p.min_stock_alert || 2)
                  const isOut = p.stock_qty === 0
                  const firstPhoto = (p.images && p.images[0]) || null

                  return (
                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                      {/* Peça e Foto */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {firstPhoto ? (
                            <img
                              src={firstPhoto}
                              alt={p.name}
                              onClick={() => setPreviewPhoto(firstPhoto)}
                              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-border cursor-pointer hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center shrink-0 border border-border/60">
                              <ImageIcon size={18} className="text-muted/60" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-sm font-body font-medium text-ink block truncate max-w-xs">{p.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {p.category && (
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface text-muted">
                                  {p.category}
                                </span>
                              )}
                              {p.images && p.images.length > 1 && (
                                <span className="text-[10px] font-mono text-muted">
                                  +{p.images.length - 1} fotos
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Código de Barras / SKU */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-muted text-xs font-mono">
                          <Barcode size={13} className="shrink-0" />
                          <span>{p.barcode || p.sku || '—'}</span>
                        </div>
                      </td>

                      {/* Preço */}
                      <td className="px-5 py-3.5">
                        <div>
                          {p.is_promo && p.promo_price ? (
                            <div>
                              <span className="text-xs text-muted line-through block font-mono">{money(p.unit_price)}</span>
                              <span className="text-sm font-bold text-amber-600 font-mono">{money(p.promo_price)}</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-ink font-mono">{money(p.unit_price)}</span>
                          )}
                          {p.cost_price > 0 && (
                            <span className="text-[10px] text-muted block font-mono">Custo: {money(p.cost_price)}</span>
                          )}
                        </div>
                      </td>

                      {/* Toggle Promoção */}
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => togglePromo(p)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body transition-colors ${
                            p.is_promo
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30 font-semibold'
                              : 'bg-surface text-muted hover:text-ink'
                          }`}
                        >
                          <Tag size={12} />
                          {p.is_promo ? 'Em Oferta' : 'Normal'}
                        </button>
                      </td>

                      {/* Grade & Saldo */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium ${
                                isOut
                                  ? 'bg-red-500/10 text-red-600'
                                  : isLow
                                  ? 'bg-amber-500/10 text-amber-600'
                                  : 'bg-emerald-500/10 text-emerald-600'
                              }`}
                            >
                              {p.stock_qty} un
                            </span>
                            {hasVariants && (
                              <span className="text-[11px] text-muted font-mono">
                                ({p.product_variants.length} variações)
                              </span>
                            )}
                          </div>

                          {/* Chips de variações de tamanho */}
                          {hasVariants && (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.product_variants.map(v => (
                                <span
                                  key={v.id}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted"
                                >
                                  {v.name}: {v.stock_qty}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="sticky right-0 z-10 bg-card px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setAdjusting(p)}
                            title="Ajustar saldo no estoque"
                            className="text-muted hover:text-accent p-1.5 rounded-lg hover:bg-surface transition-colors"
                          >
                            <Boxes size={15} />
                          </button>
                          <button
                            onClick={() => setKardexProduct(p)}
                            title="Ver histórico de movimentações (Kardex)"
                            className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface transition-colors"
                          >
                            <History size={15} />
                          </button>
                          <button
                            onClick={() => setEditing(p)}
                            title="Editar produto"
                            className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            title="Excluir"
                            className="text-muted hover:text-red-500 p-1.5 rounded-lg hover:bg-surface transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição */}
      {editing && (
        <ProductModal
          product={editing}
          clientId={clientId}
          categories={categories}
          itemNoun={itemNoun}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchStock()
          }}
        />
      )}

      {/* Modal de Ajuste de Saldo com Kardex */}
      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          clientId={clientId}
          itemNoun={itemNoun}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null)
            fetchStock()
          }}
        />
      )}

      {/* Modal de Histórico Kardex */}
      {kardexProduct && (
        <KardexHistoryModal
          product={kardexProduct}
          onClose={() => setKardexProduct(null)}
        />
      )}

      {/* Modal Preview de Foto */}
      {previewPhoto && (
        <Modal onClose={() => setPreviewPhoto(null)}>
          <div className="bg-card p-3 rounded-2xl max-w-lg w-full relative">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 bg-black/60 text-white p-1.5 rounded-full hover:bg-black transition-colors"
            >
              <X size={16} />
            </button>
            <img src={previewPhoto} alt="Preview do item" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
          </div>
        </Modal>
      )}

      {/* Importação inicial de catálogo (onboarding) — quem já tinha
          produto no marketplace antes de comprar o ZapFlow traz pra cá
          de uma vez, em vez de recadastrar manual. Depois disso o
          ZapFlow vira a fonte e distribui pra fora (sync já existente). */}
      {importing && (
        <ImportCatalogModal
          clientId={clientId}
          existingNames={products.map(p => p.name)}
          onClose={() => setImporting(false)}
          onImported={() => { setImporting(false); fetchStock() }}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Componente: Importação Inicial de Catálogo (onboarding, por marketplace)
// -------------------------------------------------------------
const CATALOG_MARKETPLACES = [
  { key: 'mercadolivre', label: 'Mercado Livre' },
  { key: 'shopee', label: 'Shopee' },
]

function ImportCatalogModal({ clientId, existingNames, onClose, onImported }) {
  const [tab, setTab] = useState('mercadolivre')

  return (
    <Modal onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fadein space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-ink">Importar Catálogo</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>
        <p className="text-muted text-xs font-body">Já tinha produto cadastrado no marketplace antes de usar o ZapFlow? Traz tudo de uma vez pra cá. Depois disso, qualquer mudança no ZapFlow sincroniza de volta sozinha.</p>

        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
          {CATALOG_MARKETPLACES.map(m => (
            <button
              key={m.key}
              onClick={() => setTab(m.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-body font-medium transition-colors ${tab === m.key ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {tab === 'mercadolivre' ? (
          <ImportMlTab clientId={clientId} existingNames={existingNames} onClose={onClose} onImported={onImported} />
        ) : (
          <p className="text-center text-sm text-muted font-body py-10">Shopee ainda não conectado nesta loja — aguardando aprovação da API deles.</p>
        )}
      </div>
    </Modal>
  )
}

function ImportMlTab({ clientId, existingNames, onClose, onImported }) {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(null)
  const [items, setItems] = useState([])
  const [channelId, setChannelId] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [importing, setImportingState] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  // Duplicata = mesmo nome (case-insensitive) já existe no catálogo local.
  // Sinal simples e real (sem fuzzy match) — suficiente pra avisar e não
  // marcar pra importar de novo por padrão.
  const existingNamesLower = new Set(existingNames.map(n => n.toLowerCase().trim()))

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: fnError } = await supabase.functions.invoke('ml-items', { body: {} })
    if (fnError || !data?.ok) {
      setError(data?.error || fnError?.message || 'Erro ao buscar anúncios.')
      setLoading(false)
      return
    }
    setConnected(data.connected)
    const fetchedItems = data.items || []
    setItems(fetchedItems)
    setChannelId(data.channel_id || null)
    // tudo marcado por padrão, EXCETO os que já existem no catálogo local
    setSelected(new Set(fetchedItems.filter(i => !existingNamesLower.has(i.title.toLowerCase().trim())).map(i => i.id)))
    setLoading(false)
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleImport() {
    const toImport = items.filter(i => selected.has(i.id))
    if (toImport.length === 0) return
    setImportingState(true)
    try {
      // SKU gerado em sequência pra cada produto importado, mesma lógica
      // do cadastro manual — ML não manda SKU próprio, não deixa em branco.
      const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
      let nextSkuNum = (count || 0) + 1
      for (const item of toImport) {
        const { data: prod, error: prodError } = await supabase
          .from('products')
          .insert({
            client_id: clientId,
            name: item.title,
            sku: `P-${String(nextSkuNum++).padStart(4, '0')}`,
            unit_price: Number(item.price) || 0,
            stock_qty: Number(item.available_quantity) || 0,
            images: item.thumbnail ? [item.thumbnail.replace('http://', 'https://')] : [],
            active: true,
          })
          .select('id')
          .single()
        if (prodError || !prod) continue
        if (channelId) {
          await supabase.from('product_channel_links').insert({
            product_id: prod.id,
            channel_id: channelId,
            external_id: item.id,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          })
        }
      }
      onImported()
    } catch (e) {
      alert('Erro ao importar: ' + e.message)
    } finally {
      setImportingState(false)
    }
  }

  if (loading) return <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto my-8" />
  if (error) return <p className="text-center text-sm text-amber-600 font-body py-6">{error}</p>
  if (connected === false) return <p className="text-center text-sm text-muted font-body py-6">Mercado Livre ainda não conectado. Conecte em Configurações primeiro.</p>
  if (items.length === 0) return <p className="text-center text-sm text-muted font-body py-6">Nenhum anúncio encontrado nesta conta.</p>

  const dupeCount = items.filter(i => existingNamesLower.has(i.title.toLowerCase().trim())).length
  const pausedCount = items.filter(i => i.status && i.status !== 'active').length

  return (
    <>
      {pausedCount > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{pausedCount} {pausedCount === 1 ? 'anúncio está pausado' : 'anúncios estão pausados'} no Mercado Livre (não aparecem pra comprador) — ainda assim pode importar o cadastro.</span>
        </div>
      )}
      {dupeCount > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{dupeCount} {dupeCount === 1 ? 'anúncio parece já existir' : 'anúncios parecem já existir'} no catálogo (mesmo nome) — vieram desmarcados pra não duplicar. Revise antes de importar.</span>
        </div>
      )}
      <div className="space-y-2 max-h-[45vh] overflow-y-auto">
        {items.map(item => {
          const isDupe = existingNamesLower.has(item.title.toLowerCase().trim())
          const isPaused = item.status && item.status !== 'active'
          return (
            <label key={item.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2.5 cursor-pointer">
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="rounded text-accent" />
              {item.thumbnail && <img src={item.thumbnail.replace('http://', 'https://')} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink font-body font-medium truncate">{item.title}</p>
                <p className="text-[11px] text-muted font-mono">
                  {item.available_quantity} un.
                  {isPaused && <span className="text-amber-600 font-bold"> · pausado no ML</span>}
                  {isDupe && <span className="text-amber-600 font-bold"> · já existe no catálogo</span>}
                </p>
              </div>
              <span className="text-sm font-mono text-ink font-bold shrink-0">{money(item.price)}</span>
            </label>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-muted hover:text-ink text-xs font-body">Cancelar</button>
        <button onClick={handleImport} disabled={importing || selected.size === 0}
          className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white font-display font-bold px-5 py-2 rounded-xl text-xs shadow-xs">
          {importing ? 'Importando...' : `Importar ${selected.size} ${selected.size === 1 ? 'item' : 'itens'}`}
        </button>
      </div>
    </>
  )
}

// -------------------------------------------------------------
// Componente: Modal de Cadastro / Edição de Produto Completo
// -------------------------------------------------------------
function ProductModal({ product, clientId, categories, onClose, onSaved, itemNoun = 'Produto' }) {
  const isEdit = !!product.id

  const [name, setName] = useState(product.name || '')
  const [category, setCategory] = useState(product.category || '')
  const [subcategory, setSubcategory] = useState(product.subcategory || '')
  const [brand, setBrand] = useState(product.brand || '')
  const [sku, setSku] = useState(product.sku || '')
  const [barcode, setBarcode] = useState(product.barcode || '')
  const [description, setDescription] = useState(product.description || '')
  const [costPrice, setCostPrice] = useState(product.cost_price || '')
  const [unitPrice, setUnitPrice] = useState(product.unit_price || '')
  const [promoPrice, setPromoPrice] = useState(product.promo_price || '')
  const [isPromo, setIsPromo] = useState(product.is_promo || false)
  const [wholesalePrice, setWholesalePrice] = useState(product.wholesale_price || '')
  const [wholesaleMinQty, setWholesaleMinQty] = useState(product.wholesale_min_qty || '')
  const [commissionPct, setCommissionPct] = useState(product.commission_pct || '')
  const [supplierId, setSupplierId] = useState(product.supplier_id || '')
  const [suppliers, setSuppliers] = useState([])
  const [stockQty, setStockQty] = useState(product.stock_qty || 0)
  const [minStockAlert, setMinStockAlert] = useState(product.min_stock_alert || 2)

  useEffect(() => {
    supabase.from('suppliers').select('id, name').eq('client_id', clientId).order('name').then(({ data }) => setSuppliers(data || []))
  }, [clientId])

  // Margem calculada ao vivo (custo x preço de venda) — gap real vs
  // concorrente (eles mostram Lucro % e Lucro R$ direto no cadastro).
  const marginValue = Number(unitPrice || 0) - Number(costPrice || 0)
  const marginPct = Number(costPrice) > 0 ? (marginValue / Number(costPrice)) * 100 : null

  // Fotos da peça (lista de URLs)
  const [images, setImages] = useState(product.images || [])
  const [newImageUrl, setNewImageUrl] = useState('')

  // Variações de Grade (tamanho / cor)
  const [variants, setVariants] = useState(product.product_variants || [])
  const [varName, setVarName] = useState('')
  const [varStock, setVarStock] = useState('')

  const [saving, setSaving] = useState(false)

  function addImage() {
    if (!newImageUrl.trim()) return
    setImages(prev => [...prev, newImageUrl.trim()])
    setNewImageUrl('')
  }

  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  function addVariant() {
    if (!varName.trim()) return
    setVariants(prev => [
      ...prev,
      {
        id: 'temp-' + Date.now(),
        name: varName.trim(),
        stock_qty: Number(varStock) || 0,
        active: true,
      }
    ])
    setVarName('')
    setVarStock('')
  }

  function removeVariant(index) {
    setVariants(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return alert('Nome do produto é obrigatório.')
    setSaving(true)

    try {
      // Se tiver variações, o estoque total é a soma das variações
      const totalStock = variants.length > 0
        ? variants.reduce((s, v) => s + (Number(v.stock_qty) || 0), 0)
        : Number(stockQty) || 0

      // SKU é só organização interna — se o usuário não preencheu, gera
      // sozinho em sequência (P-0001, P-0002...) em vez de deixar em branco.
      let finalSku = sku.trim()
      if (!finalSku && !isEdit) {
        const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
        finalSku = `P-${String((count || 0) + 1).padStart(4, '0')}`
      }

      const payload = {
        client_id: clientId,
        name: name.trim(),
        category: category.trim() || null,
        subcategory: subcategory.trim() || null,
        brand: brand.trim() || null,
        sku: finalSku || sku.trim() || null,
        barcode: barcode.trim() || null,
        description: description.trim() || null,
        cost_price: Number(costPrice) || 0,
        unit_price: Number(unitPrice) || 0,
        promo_price: promoPrice ? Number(promoPrice) : null,
        is_promo: isPromo,
        wholesale_price: wholesalePrice ? Number(wholesalePrice) : null,
        wholesale_min_qty: wholesaleMinQty ? Number(wholesaleMinQty) : null,
        commission_pct: commissionPct ? Number(commissionPct) : null,
        supplier_id: supplierId || null,
        stock_qty: totalStock,
        min_stock_alert: Number(minStockAlert) || 2,
        images: images,
        active: true,
      }

      let savedProdId = product.id

      if (isEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select().single()
        if (error) throw error
        savedProdId = data.id

        // Registra entrada inicial no Kardex
        if (totalStock > 0) {
          await supabase.from('stock_movements').insert({
            client_id: clientId,
            product_id: savedProdId,
            qty_change: totalStock,
            reason: 'entrada_inicial',
            previous_stock: 0,
            new_stock: totalStock,
            notes: 'Cadastro inicial de produto'
          })
        }
      }

      // Sincroniza variações se houver
      if (variants.length > 0) {
        for (const v of variants) {
          if (String(v.id).startsWith('temp-')) {
            await supabase.from('product_variants').insert({
              product_id: savedProdId,
              client_id: clientId,
              name: v.name,
              stock_qty: Number(v.stock_qty) || 0,
              unit_price: Number(unitPrice) || 0,
              promo_price: promoPrice ? Number(promoPrice) : null,
            })
          } else {
            await supabase.from('product_variants').update({
              name: v.name,
              stock_qty: Number(v.stock_qty) || 0,
            }).eq('id', v.id)
          }
        }
      }

      onSaved()
    } catch (err) {
      alert('Erro ao salvar produto: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadein space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-display font-bold text-xl text-ink">
              {isEdit ? `Editar ${itemNoun}` : `Cadastrar ${itemNoun.toLowerCase().endsWith('a') ? 'Nova' : 'Novo'} ${itemNoun}`}
            </h3>
            <p className="text-muted text-xs font-body">
              Grade de variações e fotos prontas para o envio no WhatsApp e PDV.
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Dados Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-body text-muted mb-1">Nome d{itemNoun.toLowerCase().endsWith('a') ? 'a' : 'o'} {itemNoun} *</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Vestido Midi Canelado"
                className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-body text-muted mb-1">Categoria</label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Ex: Vestidos, Camisas..."
                list="cats-list"
                className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent"
              />
              <datalist id="cats-list">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-body text-muted mb-1">Subcategoria</label>
              <input
                value={subcategory}
                onChange={e => setSubcategory(e.target.value)}
                placeholder="Ex: Manga Longa, Social..."
                className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-body text-muted mb-1">Marca</label>
              <input
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="Ex: Adidas, Marca Própria..."
                className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-body text-muted mb-1">Código de Barras (EAN-13)</label>
              <input
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="Ex: 7891234567890"
                className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink font-mono focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Preços e Promoções */}
          <div className="bg-surface/40 border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium">Preços & Condições</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPromo}
                  onChange={e => setIsPromo(e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span className="text-xs font-body text-ink font-medium">Ativar Promoção</span>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-body text-muted mb-1">Preço de Custo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-body text-muted mb-1">Preço de Venda (R$) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-body text-muted mb-1">Preço Promocional (R$)</label>
                <input
                  disabled={!isPromo}
                  type="number"
                  step="0.01"
                  value={promoPrice}
                  onChange={e => setPromoPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink font-mono disabled:opacity-40 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {marginPct !== null && (
              <div className="flex items-center justify-between bg-card border border-border rounded-xl px-3.5 py-2 text-xs font-mono">
                <span className="text-muted">Margem sobre o custo:</span>
                <span className={`font-bold ${marginValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {marginPct.toFixed(1)}% ({money(marginValue)})
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-body text-muted mb-1">Preço Atacado (R$)</label>
                <input
                  type="number" step="0.01"
                  value={wholesalePrice}
                  onChange={e => setWholesalePrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-body text-muted mb-1">Qtd. mínima pro atacado</label>
                <input
                  type="number" min="0"
                  value={wholesaleMinQty}
                  onChange={e => setWholesaleMinQty(e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Comissão e Fornecedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-body text-muted mb-1">Comissão do Vendedor (%)</label>
              <input
                type="number" step="0.1" min="0" max="100"
                value={commissionPct}
                onChange={e => setCommissionPct(e.target.value)}
                placeholder="Ex: 5"
                className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink font-mono focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-body text-muted mb-1">Fornecedor</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent"
              >
                <option value="">— Nenhum —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Fotos da Peça (Para Envio no WhatsApp e PDV) */}
          <div className="space-y-2">
            <label className="block text-xs font-body text-muted">Fotos d{itemNoun.toLowerCase().endsWith('a') ? 'a' : 'o'} {itemNoun} (URLs das imagens)</label>
            <div className="flex gap-2">
              <input
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                placeholder="Cole o link da foto (ex: https://...)"
                className="flex-1 bg-surface/50 border border-border rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={addImage}
                className="bg-card border border-border hover:border-accent text-ink px-4 py-2 rounded-xl text-xs font-body font-medium transition-colors"
              >
                Adicionar Foto
              </button>
            </div>

            {/* Galeria de Fotos */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {images.map((img, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-xl border border-border overflow-hidden bg-surface">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grade de Variações (Tamanho / Cor) */}
          <div className="bg-surface/40 border border-border rounded-2xl p-4 space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium">Grade de Variações</span>
            <p className="text-[11px] text-muted font-body">Se {itemNoun.toLowerCase().endsWith('a') ? 'a' : 'o'} {itemNoun.toLowerCase()} tiver tamanhos (P, M, G) ou cores, cadastre abaixo:</p>

            <div className="flex gap-2">
              <input
                value={varName}
                onChange={e => setVarName(e.target.value)}
                placeholder="Variação (ex: Preto / M)"
                className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                value={varStock}
                onChange={e => setVarStock(e.target.value)}
                placeholder="Qtd estoque"
                className="w-28 bg-card border border-border rounded-xl px-3 py-2 text-xs text-ink font-mono focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={addVariant}
                className="bg-card border border-border hover:border-accent text-ink px-3 py-2 rounded-xl text-xs font-medium"
              >
                + Adicionar
              </button>
            </div>

            {variants.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {variants.map((v, i) => (
                  <div key={v.id || i} className="flex items-center justify-between bg-card border border-border/80 px-3 py-2 rounded-xl text-xs font-body">
                    <span className="font-medium text-ink">{v.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-muted">{v.stock_qty} unidades</span>
                      <button type="button" onClick={() => removeVariant(i)} className="text-muted hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-body text-muted mb-1">Estoque Inicial (Sem Grade)</label>
                  <input
                    type="number"
                    value={stockQty}
                    onChange={e => setStockQty(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-body text-muted mb-1">Alerta Estoque Baixo</label>
                  <input
                    type="number"
                    value={minStockAlert}
                    onChange={e => setMinStockAlert(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-ink text-sm font-body transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white font-display font-bold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
            >
              {saving ? 'Salvando...' : isEdit ? `Atualizar ${itemNoun}` : `Cadastrar ${itemNoun}`}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// -------------------------------------------------------------
// Componente: Modal de Ajuste de Saldo de Estoque com Kardex
// -------------------------------------------------------------
function StockAdjustModal({ product, clientId, onClose, onSaved, itemNoun = 'Produto' }) {
  const [type, setType] = useState('add') // add | remove | set
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('Entrada de mercadoria')
  const [notes, setNotes] = useState('')
  const [supplierId, setSupplierId] = useState(product.supplier_id || '')
  const [suppliers, setSuppliers] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('suppliers').select('id, name').eq('client_id', clientId).order('name').then(({ data }) => setSuppliers(data || []))
  }, [clientId])

  const current = product.stock_qty || 0
  const numQty = Number(qty) || 0

  const newStock = type === 'add'
    ? current + numQty
    : type === 'remove'
    ? Math.max(0, current - numQty)
    : numQty

  async function handleAdjust(e) {
    e.preventDefault()
    if (!qty || numQty <= 0) return alert('Informe uma quantidade válida.')
    setSaving(true)

    try {
      const diff = newStock - current

      // 1. Atualiza produto
      const { error: pErr } = await supabase
        .from('products')
        .update({ stock_qty: newStock })
        .eq('id', product.id)

      if (pErr) throw pErr

      // 2. Insere Kardex
      await supabase.from('stock_movements').insert({
        client_id: clientId,
        product_id: product.id,
        qty_change: diff,
        reason: reason,
        previous_stock: current,
        new_stock: newStock,
        notes: notes.trim() || null,
        supplier_id: type === 'add' ? (supplierId || null) : null,
      })

      onSaved()
    } catch (err) {
      alert('Erro ao ajustar estoque: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display font-bold text-lg text-ink">Ajustar Estoque</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <p className="text-xs text-muted font-body">
          {itemNoun}: <strong className="text-ink">{product.name}</strong> (Saldo atual: {current} un)
        </p>

        <form onSubmit={handleAdjust} className="space-y-3.5">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['add', '+ Entrada'],
              ['remove', '- Saída'],
              ['set', '= Balanço'],
            ].map(([k, label]) => (
              <button
                type="button"
                key={k}
                onClick={() => setType(k)}
                className={`py-2 rounded-xl text-xs font-body font-medium transition-colors border ${
                  type === k ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-body text-muted mb-1">Quantidade</label>
            <input
              type="number"
              min="1"
              required
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="Ex: 5"
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-body text-muted mb-1">Motivo do Ajuste</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
            >
              <option value="Entrada de mercadoria">Entrada de mercadoria</option>
              <option value="Devolução / Troca">Devolução / Troca</option>
              <option value="Ajuste de inventário">Ajuste de inventário</option>
              <option value="Item danificado / Perda">Item danificado / Perda</option>
              <option value="Outro motivo">Outro motivo</option>
            </select>
          </div>

          <div className="bg-surface/50 border border-border p-3 rounded-xl flex items-center justify-between font-mono text-xs">
            <span className="text-muted">Novo saldo final:</span>
            <span className="font-bold text-ink text-sm">{newStock} unidades</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-muted hover:text-ink text-xs font-body"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-accent hover:bg-accent-dim text-white font-display font-bold px-5 py-2 rounded-xl text-xs shadow-xs"
            >
              {saving ? 'Gravando...' : 'Confirmar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// -------------------------------------------------------------
// Componente: Modal de Histórico Kardex (Rastreabilidade)
// -------------------------------------------------------------
function KardexHistoryModal({ product, onClose }) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadKardex() {
      setLoading(true)
      const { data } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(30)

      setMovements(data || [])
      setLoading(false)
    }
    loadKardex()
  }, [product])

  return (
    <Modal onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg animate-fadein space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-display font-bold text-lg text-ink">Histórico Kardex</h3>
            <p className="text-xs text-muted font-body">Rastreabilidade completa de {product.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : movements.length === 0 ? (
          <p className="text-center text-xs text-muted py-8 font-body">Nenhuma movimentação registrada para este item ainda.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {movements.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-surface/40 border border-border/70 p-3 rounded-xl text-xs">
                <div>
                  <p className="font-medium text-ink font-body">{m.reason || 'Movimentação'}</p>
                  <p className="text-[10px] text-muted font-mono">{new Date(m.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <span className={`font-mono font-bold ${m.qty_change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change} un
                  </span>
                  {m.new_stock !== null && (
                    <span className="block text-[10px] text-muted font-mono">Saldo: {m.new_stock}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-right">
          <button onClick={onClose} className="bg-surface text-ink px-4 py-2 rounded-xl text-xs font-medium">
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  )
}
