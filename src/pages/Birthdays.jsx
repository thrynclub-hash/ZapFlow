import { useEffect, useState } from 'react'
import { Cake, Send, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sendTextMessage, formatPhone, sleep } from '../lib/zapi'

export default function Birthdays() {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState([])
  const [numbers, setNumbers] = useState([])
  const [config, setConfig] = useState({ message: '', enabled: false })
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState('today') // today | week | month

  const clientId = profile?.client_id

  useEffect(() => {
    if (!clientId) return
    fetchData()
  }, [clientId])

  async function fetchData() {
    const { data: nums } = await supabase.from('client_numbers').select('*').eq('client_id', clientId)
    setNumbers(nums || [])

    const { data: cfg } = await supabase.from('birthday_configs').select('*').eq('client_id', clientId).single()
    if (cfg) setConfig({ message: cfg.message || '', enabled: cfg.enabled })

    await fetchBirthdays()
    setLoading(false)
  }

  async function fetchBirthdays() {
    const today = new Date()
    let filters = []

    if (tab === 'today') {
      const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      filters = [{ column: 'birth_date', op: 'like', value: `%-${mmdd}` }]
    } else if (tab === 'week') {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() + i)
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      // Fetch all and filter client-side for simplicity
      const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).not('birth_date', 'is', null)
      const filtered = (data || []).filter(c => {
        if (!c.birth_date) return false
        const parts = c.birth_date.split('-')
        const mmdd = `${parts[1]}-${parts[2]}`
        return days.includes(mmdd)
      })
      setContacts(filtered)
      return
    } else {
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).like('birth_date', `%-${month}-%`)
      setContacts(data || [])
      return
    }

    const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).like('birth_date', `%-${filters[0].value}`)
    setContacts(data || [])
  }

  useEffect(() => { if (clientId) fetchBirthdays() }, [tab, clientId])

  async function saveConfig() {
    await supabase.from('birthday_configs').upsert({ client_id: clientId, ...config })
    alert('Configuração salva!')
  }

  async function sendToAll() {
    if (!config.message) return alert('Configure a mensagem de aniversário primeiro.')
    const ok = confirm(`Enviar mensagem de aniversário para ${contacts.length} contatos?`)
    if (!ok) return
    setSending(true)

    for (const contact of contacts) {
      const number = numbers.find(n => n.id === contact.number_id)
      if (!number?.zapi_instance_id) continue
      try {
        const msg = config.message.replace('{nome}', contact.name?.split(' ')[0] || 'amigo(a)')
        await sendTextMessage(number.zapi_instance_id, number.zapi_token, formatPhone(contact.phone), msg)
        await supabase.from('message_logs').insert({ client_id: clientId, contact_id: contact.id, status: 'sent', sent_at: new Date().toISOString() })
      } catch {}
      await sleep(3500)
    }
    setSending(false)
    alert('Mensagens de aniversário enviadas!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Aniversários</h1>
        <p className="text-muted text-sm font-body mt-1">Gerencie e dispare mensagens para aniversariantes</p>
      </div>

      {/* Config */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-white flex items-center gap-2"><Settings size={16} /> Mensagem automática de aniversário</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted font-body">{config.enabled ? 'Ativado' : 'Desativado'}</span>
            <div onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${config.enabled ? 'bg-accent' : 'bg-border'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.enabled ? 'left-5' : 'left-1'}`} />
            </div>
          </label>
        </div>
        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Mensagem (use {'{nome}'} para personalizar)</label>
          <textarea value={config.message} onChange={e => setConfig(c => ({ ...c, message: e.target.value }))} rows={3}
            placeholder={`🎂 Feliz aniversário, {nome}! Que seu dia seja especial. Aproveite nossa promoção exclusiva para você: 10% OFF em qualquer produto hoje!`}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/40 focus:outline-none focus:border-accent transition-colors resize-none" />
        </div>
        <button onClick={saveConfig} className="bg-accent hover:bg-accent-dim text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
          Salvar configuração
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 w-fit">
        {[['today', 'Hoje'], ['week', 'Esta semana'], ['month', 'Este mês']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-body transition-colors ${tab === key ? 'bg-accent text-bg font-medium' : 'text-muted hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-muted text-sm font-body">{contacts.length} aniversariante{contacts.length !== 1 ? 's' : ''}</p>
          {contacts.length > 0 && (
            <button onClick={sendToAll} disabled={sending}
              className="flex items-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
              <Send size={14} /> {sending ? 'Enviando...' : 'Enviar para todos'}
            </button>
          )}
        </div>

        {contacts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-16 text-center">
            <Cake size={40} className="text-muted mx-auto mb-4" />
            <p className="text-white font-body font-medium mb-1">Nenhum aniversariante {tab === 'today' ? 'hoje' : tab === 'week' ? 'nessa semana' : 'neste mês'}</p>
            <p className="text-muted text-sm font-body">Certifique-se de ter a data de nascimento nos contatos</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {contacts.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center shrink-0">
                  <Cake size={18} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-body font-medium">{c.name}</p>
                  <p className="text-muted text-xs font-body">{c.phone} · {c.number?.label}</p>
                </div>
                <p className="text-accent text-sm font-body font-medium">
                  {c.birth_date ? new Date(c.birth_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
