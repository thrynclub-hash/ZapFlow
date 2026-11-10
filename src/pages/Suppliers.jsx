import { useEffect, useState } from 'react'
import { Truck, Plus, Trash2, Edit2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

// ZapFlow — Fornecedores. Gap real vs ERPs de loja física (ERP Pro etc.):
// eles têm cadastro de fornecedor + histórico de compra por produto.
// Aqui reusa o Kardex já existente (stock_movements.supplier_id) pro
// histórico, em vez de criar uma tabela de "pedido de compra" nova.

export default function Suppliers() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [editing, setEditing] = useState(null) // null = fechado, {} = novo, {...s} = editar

  useEffect(() => {
    if (clientId) fetchSuppliers()
  }, [clientId])

  async function fetchSuppliers() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').eq('client_id', clientId).order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  async function handleDelete(s) {
    if (!confirm(`Excluir fornecedor "${s.name}"? Produtos vinculados ficam sem fornecedor.`)) return
    const { error } = await supabase.from('suppliers').delete().eq('id', s.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    fetchSuppliers()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Fornecedores</h1>
          <p className="text-muted text-sm font-body mt-1">Cadastro de quem fornece seus produtos — vincule no Estoque pra ter histórico de compra.</p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white font-display font-bold px-4 py-2.5 rounded-xl transition-colors text-sm shadow-sm"
        >
          <Plus size={16} /> Novo Fornecedor
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Telefone</th>
                <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">E-mail</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10 text-muted text-sm">Carregando...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-muted text-sm">Nenhum fornecedor cadastrado ainda.</td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id} className="hover:bg-surface/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-ink font-body font-medium flex items-center gap-2">
                    <Truck size={14} className="text-muted" /> {s.name}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted font-mono">{s.phone || '-'}</td>
                  <td className="px-5 py-3.5 text-xs text-muted font-body">{s.email || '-'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(s)} className="text-muted hover:text-ink p-1.5"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(s)} className="text-muted hover:text-red-500 p-1.5"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <SupplierModal
          supplier={editing}
          clientId={clientId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchSuppliers() }}
        />
      )}
    </div>
  )
}

function SupplierModal({ supplier, clientId, onClose, onSaved }) {
  const isEdit = !!supplier.id
  const [name, setName] = useState(supplier.name || '')
  const [phone, setPhone] = useState(supplier.phone || '')
  const [email, setEmail] = useState(supplier.email || '')
  const [notes, setNotes] = useState(supplier.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return alert('Nome é obrigatório.')
    setSaving(true)
    const payload = { client_id: clientId, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null }
    const { error } = isEdit
      ? await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      : await supabase.from('suppliers').insert(payload)
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display font-bold text-lg text-ink">{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="block text-xs font-body text-muted mb-1">Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-body text-muted mb-1">Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink font-mono focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs font-body text-muted mb-1">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent" />
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
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Fornecedor'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
