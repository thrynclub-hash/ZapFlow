import { useEffect, useState } from 'react'
import { Plus, Edit2, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const PLANS = ['Starter', 'Basic', 'Pro', 'Business', 'Enterprise']
const SEGMENTS = ['Alimentação', 'Saúde/Clínica', 'Beleza', 'Educação', 'Varejo', 'Serviços', 'Outro']

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', plan: 'Basic', segment: '', status: 'active' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch() }, [])

  async function fetch() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }

  function openNew() { setEditing(null); setForm({ name: '', email: '', plan: 'Basic', segment: '', status: 'active' }); setShowModal(true) }
  function openEdit(c) { setEditing(c); setForm({ name: c.name, email: c.email || '', plan: c.plan || 'Basic', segment: c.segment || '', status: c.status }); setShowModal(true) }

  async function handleSave(e) {
    e.preventDefault()
    if (editing) {
      await supabase.from('clients').update(form).eq('id', editing.id)
    } else {
      const { data: client } = await supabase.from('clients').insert(form).select().single()
      // Cria usuário no Supabase Auth para o cliente
      if (form.email) {
        const tmpPwd = Math.random().toString(36).slice(-10) + 'A1!'
        const { data: user } = await supabase.auth.admin.createUser({ email: form.email, password: tmpPwd, email_confirm: true })
        if (user?.user) {
          await supabase.from('profiles').insert({ id: user.user.id, client_id: client.id, role: 'client', full_name: form.name, email: form.email })
        }
      }
    }
    setShowModal(false)
    fetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Clientes</h1>
          <p className="text-muted text-sm font-body mt-1">{clients.length} clientes cadastrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
          <Plus size={14} /> Novo cliente
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs text-muted font-body">Cliente</th>
              <th className="text-left px-5 py-3 text-xs text-muted font-body">E-mail</th>
              <th className="text-left px-5 py-3 text-xs text-muted font-body">Segmento</th>
              <th className="text-left px-5 py-3 text-xs text-muted font-body">Plano</th>
              <th className="text-left px-5 py-3 text-xs text-muted font-body">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                <td className="px-5 py-4 text-sm text-white font-body font-medium">{c.name}</td>
                <td className="px-5 py-4 text-sm text-muted font-body">{c.email || '—'}</td>
                <td className="px-5 py-4 text-sm text-muted font-body">{c.segment || '—'}</td>
                <td className="px-5 py-4"><span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded font-body">{c.plan}</span></td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-body ${c.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-muted/10 text-muted'}`}>
                    {c.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => openEdit(c)} className="text-muted hover:text-white transition-colors p-1"><Edit2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein my-auto">
            <h3 className="font-display font-bold text-xl text-white mb-6">{editing ? 'Editar cliente' : 'Novo cliente'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Nome da empresa *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
              {!editing && <Field label="E-mail de acesso" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="acesso@empresa.com" />}
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Plano" value={form.plan} onChange={v => setForm(f => ({ ...f, plan: v }))} options={PLANS} />
                <SelectField label="Segmento" value={form.segment} onChange={v => setForm(f => ({ ...f, segment: v }))} options={SEGMENTS} />
              </div>
              <SelectField label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['active', 'inactive']} labels={['Ativo', 'Inativo']} />
              {!editing && <p className="text-xs text-muted font-body bg-surface rounded-lg p-3">Uma senha temporária será gerada. O cliente precisará redefinir no primeiro acesso.</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border text-muted py-2.5 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-accent hover:bg-accent-dim text-bg py-2.5 rounded-lg text-sm font-display font-bold transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
    </div>
  )
}

function SelectField({ label, value, onChange, options, labels }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
        {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
      </select>
    </div>
  )
}
