import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Image, Send, AlertCircle, CheckCircle, X, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sendImageMessage, sendTextMessage, formatPhone, sleep } from '../lib/zapi'

const DELAY_MS = 3500 // 3.5s entre mensagens (anti-ban)

export default function NewCampaign() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [numbers, setNumbers] = useState([])
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({ name: '', number_id: '', caption: '', type: 'image' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [step, setStep] = useState('compose') // compose | sending | done
  const [progress, setProgress] = useState({ sent: 0, errors: 0, total: 0, current: '' })
  const [campaignId, setCampaignId] = useState(null)
  const fileRef = useRef()
  const abortRef = useRef(false)

  const clientId = profile?.client_id

  useEffect(() => { if (clientId) { fetchNumbers() } }, [clientId])
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
    const { error } = await supabase.storage.from('creatives').upload(path, imageFile, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('creatives').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!form.number_id) return alert('Selecione uma loja.')
    if (contacts.length === 0) return alert('Nenhum contato nesta loja. Importe contatos primeiro.')
    if (form.type === 'image' && !imageFile) return alert('Selecione uma imagem.')
    if (!form.caption.trim()) return alert('Escreva a mensagem/legenda.')

    // Pega credenciais do número
    const number = numbers.find(n => n.id === form.number_id)
    if (!number?.zapi_instance_id || !number?.zapi_token) {
      return alert('Este número não tem Z-API configurado. Peça ao administrador para configurar.')
    }

    abortRef.current = false
    setStep('sending')

    // Cria campanha no banco
    const { data: campaign, error: campErr } = await supabase.from('campaigns').insert({
      client_id: clientId,
      number_id: form.number_id,
      name: form.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
      caption: form.caption,
      type: 'manual',
      status: 'sending',
      total_count: contacts.length,
      sent_count: 0,
      error_count: 0,
    }).select().single()

    if (campErr) { alert('Erro ao criar campanha: ' + campErr.message); setStep('compose'); return }
    setCampaignId(campaign.id)

    // Upload imagem se houver
    let imageUrl = null
    if (imageFile) {
      try { imageUrl = await uploadImage(campaign.id) }
      catch (err) { alert('Erro ao subir imagem: ' + err.message); setStep('compose'); return }
    }

    // Loop de envio
    let sent = 0, errors = 0
    setProgress({ sent: 0, errors: 0, total: contacts.length, current: '' })

    for (const contact of contacts) {
      if (abortRef.current) break
      const phone = formatPhone(contact.phone)
      setProgress(p => ({ ...p, current: contact.name }))

      try {
        if (imageUrl) {
          await sendImageMessage(number.zapi_instance_id, number.zapi_token, phone, imageUrl, form.caption)
        } else {
          await sendTextMessage(number.zapi_instance_id, number.zapi_token, phone, form.caption)
        }
        sent++
        await supabase.from('message_logs').insert({ campaign_id: campaign.id, client_id: clientId, contact_id: contact.id, status: 'sent', sent_at: new Date().toISOString() })
      } catch (err) {
        errors++
        await supabase.from('message_logs').insert({ campaign_id: campaign.id, client_id: clientId, contact_id: contact.id, status: 'error', error_detail: err.message })
      }

      setProgress({ sent, errors, total: contacts.length, current: contact.name })
      if (sent + errors < contacts.length) await sleep(DELAY_MS)
    }

    // Atualiza campanha
    await supabase.from('campaigns').update({
      status: abortRef.current ? 'error' : 'completed',
      sent_count: sent,
      error_count: errors,
      completed_at: new Date().toISOString(),
    }).eq('id', campaign.id)

    setProgress(p => ({ ...p, current: '' }))
    setStep('done')
  }

  const selectedNumber = numbers.find(n => n.id === form.number_id)
  const pct = progress.total > 0 ? Math.round(((progress.sent + progress.errors) / progress.total) * 100) : 0

  if (step === 'sending' || step === 'done') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          {step === 'sending' ? (
            <>
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Send size={28} className="text-accent" />
              </div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">Enviando mensagens</h2>
              <p className="text-muted text-sm font-body mb-6">Aguarde, estamos enviando para todos os contatos...</p>

              <div className="bg-surface rounded-xl p-5 mb-6 text-left space-y-3">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted">Progresso</span>
                  <span className="text-accent font-medium">{pct}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs font-body">
                  <span className="text-green-400">✓ {progress.sent} enviados</span>
                  {progress.errors > 0 && <span className="text-red-400">✗ {progress.errors} erros</span>}
                  <span className="text-muted">{progress.total} total</span>
                </div>
                {progress.current && (
                  <p className="text-xs text-muted font-body flex items-center gap-2">
                    <Clock size={12} className="animate-spin" /> Enviando para: <strong className="text-white">{progress.current}</strong>
                  </p>
                )}
              </div>

              <button onClick={() => { abortRef.current = true }} className="text-red-400 text-sm font-body hover:underline">
                Cancelar envio
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-400/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">Disparo concluído!</h2>
              <p className="text-muted text-sm font-body mb-6">
                {progress.sent} mensagens enviadas com sucesso.
                {progress.errors > 0 && ` ${progress.errors} erros.`}
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setStep('compose'); setImageFile(null); setImagePreview(null); setForm({ name: '', number_id: '', caption: '', type: 'image' }) }}
                  className="flex-1 border border-border text-white py-3 rounded-lg font-body text-sm hover:bg-surface transition-colors">
                  Novo disparo
                </button>
                <button onClick={() => navigate('/campaigns')}
                  className="flex-1 bg-accent hover:bg-accent-dim text-bg py-3 rounded-lg font-display font-bold text-sm transition-colors">
                  Ver histórico
                </button>
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
        <p className="text-muted text-sm font-body mt-1">Envie imagem e mensagem para os contatos de uma loja</p>
      </div>

      <form onSubmit={handleSend} className="space-y-6">
        {/* Nome da campanha */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">1. Identificação</h3>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Nome do disparo (uso interno)</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={`Promo ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}`}
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
          </div>

          {/* Seleção de loja */}
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Loja / número WhatsApp *</label>
            {numbers.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400" />
                <p className="text-muted text-sm font-body">Nenhum número configurado. Fale com o administrador.</p>
              </div>
            ) : (
              <div className="flex gap-3">
                {numbers.map(n => (
                  <button key={n.id} type="button" onClick={() => setForm(f => ({ ...f, number_id: n.id }))}
                    className={`flex-1 border rounded-lg px-4 py-3 text-sm font-body transition-all text-left ${
                      form.number_id === n.id ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:border-muted'
                    }`}>
                    <div className="font-medium">{n.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{n.phone || 'Número não exibido'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {form.number_id && (
            <p className="text-xs text-muted font-body flex items-center gap-1">
              <CheckCircle size={12} className="text-green-400" />
              {contacts.length} contatos nesta loja
            </p>
          )}
        </div>

        {/* Criativo */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">2. Criativo</h3>

          <div>
            <label className="block text-xs text-muted font-body mb-2">Imagem (opcional)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />

            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt="preview" className="rounded-xl max-h-64 border border-border object-cover" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute top-2 right-2 bg-bg/80 rounded-full p-1 text-white hover:bg-red-500 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current.click()}
                className="w-full h-40 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 text-muted hover:border-accent hover:text-accent transition-colors">
                <Image size={28} />
                <div className="text-center">
                  <p className="text-sm font-body">Clique para adicionar imagem</p>
                  <p className="text-xs opacity-60 mt-0.5">JPG, PNG, WEBP até 10MB</p>
                </div>
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Mensagem / legenda *</label>
            <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} required
              rows={5} placeholder="Escreva a mensagem que será enviada junto com a imagem..."
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors resize-none" />
            <p className="text-xs text-muted font-body mt-1">{form.caption.length} caracteres</p>
          </div>
        </div>

        {/* Preview & envio */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">3. Confirmar e enviar</h3>

          <div className="bg-surface rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm font-body">
              <span className="text-muted">Loja selecionada</span>
              <span className="text-white">{selectedNumber?.label || '—'}</span>
            </div>
            <div className="flex justify-between text-sm font-body">
              <span className="text-muted">Contatos no disparo</span>
              <span className="text-accent font-medium">{contacts.length}</span>
            </div>
            <div className="flex justify-between text-sm font-body">
              <span className="text-muted">Tempo estimado</span>
              <span className="text-white">~{Math.ceil(contacts.length * DELAY_MS / 60000)} min</span>
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-amber-200 text-xs font-body">
                O envio acontece com intervalo de {DELAY_MS/1000}s entre cada mensagem para evitar bloqueios. <strong>Não feche a janela</strong> durante o processo.
              </p>
            </div>
          )}

          <button type="submit" disabled={!form.number_id || contacts.length === 0}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-bg font-display font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-base">
            <Send size={18} />
            Enviar para {contacts.length} contato{contacts.length !== 1 ? 's' : ''}
          </button>
        </div>
      </form>
    </div>
  )
}
