import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Trash2, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

// ZapFlow — Negócios (funil de vendas de verdade, 2026-11-09). Distinto
// do Pipeline de relacionamento (contacts.lifecycle_stage) — aqui é uma
// oportunidade de venda com itens e valor, igual referência de mercado
// (Bolten "Funil de vendas"). opportunity_items.product_id aponta pro
// catálogo LOCAL (products, erp_core.sql) — cliente que usa ERP externo
// (Bling) ainda pode lançar item por descrição livre, sem produto vinculado.
const STAGES = [
  { key: 'Novo', label: 'Novo', tint: 'bg-blue-400/10 text-blue-300 border-blue-400/20' },
  { key: 'Orçamento', label: 'Orçamento', tint: 'bg-violet/10 text-violet border-violet/20' },
  { key: 'Negociação', label: 'Negociação', tint: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  { key: 'Ganho', label: 'Ganho', tint: 'bg-green-400/10 text-green-400 border-green-400/20' },
  { key: 'Perdido', label: 'Perdido', tint: 'bg-red-400/10 text-red-400 border-red-400/20' },
]

function money(n) {
  return `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`
}

export default function Opportunities() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [opps, setOpps] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragOverStage, setDragOverStage] = useState(null)
  const [editing, setEditing] = useState(null) // null fechado, {} nova, {id,...} editar

  useEffect(() => { if (clientId) fetchOpps() }, [clientId])

  async function fetchOpps() {
    setLoading(true)
    const { data } = await supabase
      .from('opportunities')
      .select('id, title, stage, contact_id, notes, created_at, contacts(name), opportunity_items(id, qty, unit_price)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setOpps(data || [])
    setLoading(false)
  }

  function total(o) {
    return (o.opportunity_items || []).reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0)
  }

  async function moveTo(opp, nextStage) {
    if (opp.stage === nextStage) return
    setOpps(os => os.map(o => o.id === opp.id ? { ...o, stage: nextStage } : o))
    const closed = nextStage === 'Ganho' || nextStage === 'Perdido'
    await supabase.from('opportunities').update({ stage: nextStage, closed_at: closed ? new Date().toISOString() : null }).eq('id', opp.id)
  }

  const totalPipeline = useMemo(() => opps.filter(o => o.stage !== 'Perdido').reduce((s, o) => s + total(o), 0), [opps])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Negócios</h1>
          <p className="text-muted text-sm font-body mt-1">Funil de vendas — {money(totalPipeline)} em aberto.</p>
        </div>
        <button onClick={() => setEditing({})} className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg font-display font-bold px-4 py-2 rounded-lg transition-colors text-sm">
          <Plus size={15} /> Novo negócio
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const items = opps.filter((o) => o.stage === stage.key)
          const stageTotal = items.reduce((s, o) => s + total(o), 0)
          return (
            <div
              key={stage.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.key) }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverStage(null)
                const id = e.dataTransfer.getData('text/plain')
                const opp = opps.find((o) => o.id === id)
                if (opp) moveTo(opp, stage.key)
              }}
              className={`rounded-[14px] border p-3 min-h-[200px] transition-colors ${
                dragOverStage === stage.key ? 'border-accent bg-accent/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-1">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wide border ${stage.tint}`}>
                  {stage.label}
                </span>
                <span className="text-muted text-xs font-mono">{items.length}</span>
              </div>
              <p className="text-muted text-[11px] font-mono px-1 pb-2">{money(stageTotal)}</p>
              <div className="space-y-2">
                {items.map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', o.id)}
                    onClick={() => setEditing(o)}
                    className="bg-bg border border-border rounded-[10px] p-3 cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
                  >
                    <p className="text-sm text-white font-body font-medium truncate">{o.title}</p>
                    {o.contacts?.name && <p className="text-muted text-xs font-body mt-0.5 truncate">{o.contacts.name}</p>}
                    <p className="text-accent text-xs font-mono mt-1.5 flex items-center gap-1"><DollarSign size={10} /> {money(total(o))}</p>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-muted text-xs font-body text-center py-6">Nenhum negócio</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editing !== null && <OpportunityModal opportunity={editing} clientId={clientId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchOpps() }} />}
    </div>
  )
}

function OpportunityModal({ opportunity, clientId, onClose, onSaved }) {
  const isNew = !opportunity.id
  const [title, setTitle] = useState(opportunity.title || '')
  const [contactId, setContactId] = useState(opportunity.contact_id || '')
  const [notes, setNotes] = useState(opportunity.notes || '')
  const [contacts, setContacts] = useState([])
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([{ description: '', qty: 1, unit_price: '', product_id: null }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.from('contacts').select('id, name').eq('client_id', clientId).order('name').then(({ data }) => setContacts(data || []))
    supabase.from('products').select('id, name, unit_price').eq('client_id', clientId).eq('active', true).order('name').then(({ data }) => setProducts(data || []))
    if (!isNew) {
      supabase.from('opportunity_items').select('id, product_id, description, qty, unit_price').eq('opportunity_id', opportunity.id).then(({ data }) => {
        if (data?.length) setItems(data)
      })
    }
  }, [])

  function updateItem(i, field, value) {
    setItems(its => its.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }
  function pickProduct(i, productId) {
    const p = products.find(p => p.id === productId)
    setItems(its => its.map((it, idx) => idx === i ? { ...it, product_id: productId || null, description: p ? p.name : it.description, unit_price: p ? p.unit_price : it.unit_price } : it))
  }
  function addItem() { setItems(its => [...its, { description: '', qty: 1, unit_price: '', product_id: null }]) }
  function removeItem(i) { setItems(its => its.filter((_, idx) => idx !== i)) }

  const total = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const validItems = items.filter(i => i.description.trim())

    let oppId = opportunity.id
    if (isNew) {
      const { data, error } = await supabase.from('opportunities').insert({ client_id: clientId, title, contact_id: contactId || null, notes, stage: 'Novo' }).select().single()
      if (error) { setSaving(false); setErr(error.message); return }
      oppId = data.id
    } else {
      const { error } = await supabase.from('opportunities').update({ title, contact_id: contactId || null, notes }).eq('id', oppId)
      if (error) { setSaving(false); setErr(error.message); return }
      await supabase.from('opportunity_items').delete().eq('opportunity_id', oppId)
    }

    if (validItems.length > 0) {
      await supabase.from('opportunity_items').insert(validItems.map(i => ({
        opportunity_id: oppId, product_id: i.product_id || null, description: i.description, qty: Number(i.qty) || 1, unit_price: Number(i.unit_price) || 0,
      })))
    }
    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!confirm(`Excluir o negócio "${opportunity.title}"?`)) return
    await supabase.from('opportunities').delete().eq('id', opportunity.id)
    onSaved()
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadein">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-bold text-xl text-white">{isNew ? 'Novo negócio' : 'Editar negócio'}</h3>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: Pedido camisetas - Studio Fit"
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Contato</label>
            <select value={contactId} onChange={e => setContactId(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent">
              <option value="">Sem contato vinculado</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-2.5 border border-border rounded-lg p-3">
            <p className="text-xs text-muted font-body uppercase tracking-wide">Itens</p>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_55px_75px_auto] gap-2 items-center">
                {products.length > 0 ? (
                  <select value={it.product_id || ''} onChange={e => pickProduct(i, e.target.value)}
                    className="bg-surface border border-border rounded-lg px-2 py-2 text-xs text-white font-body focus:outline-none focus:border-accent">
                    <option value="">{it.description || 'Selecionar produto...'}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ) : (
                  <input placeholder="Descrição" value={it.description} onChange={e => updateItem(i, 'description', e.target.value)}
                    className="bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                )}
                <input type="number" min="0" step="1" placeholder="Qtd" value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                <input type="number" min="0" step="0.01" placeholder="R$" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                <button type="button" onClick={() => removeItem(i)} className="text-muted hover:text-red-400 p-1"><X size={14} /></button>
              </div>
            ))}
            {products.length > 0 && items.some(it => !it.product_id && it.description) && (
              <p className="text-muted text-[11px] font-body">Sem produto no catálogo? Digite a descrição livre direto no campo.</p>
            )}
            <button type="button" onClick={addItem} className="text-accent text-xs font-display font-bold hover:underline">+ Adicionar item</button>
            <div className="flex justify-between pt-2 border-t border-border text-sm font-body">
              <span className="text-muted">Total</span>
              <span className="text-white font-semibold">{money(total)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
          </div>

          {err && <p className="text-red-400 text-xs font-body">{err}</p>}
          <div className="flex gap-3 pt-2">
            {!isNew && (
              <button type="button" onClick={handleDelete} className="border border-red-400/30 text-red-400 px-4 py-3 rounded-lg text-sm font-body hover:bg-red-400/10 transition-colors"><Trash2 size={15} /></button>
            )}
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
