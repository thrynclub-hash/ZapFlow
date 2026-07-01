import { useEffect, useState } from 'react'
import { Plus, Edit2, Smartphone, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { checkInstanceStatus } from '../../lib/zapi'
import Modal from '../../components/Modal'

export default function AdminNumbers() {
  const [numbers, setNumbers] = useState([])
  const [clients, setClients] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statuses, setStatuses] = useState({})
  const [form, setForm] = useState({ client_id: '', label: '', phone: '', zapi_instance_id: '', zapi_token: '', active: true })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: nums }, { data: cls }] = await Promise.all([
      supabase.from('client_numbers').select('*, client:clients(name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').eq('status', 'active'),
    ])
    setNumbers(nums || [])
    setClients(cls || [])
  }

  function openNew() {
    setEditing(null)
    setForm({ client_id: '', label: '', phone: '', zapi_instance_id: '', zapi_token: '', active: true })
    setShowModal(true)
  }

  function openEdit(n) {
    setEditing(n)
    setForm({ client_id: n.client_id, label: n.label, phone: n.phone || '', zapi_instance_id: n.zapi_instance_id || '', zapi_token: n.zapi_token || '', active: n.active })
    setShowModal(true)
  }

  async function handleDelete(number) {
    if (!confirm(`Excluir "${number.label}"?`)) return
    await supabase.from('client_numbers').delete().eq('id', number.id)
    fetchAll()
  }

  async function handleSave(e) {
    e.preventDefault()

    if (!editing) {
      // Checa limite de números do plano ANTES de criar (o limite não se
      // aplica ao editar um número já existente).
      const { data: client } = await supabase.from('clients').select('plan').eq('id', form.client_id).single()
      if (client?.plan) {
        const { data: limit } = await supabase.from('plan_limits').select('numbers_limit').eq('plan', client.plan).single()
        if (limit) {
          const { count } = await supabase.from('client_numbers').select('id', { count: 'exact', head: true }).eq('client_id', form.client_id)
          if ((count ?? 0) >= limit.numbers_limit) {
            alert(`Este cliente já está no limite do plano ${client.plan} (${limit.numbers_limit} número${limit.numbers_limit > 1 ? 's' : ''}). Mude o plano dele em Clientes antes de adicionar outro número.`)
            return
          }
        }
      }
    }

    setSaving(true)
    if (editing) await supabase.from('client_numbers').update(form).eq('id', editing.id)
    else await supabase.from('client_numbers').insert(form)
    setSaving(false); setShowModal(false); fetchAll()
  }

  async function checkStatus(n) {
    setStatuses(s => ({ ...s, [n.id]: 'checking' }))
    try {
      const res = await checkInstanceStatus(n.zapi_instance_id, n.zapi_token)
      setStatuses(s => ({ ...s, [n.id]: res.connected ? 'connected' : 'disconnected' }))
    } catch {
      setStatuses(s => ({ ...s, [n.id]: 'disconnected' }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Números WhatsApp</h1>
          <p className="text-muted text-sm font-body mt-1">{numbers.length} instâncias configuradas</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
          <Plus size={14} /> Novo número
        </button>
      </div>

      {numbers.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Smartphone size={40} className="text-muted mx-auto mb-4" />
          <p className="text-white font-body font-medium mb-1">Nenhum número configurado</p>
          <button onClick={openNew} className="text-accent text-sm font-display font-bold hover:underline mt-2">Adicionar número →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {numbers.map(n => {
            const st = statuses[n.id]
            return (
              <div key={n.id} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                  <Smartphone size={18} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-body font-medium">{n.label}</p>
                    {!n.active && <span className="text-xs text-muted bg-muted/10 px-2 py-0.5 rounded font-body">Inativo</span>}
                  </div>
                  <p className="text-muted text-xs font-body mt-0.5">{n.client?.name} · {n.phone || 'Sem telefone'}</p>
                  <p className="text-muted/50 text-xs font-body mt-0.5 truncate">ID: {n.zapi_instance_id || 'não configurado'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {st === 'checking' && <RefreshCw size={14} className="text-accent animate-spin" />}
                  {st === 'connected' && <span className="flex items-center gap-1 text-green-400 text-xs font-body"><CheckCircle size={12} /> Online</span>}
                  {st === 'disconnected' && <span className="flex items-center gap-1 text-red-400 text-xs font-body"><XCircle size={12} /> Offline</span>}
                  <button onClick={() => checkStatus(n)} className="text-xs text-muted hover:text-accent font-body transition-colors">Testar</button>
                  <button onClick={() => openEdit(n)} className="text-muted hover:text-white transition-colors p-1"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(n)} className="text-muted hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein">
              <h3 className="font-display font-bold text-xl text-white mb-6">{editing ? 'Editar número' : 'Novo número WPP'}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Cliente *</label>
                  {clients.length === 0 ? (
                    <div className="bg-surface border border-border rounded-lg px-4 py-3">
                      <p className="text-amber-400 text-sm font-body">⚠ Crie um cliente primeiro.</p>
                    </div>
                  ) : (
                    <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required
                      className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent">
                      <option value="">Selecionar cliente</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
                <F label="Nome / Loja *" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Loja 1 / Consultório" required />
                <F label="Telefone (ex: 5519999999999)" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="5519999999999" />
                <F label="Z-API Instance ID *" value={form.zapi_instance_id} onChange={v => setForm(f => ({ ...f, zapi_instance_id: v }))} required />
                <F label="Z-API Token *" value={form.zapi_token} onChange={v => setForm(f => ({ ...f, zapi_token: v }))} required />
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="accent-yellow-400 w-4 h-4" />
                  <label htmlFor="active" className="text-sm text-white font-body cursor-pointer">Número ativo</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" disabled={saving || clients.length === 0} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-40 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
        </Modal>
      )}
    </div>
  )
}

function F({ label, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
    </div>
  )
}
