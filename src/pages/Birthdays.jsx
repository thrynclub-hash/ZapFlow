import { useEffect, useRef, useState } from 'react'
import { Cake, Send, Settings, Image, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sleep } from '../lib/zapi'

const TEMPLATES = [
  { label: 'Desconto no dia', text: '🎂 Feliz aniversário, {nome}! Que seu dia seja especial. Aproveite: 10% OFF em qualquer produto hoje! 🎉' },
  { label: 'Carinhoso, sem oferta', text: '🎉 Parabéns, {nome}! Hoje é um dia só seu — desejamos muita saúde, alegria e realizações. Um abraço da nossa equipe! 💛' },
  { label: 'Convite pra visitar', text: '🎂 {nome}, feliz aniversário! Passa aqui essa semana pra gente comemorar com você — tem uma surpresinha esperando! 🎁' },
  { label: 'Curto e direto', text: 'Feliz aniversário, {nome}! 🎉 Tudo de bom pra você hoje e sempre.' },
  { label: 'Agradecimento', text: '🎂 {nome}, muito feliz aniversário! Obrigado por confiar na gente durante esse ano. Contamos com você por muitos mais! 💛' },
]

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
  const [selectedIds, setSelectedIds] = useState(new Set())
  const fileRef = useRef()
  const clientId = profile?.client_id

  useEffect(() => { if (clientId) fetchData() }, [clientId])
  useEffect(() => { if (clientId) fetchBirthdays() }, [tab, clientId])

  async function fetchData() {
    const { data: nums } = await supabase.from('client_numbers').select('id, client_id, label, phone, active').eq('client_id', clientId)
    setNumbers(nums || [])
    const { data: cfg } = await supabase.from('birthday_configs').select('*').eq('client_id', clientId).maybeSingle()
    if (cfg) { setConfig({ message: cfg.message || '', enabled: cfg.enabled }); setSavedImageUrl(cfg.image_url || null) }
    await fetchBirthdays()
    setLoading(false)
  }

  // Paginado (2026-07-06) — mesmo bug do teto de 1000 linhas já corrigido em
  // Contacts.jsx/Reports.jsx: sem isso, cliente com mais de 1000 contatos com
  // data de nascimento perdia silenciosamente quem caísse depois da linha 1000.
  async function fetchContactsWithBirthdate() {
    let all = [], from = 0
    while (true) {
      const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).not('birth_date', 'is', null).range(from, from + 999)
      all = all.concat(data || [])
      if (!data || data.length < 1000) break
      from += 1000
    }
    return all
  }

  async function fetchBirthdays() {
    const today = new Date()
    const data = await fetchContactsWithBirthdate()
    let list = []
    if (tab === 'today') {
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      list = data.filter(c => { const p = c.birth_date.split('-'); return p[1] === mm && p[2] === dd })
    } else if (tab === 'week') {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() + i)
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      list = data.filter(c => { if (!c.birth_date) return false; const p = c.birth_date.split('-'); return days.includes(`${p[1]}-${p[2]}`) })
    } else {
      const month = String(today.getMonth() + 1).padStart(2, '0')
      list = data.filter(c => c.birth_date.split('-')[1] === month)
    }
    setContacts(list)
    // Por padrão todo mundo vem selecionado (comportamento igual ao antigo
    // "enviar para todos"), mas agora dá pra desmarcar quem não quer receber.
    setSelectedIds(new Set(list.map(c => c.id)))
  }

  function toggleSelected(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === contacts.length ? new Set() : new Set(contacts.map(c => c.id)))
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
    const targets = contacts.filter(c => selectedIds.has(c.id))
    if (targets.length === 0) return alert('Selecione ao menos um aniversariante.')
    if (!confirm(`Enviar para ${targets.length} aniversariante(s) selecionado(s)?`)) return
    setSending(true)
    let sent = 0, capHit = false
    for (const contact of targets) {
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
              <div className={`w-4 h-4 bg-[#ffffff] rounded-full absolute top-1 transition-all ${config.enabled ? 'left-5' : 'left-1'}`} />
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
          <label className="block text-xs text-muted font-body mb-1.5">Modelos prontos (clique para usar como ponto de partida)</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {TEMPLATES.map(t => (
              <button key={t.label} type="button" onClick={() => setConfig(c => ({ ...c, message: t.text }))}
                className="text-xs text-accent border border-accent/30 px-3 py-1.5 rounded-lg font-body hover:bg-accent/10 transition-colors">
                {t.label}
              </button>
            ))}
          </div>
          <label className="block text-xs text-muted font-body mb-1.5">Mensagem (use {'{nome}'} para personalizar) — pode editar livremente após escolher um modelo</label>
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
          <div className="flex items-center gap-3">
            <p className="text-muted text-sm font-body">{contacts.length} aniversariante{contacts.length !== 1 ? 's' : ''} · {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</p>
            {contacts.length > 0 && (
              <button onClick={toggleSelectAll} className="text-xs text-accent font-body hover:underline">
                {selectedIds.size === contacts.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
          </div>
          {contacts.length > 0 && (
            <button onClick={sendToAll} disabled={sending || selectedIds.size === 0}
              className="flex items-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
              <Send size={14} /> {sending ? 'Enviando...' : `Enviar para ${selectedIds.size} selecionado${selectedIds.size !== 1 ? 's' : ''}`}
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
              <div key={c.id} className={`bg-card border rounded-xl p-4 flex items-center gap-4 transition-colors ${selectedIds.has(c.id) ? 'border-border' : 'border-border opacity-50'}`}>
                <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelected(c.id)}
                  className="w-4 h-4 accent-accent shrink-0" />
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
