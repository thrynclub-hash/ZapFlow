import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Image, Send, AlertCircle, CheckCircle, X, Clock, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sendImageMessage, sendTextMessage, formatPhone, sleep } from '../lib/zapi'

const DELAY_MS = 4000 // 4s entre mensagens

export default function NewCampaign() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [numbers, setNumbers] = useState([])
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({
    name: '', number_id: '', caption: '',
    send_mode: 'now', // 'now' | 'scheduled' | 'daily'
    scheduled_date: '', daily_limit: 100, daily_start_hour: 9
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [step, setStep] = useState('compose')
  const [progress, setProgress] = useState({ sent: 0, errors: 0, total: 0, current: '' })
  const fileRef = useRef()
  const abortRef = useRef(false)
  const clientId = profile?.client_id

  useEffect(() => { if (clientId) fetchNumbers() }, [clientId])
  useEffect(() => { if (form.number_id) fetchContacts() }, [form.number_id])

  async function fetchNumbers() {
    const { data } = await supabase.from('client_numbers').select('*').eq('client_id', clientId).eq('active', true)
    setNumbers(data || [])
  }

  async function fetchContacts() {
    const { data } = await supabase.from('contacts').select('*').eq('client_id', clientId).eq('number_id', form.number_id)
    setContacts(data || [])
  }

  function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(campaignId) {
    const ext = imageFile.name.split('.').pop()
    const path = `campaigns/${clientId}/${campaignId}.${ext}`
    await supabase.storage.from('creatives').upload(path, imageFile, { upsert: true })
    const { data } = supabase.storage.from('creatives').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!form.number_id) return alert('Selecione uma loja.')
    if (contacts.length === 0) return alert('Nenhum contato nesta loja.')
    if (!form.caption.trim()) return alert('Escreva a mensagem.')

    const number = numbers.find(n => n.id === form.number_id)
    if (!number?.zapi_instance_id || !number?.zapi_token) return alert('Número sem Z-API configurado.')

    // Modo agendado — salva e sai
    if (form.send_mode === 'scheduled' || form.send_mode === 'daily') {
      const { error } = await supabase.from('campaigns').insert({
        client_id: clientId, number_id: form.number_id,
        name: form.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
        caption: form.caption, type: 'manual',
        status: 'scheduled',
        total_count: contacts.length, sent_count: 0, error_count: 0,
        daily_limit: form.send_mode === 'daily' ? form.daily_limit : null,
        daily_start_hour: form.daily_start_hour,
        scheduled_for: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : new Date().toISOString(),
      })
      if (error) return alert('Erro ao agendar: ' + error.message)
      alert(`✅ Campanha agendada! Disparos de ${form.daily_limit}/dia a partir das ${form.daily_start_hour}h.`)
      navigate('/campaigns')
      return
    }

    // Modo imediato
    abortRef.current = false
    setStep('sending')

    const { data: campaign, error: campErr } = await supabase.from('campaigns').insert({
      client_id: clientId, number_id: form.number_id,
      name: form.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
      caption: form.caption, type: 'manual', status: 'sending',
      total_count: contacts.length, sent_count: 0, error_count: 0,
    }).select().single()

    if (campErr) { alert('Erro: ' + campErr.message); setStep('compose'); return }

    let imageUrl = null
    if (imageFile) {
      try { imageUrl = await uploadImage(campaign.id) }
      catch (err) { alert('Erro ao subir imagem: ' + err.message); setStep('compose'); return }
    }

    let sent = 0, errors = 0
    setProgress({ sent: 0, errors: 0, total: contacts.length, current: '' })

    for (const contact of contacts) {
      if (abortRef.current) break
      const phone = formatPhone(contact.phone)
      setProgress(p => ({ ...p, current: contact.name }))
      try {
        if (imageUrl) await sendImageMessage(number.zapi_instance_id, number.zapi_token, phone, imageUrl, form.caption)
        else await sendTextMessage(number.zapi_instance_id, number.zapi_token, phone, form.caption)
        sent++
        await supabase.from('message_logs').insert({ campaign_id: campaign.id, client_id: clientId, contact_id: contact.id, status: 'sent', sent_at: new Date().toISOString() })
      } catch (err) {
        errors++
        await supabase.from('message_logs').insert({ campaign_id: campaign.id, client_id: clientId, contact_id: contact.id, status: 'error', error_detail: err.message })
      }
      setProgress({ sent, errors, total: contacts.length, current: contact.name })
      if (sent + errors < contacts.length) await sleep(DELAY_MS)
    }

    await supabase.from('campaigns').update({ status: abortRef.current ? 'error' : 'completed', sent_count: sent, error_count: errors, completed_at: new Date().toISOString() }).eq('id', campaign.id)
    setProgress(p => ({ ...p, current: '' }))
    setStep('done')
  }

  const selectedNumber = numbers.find(n => n.id === form.number_id)
  const pct = progress.total > 0 ? Math.round(((progress.sent + progress.errors) / progress.total) * 100) : 0
  const estimatedDays = form.send_mode === 'daily' ? Math.ceil(contacts.length / form.daily_limit) : null

  if (step === 'sending' || step === 'done') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          {step === 'sending' ? (
            <>
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6"><Send size={28} className="text-accent" /></div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">Enviando mensagens</h2>
              <p className="text-muted text-sm font-body mb-6">Não feche a janela durante o envio.</p>
              <div className="bg-surface rounded-xl p-5 mb-6 text-left space-y-3">
                <div className="flex justify-between text-sm font-body"><span className="text-muted">Progresso</span><span className="text-accent font-medium">{pct}%</span></div>
                <div className="w-full bg-border rounded-full h-2"><div className="bg-accent h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                <div className="flex justify-between text-xs font-body">
                  <span className="text-green-400">✓ {progress.sent} enviados</span>
                  {progress.errors > 0 && <span className="text-red-400">✗ {progress.errors} erros</span>}
                  <span className="text-muted">{progress.total} total</span>
                </div>
                {progress.current && <p className="text-xs text-muted font-body flex items-center gap-2"><Clock size={12} className="animate-spin" /> {progress.current}</p>}
              </div>
              <button onClick={() => { abortRef.current = true }} className="text-red-400 text-sm font-body hover:underline">Cancelar</button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-400/10 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={28} className="text-green-400" /></div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">Disparo concluído!</h2>
              <p className="text-muted text-sm font-body mb-6">{progress.sent} mensagens enviadas.{progress.errors > 0 ? ` ${progress.errors} erros.` : ''}</p>
              <div className="flex gap-3">
                <button onClick={() => { setStep('compose'); setImageFile(null); setImagePreview(null); setForm({ name: '', number_id: '', caption: '', send_mode: 'now', scheduled_date: '', daily_limit: 100, daily_start_hour: 9 }) }}
                  className="flex-1 border border-border text-white py-3 rounded-lg font-body text-sm hover:bg-surface transition-colors">Novo disparo</button>
                <button onClick={() => navigate('/campaigns')} className="flex-1 bg-accent hover:bg-accent-dim text-bg py-3 rounded-lg font-display font-bold text-sm transition-colors">Ver histórico</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-white">Novo Disparo</h1>
        <p className="text-muted text-sm font-body mt-1">Configure e envie mensagens para os contatos</p>
      </div>

      <form onSubmit={handleSend} className="space-y-6">
        {/* Identificação */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">1. Identificação</h3>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Nome do disparo (uso interno)</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Limpeza Dental - Julho"
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
            <p className="text-xs text-muted font-body mt-1">⚠️ Use o tipo no nome para o follow-up funcionar: <span className="text-accent">limpeza</span>, <span className="text-accent">clareamento</span>, <span className="text-accent">harmonizacao</span>, <span className="text-accent">implante</span></p>
          </div>
          <div>
            <label className="block text-xs text-muted font-body mb-2">Loja / número WhatsApp *</label>
            {numbers.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400" />
                <p className="text-muted text-sm font-body">Nenhum número configurado. Fale com o administrador.</p>
              </div>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {numbers.map(n => (
                  <button key={n.id} type="button" onClick={() => setForm(f => ({ ...f, number_id: n.id }))}
                    className={`flex-1 border rounded-lg px-4 py-3 text-sm font-body transition-all text-left min-w-[140px] ${form.number_id === n.id ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:border-muted'}`}>
                    <div className="font-medium">{n.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{n.phone || 'WPP configurado'}</div>
                  </button>
                ))}
              </div>
            )}
            {form.number_id && <p className="text-xs text-muted font-body mt-2 flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> {contacts.length} contatos nesta loja</p>}
          </div>
        </div>

        {/* Criativo */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">2. Criativo</h3>
          <div>
            <label className="block text-xs text-muted font-body mb-2">Imagem (opcional)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="preview" className="rounded-xl max-h-48 border border-border object-cover" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute top-2 right-2 bg-bg/80 rounded-full p-1 text-white hover:bg-red-500 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current.click()}
                className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors">
                <Image size={24} />
                <p className="text-sm font-body">Adicionar imagem</p>
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Mensagem *</label>
            <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} required
              rows={5} placeholder="Escreva a mensagem que será enviada..."
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors resize-none" />
            <p className="text-xs text-muted font-body mt-1">{form.caption.length} caracteres</p>
          </div>
        </div>

        {/* Agendamento */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">3. Quando enviar</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'now', icon: Send, label: 'Agora', desc: 'Envio imediato' },
              { value: 'scheduled', icon: Calendar, label: 'Agendado', desc: 'Em data específica' },
              { value: 'daily', icon: Clock, label: 'Por dia', desc: 'X contatos/dia' },
            ].map(({ value, icon: Icon, label, desc }) => (
              <button key={value} type="button" onClick={() => setForm(f => ({ ...f, send_mode: value }))}
                className={`border rounded-xl p-3 text-left transition-all ${form.send_mode === value ? 'border-accent bg-accent/10' : 'border-border hover:border-muted'}`}>
                <Icon size={16} className={form.send_mode === value ? 'text-accent' : 'text-muted'} />
                <p className={`text-sm font-body font-medium mt-2 ${form.send_mode === value ? 'text-accent' : 'text-white'}`}>{label}</p>
                <p className="text-xs text-muted font-body">{desc}</p>
              </button>
            ))}
          </div>

          {form.send_mode === 'scheduled' && (
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Data e hora do disparo</label>
              <input type="datetime-local" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
            </div>
          )}

          {form.send_mode === 'daily' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Contatos por dia</label>
                  <input type="number" min={10} max={500} value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: Number(e.target.value) }))}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Horário início</label>
                  <select value={form.daily_start_hour} onChange={e => setForm(f => ({ ...f, daily_start_hour: Number(e.target.value) }))}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors">
                    {[8,9,10,11,14,15,16,17,18].map(h => <option key={h} value={h}>{h}:00h</option>)}
                  </select>
                </div>
              </div>
              {contacts.length > 0 && (
                <div className="bg-surface rounded-xl p-4 space-y-1">
                  <p className="text-xs text-muted font-body">📊 Com {form.daily_limit} contatos/dia:</p>
                  <p className="text-sm text-white font-body">→ {estimatedDays} dias para enviar para todos os {contacts.length} contatos</p>
                  <p className="text-xs text-muted font-body">→ Início todos os dias às {form.daily_start_hour}:00h</p>
                </div>
              )}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-200 text-xs font-body">⚠️ O ZapFlow enviará automaticamente {form.daily_limit} mensagens por dia até terminar a lista. Recomendamos máximo 100-150/dia para evitar bloqueios.</p>
              </div>
            </div>
          )}
        </div>

        {/* Confirmar */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">4. Confirmar</h3>
          <div className="bg-surface rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm font-body"><span className="text-muted">Loja</span><span className="text-white">{selectedNumber?.label || '—'}</span></div>
            <div className="flex justify-between text-sm font-body"><span className="text-muted">Total de contatos</span><span className="text-accent font-medium">{contacts.length}</span></div>
            {form.send_mode === 'daily' && <div className="flex justify-between text-sm font-body"><span className="text-muted">Por dia</span><span className="text-white">{form.daily_limit} contatos/dia</span></div>}
            {form.send_mode === 'now' && <div className="flex justify-between text-sm font-body"><span className="text-muted">Tempo estimado</span><span className="text-white">~{Math.ceil(contacts.length * DELAY_MS / 60000)} min</span></div>}
          </div>

          {form.send_mode === 'now' && contacts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-amber-200 text-xs font-body">Não feche a janela durante o envio. O processo leva ~{Math.ceil(contacts.length * DELAY_MS / 60000)} minutos.</p>
            </div>
          )}

          <button type="submit" disabled={!form.number_id || contacts.length === 0}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-bg font-display font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-base">
            {form.send_mode === 'now' ? <><Send size={18} /> Enviar agora para {contacts.length} contatos</> :
             form.send_mode === 'daily' ? <><Clock size={18} /> Agendar disparo ({estimatedDays} dias)</> :
             <><Calendar size={18} /> Agendar disparo</>}
          </button>
        </div>
      </form>
    </div>
  )
}
