import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X, TrendingUp, TrendingDown, AlertCircle, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

// ZapFlow — Contas a Pagar e a Receber (financeiro genérico, fora do PDV).
// Gap real vs Bling/Olist: eles têm financeiro completo além de venda
// (aluguel, fornecedor, imposto, salário). Lançamento manual, sem
// conciliação bancária automática — isso fica pra quando algum cliente
// realmente precisar (import de OFX é trabalho grande à toa sem demanda).

function money(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
}

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default function Financeiro() {
  const { profile } = useAuth()
  const clientId = profile?.client_id

  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('todos') // todos | receivable | payable | atrasado
  const [editing, setEditing] = useState(null) // null = fechado, {} = novo, {...e} = editar

  useEffect(() => {
    if (clientId) fetchEntries()
  }, [clientId])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }

  async function togglePaid(entry) {
    const nextPaid = !entry.paid
    const { error } = await supabase
      .from('financial_entries')
      .update({ paid: nextPaid, paid_at: nextPaid ? new Date().toISOString() : null })
      .eq('id', entry.id)
    if (!error) setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, paid: nextPaid, paid_at: nextPaid ? new Date().toISOString() : null } : e))
  }

  async function handleDelete(entry) {
    if (!confirm(`Excluir "${entry.description}"?`)) return
    const { error } = await supabase.from('financial_entries').delete().eq('id', entry.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    fetchEntries()
  }

  const today = new Date().toISOString().slice(0, 10)

  const stats = useMemo(() => {
    const toReceive = entries.filter(e => e.kind === 'receivable' && !e.paid).reduce((s, e) => s + Number(e.amount), 0)
    const toPay = entries.filter(e => e.kind === 'payable' && !e.paid).reduce((s, e) => s + Number(e.amount), 0)
    const overdue = entries.filter(e => !e.paid && e.due_date < today).length
    return { toReceive, toPay, balance: toReceive - toPay, overdue }
  }, [entries, today])

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filter === 'receivable') return e.kind === 'receivable'
      if (filter === 'payable') return e.kind === 'payable'
      if (filter === 'atrasado') return !e.paid && e.due_date < today
      return true
    })
  }, [entries, filter, today])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Financeiro</h1>
          <p className="text-muted text-sm font-body mt-1">Contas a pagar e a receber — além das vendas do PDV.</p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white font-display font-bold px-4 py-2.5 rounded-xl transition-colors text-sm shadow-sm"
        >
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted font-body uppercase tracking-wider flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500" /> A Receber</p>
          <p className="font-display font-bold text-2xl text-ink mt-1">{money(stats.toReceive)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted font-body uppercase tracking-wider flex items-center gap-1"><TrendingDown size={12} className="text-red-500" /> A Pagar</p>
          <p className="font-display font-bold text-2xl text-ink mt-1">{money(stats.toPay)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted font-body uppercase tracking-wider">Saldo Projetado</p>
          <p className={`font-display font-bold text-2xl mt-1 ${stats.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(stats.balance)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted font-body uppercase tracking-wider flex items-center gap-1"><AlertCircle size={12} className="text-amber-500" /> Atrasados</p>
          <p className="font-display font-bold text-2xl text-ink mt-1">{stats.overdue}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[
          ['todos', 'Todos'],
          ['receivable', 'A Receber'],
          ['payable', 'A Pagar'],
          ['atrasado', 'Atrasados'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3.5 py-2 rounded-xl text-xs font-body font-medium border transition-colors ${
              filter === k ? 'bg-accent text-white border-accent' : 'bg-card border-border text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Descrição</th>
                <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Categoria</th>
                <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Vencimento</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Valor</th>
                <th className="text-center px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted text-sm">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted text-sm">Nenhum lançamento encontrado.</td></tr>
              ) : filtered.map(e => {
                const overdue = !e.paid && e.due_date < today
                return (
                  <tr key={e.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-3 text-sm text-ink font-body font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {e.kind === 'receivable' ? <TrendingUp size={13} className="text-emerald-500" /> : <TrendingDown size={13} className="text-red-500" />}
                        {e.description}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted font-body">{e.category || '-'}</td>
                    <td className={`px-5 py-3 text-xs font-mono ${overdue ? 'text-red-500 font-bold' : 'text-muted'}`}>{fmtDate(e.due_date)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-right text-ink">{money(e.amount)}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => togglePaid(e)}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-mono font-medium transition-colors ${
                          e.paid ? 'bg-emerald-500/10 text-emerald-600' : overdue ? 'bg-red-500/10 text-red-500' : 'bg-surface text-muted'
                        }`}
                      >
                        {e.paid ? 'Pago' : overdue ? 'Atrasado' : 'Pendente'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(e)} className="text-muted hover:text-ink p-1.5"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(e)} className="text-muted hover:text-red-500 p-1.5"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EntryModal
          entry={editing}
          clientId={clientId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchEntries() }}
        />
      )}
    </div>
  )
}

function EntryModal({ entry, clientId, onClose, onSaved }) {
  const isEdit = !!entry.id
  const [kind, setKind] = useState(entry.kind || 'receivable')
  const [description, setDescription] = useState(entry.description || '')
  const [category, setCategory] = useState(entry.category || '')
  const [amount, setAmount] = useState(entry.amount || '')
  const [dueDate, setDueDate] = useState(entry.due_date || new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!description.trim() || !amount || !dueDate) return alert('Descrição, valor e vencimento são obrigatórios.')
    setSaving(true)
    const payload = {
      client_id: clientId,
      kind,
      description: description.trim(),
      category: category.trim() || null,
      amount: Number(amount),
      due_date: dueDate,
      notes: notes.trim() || null,
    }
    const { error } = isEdit
      ? await supabase.from('financial_entries').update(payload).eq('id', entry.id)
      : await supabase.from('financial_entries').insert(payload)
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display font-bold text-lg text-ink">{isEdit ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {[['receivable', 'A Receber'], ['payable', 'A Pagar']].map(([k, label]) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`py-2 rounded-xl text-xs font-body font-medium transition-colors border ${
                  kind === k ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-body text-muted mb-1">Descrição *</label>
            <input value={description} onChange={e => setDescription(e.target.value)} required
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent" />
          </div>

          <div>
            <label className="block text-xs font-body text-muted mb-1">Categoria</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Aluguel, Fornecedor, Imposto"
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-body text-muted mb-1">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-body text-muted mb-1">Vencimento *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-body text-muted mb-1">Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent resize-none" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-muted hover:text-ink text-xs font-body">Cancelar</button>
            <button type="submit" disabled={saving}
              className="bg-accent hover:bg-accent-dim text-white font-display font-bold px-5 py-2 rounded-xl text-xs shadow-xs">
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
