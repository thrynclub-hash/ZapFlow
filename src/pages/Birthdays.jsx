import { useEffect, useRef, useState } from 'react'
import { Cake, Send, Settings, Image, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sleep } from '../lib/zapi'

export default function Birthdays() {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState([])
  const [numbers, setNumbers] = useState([])
  const [config, setConfig] = useState({ message: '', enabled: false })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [savedImageUrl, setSavedImageUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('today')
  const fileRef = useRef()
  const clientId = profile?.client_id

  useEffect(() => { if (clientId) fetchData() }, [clientId])
  useEffect(() => { if (clientId) fetchBirthdays() }, [tab, clientId])

  async function fetchData() {
    const { data: nums } = await supabase.from('client_numbers').select('id, client_id, label, phone, active').eq('client_id', clientId)
    setNumbers(nums || [])
    const { data: cfg } = await supabase.from('birthday_configs').select('*').eq('client_id', clientId).single()
    if (cfg) { setConfig({ message: cfg.message || '', enabled: cfg.enabled }); setSavedImageUrl(cfg.image_url || null) }
    await fetchBirthdays()
    setLoading(false)
  }

  async function fetchBirthdays() {
    const today = new Date()
    if (tab === 'today') {
      const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).like('birth_date', `%-${mmdd}`)
      setContacts(data || [])
    } else if (tab === 'week') {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() + i)
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).not('birth_date', 'is', null)
      setContacts((data || []).filter(c => { if (!c.birth_date) return false; const p = c.birth_date.split('-'); return days.includes(`${p[1]}-${p[2]}`) }))
    } else {
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).like('birth_date', `%-${month}-%`)
      setContacts(data || [])
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function saveConfig() {
    setSaving(true)
    let imageUrl = savedImageUrl
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `birthday/${clientId}/aniversario.${ext}`
      await supabase.storage.from('creatives').upload(path, imageFile, { upsert: true })
      const { data } = supabase.storage.from('creatives').getPublicUrl(path)
      imageUrl = data.publicUrl
      setSavedImageUrl(imageUrl)
    }
    await supabase.from('birthday_configs').upsert({ client_id: clientId, message: config.message, enabled: config.enabled, image_url: imageUrl })
    setSaving(false)
    alert('Configuração salva!')
  }

  async function sendToAll() {
    if (!config.message) return alert('Configure a mensagem de aniversário primeiro.')
    if (!confirm(`Enviar para ${contacts.length} aniversariantes?`)) return
    setSending(true)
    let sent = 0, capHit = false
    for (const contact of contacts) {
      if (capHit) break
      const number = numbers.find(n => n.id === contact.number_id)
      if (!number) continue
      const msg = config.message.replace('{nome}', contact.name?.split(' ')[0] || 'amigo(a)')
      // Mesma Edge Function do disparo manual: token da Z-API fica só no
      // servidor, e o mesmo limite diário de 100/dia por número vale aqui
      // também (soma com campanhas/automações do mesmo número).
      const { data } = await supabase.functions.invoke('send-message', {
        body: { number_id: number.id, phone: contact.phone, message: msg, image_url: savedImageUrl || undefined, contact_id: contact.id },
      })
      if (data?.error === 'LIMITE_DIARIO_ATINGIDO') { capHit = true; break }
      if (!data?.error) sent++
      await sleep(3500)
    }
    setSending(false)
    alert(capHit
      ? `Limite diário de 100 mensagens atingido neste número. ${sent} enviadas agora — o resto não foi enviado hoje (envie de novo amanhã, ou espere a próxima campanha).`
      : `${sent} mensagens de aniversário enviadas!`)
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

        {/* Imagem de aniversário */}
        <div>
          <label className="block text-xs text-muted font-body mb-2">Imagem (opcional — será enviada junto com a mensagem)</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          {(imagePreview || savedImageUrl) ? (
            <div className="flex items-center gap-4">
              <img src={imagePreview || savedImageUrl} alt="preview" className="h-20 w-20 rounded-xl object-cover border border-border" />
              <div className="space-y-2">
                <p className="text-xs text-muted font-body">{imageFile ? imageFile.name : 'Imagem salva'}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current.click()}
                    className="text-xs text-accent border border-accent/30 px-3 py-1.5 rounded-lg font-body hover:bg-accent/10 transition-colors">
                    Trocar imagem
                  </button>
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setSavedImageUrl(null) }}
                    className="text-xs text-red-400 border border-red-400/30 px-3 py-1.5 rounded-lg font-body hover:bg-red-400/10 transition-colors">
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current.click()}
              className="flex items-center gap-2 border border-dashed border-border rounded-xl px-4 py-3 text-muted hover:border-accent hover:text-accent transition-colors text-sm font-body">
              <Image size={16} /> Adicionar imagem de aniversário
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Mensagem (use {'{nome}'} para personalizar)</label>
          <textarea value={config.message} onChange={e => setConfig(c => ({ ...c, message: e.target.value }))} rows={3}
            placeholder={`🎂 Feliz aniversário, {nome}! Que seu dia seja especial. Aproveite: 10% OFF em qualquer produto hoje! 🎉`}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/40 focus:outline-none focus:border-accent transition-colors resize-none" />
        </div>
        <button onClick={saveConfig} disabled={saving}
          className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
          {saving ? 'Salvando...' : 'Salvar configuração'}
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
                  <p className="text-muted text-xs font-body">{c.phone} · {c.number?.label || 'Sem loja'}</p>
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
