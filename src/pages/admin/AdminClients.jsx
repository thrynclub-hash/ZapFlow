import { useEffect, useState } from 'react'
import { Plus, Edit2, Building2, Copy, Check, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const PLANS = ['Starter', 'Basic', 'Pro', 'Business', 'Enterprise']
const SEGMENTS = ['Alimentação', 'Saúde/Clínica', 'Beleza', 'Educação', 'Varejo', 'Serviços', 'Outro']

// Gera chave no formato xxxx-xxxx-xxxx-xxxx
function generateKey() {
  return Array.from({ length: 4 }, () =>
    Math.random().toString(36).substring(2, 6)
  ).join('-')
}

// Gera email e senha internos (invisíveis ao cliente)
function generateAuthCredentials(clientName) {
  const slug = clientName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').substring(0, 12)
  const rand = Math.random().toString(36).substring(2, 8)
  return {
    auth_email: `${slug}-${rand}@zapflow.internal`,
    auth_password: Math.random().toString(36).substring(2) + 'Zf1!',
  }
}

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showKey, setShowKey] = useState(null) // mostra chave após criação
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    name: '', plan: 'Basic', segment: 'Alimentação', status: 'active', access_key: ''
  })

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', plan: 'Basic', segment: 'Alimentação', status: 'active', access_key: generateKey() })
    setShowModal(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ name: c.name, plan: c.plan || 'Basic', segment: c.segment || '', status: c.status, access_key: c.access_key || generateKey() })
    setShowModal(true)
  }

  function regenerateKey() {
    setForm(f => ({ ...f, access_key: generateKey() }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    if (editing) {
      await supabase.from('clients').update({
        name: form.name, plan: form.plan, segment: form.segment,
        status: form.status, access_key: form.access_key,
      }).eq('id', editing.id)
      setSaving(false)
      setShowModal(false)
      fetchClients()
    } else {
      // Cria o client no banco
      const { data: client, error } = await supabase.from('clients').insert({
        name: form.name, plan: form.plan, segment: form.segment,
        status: form.status, access_key: form.access_key,
      }).select().single()

      if (error || !client) {
        alert('Erro ao criar cliente: ' + error?.message)
        setSaving(false)
        return
      }

      // Cria usuário no Supabase Auth com credenciais internas
      const { auth_email, auth_password } = generateAuthCredentials(form.name)
      const { data: authData } = await supabase.auth.admin.createUser({
        email: auth_email,
        password: auth_password,
        email_confirm: true,
      })

      if (authData?.user) {
        // Salva credenciais internas no client (pra login pela chave funcionar)
        await supabase.from('clients').update({ auth_email, auth_password }).eq('id', client.id)
        // Cria profile
        await supabase.from('profiles').insert({
          id: authData.user.id,
          client_id: client.id,
          role: 'client',
          full_name: form.name,
          email: auth_email,
        })
      }

      setSaving(false)
      setShowModal(false)
      setShowKey({ name: form.name, key: form.access_key })
      fetchClients()
    }
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateClientKey(client) {
    const newKey = generateKey()
    await supabase.from('clients').update({ access_key: newKey }).eq('id', client.id)
    setShowKey({ name: client.name, key: newKey })
    fetchClients()
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

      {clients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Building2 size={40} className="text-muted mx-auto mb-4" />
          <p className="text-white font-body font-medium mb-1">Nenhum cliente ainda</p>
          <button onClick={openNew} className="mt-4 text-accent text-sm font-display font-bold hover:underline">Adicionar primeiro cliente →</button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Cliente</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Segmento</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Plano</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Chave de acesso</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                  <td className="px-5 py-4 text-sm text-white font-body font-medium">{c.name}</td>
                  <td className="px-5 py-4 text-sm text-muted font-body">{c.segment || '—'}</td>
                  <td className="px-5 py-4"><span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded font-body">{c.plan}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-accent bg-accent/10 px-2 py-1 rounded font-body tracking-wider">{c.access_key || '—'}</code>
                      {c.access_key && (
                        <button onClick={() => copyKey(c.access_key)} className="text-muted hover:text-accent transition-colors">
                          <Copy size={12} />
                        </button>
                      )}
                      <button onClick={() => regenerateClientKey(c)} className="text-muted hover:text-accent transition-colors" title="Gerar nova chave">
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </td>
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
      )}

      {/* MODAL NOVO/EDITAR */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bg/80 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein">
              <h3 className="font-display font-bold text-xl text-white mb-6">{editing ? 'Editar cliente' : 'Novo cliente'}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <F label="Nome da empresa *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
                <div className="grid grid-cols-2 gap-3">
                  <Sel label="Plano" value={form.plan} onChange={v => setForm(f => ({ ...f, plan: v }))} options={PLANS} />
                  <Sel label="Segmento" value={form.segment} onChange={v => setForm(f => ({ ...f, segment: v }))} options={SEGMENTS} />
                </div>
                <Sel label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['active', 'inactive']} labels={['Ativo', 'Inativo']} />

                {/* Chave de acesso */}
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Chave de acesso (gerada automaticamente)</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-surface border border-accent/30 rounded-lg px-4 py-3 flex items-center">
                      <code className="text-accent text-sm font-body tracking-widest flex-1">{form.access_key}</code>
                    </div>
                    <button type="button" onClick={regenerateKey}
                      className="border border-border text-muted hover:text-accent px-3 rounded-lg transition-colors" title="Gerar nova chave">
                      <RefreshCw size={14} />
                    </button>
                    <button type="button" onClick={() => copyKey(form.access_key)}
                      className="border border-border text-muted hover:text-accent px-3 rounded-lg transition-colors">
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted font-body mt-1.5">Esta é a chave que o cliente usará para entrar. Guarde e envie para ele.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">
                    {saving ? 'Criando...' : editing ? 'Salvar' : 'Criar cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHAVE GERADA */}
      {showKey && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bg/80 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-card border border-accent/30 rounded-2xl p-8 w-full max-w-sm animate-fadein text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-accent" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">Cliente criado!</h3>
              <p className="text-muted text-sm font-body mb-6">Envie essa chave de acesso para <strong className="text-white">{showKey.name}</strong>:</p>

              <div className="bg-surface border border-accent/20 rounded-xl p-4 mb-6">
                <code className="text-accent text-xl font-body tracking-widest">{showKey.key}</code>
              </div>

              <div className="flex gap-3">
                <button onClick={() => copyKey(showKey.key)}
                  className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white flex items-center justify-center gap-2 transition-colors">
                  {copied ? <><Check size={14} className="text-green-400" /> Copiado!</> : <><Copy size={14} /> Copiar chave</>}
                </button>
                <button onClick={() => setShowKey(null)}
                  className="flex-1 bg-accent hover:bg-accent-dim text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">
                  Fechar
                </button>
              </div>

              <p className="text-xs text-muted font-body mt-4">
                O cliente acessa: <span className="text-white">zap-flow-smoky.vercel.app</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function F({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
    </div>
  )
}
function Sel({ label, value, onChange, options, labels }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent">
        {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
      </select>
    </div>
  )
}
