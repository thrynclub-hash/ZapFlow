import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Megaphone, CheckCircle, Clock, XCircle, Loader, Send, CalendarClock, Image as ImageIcon, Eye, Pencil, Trash2, X, MessageCircle, Clock3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

const statusConfig = {
  draft: { label: 'Rascunho — aguardando você disparar', icon: Clock, color: 'text-muted bg-muted/10' },
  scheduled: { label: 'Agendado', icon: CalendarClock, color: 'text-blue-300 bg-blue-400/10' },
  sending: { label: 'Enviando', icon: Loader, color: 'text-accent bg-accent/10' },
  completed: { label: 'Concluído', icon: CheckCircle, color: 'text-green-400 bg-green-400/10' },
  // Parou por causa da data de término (stop_at) antes de alcançar toda a
  // lista — diferente de "completed", que significa que alcançou todo mundo.
  stopped: { label: 'Parado (data de término)', icon: XCircle, color: 'text-amber-300 bg-amber-400/10' },
  error: { label: 'Erro', icon: XCircle, color: 'text-red-400 bg-red-400/10' },
}

// Extrai o número da semana/campanha do nome (ex: "Semana 2 - ..." -> 2,
// "Campanha 5 - ..." -> 5) pra ordenar por número, não por data de criação
// (que fica bagunçada assim que alguém edita/reordena registros por fora).
// Sem número no nome = vai pro final (999).
function weekNum(c) {
  const m = (c.name || '').match(/(?:semana|campanha)\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : 999
}

// Categoriza cada campanha numa seção clara do Histórico — "o que é
// campanha em rascunho, o que já tá rodando, o que é agendamento" (pedido
// literal do Leonardo), sem misturar tudo numa lista só.
//
// Bug real corrigido em 2026-07-01: follow-ups nascem com status='scheduled'
// e scheduled_for=null pra sempre (eles não usam data marcada — disparam N
// dias depois de cada envio individual da campanha-base, via
// processFollowUpCampaigns no run-automations). Antes disso cair na regra
// "scheduled sem data futura = rodando", TODO follow-up aparecia em "Rodando
// agora" mesmo com a campanha-base ainda em rascunho, sem nunca ter
// disparado pra ninguém — nada era enviado de verdade antes da hora (o motor
// só age quando existe message_log real da base), mas a etiqueta na tela
// mentia. Corrigido: follow-up agora sempre usa o MESMO grupo da sua
// campanha-base (se a base é rascunho, o follow-up também aparece como
// rascunho; se a base já está rodando/concluída, o follow-up acompanha).
function groupOf(c, byId) {
  if (c.follow_up_of && byId) {
    const base = byId.get(c.follow_up_of)
    if (base) return groupOf(base, null) // base nunca é follow-up de outra coisa, sem risco de loop
  }
  if (c.status === 'error') return 'error'
  if (c.status === 'stopped') return 'stopped'
  if (c.status === 'completed') return 'completed'
  if (c.status === 'sending') return 'running'
  if (c.status === 'scheduled') {
    if (c.type === 'daily') return 'running' // recorrente — sempre "rodando", todo dia
    if (c.scheduled_for && new Date(c.scheduled_for) > new Date()) return 'scheduled_future'
    return 'running' // data já passou / é um envio multi-dia em andamento
  }
  return 'draft'
}

const GROUPS = [
  { key: 'running', title: '🟢 Rodando agora', hint: 'Já está disparando, ou é recorrente (diária) e roda todo dia sozinha.' },
  { key: 'scheduled_future', title: '🕐 Agendado', hint: 'Vai disparar sozinho na data marcada — ainda não começou.' },
  { key: 'draft', title: '📝 Rascunho', hint: 'Ainda não foi disparado nem agendado — só você está vendo isso.' },
  { key: 'completed', title: '✅ Concluído', hint: 'Já terminou de enviar pra todo o público-alvo dela.' },
  { key: 'stopped', title: '🛑 Parado (data de término)', hint: 'Parou sozinha na data marcada, mesmo com contatos ainda pendentes na lista.' },
  { key: 'error', title: '⚠️ Com erro', hint: 'Teve problema no envio — dá uma olhada.' },
]

// Ordena dentro de cada seção: por número de semana/campanha, base antes
// do próprio follow-up, e como desempate final, data de criação.
function sortCampaigns(list) {
  return [...list].sort((a, b) => {
    const wa = weekNum(a), wb = weekNum(b)
    if (wa !== wb) return wa - wb
    const fa = a.follow_up_of ? 1 : 0, fb = b.follow_up_of ? 1 : 0
    if (fa !== fb) return fa - fb
    return new Date(a.created_at) - new Date(b.created_at)
  })
}

export default function Campaigns() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [schedulingId, setSchedulingId] = useState(null)
  const [scheduleValue, setScheduleValue] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const [modalCampaign, setModalCampaign] = useState(null) // { campaign, mode: 'view'|'edit' }
  const fileRefs = useRef({})

  useEffect(() => { if (clientId) fetchCampaigns() }, [clientId])

  function fetchCampaigns() {
    setLoading(true)
    supabase.from('campaigns')
      .select('*, number:client_numbers(label)')
      .eq('client_id', clientId)
      // Ordem cronológica de criação (Semana 1 -> Semana 4), e como cada
      // follow-up nasce logo depois da sua campanha-base no banco, isso
      // também os agrupa naturalmente (base primeiro, follow-up logo abaixo).
      .order('created_at', { ascending: true })
      .then(({ data }) => { setCampaigns(data || []); setLoading(false) })
  }

  // Só campanha-base em rascunho, sem data marcada, ganha os controles de
  // disparo manual — follow-up (follow_up_of preenchido) dispara sozinho
  // N dias depois de cada campanha-base, não precisa (nem deve) ser
  // disparado manualmente.
  function isLaunchable(c) {
    return c.status === 'draft' && !c.follow_up_of && (c.type === 'scheduled' || c.type === 'daily')
  }

  async function launchNow(c) {
    if (!confirm(`Disparar "${c.name}" agora? Vai para todos os contatos desta loja, respeitando o limite de 100/dia.`)) return
    const { error } = await supabase.from('campaigns').update({ status: 'scheduled', scheduled_for: new Date().toISOString() }).eq('id', c.id)
    if (error) { alert('Erro ao disparar: ' + error.message); return }
    fetchCampaigns()
  }

  async function confirmSchedule(c) {
    if (!scheduleValue) return
    const { error } = await supabase.from('campaigns').update({ status: 'scheduled', scheduled_for: new Date(scheduleValue).toISOString() }).eq('id', c.id)
    if (error) { alert('Erro ao agendar: ' + error.message); return }
    setSchedulingId(null)
    setScheduleValue('')
    fetchCampaigns()
  }

  async function handleImageChange(c, e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingId(c.id)
    const ext = file.name.split('.').pop()
    const path = `campaigns/${clientId}/${c.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('creatives').upload(path, file, { upsert: true })
    if (upErr) { alert('Erro ao enviar imagem: ' + upErr.message); setUploadingId(null); return }
    const { data } = supabase.storage.from('creatives').getPublicUrl(path)
    const { error } = await supabase.from('campaigns').update({ image_url: data.publicUrl }).eq('id', c.id)
    setUploadingId(null)
    e.target.value = ''
    if (error) { alert('Imagem enviada, mas não consegui vincular à campanha: ' + error.message); return }
    fetchCampaigns()
  }

  async function removeCampaign(c) {
    const warn = c.status === 'draft'
      ? `Remover "${c.name}"? Isso não pode ser desfeito.`
      : `"${c.name}" já teve envios (${c.sent_count || 0}). Remover apaga o registro do Histórico, mas as mensagens já enviadas continuam entregues — não tem como "desenviar". Continuar?`
    if (!confirm(warn)) return
    await supabase.from('message_logs').delete().eq('campaign_id', c.id)
    const { error } = await supabase.from('campaigns').delete().eq('id', c.id)
    if (error) { alert('Erro ao remover: ' + error.message); return }
    fetchCampaigns()
    setModalCampaign(null)
  }

  function renderCard(c) {
    const st = statusConfig[c.status] || statusConfig.draft
    const Icon = st.icon
    const pct = c.total_count > 0 ? Math.round((c.sent_count / c.total_count) * 100) : 0
    const launchable = isLaunchable(c)
    return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${st.color}`}>
                    <Icon size={18} className={c.status === 'sending' ? 'animate-spin' : ''} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-white font-body font-medium">{c.name || 'Disparo'}{c.follow_up_of && <span className="text-muted text-xs font-body ml-2">(follow-up automático)</span>}</p>
                        <p className="text-muted text-xs font-body mt-0.5">{c.number?.label} · {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-body shrink-0 ${st.color}`}>{st.label}</span>
                    </div>
                    {c.status !== 'draft' && c.total_count > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs font-body">
                          <span className="text-green-400">{c.sent_count} enviados</span>
                          {c.error_count > 0 && <span className="text-red-400">{c.error_count} erros</span>}
                          <span className="text-muted">{c.total_count} total · {pct}%</span>
                        </div>
                        <div className="w-full bg-border rounded-full h-1.5">
                          <div className="bg-green-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                    {c.caption && <p className="text-muted text-xs font-body mt-2 truncate">{c.caption}</p>}
                  </div>
                  {c.image_url && <img src={c.image_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />}
                </div>

                {/* Visualizar / Editar / Remover — disponível em TODA campanha, não só nas lançáveis */}
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-2">
                  <button onClick={() => setModalCampaign({ campaign: c, mode: 'view' })}
                    className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors">
                    <Eye size={13} /> Visualizar
                  </button>
                  <button onClick={() => setModalCampaign({ campaign: c, mode: 'edit' })}
                    className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors">
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => removeCampaign(c)}
                    className="flex items-center gap-1.5 border border-red-400/30 text-red-400 hover:bg-red-400/10 px-3 py-2 rounded-lg text-xs font-body transition-colors">
                    <Trash2 size={13} /> Remover
                  </button>

                  {/* Adicionar/trocar imagem — disponível em TODA campanha, igual
                      Visualizar/Editar/Remover, não só nas lançáveis. Antes só
                      aparecia em campanha-base ainda em rascunho, então "Semana 1-4"
                      (já lançadas antes) e follow-ups nunca tinham esse botão,
                      mesmo já existindo campo image_url pra qualquer uma delas. */}
                  <input ref={el => (fileRefs.current[c.id] = el)} type="file" accept="image/*" onChange={e => handleImageChange(c, e)} className="hidden" />
                  <button onClick={() => fileRefs.current[c.id]?.click()} disabled={uploadingId === c.id}
                    className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors disabled:opacity-50">
                    <ImageIcon size={13} /> {uploadingId === c.id ? 'Enviando...' : c.image_url ? 'Trocar imagem' : 'Adicionar imagem'}
                  </button>

                  {launchable && (
                    <>
                      {schedulingId === c.id ? (

                        <>
                          <input type="datetime-local" value={scheduleValue} onChange={e => setScheduleValue(e.target.value)}
                            className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
                          <button onClick={() => confirmSchedule(c)} className="bg-accent hover:bg-accent-dim text-bg px-3 py-2 rounded-lg text-xs font-display font-bold transition-colors">Confirmar</button>
                          <button onClick={() => { setSchedulingId(null); setScheduleValue('') }} className="text-muted hover:text-white text-xs font-body px-2">Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => launchNow(c)}
                            className="flex items-center gap-1.5 bg-accent hover:bg-accent-dim text-bg px-3 py-2 rounded-lg text-xs font-display font-bold transition-colors">
                            <Send size={13} /> Disparar agora
                          </button>
                          <button onClick={() => setSchedulingId(c.id)}
                            className="flex items-center gap-1.5 border border-accent/50 text-accent hover:bg-accent hover:text-bg px-3 py-2 rounded-lg text-xs font-body transition-colors">
                            <CalendarClock size={13} /> Agendar para depois
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Histórico de Disparos</h1>
          <p className="text-muted text-sm font-body mt-1">{campaigns.length} campanhas no total</p>
        </div>
        <Link to="/campaigns/new" className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
          <Plus size={14} /> Novo Disparo
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Megaphone size={40} className="text-muted mx-auto mb-4" />
          <p className="text-white font-body font-medium mb-1">Nenhum disparo ainda</p>
          <Link to="/campaigns/new" className="inline-block mt-4 text-accent text-sm font-display font-bold hover:underline">Criar primeiro disparo →</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {GROUPS.map(g => {
            const campaignsById = new Map(campaigns.map(c => [c.id, c]))
            const items = sortCampaigns(campaigns.filter(c => groupOf(c, campaignsById) === g.key))
            if (items.length === 0) return null
            return (
              <div key={g.key}>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-bold text-sm text-white uppercase tracking-wide">{g.title}</h2>
                  <span className="text-muted text-xs font-body">({items.length})</span>
                </div>
                <p className="text-muted text-xs font-body mb-3">{g.hint}</p>
                <div className="space-y-3">
                  {items.map(c => renderCard(c))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalCampaign && (
        <CampaignModal
          campaign={modalCampaign.campaign}
          mode={modalCampaign.mode}
          clientId={clientId}
          onClose={() => setModalCampaign(null)}
          onSaved={() => { setModalCampaign(null); fetchCampaigns() }}
        />
      )}
    </div>
  )
}

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Data e horário sempre em 2 campos separados (não 1 datetime-local) —
// mesmo pedido do Leonardo aplicado em NewCampaign.jsx, pra deixar o
// horário óbvio tanto pra editar o início quanto o término de uma campanha
// já criada.
function toDatePart(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toTimePart(iso) {
  if (!iso) return '09:00'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}:00`)
}

function CampaignModal({ campaign, mode, clientId, onClose, onSaved }) {
  const editing = mode === 'edit'
  const isBase = !campaign.follow_up_of

  const [name, setName] = useState(campaign.name || '')
  const [caption, setCaption] = useState(campaign.caption || '')
  const [scheduledDate, setScheduledDate] = useState(toDatePart(campaign.scheduled_for))
  const [scheduledTime, setScheduledTime] = useState(toTimePart(campaign.scheduled_for))
  const [dailyLimit, setDailyLimit] = useState(campaign.daily_limit || 100)
  const [dailyStartHour, setDailyStartHour] = useState(campaign.daily_start_hour || 9)
  const [stopDate, setStopDate] = useState(toDatePart(campaign.stop_at))
  const [stopTime, setStopTime] = useState(toTimePart(campaign.stop_at))
  const [targetTags, setTargetTags] = useState(Array.isArray(campaign.target_tags) ? campaign.target_tags : [])
  const [quickReplies, setQuickReplies] = useState(Array.isArray(campaign.quick_replies) ? campaign.quick_replies : [])
  function updateQuickReply(idx, patch) {
    setQuickReplies(list => list.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }
  function addQuickReply() {
    setQuickReplies(list => [...list, { id: `opt_${list.length + 1}`, label: '', action: 'trigger_flow' }])
  }
  function removeQuickReply(idx) {
    setQuickReplies(list => list.filter((_, i) => i !== idx))
  }
  // Todas as tags REAIS em uso pelos contatos deste cliente — não só
  // "Antigo"/"Novo" fixos. Bug reportado: contato com tag "vip" (ou
  // qualquer tag livre) não aparecia como opção de público-alvo aqui.
  const [availableTags, setAvailableTags] = useState([])
  const [saving, setSaving] = useState(false)

  // Follow-up ligado a esta campanha-base (se houver)
  const [followUp, setFollowUp] = useState(null)
  const [fuCaption, setFuCaption] = useState('')
  const [fuDelayDays, setFuDelayDays] = useState(2)
  const [loadingFu, setLoadingFu] = useState(isBase)

  // Fluxo de resposta ("EU QUERO") — hoje é 1 configuração POR CLIENTE
  // (vale pra todas as campanhas dele), não por campanha individual.
  const [replyFlow, setReplyFlow] = useState(null)
  const [rfKeywords, setRfKeywords] = useState('')
  const [rfAsk, setRfAsk] = useState('')
  const [rfConfirm, setRfConfirm] = useState('')
  const [rfNotify, setRfNotify] = useState('')
  const [rfEnabled, setRfEnabled] = useState(true)
  const [loadingRf, setLoadingRf] = useState(true)

  useEffect(() => {
    if (isBase) {
      supabase.from('campaigns').select('*').eq('follow_up_of', campaign.id).maybeSingle().then(({ data }) => {
        setFollowUp(data)
        if (data) { setFuCaption(data.caption || ''); setFuDelayDays(data.follow_up_delay_days ?? 2) }
        setLoadingFu(false)
      })
    }
    // Busca TODAS as tags em uso (paginado — cliente pode ter mais de 1000
    // contatos, ver bug do teto de 1000 corrigido em Contacts.jsx).
    ;(async () => {
      let all = [], from = 0
      while (true) {
        const { data } = await supabase.from('contacts').select('tags').eq('client_id', clientId).range(from, from + 999)
        all = all.concat(data || [])
        if (!data || data.length < 1000) break
        from += 1000
      }
      const found = Array.from(new Set(all.flatMap(c => Array.isArray(c.tags) ? c.tags : [])))
      const ordered = [...['Antigo', 'Novo'].filter(t => found.includes(t)), ...found.filter(t => t !== 'Antigo' && t !== 'Novo').sort()]
      setAvailableTags(ordered)
    })()
    supabase.from('reply_flows').select('*').eq('client_id', clientId).maybeSingle().then(({ data }) => {
      setReplyFlow(data)
      if (data) {
        setRfKeywords(data.trigger_keyword || '')
        setRfAsk(data.ask_period_message || '')
        setRfConfirm(data.confirm_message || '')
        setRfNotify(data.notify_phone || '')
        setRfEnabled(data.enabled)
      }
      setLoadingRf(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const scheduledDT = combineDateTime(scheduledDate, scheduledTime)
      const stopDT = combineDateTime(stopDate, stopTime)
      const updates = { name, caption }
      if (isBase) {
        if (campaign.type === 'scheduled') updates.scheduled_for = scheduledDT ? scheduledDT.toISOString() : null
        if (campaign.type === 'daily') { updates.daily_limit = Number(dailyLimit); updates.daily_start_hour = Number(dailyStartHour) }
        if (campaign.type === 'scheduled' || campaign.type === 'daily') updates.stop_at = stopDT ? stopDT.toISOString() : null
        // Reabrir uma campanha que já tinha parado por stop_at, se a data de término foi removida/adiada
        if (campaign.status === 'stopped' && (!stopDT || stopDT > new Date())) updates.status = 'scheduled'
        updates.target_tags = targetTags.length > 0 ? targetTags : null
        updates.quick_replies = quickReplies.filter(q => q.label.trim())
      }
      // BUG real corrigido em 2026-07-03: nenhuma dessas chamadas checava o
      // `error` de retorno do Supabase. supabase-js NÃO lança exceção em erro
      // de banco (RLS, constraint, etc.) — ele resolve normal com
      // { data: null, error }. Sem checar isso, uma falha ficava
      // completamente silenciosa: o modal fechava, a lista recarregava
      // mostrando os dados ANTIGOS (porque nada foi realmente escrito), e
      // parecia que "salvou mas voltou tudo como antes" ao atualizar a
      // página — exatamente o sintoma reportado (campanha da Hassum).
      const { error: campErr } = await supabase.from('campaigns').update(updates).eq('id', campaign.id)
      if (campErr) throw campErr

      if (followUp) {
        // Follow-up sempre manda pro mesmo público-alvo da campanha-base —
        // não faz sentido a base ir só pra "Antigo" e o follow-up ir pra todo mundo.
        const { error: fuErr } = await supabase.from('campaigns').update({ caption: fuCaption, follow_up_delay_days: Number(fuDelayDays), target_tags: updates.target_tags }).eq('id', followUp.id)
        if (fuErr) throw fuErr
      }

      // Fluxo de resposta é por cliente — upsert por client_id
      const { error: rfErr } = await supabase.from('reply_flows').upsert({
        client_id: clientId, enabled: rfEnabled, trigger_keyword: rfKeywords,
        ask_period_message: rfAsk, confirm_message: rfConfirm, notify_phone: rfNotify || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id' })
      if (rfErr) throw rfErr

      onSaved()
    } catch (e) {
      alert('Erro ao salvar: ' + (e.message || e.details || JSON.stringify(e)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 animate-fadein">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-white">{editing ? 'Editar disparo' : 'Detalhes do disparo'}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>

        {editing && campaign.sent_count > 0 && (
          <p className="text-amber-300 text-xs font-body bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠️ Essa campanha já enviou {campaign.sent_count} mensagem(ns). Editar aqui não muda o que já foi enviado — só afeta quem ainda vai receber a partir de agora.
          </p>
        )}

        {campaign.image_url && <img src={campaign.image_url} alt="" className="w-full max-h-56 rounded-lg object-contain bg-black/20" />}

        {/* Campanha principal */}
        <div className="space-y-4">
          <p className="text-xs text-muted font-body uppercase tracking-wide font-medium">Esta campanha</p>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Nome</label>
            {editing ? (
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
            ) : (
              <p className="text-sm text-white font-body">{campaign.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Mensagem</label>
            {editing ? (
              <textarea rows={5} value={caption} onChange={e => setCaption(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
            ) : (
              <p className="text-sm text-white font-body whitespace-pre-wrap">{campaign.caption}</p>
            )}
          </div>

          {isBase && campaign.type === 'scheduled' && (
            <div>
              <label className="block text-xs text-muted font-body mb-1.5 flex items-center gap-1.5"><Clock3 size={12} /> Quando dispara (data e horário)</label>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
                  <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
                </div>
              ) : (
                <p className="text-sm text-white font-body">{campaign.scheduled_for ? new Date(campaign.scheduled_for).toLocaleString('pt-BR') : 'Ainda não agendado'}</p>
              )}
            </div>
          )}

          {isBase && campaign.type === 'daily' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted font-body mb-1.5">Contatos por dia</label>
                {editing ? (
                  <input type="number" min={1} max={100} value={dailyLimit} onChange={e => setDailyLimit(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
                ) : <p className="text-sm text-white font-body">{campaign.daily_limit || 100}/dia</p>}
              </div>
              <div>
                <label className="block text-xs text-muted font-body mb-1.5">Horário início</label>
                {editing ? (
                  <select value={dailyStartHour} onChange={e => setDailyStartHour(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
                    {[8,9,10,11,14,15,16,17,18].map(h => <option key={h} value={h}>{h}:00h</option>)}
                  </select>
                ) : <p className="text-sm text-white font-body">{campaign.daily_start_hour ?? 9}:00h</p>}
              </div>
            </div>
          )}

          {isBase && (campaign.type === 'scheduled' || campaign.type === 'daily') && (
            <div>
              <label className="block text-xs text-muted font-body mb-1.5 flex items-center gap-1.5"><Clock3 size={12} /> Parar de enviar em (data e horário, opcional)</label>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={stopDate} onChange={e => setStopDate(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
                  <input type="time" value={stopTime} onChange={e => setStopTime(e.target.value)} disabled={!stopDate}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent disabled:opacity-40" />
                </div>
              ) : (
                <p className="text-sm text-white font-body">{campaign.stop_at ? new Date(campaign.stop_at).toLocaleString('pt-BR') : 'Sem data de término — roda até alcançar toda a lista'}</p>
              )}
              {campaign.status === 'stopped' && <p className="text-xs text-amber-300 font-body mt-1">Esta campanha já parou por causa da data de término. Mude ou apague a data acima e salve para retomar o envio.</p>}
            </div>
          )}

          {isBase && (
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Botões de resposta rápida</label>
              {editing ? (
                <div className="space-y-2">
                  {quickReplies.map((q, idx) => (
                    <div key={idx} className="bg-surface border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={q.label} onChange={e => updateQuickReply(idx, { label: e.target.value })}
                          placeholder="Texto do botão"
                          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
                        <button type="button" onClick={() => removeQuickReply(idx)}
                          className="text-muted hover:text-red-400 p-2 shrink-0" title="Remover botão"><X size={14} /></button>
                      </div>
                      <select value={q.action} onChange={e => updateQuickReply(idx, { action: e.target.value })}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-white font-body focus:outline-none focus:border-accent">
                        <option value="trigger_flow">Continuar o fluxo normal (pergunta o turno, igual "eu quero")</option>
                        <option value="stop_followup">Parar o follow-up automático desta campanha pra essa pessoa</option>
                        <option value="opt_out">Descadastrar de vez (igual responder "PARAR")</option>
                      </select>
                    </div>
                  ))}
                  <button type="button" onClick={addQuickReply} className="text-xs text-accent hover:underline font-body">+ Adicionar botão</button>
                  {quickReplies.length === 0 && <p className="text-xs text-muted font-body">Nenhum botão configurado — a mensagem vai só em texto, e o fluxo "eu quero" continua funcionando por digitação normalmente.</p>}
                </div>
              ) : (
                quickReplies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((q, idx) => <span key={idx} className="px-2.5 py-1 rounded-full text-xs font-body bg-surface border border-border text-white">{q.label}</span>)}
                  </div>
                ) : <p className="text-sm text-white font-body">Nenhum — só texto (sem botões)</p>
              )}
            </div>
          )}

          {isBase && (
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Público-alvo (por tag do contato)</label>
              {editing ? (
                <div className="flex flex-wrap gap-2">
                  {availableTags.length === 0 && <span className="text-xs text-muted font-body">Nenhuma tag em uso ainda nos contatos deste cliente.</span>}
                  {availableTags.map(t => (
                    <button key={t} type="button"
                      onClick={() => setTargetTags(ts => ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-colors ${targetTags.includes(t) ? 'bg-accent text-bg border-accent font-bold' : 'border-border text-muted hover:text-white'}`}>
                      {t}
                    </button>
                  ))}
                  <span className="text-xs text-muted font-body self-center">{targetTags.length === 0 ? '(nenhuma marcada = manda pra todo mundo ativo)' : targetTags.length > 1 ? '(manda pra quem tem QUALQUER uma das marcadas)' : ''}</span>
                </div>
              ) : (
                <p className="text-sm text-white font-body">{targetTags.length > 0 ? targetTags.join(' ou ') : 'Todos os contatos ativos (sem filtro de tag)'}</p>
              )}
              {followUp && <p className="text-xs text-muted font-body mt-1">O follow-up automático desta campanha usa o mesmo alvo.</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs font-body text-muted">
            <div><span className="text-white">{campaign.total_count || 0}</span> contatos no total</div>
            <div><span className="text-green-400">{campaign.sent_count || 0}</span> enviados</div>
          </div>
        </div>

        {/* Follow-up ligado (só campanha-base) */}
        {isBase && !loadingFu && followUp && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs text-muted font-body uppercase tracking-wide font-medium">Follow-up automático</p>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Dispara depois de quantos dias sem resposta</label>
              {editing ? (
                <input type="number" min={1} value={fuDelayDays} onChange={e => setFuDelayDays(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
              ) : <p className="text-sm text-white font-body">{followUp.follow_up_delay_days ?? 2} dias</p>}
            </div>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Mensagem do follow-up</label>
              {editing ? (
                <textarea rows={4} value={fuCaption} onChange={e => setFuCaption(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
              ) : (
                <p className="text-sm text-white font-body whitespace-pre-wrap">{followUp.caption}</p>
              )}
            </div>
            <p className="text-xs text-muted font-body">Status: {statusConfig[followUp.status]?.label || followUp.status} · {followUp.sent_count || 0} enviados</p>
          </div>
        )}
        {isBase && !loadingFu && !followUp && (
          <p className="text-xs text-muted font-body border-t border-border pt-4">Essa campanha não tem follow-up automático vinculado.</p>
        )}

        {/* Fluxo de resposta (EU QUERO) — vale pra todo o cliente */}
        {!loadingRf && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs text-muted font-body uppercase tracking-wide font-medium flex items-center gap-1.5"><MessageCircle size={12} /> Resposta automática ("EU QUERO")</p>
            <p className="text-xs text-muted font-body">Isso vale para todas as campanhas deste cliente, não só esta — é uma configuração única por conta.</p>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Palavras que ativam a resposta (separadas por vírgula)</label>
              {editing ? (
                <input value={rfKeywords} onChange={e => setRfKeywords(e.target.value)} placeholder="eu quero, quero, bora, pode ser"
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
              ) : (
                <p className="text-sm text-white font-body">{replyFlow?.trigger_keyword || '— (não configurado ainda)'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Pergunta enviada quando a pessoa responde a palavra-chave</label>
              {editing ? (
                <textarea rows={2} value={rfAsk} onChange={e => setRfAsk(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
              ) : <p className="text-sm text-white font-body whitespace-pre-wrap">{replyFlow?.ask_period_message || '—'}</p>}
            </div>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Mensagem de confirmação (depois que a pessoa diz manhã/tarde)</label>
              {editing ? (
                <textarea rows={2} value={rfConfirm} onChange={e => setRfConfirm(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
              ) : <p className="text-sm text-white font-body whitespace-pre-wrap">{replyFlow?.confirm_message || '—'}</p>}
            </div>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">WhatsApp que recebe a notificação interna (ex: recepção)</label>
              {editing ? (
                <input value={rfNotify} onChange={e => setRfNotify(e.target.value)} placeholder="5519999999999"
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent" />
              ) : <p className="text-sm text-white font-body">{replyFlow?.notify_phone || '— (não configurado)'}</p>}
            </div>
            {editing && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rfEnabled} onChange={e => setRfEnabled(e.target.checked)} className="accent-accent" />
                <span className="text-xs text-white font-body">Resposta automática ativada</span>
              </label>
            )}
          </div>
        )}

        {editing && (
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-3 rounded-lg text-sm font-display font-bold transition-colors">
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        )}
      </div>
    </Modal>
  )
}
