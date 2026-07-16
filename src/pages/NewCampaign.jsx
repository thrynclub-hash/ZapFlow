import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Image, AlertCircle, CheckCircle, X, Clock, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sleep, generateId } from '../lib/zapi'

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
  // Público-alvo por tag (2026-07-06) — pedido do Leonardo pra poder taguear
  // o próprio número de teste e disparar só pra essa tag, sem mandar pra
  // toda a lista. Mesmo padrão já usado na edição de campanha (Campaigns.jsx)
  // e já consumido no motor (run-automations faz .overlaps('tags', target_tags)).
  const [availableTags, setAvailableTags] = useState([])
  const [targetTags, setTargetTags] = useState([])
  const [form, setForm] = useState({
    name: '', number_id: '', caption: '',
    send_mode: 'scheduled', // 'scheduled' | 'daily'
    // Data e horário sempre separados (2 campos, não 1 datetime-local) —
    // pedido explícito do Leonardo pra deixar o horário óbvio e fácil de
    // ajustar, tanto pra começar quanto pra parar o disparo.
    scheduled_date: '', scheduled_time: '09:00',
    daily_limit: 100,
    stop_date: '', stop_time: '18:00', // opcional — pra quando enviar até uma data/hora e parar (mesmo com contatos pendentes)
    // Janela de horário comercial (2026-07-03) — vale pra AMBOS os modos
    // (agendado e por dia), não só "por dia": o motor espalha os envios
    // proporcionalmente ao longo dessa janela em vez de mandar tudo de
    // rajada assim que a campanha vira elegível. Pedido real do Leonardo:
    // "a clínica abre de seg a sexta das 9 as 17, devia dividir o intervalo".
    daily_start_hour: 9, daily_end_hour: 18, weekdays_only: true,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  // Envio de teste imediato (2026-07-06) — pedido do Leonardo pra poder
  // taguear o próprio número e mandar na hora, sem esperar agendamento nem
  // o ciclo do cron, pra validar a integração Z-API de ponta a ponta. Só
  // habilitado quando alguma tag está marcada (nunca "todos os contatos"),
  // pra não virar um jeito de furar o motor automático com a lista toda.
  const [sendingNow, setSendingNow] = useState(false)
  const fileRef = useRef()

  // Botões de resposta rápida (2026-07-03) — além de escrever "eu quero" na
  // mão, a pessoa pode tocar num botão pronto na própria mensagem. Cada
  // opção é configurável: o que acontece quando ALGUÉM clica nela.
  //   trigger_flow    -> mesmo fluxo de quem digita a palavra-chave (pergunta turno,
  //                      manhã/tarde) — esse fluxo é ÚNICO por cliente (reply_flows,
  //                      configurado em "Resposta automática" no Histórico) e nasceu
  //                      pensado pra Clínica Hassum (agendamento de consulta). Faz
  //                      sentido só pra quem realmente pergunta turno de atendimento.
  //   send_message    -> (2026-07-16) manda uma mensagem livre, definida aqui na
  //                      própria campanha — pro caso de clientes como a Sodie, que
  //                      não usam o fluxo de agendamento da Hassum e só querem
  //                      responder alguma coisa própria quando alguém tocar no botão.
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
    { id: 'yes', label: 'Quero sim! 🙌', action: 'send_message', message: '' },
    { id: 'no', label: 'Não quero receber esse tipo de mensagem', action: 'stop_followup' },
  ])
  function updateQuickReply(idx, patch) {
    setQuickReplies(list => list.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }
  function addQuickReply() {
    setQuickReplies(list => [...list, { id: generateId('opt'), label: '', action: 'send_message', message: '' }])
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
      ? { ...q, options: [...(q.options || []), { id: generateId('sub'), label: '' }] }
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
  // Limite diário + controle de início do follow-up (2026-07-13, pedido do
  // Leonardo depois de achar os follow-ups da Hassum travados sem nenhum
  // limite configurável): default 50/dia, mais conservador que os 100 da
  // campanha principal, e configurável igual a ela. fuStartActive=false
  // cria o follow-up já pausado ('stopped'), pra poder ativar quando quiser
  // pelo botão "Retomar" no Histórico, em vez de começar sozinho assim que
  // os primeiros contatos baterem o prazo de dias sem resposta.
  const [fuDailyLimit, setFuDailyLimit] = useState(50)
  const [fuStartActive, setFuStartActive] = useState(true)
  const [fuCaption, setFuCaption] = useState('')
  const [fuImageFile, setFuImageFile] = useState(null)
  const [fuImagePreview, setFuImagePreview] = useState(null)
  const [fuImageUrlInput, setFuImageUrlInput] = useState('')
  const fuFileRef = useRef()
  const clientId = profile?.client_id

  useEffect(() => { if (clientId) fetchNumbers() }, [clientId])
  useEffect(() => { if (form.number_id) { fetchContacts(); fetchAvailableTags() } }, [form.number_id])

  async function fetchNumbers() {
    // Não seleciona zapi_token/zapi_instance_id: o envio é 100% no
    // servidor (Edge Function send-message + run-automations) — o
    // navegador do cliente nunca precisa ver o token da Z-API.
    const { data } = await supabase.from('client_numbers').select('id, client_id, label, phone, active').eq('client_id', clientId).eq('active', true)
    setNumbers(data || [])
  }

  // Paginado (2026-07-06) — mesmo bug do teto de 1000 linhas já corrigido
  // no Histórico (Reports.jsx): sem isso, cliente com mais de 1000 contatos
  // nunca via os últimos (nem no total_count, nem no filtro por tag, nem
  // em quem realmente recebe no "Enviar agora").
  async function fetchContacts() {
    let all = [], from = 0
    while (true) {
      const { data } = await supabase.from('contacts').select('*').eq('client_id', clientId).eq('number_id', form.number_id).range(from, from + 999)
      all = all.concat(data || [])
      if (!data || data.length < 1000) break
      from += 1000
    }
    setContacts(all)
  }

  // Tags em uso nos contatos desta loja — paginado porque select() sem
  // range() trava em 1000 linhas por padrão no Supabase (mesmo bug já
  // corrigido no Histórico).
  async function fetchAvailableTags() {
    let all = [], from = 0
    while (true) {
      const { data } = await supabase.from('contacts').select('tags').eq('client_id', clientId).eq('number_id', form.number_id).range(from, from + 999)
      all = all.concat(data || [])
      if (!data || data.length < 1000) break
      from += 1000
    }
    const found = Array.from(new Set(all.flatMap(c => Array.isArray(c.tags) ? c.tags : [])))
    const ordered = [...['Antigo', 'Novo'].filter(t => found.includes(t)), ...found.filter(t => t !== 'Antigo' && t !== 'Novo').sort()]
    setAvailableTags(ordered)
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
    if (filteredContacts.length === 0) return alert(targetTags.length > 0 ? 'Nenhum contato com essa(s) tag(s) nesta loja.' : 'Nenhum contato nesta loja.')
    if (!form.caption.trim()) return alert('Escreva a mensagem.')
    if (form.send_mode === 'scheduled' && !form.scheduled_date) return alert('Escolha a data e hora do disparo (ou deixe como rascunho e agende depois pelo Histórico).')
    if (wantsFollowUp && !fuCaption.trim()) return alert('Escreva a mensagem do follow-up (ou desative o follow-up).')
    const scheduledDT = combineDateTime(form.scheduled_date, form.scheduled_time)
    const stopDT = combineDateTime(form.stop_date, form.stop_time)
    if (stopDT && scheduledDT && stopDT <= scheduledDT) return alert('A data/hora de término precisa ser depois da data/hora de início.')
    if (Number(form.daily_end_hour) <= Number(form.daily_start_hour)) return alert('O horário de fim da janela de envio precisa ser depois do horário de início.')
    if (wantsQuickReplies && quickReplies.some(q => !q.label.trim())) return alert('Preencha o texto de todos os botões de resposta rápida (ou remova o que não vai usar).')
    if (wantsQuickReplies && quickReplies.some(q => q.action === 'ask_choice' && (!q.question?.trim() || !(q.options || []).length || q.options.some(o => !o.label.trim())))) {
      return alert('Pra um botão do tipo "perguntar e continuar", preencha a pergunta e o texto de todas as sub-opções (ou remova as vazias).')
    }
    if (wantsQuickReplies && quickReplies.some(q => q.action === 'send_message' && !q.message?.trim())) {
      return alert('Pra um botão do tipo "mandar mensagem personalizada", preencha a mensagem que vai ser enviada.')
    }

    setSaving(true)

    const { data: campaign, error: campErr } = await supabase.from('campaigns').insert({
      client_id: clientId, number_id: form.number_id,
      name: form.name || `Disparo ${new Date().toLocaleDateString('pt-BR')}`,
      caption: form.caption, type: form.send_mode, status: 'scheduled',
      total_count: filteredContacts.length, sent_count: 0, error_count: 0,
      target_tags: targetTags.length > 0 ? targetTags : null,
      daily_limit: Math.min(DAILY_CAP, form.daily_limit),
      daily_start_hour: form.daily_start_hour,
      daily_end_hour: form.daily_end_hour,
      weekdays_only: form.weekdays_only,
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
        caption: fuCaption, type: 'followup', status: fuStartActive ? 'scheduled' : 'stopped',
        follow_up_of: campaign.id, follow_up_delay_days: Number(fuDelayDays) || 2,
        // Mesmo limite/janela/dias-úteis que a campanha principal usa como
        // ponto de partida — dá pra ajustar depois pelo Histórico > Editar.
        daily_limit: Math.min(100, Number(fuDailyLimit) || 50),
        daily_start_hour: form.daily_start_hour,
        daily_end_hour: form.daily_end_hour,
        weekdays_only: form.weekdays_only,
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

  // Mesma substituição de {{nome}} que o run-automations faz (personalize())
  // — precisa rodar ANTES de chamar send-message, porque lá o spintax
  // {opção1|opção2} já roda em cima do texto, e {{nome}} sem substituir
  // vira confusão com chave dupla.
  function personalizeMessage(rawMessage, contactName) {
    return (rawMessage || '').replace(/\{\{\s*nome\s*\}\}/gi, contactName || '')
  }

  // Envio de teste imediato — usa a mesma Edge Function send-message do
  // disparo manual (token da Z-API nunca sai do servidor, mesmo limite
  // diário de 100/dia por número vale aqui também). Só existe quando há
  // tag marcada, de propósito, pra nunca virar um "manda pra todo mundo
  // agora" por engano.
  async function handleSendNow() {
    if (!form.number_id) return alert('Selecione uma loja.')
    if (targetTags.length === 0) return alert('O envio imediato só funciona com pelo menos uma tag marcada (é pra teste, não pra disparo em massa).')
    if (filteredContacts.length === 0) return alert('Nenhum contato com essa(s) tag(s) nesta loja.')
    if (!form.caption.trim()) return alert('Escreva a mensagem.')
    if (!confirm(`Enviar AGORA (sem agendar) para ${filteredContacts.length} contato(s) com a tag "${targetTags.join(', ')}"?`)) return

    setSendingNow(true)

    let imageUrl = null
    if (imageFile) {
      try { imageUrl = await uploadImage(`teste-${Date.now()}`) }
      catch (err) { alert('A imagem não subiu (' + err.message + ') — enviando só o texto.') }
    } else if (imageUrlInput.trim()) {
      imageUrl = imageUrlInput.trim()
    }

    const { data: campaign, error: campErr } = await supabase.from('campaigns').insert({
      client_id: clientId, number_id: form.number_id,
      name: form.name || `Teste (${targetTags.join(', ')}) - ${new Date().toLocaleDateString('pt-BR')}`,
      caption: form.caption, type: 'scheduled', status: 'sending',
      total_count: filteredContacts.length, sent_count: 0, error_count: 0,
      scheduled_for: new Date().toISOString(),
      target_tags: targetTags,
      image_url: imageUrl,
      quick_replies: wantsQuickReplies ? quickReplies.filter(q => q.label.trim()) : [],
    }).select().single()

    if (campErr) { alert('Erro ao criar a campanha de teste: ' + campErr.message); setSendingNow(false); return }

    let sent = 0, errors = 0, capHit = false
    for (const contact of filteredContacts) {
      if (capHit) break
      const message = personalizeMessage(form.caption, contact.name)
      const { data } = await supabase.functions.invoke('send-message', {
        body: { number_id: form.number_id, phone: contact.phone, message, image_url: imageUrl || undefined, contact_id: contact.id, campaign_id: campaign.id },
      })
      if (data?.error === 'LIMITE_DIARIO_ATINGIDO') { capHit = true; break }
      if (!data?.error) sent++; else errors++
      await sleep(3500)
    }

    await supabase.from('campaigns').update({ status: 'completed', sent_count: sent, error_count: errors }).eq('id', campaign.id)

    setSendingNow(false)
    alert(capHit
      ? `Limite diário de ${DAILY_CAP} mensagens atingido neste número. ${sent} enviada(s) agora — o resto não foi enviado (tenta de novo amanhã).`
      : `${sent} mensagem(ns) enviada(s) agora!${errors > 0 ? ` ${errors} com erro — confira no Histórico.` : ''}`)
    navigate('/campaigns')
  }

  const selectedNumber = numbers.find(n => n.id === form.number_id)
  // Contatos que realmente vão receber o disparo — se alguma tag estiver
  // marcada, filtra pra bater exatamente com o que o run-automations vai
  // aplicar depois (.overlaps('tags', target_tags)).
  const filteredContacts = targetTags.length > 0 ? contacts.filter(c => Array.isArray(c.tags) && c.tags.some(t => targetTags.includes(t))) : contacts
  const estimatedDays = form.daily_limit > 0 ? Math.ceil(filteredContacts.length / Math.min(DAILY_CAP, form.daily_limit)) : 0
  const estimatedWeeks = (estimatedDays / 7).toFixed(1)
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
                  <button key={n.id} type="button" onClick={() => { setForm(f => ({ ...f, number_id: n.id })); setTargetTags([]) }}
                    className={`flex-1 border rounded-lg px-4 py-3 text-sm font-body transition-all text-left min-w-[140px] ${form.number_id === n.id ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:border-muted'}`}>
                    <div className="font-medium">{n.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{n.phone || 'WPP configurado'}</div>
                  </button>
                ))}
              </div>
            )}
            {form.number_id && <p className="text-xs text-muted font-body mt-2 flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> {contacts.length} contatos nesta loja</p>}
          </div>

          {form.number_id && (
            <div className="pt-3 border-t border-border">
              <label className="block text-xs text-muted font-body mb-2">Público-alvo (por tag do contato)</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.length === 0 && <span className="text-xs text-muted font-body">Nenhuma tag em uso ainda nos contatos desta loja.</span>}
                {availableTags.map(t => (
                  <button key={t} type="button"
                    onClick={() => setTargetTags(ts => ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${targetTags.includes(t) ? 'bg-accent text-bg border-accent font-bold' : 'border-border text-muted hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted font-body mt-1.5">
                {targetTags.length === 0
                  ? 'Nenhuma tag marcada — vai pra todos os contatos ativos desta loja.'
                  : `Vai só pra quem tem ${targetTags.length > 1 ? 'QUALQUER uma das tags marcadas' : `a tag "${targetTags[0]}"`} — ${filteredContacts.length} contato(s).`}
              </p>
            </div>
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
            </div>
          )}

          {/* Contatos por dia — vale pros dois modos (Agendado e Por dia).
              Pedido do Leonardo: poder escolher um ritmo mais devagar que o
              teto de 100/dia (10/20/30/50) por segurança extra, e ver quanto
              tempo (dias/semanas) vai levar pra alcançar todo mundo. */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Contatos por dia (segurança — máximo {DAILY_CAP})</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[10, 20, 30, 50, 75, 100].map(n => (
                  <button key={n} type="button" onClick={() => setForm(f => ({ ...f, daily_limit: n }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${Number(form.daily_limit) === n ? 'bg-accent text-bg border-accent font-bold' : 'border-border text-muted hover:text-white'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <input type="number" min={1} max={DAILY_CAP} value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: Math.min(DAILY_CAP, Number(e.target.value)) }))}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
            </div>
            {filteredContacts.length > 0 && (
              <div className="bg-surface rounded-xl p-4 space-y-1">
                <p className="text-xs text-muted font-body">📊 Com {form.daily_limit} contatos/dia:</p>
                <p className="text-sm text-white font-body">→ {estimatedDays} dia(s) ({estimatedWeeks} semana(s)) para enviar para todos os {filteredContacts.length} contatos</p>
              </div>
            )}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-amber-200 text-xs font-body">⚠️ Trava em no máximo {DAILY_CAP} mensagens por dia por número — mesmo somando com outras campanhas ou automações ativas ao mesmo tempo — pra esse número nunca correr risco de bloqueio no WhatsApp. Desse total, o disparo em massa usa no máximo {DAILY_CAP - 10}/dia — as últimas 10 vagas ficam reservadas pra responder automaticamente quem interagir na hora (ex: clicar "eu quero").</p>
            </div>
          </div>

          {/* Janela de envio — vale pros dois modos (Agendado e Por dia):
              em vez de mandar tudo de rajada assim que a campanha vira
              elegível, o motor espalha os envios proporcionalmente dentro
              desta janela de horário. Pedido real do Leonardo: "a clínica
              abre de seg a sexta das 9 as 17, devia dividir o intervalo". */}
          <div className="pt-2 border-t border-border space-y-3">
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Janela de envio (espalha as mensagens ao longo do dia, em vez de mandar tudo de uma vez)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted font-body mb-1">Começa às</label>
                  <select value={form.daily_start_hour} onChange={e => setForm(f => ({ ...f, daily_start_hour: Number(e.target.value) }))}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors">
                    {Array.from({ length: 24 }, (_, h) => h).map(h => <option key={h} value={h}>{h}:00h</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted font-body mb-1">Termina às</label>
                  <select value={form.daily_end_hour} onChange={e => setForm(f => ({ ...f, daily_end_hour: Number(e.target.value) }))}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors">
                    {Array.from({ length: 24 }, (_, h) => h).map(h => <option key={h} value={h}>{h}:00h</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted font-body mt-1.5">Ex: clínica que atende das 9h às 17h — as mensagens do dia saem espalhadas nesse intervalo (proporcional ao horário), não tudo de uma vez às 9h em ponto.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.weekdays_only} onChange={e => setForm(f => ({ ...f, weekdays_only: e.target.checked }))} className="accent-accent" />
              <span className="text-xs text-white font-body">Só dias úteis (pula sábado e domingo)</span>
            </label>
          </div>

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
                      <option value="send_message">Mandar uma mensagem personalizada (livre, escrita abaixo)</option>
                      <option value="trigger_flow">Continuar o fluxo de agendamento (pergunta manhã/tarde — configurado em "Resposta automática")</option>
                      <option value="stop_followup">Parar o follow-up automático desta campanha pra essa pessoa</option>
                      <option value="opt_out">Descadastrar de vez (igual responder "PARAR")</option>
                      <option value="ask_choice">Perguntar outra coisa com novos botões, e depois notificar pra continuar na mão</option>
                    </select>
                  </div>

                  {q.action === 'send_message' && (
                    <div className="space-y-2 pl-3 border-l-2 border-accent/30">
                      <div>
                        <label className="block text-xs text-muted font-body mb-1">Mensagem enviada quando alguém tocar aqui</label>
                        <textarea value={q.message || ''} onChange={e => updateQuickReply(idx, { message: e.target.value })}
                          rows={3} placeholder="Ex: Show! Já vamos te mandar mais detalhes da promoção por aqui."
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input type="checkbox" checked={!!q.notify} onChange={e => updateQuickReply(idx, { notify: e.target.checked })}
                          className="w-4 h-4 rounded border-border bg-surface accent-accent" />
                        <span className="text-xs text-muted font-body">Notificar o WhatsApp interno também (mesmo número configurado em "Resposta automática")</span>
                      </label>
                    </div>
                  )}

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
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Quantos dias depois do envio principal</label>
                  <input type="number" min={1} max={30} value={fuDelayDays} onChange={e => setFuDelayDays(e.target.value)}
                    className="w-32 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Limite de mensagens por dia</label>
                  <input type="number" min={1} max={100} value={fuDailyLimit} onChange={e => setFuDailyLimit(e.target.value)}
                    className="w-32 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent transition-colors" />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" checked={fuStartActive} onChange={e => setFuStartActive(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-surface accent-accent" />
                <span className="text-xs text-muted font-body">Ativar o follow-up assim que a campanha principal for criada</span>
              </label>
              {!fuStartActive && <p className="text-xs text-muted font-body -mt-2">O follow-up fica criado mas pausado — ative quando quiser pelo botão "Retomar" no Histórico.</p>}

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
            <div className="flex justify-between text-sm font-body"><span className="text-muted">Total de contatos</span><span className="text-accent font-medium">{filteredContacts.length}</span></div>
            {targetTags.length > 0 && <div className="flex justify-between text-sm font-body"><span className="text-muted">Filtrado por tag</span><span className="text-white">{targetTags.join(', ')}</span></div>}
            <div className="flex justify-between text-sm font-body"><span className="text-muted">Por dia</span><span className="text-white">{form.daily_limit} contatos/dia (~{estimatedDays} dia(s))</span></div>
            <div className="flex justify-between text-sm font-body"><span className="text-muted">Janela de envio</span><span className="text-white">{form.daily_start_hour}h–{form.daily_end_hour}h{form.weekdays_only ? ', só dias úteis' : ', todo dia'}</span></div>
            {stopDTPreview && <div className="flex justify-between text-sm font-body"><span className="text-muted">Para de enviar em</span><span className="text-white">{stopDTPreview.toLocaleString('pt-BR')}</span></div>}
            {wantsFollowUp && <div className="flex justify-between text-sm font-body"><span className="text-muted">Follow-up</span><span className="text-white">{fuDelayDays} dia(s) depois, se não responder</span></div>}
            {wantsQuickReplies && <div className="flex justify-between text-sm font-body"><span className="text-muted">Botões de resposta</span><span className="text-white">{quickReplies.filter(q => q.label.trim()).length}</span></div>}
          </div>

          <button type="submit" disabled={!form.number_id || filteredContacts.length === 0 || saving}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-bg font-display font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-base">
            {saving ? 'Salvando...' : <><Clock size={18} /> Agendar disparo (~{estimatedDays} dias)</>}
          </button>

          {targetTags.length > 0 && (
            <button type="button" onClick={handleSendNow} disabled={filteredContacts.length === 0 || sendingNow || saving}
              className="w-full bg-surface border border-accent/40 hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed text-accent font-display font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm">
              {sendingNow ? `Enviando... (${filteredContacts.length} contato(s))` : `⚡ Enviar agora, só pra tag "${targetTags.join(', ')}" (${filteredContacts.length} contato(s))`}
            </button>
          )}
          {targetTags.length > 0 && <p className="text-xs text-muted font-body text-center -mt-2">Envio de teste imediato, sem agendar — passa pela mesma Edge Function e mesmo limite diário do disparo normal.</p>}
        </div>
      </form>
    </div>
  )
}
