import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Image, AlertCircle, CheckCircle, X, Clock, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const DAILY_CAP = 100

// Disparo manual "agora" foi removido de propósito (2026-07-01, pedido do
// Leonardo): todo disparo passa pelo motor automático (run-automations),
// que já respeita o limite diário de 100/número — nunca manda tudo de
// uma vez direto do navegador. Vale pra todos os planos, sem exceção.
export default function NewCampaign() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [numbers, setNumbers] = useState([])
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({
    name: '', number_id: '', caption: '',
    send_mode: 'scheduled', // 'scheduled' | 'daily'
    scheduled_date: '', daily_limit: 100, daily_start_hour: 9
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()
  const clientId = profile?.client_id

  useEffect(() => { if (clientId) fetchNumbers() }, [clientId])
  useEffect(() => { if (form.number_id) fetchContacts() }, [form.number_id])

  async function fetchNumbers() {
    // Não seleciona zapi_token/zapi_instance_id: o envio é 100% no
    // servidor (Edge Function send-message + run-automations) — o
    // navegador do cliente nunca precisa ver o token da Z-API.
    const { data } = await supabase.from('client_numbers').select('id, client_id, label, phone, active').eq('client_id', clientId).eq('active', true)
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
    setImageUrlInput('')
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
    if (form.send_mode === 'scheduled' && !form.scheduled_date) return alert('Escolha a data e hora do disparo (ou deixe como rascunho e agende depois pelo Histórico).')

    setSaving(true)

    const { data: campaign, error: campErr } = await supabase.from('campaigns').insert({
      client_id: clientId, number_id: form.number_id,
      name: form.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
      caption: form.caption, type: form.send_mode, status: 'scheduled',
      total_count: contacts.length, sent_count: 0, error_count: 0,
      daily_limit: form.send_mode === 'daily' ? Math.min(DAILY_CAP, form.daily_limit) : null,
      daily_start_hour: form.daily_start_hour,
      scheduled_for: form.send_mode === 'scheduled' ? new Date(form.scheduled_date).toISOString() : new Date().toISOString(),
    }).select().single()

    if (campErr) { alert('Erro ao criar campanha: ' + campErr.message); setSaving(false); return }

    if (imageFile) {
      try {
        const imageUrl = await uploadImage(campaign.id)
        await supabase.from('campaigns').update({ image_url: imageUrl }).eq('id', campaign.id)
      } catch (err) {
        alert('Campanha criada, mas a imagem não subiu: ' + err.message + '. Você pode adicionar depois pelo Histórico.')
      }
    } else if (imageUrlInput.trim()) {
      // Link direto de imagem (ex: copiado da página Criativos) — não
      // precisa de upload, só grava a URL na campanha.
      await supabase.from('campaigns').update({ image_url: imageUrlInput.trim() }).eq('id', campaign.id)
    }

    setSaving(false)
    alert(form.send_mode === 'scheduled'
      ? `✅ Campanha agendada! Dispara automaticamente a partir de ${new Date(form.scheduled_date).toLocaleString('pt-BR')}, no máximo ${DAILY_CAP}/dia.`
      : `✅ Campanha configurada! Envia até ${Math.min(DAILY_CAP, form.daily_limit)} contatos/dia a partir de amanhã.`)
    navigate('/campaigns')
  }

  const selectedNumber = numbers.find(n => n.id === form.number_id)
  const estimatedDays = form.send_mode === 'daily' ? Math.ceil(contacts.length / Math.min(DAILY_CAP, form.daily_limit)) : null

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-white">Novo Disparo</h1>
        <p className="text-muted text-sm font-body mt-1">Configure a campanha — o envio roda sozinho, respeitando o limite diário</p>
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
                <img src={imagePreview} alt="preview" className="rounded-xl max-h-48 border border-border object-contain bg-black/20" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute top-2 right-2 bg-bg/80 rounded-full p-1 text-white hover:bg-red-500 transition-colors"><X size={14} /></button>
              </div>
            ) : imageUrlInput.trim() ? (
              <div className="relative inline-block">
                <img src={imageUrlInput.trim()} alt="preview" className="rounded-xl max-h-48 border border-border object-contain bg-black/20" onError={e => { e.target.style.display = 'none' }} />
                <button type="button" onClick={() => setImageUrlInput('')}
                  className="absolute top-2 right-2 bg-bg/80 rounded-full p-1 text-white hover:bg-red-500 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current.click()}
                className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors">
                <Image size={24} />
                <p className="text-sm font-body">Adicionar imagem</p>
              </button>
            )}
            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-border" /><span className="text-xs text-muted font-body">ou</span><div className="flex-1 h-px bg-border" />
            </div>
            <input type="url" value={imageUrlInput} onChange={e => { setImageUrlInput(e.target.value); if (e.target.value) { setImageFile(null); setImagePreview(null) } }}
              placeholder="Cola aqui o link de uma imagem (ex: copiado da página Criativos)"
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
            <p className="text-xs text-muted font-body mt-1.5">Prefere reaproveitar uma imagem já enviada? Sobe em <strong className="text-white">Criativos</strong>, copia o link e cola aqui — ou anexa um arquivo novo acima.</p>
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
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'scheduled', icon: Calendar, label: 'Agendado', desc: 'Em data específica' },
              { value: 'daily', icon: Clock, label: 'Por dia', desc: 'X contatos/dia até acabar' },
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
              {contacts.length > DAILY_CAP && (
                <p className="text-xs text-amber-300 font-body mt-2">⚠️ {contacts.length} contatos, mas o limite é {DAILY_CAP}/dia — vai levar ~{Math.ceil(contacts.length / DAILY_CAP)} dias pra alcançar todo mundo, começando na data marcada.</p>
              )}
            </div>
          )}

          {form.send_mode === 'daily' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Contatos por dia</label>
                  <input type="number" min={10} max={DAILY_CAP} value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: Math.min(DAILY_CAP, Number(e.target.value)) }))}
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
                <p className="text-amber-200 text-xs font-body">⚠️ Trava em no máximo {DAILY_CAP} mensagens por dia por número — mesmo somando com outras campanhas ou automações ativas ao mesmo tempo — pra esse número nunca correr risco de bloqueio no WhatsApp.</p>
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
          </div>

          <button type="submit" disabled={!form.number_id || contacts.length === 0 || saving}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-bg font-display font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-base">
            {saving ? 'Salvando...' : form.send_mode === 'daily' ? <><Clock size={18} /> Agendar disparo ({estimatedDays} dias)</> : <><Calendar size={18} /> Agendar disparo</>}
          </button>
        </div>
      </form>
    </div>
  )
}
