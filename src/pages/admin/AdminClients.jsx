import { useEffect, useState } from 'react'
import { Plus, Edit2, Building2, Copy, Check, RefreshCw, Trash2, KeyRound, PackagePlus, X, CalendarCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'

const PLANS = ['Starter', 'Growth', 'Scale', 'Enterprise']
const SEGMENTS = ['Alimentação', 'Saúde/Clínica', 'Beleza', 'Educação', 'Varejo', 'Serviços', 'Outro']

function generateKey() {
  return Array.from({ length: 4 }, () => Math.random().toString(36).substring(2, 6)).join('-')
}

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showKey, setShowKey] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [provisioning, setProvisioning] = useState(null) // id do cliente sendo provisionado
  const [addonsClient, setAddonsClient] = useState(null) // cliente com o painel de add-ons aberto
  const [form, setForm] = useState({ name: '', plan: 'Basic', segment: 'Alimentação', status: 'active', access_key: '', plan_next_charge_at: '', plan_billing_cycle_days: 30 })

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', plan: 'Basic', segment: 'Alimentação', status: 'active', access_key: generateKey(), plan_next_charge_at: '', plan_billing_cycle_days: 30 })
    setShowModal(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ name: c.name, plan: c.plan || 'Basic', segment: c.segment || '', status: c.status, access_key: c.access_key || generateKey(), plan_next_charge_at: c.plan_next_charge_at ? c.plan_next_charge_at.slice(0, 10) : '', plan_billing_cycle_days: c.plan_billing_cycle_days || 30 })
    setShowModal(true)
  }

  async function handleDelete(client) {
    if (!confirm(`Excluir "${client.name}"? Isso remove também os números e contatos vinculados.`)) return
    await supabase.from('message_logs').delete().eq('client_id', client.id)
    await supabase.from('campaigns').delete().eq('client_id', client.id)
    await supabase.from('contacts').delete().eq('client_id', client.id)
    await supabase.from('client_numbers').delete().eq('client_id', client.id)
    await supabase.from('profiles').delete().eq('client_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)
    fetchClients()
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      await supabase.from('clients').update({ name: form.name, plan: form.plan, segment: form.segment, status: form.status, access_key: form.access_key, plan_next_charge_at: form.plan_next_charge_at || null, plan_billing_cycle_days: form.plan_billing_cycle_days }).eq('id', editing.id)
      setSaving(false); setShowModal(false); fetchClients()
    } else {
      const { data: client, error } = await supabase.from('clients').insert({ name: form.name, plan: form.plan, segment: form.segment, status: form.status, access_key: form.access_key, plan_next_charge_at: form.plan_next_charge_at || null, plan_billing_cycle_days: form.plan_billing_cycle_days }).select().single()
      if (error) { alert('Erro: ' + error.message); setSaving(false); return }
      // Provisiona login real (Supabase Auth) automaticamente pra todo cliente novo —
      // sem isso, o cliente consegue "logar" mas o banco trata ele como anônimo.
      await provisionLogin(client, { silent: true })
      setSaving(false); setShowModal(false)
      setShowKey({ name: form.name, key: form.access_key })
      fetchClients()
    }
  }

  // Provisiona (ou reprovisiona, é seguro chamar de novo) o login real
  // do cliente. Ver supabase/functions/client-provision.
  async function provisionLogin(client, { silent = false } = {}) {
    setProvisioning(client.id)
    try {
      const { data, error } = await supabase.functions.invoke('client-provision', { body: { client_id: client.id } })
      if (error || data?.error) {
        if (!silent) alert('Erro ao provisionar login: ' + (data?.error || error.message))
        return false
      }
      if (!silent) alert(data.already_provisioned ? 'Esse cliente já tinha login provisionado.' : 'Login provisionado! O cliente já pode logar com a chave de acesso normalmente.')
      return true
    } catch (e) {
      if (!silent) alert('Erro ao provisionar login: ' + e.message)
      return false
    } finally {
      setProvisioning(null)
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

  // Calcula o status de vencimento na hora, a partir da data crua —
  // nunca fica guardado/desatualizado no banco.
  function billingInfo(c) {
    if (!c.plan_next_charge_at) return { label: 'Sem data definida', color: 'bg-muted/10 text-muted' }
    const diffDays = Math.ceil((new Date(c.plan_next_charge_at) - new Date()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { label: `Atrasado ${Math.abs(diffDays)}d`, color: 'bg-red-400/10 text-red-400' }
    if (diffDays <= 3) return { label: diffDays === 0 ? 'Vence hoje' : `Vence em ${diffDays}d`, color: 'bg-amber-400/10 text-amber-400' }
    return { label: `Em dia (${new Date(c.plan_next_charge_at).toLocaleDateString('pt-BR')})`, color: 'bg-green-400/10 text-green-400' }
  }

  // "Renovar": avança a próxima cobrança pelo ciclo do cliente (default 30
  // dias), contando a partir de hoje se já tiver vencido, ou a partir da
  // data atual marcada se ainda não venceu (pra não perder dias já pagos).
  async function renewPlan(c) {
    const base = c.plan_next_charge_at && new Date(c.plan_next_charge_at) > new Date() ? new Date(c.plan_next_charge_at) : new Date()
    const next = new Date(base)
    next.setDate(next.getDate() + (c.plan_billing_cycle_days || 30))
    if (!confirm(`Marcar "${c.name}" como renovado? Próxima cobrança passa a ser ${next.toLocaleDateString('pt-BR')}.`)) return
    await supabase.from('clients').update({ plan_next_charge_at: next.toISOString() }).eq('id', c.id)
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
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Vencimento</th>
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
                      {c.access_key && <button onClick={() => copyKey(c.access_key)} className="text-muted hover:text-accent transition-colors"><Copy size={12} /></button>}
                      <button onClick={() => regenerateClientKey(c)} className="text-muted hover:text-accent transition-colors"><RefreshCw size={12} /></button>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-body ${c.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-muted/10 text-muted'}`}>
                      {c.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-body whitespace-nowrap ${billingInfo(c).color}`}>{billingInfo(c).label}</span>
                  </td>
                  <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                    <button onClick={() => renewPlan(c)} title="Marcar como renovado (avança a próxima cobrança pelo ciclo do cliente)"
                      className="text-muted hover:text-green-400 transition-colors p-1">
                      <CalendarCheck size={14} />
                    </button>
                    <button onClick={() => provisionLogin(c)} disabled={provisioning === c.id} title="Provisionar/verificar login real (Supabase Auth) deste cliente"
                      className="text-muted hover:text-accent transition-colors p-1 disabled:opacity-40">
                      <KeyRound size={14} />
                    </button>
                    <button onClick={() => setAddonsClient(c)} title="Add-ons (order bump): +número, +contatos"
                      className="text-muted hover:text-accent transition-colors p-1">
                      <PackagePlus size={14} />
                    </button>
                    <button onClick={() => openEdit(c)} className="text-muted hover:text-white transition-colors p-1"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c)} className="text-muted hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein">
              <h3 className="font-display font-bold text-xl text-white mb-6">{editing ? 'Editar cliente' : 'Novo cliente'}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <F label="Nome da empresa *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
                <div className="grid grid-cols-2 gap-3">
                  <Sel label="Plano" value={form.plan} onChange={v => setForm(f => ({ ...f, plan: v }))} options={PLANS} />
                  <Sel label="Segmento" value={form.segment} onChange={v => setForm(f => ({ ...f, segment: v }))} options={SEGMENTS} />
                </div>
                <Sel label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['active', 'inactive']} labels={['Ativo', 'Inativo']} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted font-body mb-1.5">Próxima cobrança</label>
                    <input type="date" value={form.plan_next_charge_at} onChange={e => setForm(f => ({ ...f, plan_next_charge_at: e.target.value }))}
                      className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white text-sm font-body focus:border-accent focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted font-body mb-1.5">Ciclo (dias)</label>
                    <input type="number" min="1" value={form.plan_billing_cycle_days} onChange={e => setForm(f => ({ ...f, plan_billing_cycle_days: parseInt(e.target.value) || 30 }))}
                      className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white text-sm font-body focus:border-accent focus:outline-none" />
                  </div>
                </div>
                <p className="text-xs text-muted font-body -mt-2">Controle manual — não gera cobrança automática. Use o botão "Renovar" (ícone de calendário) na lista pra avançar rapidinho quando o pagamento cair.</p>
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Chave de acesso</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-surface border border-accent/30 rounded-lg px-4 py-3">
                      <code className="text-accent text-sm font-body tracking-widest">{form.access_key}</code>
                    </div>
                    <button type="button" onClick={() => setForm(f => ({ ...f, access_key: generateKey() }))} className="border border-border text-muted hover:text-accent px-3 rounded-lg transition-colors"><RefreshCw size={14} /></button>
                    <button type="button" onClick={() => copyKey(form.access_key)} className="border border-border text-muted hover:text-accent px-3 rounded-lg transition-colors">
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</button>
                </div>
              </form>
            </div>
        </Modal>
      )}

      {addonsClient && <AddonsModal client={addonsClient} onClose={() => setAddonsClient(null)} />}

      {showKey && (
        <Modal>
            <div className="bg-card border border-accent/30 rounded-2xl p-8 w-full max-w-sm animate-fadein text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-accent" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">Cliente criado!</h3>
              <p className="text-muted text-sm font-body mb-6">Chave de acesso de <strong className="text-white">{showKey.name}</strong>:</p>
              <div className="bg-surface border border-accent/20 rounded-xl p-4 mb-6">
                <code className="text-accent text-xl font-body tracking-widest">{showKey.key}</code>
              </div>
              <div className="flex gap-3">
                <button onClick={() => copyKey(showKey.key)} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white flex items-center justify-center gap-2 transition-colors">
                  {copied ? <><Check size={14} className="text-green-400" /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                </button>
                <button onClick={() => setShowKey(null)} className="flex-1 bg-accent hover:bg-accent-dim text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">Fechar</button>
              </div>
            </div>
        </Modal>
      )}
    </div>
  )
}

function AddonsModal({ client, onClose }) {
  const [addons, setAddons] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('number')
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState(150)
  const [saving, setSaving] = useState(false)

  // "number" é recorrente (mensal); "contacts_1000" é pagamento único
  // (corrigido em 2026-07-03 — não é mais cobrado todo mês).
  const SUGGESTED = { number: 150, contacts_1000: 59.90 }

  useEffect(() => { fetchAddons() }, [])

  async function fetchAddons() {
    setLoading(true)
    const { data } = await supabase.from('client_addons').select('*').eq('client_id', client.id).order('created_at', { ascending: false })
    setAddons(data || [])
    setLoading(false)
  }

  async function addAddon() {
    setSaving(true)
    // status='active' direto: add-on criado manualmente aqui pressupõe que
    // você já cobrou o cliente por fora (Kiwify, Pix, etc). Add-ons que
    // vierem do checkout automático do Mercado Pago nascem 'pending' e só
    // viram 'active' quando o mp-webhook confirmar o pagamento.
    await supabase.from('client_addons').insert({ client_id: client.id, addon_type: type, quantity, monthly_price: price, status: 'active' })
    setSaving(false)
    setQuantity(1)
    fetchAddons()
  }

  async function removeAddon(id) {
    if (!confirm('Remover este add-on? Isso reduz o limite efetivo do cliente imediatamente.')) return
    await supabase.from('client_addons').delete().eq('id', id)
    fetchAddons()
  }

  // Só soma no total "extra/mês" os add-ons recorrentes (número) — contatos
  // é pagamento único, não deveria inflar essa conta (bug corrigido em
  // 2026-07-03, junto com a troca do checkout de contatos pra one-time).
  const totalExtraMonthly = addons.filter(a => a.status === 'active' && a.addon_type === 'number').reduce((s, a) => s + Number(a.monthly_price), 0)
  const totalExtraOneTime = addons.filter(a => a.status === 'active' && a.addon_type === 'contacts_1000').reduce((s, a) => s + Number(a.monthly_price), 0)

  return (
    <Modal>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xl text-white">Add-ons de {client.name}</h3>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>

        {loading ? (
          <p className="text-muted text-sm font-body">Carregando...</p>
        ) : addons.length === 0 ? (
          <p className="text-muted text-sm font-body">Nenhum add-on ainda — esse cliente usa só o limite do plano base.</p>
        ) : (
          <div className="space-y-2">
            {addons.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm text-white font-body flex items-center gap-2">
                    {a.addon_type === 'number' ? `+${a.quantity} número(s) WhatsApp` : `+${a.quantity * 1000} contatos`}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-body ${a.status === 'active' ? 'bg-green-400/10 text-green-400' : a.status === 'pending' ? 'bg-amber-400/10 text-amber-300' : 'bg-red-400/10 text-red-400'}`}>
                      {a.status === 'active' ? 'ativo' : a.status === 'pending' ? 'aguardando pagamento' : 'cancelado'}
                    </span>
                  </p>
                  <p className="text-xs text-muted font-body">R$ {Number(a.monthly_price).toFixed(2)}{a.addon_type === 'number' ? '/mês' : ' (único)'} · desde {new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => removeAddon(a.id)} className="text-muted hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="flex justify-between text-sm font-body pt-1 border-t border-border">
              <span className="text-muted">Total extra/mês (recorrente)</span>
              <span className="text-accent font-medium">R$ {totalExtraMonthly.toFixed(2)}</span>
            </div>
            {totalExtraOneTime > 0 && (
              <div className="flex justify-between text-sm font-body">
                <span className="text-muted">Total pago em add-ons únicos</span>
                <span className="text-white font-medium">R$ {totalExtraOneTime.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs text-muted font-body">Adicionar novo add-on:</p>
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Tipo" value={type} onChange={v => { setType(v); setPrice(SUGGESTED[v]) }} options={['number', 'contacts_1000']} labels={['+1 número WhatsApp', '+1000 contatos']} />
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Quantidade</label>
              <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">{type === 'number' ? 'Preço mensal (R$)' : 'Preço — pagamento único (R$)'} — sugestão: {SUGGESTED[type]}</label>
            <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(Number(e.target.value))}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
          </div>
          <button onClick={addAddon} disabled={saving}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">
            {saving ? 'Adicionando...' : 'Adicionar add-on'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function F({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
    </div>
  )
}
function Sel({ label, value, onChange, options, labels }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent">
        {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
      </select>
    </div>
  )
}
