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
    // Data e horário sempre separados (2 campos, não 1 datetime-local) —
    // pedido explícito do Leonardo pra deixar o horário óbvio e fácil de
    // ajustar, tanto pra começar quanto pra parar o disparo.
    scheduled_date: '', scheduled_time: '09:00',
    daily_limit: 100, daily_start_hour: 9,
    stop_date: '', stop_time: '18:00', // opcional — pra quando enviar até uma data/hora e parar (mesmo com contatos pendentes)
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  // Botões de resposta rápida (2026-07-03) — além de escrever "eu quero" na
  // mão, a pessoa pode tocar num botão pronto na própria mensagem. Cada
  // opção é configurável: o que acontece quando ALGUÉM clica nela.
  //   trigger_flow    -> mesmo fluxo de quem digita a palavra-chave (pergunta turno)
  //   stop_followup   -> confirma e não manda mais o follow-up desta campanha pra essa pessoa
  //   opt_out         -> descadastra de vez (igual responder "PARAR")
  //   ask_choice      -> manda uma 2ª pergunta com outros botões (ex: "qual
  //                      procedimento você prefere?"); quando a pessoa
  //                      escolhe uma das sub-opções, notifica o WhatsApp
  //                      interno (mesmo número de reply_flows.notify_phone)
  //                      pra continuar manualmente — pedido do Leonardo
  //                      pro caso da Hassum (dentista vê e agenda na mão).
  const [wantsQuickReplies, setWantsQuickReplies] = useState(false)
  const [quickReplies, setQuickReplies] = useState([
    { id: 'yes', label: 'Quero sim! 🙌', action: 'trigger_flow' },
    { id: 'no', label: 'Não quero receber esse tipo de mensagem', action: 'stop_followup' },
  ])
  function updateQuickReply(idx, patch) {
    setQuickReplies(list => list.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }
  function addQuickReply() {
    setQuickReplies(list => [...list, { id: `opt_${list.length + 1}`, label: '', action: 'trigger_flow' }])
  }
  function removeQuickReply(idx) {
    setQuickReplies(list => list.filter((_, i) => i !== idx))
  }
  function updateSubOption(idx, subIdx, patch) {
    setQuickReplies(list => list.map((q, i) => i === idx
      ? { ...q, options: (q.options || []).map((o, j) => j === subIdx ? { ...o, ...patch } : o) }
      : q))
  }
  function addSubOption(idx) {
    setQuickReplies(list => list.map((q, i) => i === idx
      ? { ...q, options: [...(q.options || []), { id: `sub_${(q.options || []).length + 1}`, label: '' }] }
      : q))
  }
  function removeSubOption(idx, subIdx) {
    setQuickReplies(list => list.map((q, i) => i === idx
      ? { ...q, options: (q.options || []).filter((_, j) => j !== subIdx) }
      : q))
  }

  // Combina data (YYYY-MM-DD) + hora (HH:MM) num Date local — os dois
  // campos precisam estar preenchidos, senão retorna null (rascunho/sem data).
  function combineDateTime(date, time) {
    if (!date) return null
    return new Date(`${date}T${time || '00:00'}:00`)
  }

  // Follow-up automático — pedido do Leonardo pra ficar embutido aqui
  // direto (não depender da tela de Automations, que ainda não está clara
  // pra ele). Dispara sozinho N dias depois de cada envio individual desta
  // campanha, pra quem não respondeu nada nesse meio tempo (mesmo motor que
  // já existia pra follow-up, só que agora configurável na hora de criar).
  const [wantsFollowUp, setWantsFollowUp] = useState(false)
  const [fuDelayDays, setFuDelayDays] = useState(2)
  const [fuCaption, setFuCaption] = useState('')
  const [fuImageFile, setFuImageFile] = useState(null)
  const [fuImagePreview, setFuImagePreview] = useState(null)
  const [fuImageUrlInput, setFuImageUrlInput] = useState('')
  const fuFileRef = useRef()
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

  function handleFuImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setFuImageFile(file)
    setFuImagePreview(URL.createObjectURL(file))
    setFuImageUrlInput('')
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
    if (wantsFollowUp && !fuCaption.trim()) return alert('Escreva a mensagem do follow-up (ou desative o follow-up).')
    const scheduledDT = combineDateTime(form.scheduled_date, form.scheduled_time)
    const stopDT = combineDateTime(form.stop_date, form.stop_time)
    if (stopDT && scheduledDT && stopDT <= scheduledDT) return alert('A data/hora de término precisa ser depois da data/hora de início.')
    if (wantsQuickReplies && quickReplies.some(q => !q.label.trim())) return alert('Preencha o texto de todos os botões de resposta rápida (ou remova o que não vai usar).')
    if (wantsQuickReplies && quickReplies.some(q => q.action === 'ask_choice' && (!q.question?.trim() || !(q.options || []).length || q.options.some(o => !o.label.trim())))) {
      return alert('Pra um botão do tipo "perguntar e continuar", preencha a pergunta e o texto de todas as sub-opções (ou remova as vazias).')
    }

    setSaving(true)

    const { data: campaign, error: campErr } = await supabase.from('campaigns').insert({
      client_id: clientId, number_id: form.number_id,
      name: form.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
      caption: form.caption, type: form.send_mode, status: 'scheduled',
      total_count: contacts.length, sent_count: 0, error_count: 0,
      daily_limit: form.send_mode === 'daily' ? Math.min(DAILY_CAP, form.daily_limit) : null,
      daily_start_hour: form.daily_start_hour,
      scheduled_for: form.send_mode === 'scheduled' ? scheduledDT.toISOString() : new Date().toISOString(),
      stop_at: stopDT ? stopDT.toISOString() : null,
      quick_replies: wantsQuickReplies ? quickReplies.filter(q => q.label.trim()) : [],
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

    // Follow-up automático (opcional) — mesma campanha-mãe, dispara sozinho
    // N dias depois de cada envio individual pra quem não respondeu nada.
    if (wantsFollowUp && fuCaption.trim()) {
      const { data: followUp, error: fuErr } = await supabase.from('campaigns').insert({
        client_id: clientId, number_id: form.number_id,
        name: `${form.name || 'Disparo'} - Follow-up (${fuDelayDays} dias)`,
        caption: fuCaption, type: 'followup', status: 'scheduled',
        follow_up_of: campaign.id, follow_up_delay_days: Number(fuDelayDays) || 2,
      }).select().single()

      if (fuErr) {
        alert('Campanha principal criada, mas o follow-up deu erro: ' + fuErr.message + '. Você pode criar depois editando esta campanha no Histórico.')
      } else if (followUp) {
        if (fuImageFile) {
          try {
            const ext = fuImageFile.name.split('.').pop()
            const path = `campaigns/${clientId}/${followUp.id}.${ext}`
            await supabase.storage.from('creatives').upload(path, fuImageFile, { upsert: true })
            const { data } = supabase.storage.from('creatives').getPublicUrl(path)
            await supabase.from('campaigns').update({ image_url: data.publicUrl }).eq('id', followUp.id)
          } catch (err) {
            alert('Follow-up criado, mas a imagem dele não subiu: ' + err.message + '. Você pode adicionar depois pelo Histórico.')
          }
        } else if (fuImageUrlInput.trim()) {
          await supabase.from('campaigns').update({ image_url: fuImageUrlInput.trim() }).eq('id', followUp.id)
        }
      }
    }

    setSaving(false)
    const fuNote = wantsFollowUp && fuCaption.trim() ? ` Follow-up configurado pra ${fuDelayDays} dia(s) depois, pra quem não responder.` : ''
    alert((form.send_mode === 'scheduled'
      ? `✅ Campanha agendada! Dispara automaticamente a partir de ${scheduledDT.toLocaleString('pt-BR')}, no máximo ${DAILY_CAP}/dia.`
      : `✅ Campanha configurada! Envia até ${Math.min(DAILY_CAP, form.daily_limit)} contatos/dia a partir de amanhã.`) + fuNote)
    navigate('/campaigns')
  }

  const selectedNumber = numbers.find(n => n.id === form.number_id)
  const estimatedDays = form.send_mode === 'daily' ? Math.ceil(contacts.length / Math.min(DAILY_CAP, form.daily_limit)) : null
  const stopDTPreview = combineDateTime(form.stop_date, form.stop_time)

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
              rows={5} placeholder={"Ex: {Oi|Olá|E aí}, {{nome}}! {Temos uma novidade|Chegou uma oferta} pra você..."}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors resize-none" />
            <p className="text-xs text-muted font-body mt-1">{form.caption.length} caracteres</p>
            <div className="bg-surface rounded-lg p-3 mt-2 space-y-1">
              <p className="text-xs text-white font-body font-medium">💡 Variação de mensagem (recomendado para listas grandes)</p>
              <p className="text-xs text-muted font-body"><code className="text-accent">{'{{nome}}'}</code> vira o nome do contato. <code className="text-accent">{'{opção1|opção2|opção3}'}</code> escolhe uma das opções aleatoriamente para cada pessoa — assim ninguém recebe exatamente a mesma frase, o que ajuda a não parecer disparo em massa pro WhatsApp.</p>
              <p className="text-xs text-muted font-body">Ex: <code className="text-accent">{'{Oi|Olá}, {{nome}}! {Tudo bem?|Como vai?}'}</code></p>
            </div>
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
              <label className="block text-xs text-muted font-body mb-1.5">Data e horário do disparo</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
                <input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
              </div>
              {contacts.length > DAILY_CAP && (
                <p className="text-xs text-amber-300 font-body mt-2">⚠️ {contacts.length} contatos, mas o limite é {DAILY_CAP}/dia — vai levar ~{Math.ceil(contacts.length / DAILY_CAP)} dias pra alcançar todo mundo, começando na data/horário marcados.</p>
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

          <div className="pt-2 border-t border-border">
            <label className="block text-xs text-muted font-body mb-1.5">Parar de enviar em (data e horário, opcional)</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={form.stop_date} onChange={e => setForm(f => ({ ...f, stop_date: e.target.value }))}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
              <input type="time" value={form.stop_time} onChange={e => setForm(f => ({ ...f, stop_time: e.target.value }))} disabled={!form.stop_date}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors disabled:opacity-40" />
            </div>
            <p className="text-xs text-muted font-body mt-1.5">
              {form.send_mode === 'daily'
                ? 'Sem isso, a campanha continua todo dia até enviar pra toda a lista — pode levar semanas com listas grandes. Marque uma data se quiser interromper antes disso (ex: fim de uma promoção), mesmo que ainda falte gente.'
                : 'Deixe em branco pra continuar tentando alcançar todo mundo até o fim da lista, mesmo que leve mais de um dia por causa do limite diário.'}
            </p>
          </div>
        </div>

        {/* Respostas rápidas (opcional) */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">4. Respostas rápidas (opcional)</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted font-body">{wantsQuickReplies ? 'Sim' : 'Não'}</span>
              <div onClick={() => setWantsQuickReplies(v => !v)}
                className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${wantsQuickReplies ? 'bg-accent' : 'bg-border'}`}>
                <div className={`w-4 h-4 bg-[#ffffff] rounded-full absolute top-1 transition-all ${wantsQuickReplies ? 'left-5' : 'left-1'}`} />
              </div>
            </label>
          </div>
          <p className="text-xs text-muted font-body -mt-2">Manda a mensagem junto com botões prontos pra pessoa tocar, sem precisar escrever nada — além disso, quem <strong className="text-white">digitar</strong> a palavra-chave (ex: "eu quero") continua funcionando normalmente também.</p>

          {wantsQuickReplies && (
            <div className="space-y-3 pt-2 border-t border-border">
              {quickReplies.map((q, idx) => (
                <div key={idx} className="bg-surface border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={q.label} onChange={e => updateQuickReply(idx, { label: e.target.value })}
                      placeholder="Texto do botão"
                      className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
                    <button type="button" onClick={() => removeQuickReply(idx)}
                      className="text-muted hover:text-red-400 p-2 shrink-0" title="Remover botão"><X size={14} /></button>
                  </div>
                  <div>
                    <label className="block text-xs text-muted font-body mb-1">Quando alguém tocar aqui:</label>
                    <select value={q.action} onChange={e => updateQuickReply(idx, { action: e.target.value })}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-white font-body focus:outline-none focus:border-accent transition-colors">
                      <option value="trigger_flow">Continuar o fluxo normal (pergunta o turno, igual "eu quero")</option>
                      <option value="stop_followup">Parar o follow-up automático desta campanha pra essa pessoa</option>
                      <option value="opt_out">Descadastrar de vez (igual responder "PARAR")</option>
                      <option value="ask_choice">Perguntar outra coisa com novos botões, e depois notificar pra continuar na mão</option>
                    </select>
                  </div>

                  {q.action === 'ask_choice' && (
                    <div className="space-y-2 pl-3 border-l-2 border-accent/30">
                      <div>
                        <label className="block text-xs text-muted font-body mb-1">Pergunta enviada (com as sub-opções abaixo como botões)</label>
                        <input value={q.question || ''} onChange={e => updateQuickReply(idx, { question: e.target.value })}
                          placeholder='Ex: Qual procedimento você prefere?'
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs text-muted font-body">Sub-opções (botões da 2ª pergunta)</label>
                        {(q.options || []).map((o, subIdx) => (
                          <div key={subIdx} className="flex items-center gap-2">
                            <input value={o.label} onChange={e => updateSubOption(idx, subIdx, { label: e.target.value })}
                              placeholder="Ex: Clareamento"
                              className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
                            <button type="button" onClick={() => removeSubOption(idx, subIdx)}
                              className="text-muted hover:text-red-400 p-1 shrink-0" title="Remover"><X size={12} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addSubOption(idx)}
                          className="text-xs text-accent hover:underline font-body">+ Adicionar sub-opção</button>
                      </div>
                      <p className="text-xs text-muted font-body">Quando a pessoa escolher uma sub-opção, o WhatsApp interno (configurado em "Resposta automática" no Histórico → notificação) recebe o nome, telefone e a escolha, pra continuar o atendimento manualmente.</p>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" onClick={addQuickReply}
                className="text-xs text-accent hover:underline font-body">+ Adicionar outro botão</button>
              <div className="bg-surface rounded-lg p-3">
                <p className="text-xs text-muted font-body">💡 Independente do botão escolhido, tocar em qualquer um deles já conta como resposta — então o follow-up automático nunca dispara pra quem interagiu, mesmo que a ação escolhida não seja "Parar o follow-up". Quem não tocar em nada e não escrever nada continua no follow-up normalmente.</p>
              </div>
            </div>
          )}
        </div>

        {/* Follow-up automático (opcional) */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">5. Follow-up automático (opcional)</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted font-body">{wantsFollowUp ? 'Sim' : 'Não'}</span>
              <div onClick={() => setWantsFollowUp(v => !v)}
                className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${wantsFollowUp ? 'bg-accent' : 'bg-border'}`}>
                <div className={`w-4 h-4 bg-[#ffffff] rounded-full absolute top-1 transition-all ${wantsFollowUp ? 'left-5' : 'left-1'}`} />
              </div>
            </label>
          </div>
          <p className="text-xs text-muted font-body -mt-2">Manda uma segunda mensagem sozinho, alguns dias depois, só pra quem <strong className="text-white">não respondeu nada</strong> desde o disparo principal. (A tela de Automations ainda vai passar por uma revisão — por enquanto, configure o follow-up direto por aqui.)</p>

          {wantsFollowUp && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-xs text-muted font-body mb-1.5">Quantos dias depois do envio principal</label>
                <input type="number" min={1} max={30} value={fuDelayDays} onChange={e => setFuDelayDays(e.target.value)}
                  className="w-32 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
              </div>

              <div>
                <label className="block text-xs text-muted font-body mb-1.5">Mensagem do follow-up *</label>
                <textarea value={fuCaption} onChange={e => setFuCaption(e.target.value)}
                  rows={4} placeholder={"Ex: {Oi|Olá}, {{nome}}! Passando rapidinho pra saber se ainda tem interesse..."}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors resize-none" />
                <p className="text-xs text-muted font-body mt-1">Mesma sintaxe da mensagem principal: <code className="text-accent">{'{{nome}}'}</code> e <code className="text-accent">{'{opção1|opção2}'}</code>.</p>
              </div>

              <div>
                <label className="block text-xs text-muted font-body mb-2">Imagem do follow-up (opcional, pode ser diferente da principal)</label>
                <input ref={fuFileRef} type="file" accept="image/*" onChange={handleFuImage} className="hidden" />
                {fuImagePreview ? (
                  <div className="relative inline-block">
                    <img src={fuImagePreview} alt="preview" className="rounded-xl max-h-40 border border-border object-contain bg-black/20" />
                    <button type="button" onClick={() => { setFuImageFile(null); setFuImagePreview(null) }}
                      className="absolute top-2 right-2 bg-bg/80 rounded-full p-1 text-white hover:bg-red-500 transition-colors"><X size={14} /></button>
                  </div>
                ) : fuImageUrlInput.trim() ? (
                  <div className="relative inline-block">
                    <img src={fuImageUrlInput.trim()} alt="preview" className="rounded-xl max-h-40 border border-border object-contain bg-black/20" onError={e => { e.target.style.display = 'none' }} />
                    <button type="button" onClick={() => setFuImageUrlInput('')}
                      className="absolute top-2 right-2 bg-bg/80 rounded-full p-1 text-white hover:bg-red-500 transition-colors"><X size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fuFileRef.current.click()}
                    className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1 text-muted hover:border-accent hover:text-accent transition-colors">
                    <Image size={20} />
                    <p className="text-xs font-body">Adicionar imagem</p>
                  </button>
                )}
                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 h-px bg-border" /><span className="text-xs text-muted font-body">ou</span><div className="flex-1 h-px bg-border" />
                </div>
                <input type="url" value={fuImageUrlInput} onChange={e => { setFuImageUrlInput(e.target.value); if (e.target.value) { setFuImageFile(null); setFuImagePreview(null) } }}
                  placeholder="Cola aqui o link de uma imagem"
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
              </div>
            </div>
          )}
        </div>

        {/* Confirmar */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white text-sm uppercase tracking-wide">6. Confirmar</h3>
          <div className="bg-surface rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm font-body"><span className="text-muted">Loja</span><span className="text-white">{selectedNumber?.label || '—'}</span></div>
            <div className="flex justify-between text-sm font-body"><span className="text-muted">Total de contatos</span><span className="text-accent font-medium">{contacts.length}</span></div>
            {form.send_mode === 'daily' && <div className="flex justify-between text-sm font-body"><span className="text-muted">Por dia</span><span className="text-white">{form.daily_limit} contatos/dia</span></div>}
            {stopDTPreview && <div className="flex justify-between text-sm font-body"><span className="text-muted">Para de enviar em</span><span className="text-white">{stopDTPreview.toLocaleString('pt-BR')}</span></div>}
            {wantsFollowUp && <div className="flex justify-between text-sm font-body"><span className="text-muted">Follow-up</span><span className="text-white">{fuDelayDays} dia(s) depois, se não responder</span></div>}
            {wantsQuickReplies && <div className="flex justify-between text-sm font-body"><span className="text-muted">Botões de resposta</span><span className="text-white">{quickReplies.filter(q => q.label.trim()).length}</span></div>}
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
