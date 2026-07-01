import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Megaphone, CheckCircle, Clock, XCircle, Loader, Send, CalendarClock, Image as ImageIcon, Eye, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

const statusConfig = {
  draft: { label: 'Rascunho — aguardando você disparar', icon: Clock, color: 'text-muted bg-muted/10' },
  scheduled: { label: 'Agendado', icon: CalendarClock, color: 'text-blue-300 bg-blue-400/10' },
  sending: { label: 'Enviando', icon: Loader, color: 'text-accent bg-accent/10' },
  completed: { label: 'Concluído', icon: CheckCircle, color: 'text-green-400 bg-green-400/10' },
  error: { label: 'Erro', icon: XCircle, color: 'text-red-400 bg-red-400/10' },
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
      // Antes estava 'descending' e mostrava Semana 4 no topo — corrigido.
      .order('created_at', { ascending: true })
      .then(({ data }) => { setCampaigns(data || []); setLoading(false) })
  }

  // Só campanha-base em rascunho, sem data marcada, ganha os controles de
  // disparo manual — follow-up (follow_up_of preenchido) dispara sozinho
  // 2 dias depois de cada campanha-base, não precisa (nem deve) ser
  // disparado manualmente.
  function isLaunchable(c) {
    return c.status === 'draft' && !c.follow_up_of && (c.type === 'scheduled' || c.type === 'daily')
  }

  async function launchNow(c) {
    if (!confirm(`Disparar "${c.name}" agora? Vai para todos os contatos desta loja, respeitando o limite de 100/dia.`)) return
    await supabase.from('campaigns').update({ status: 'scheduled', scheduled_for: new Date().toISOString() }).eq('id', c.id)
    fetchCampaigns()
  }

  async function confirmSchedule(c) {
    if (!scheduleValue) return
    await supabase.from('campaigns').update({ status: 'scheduled', scheduled_for: new Date(scheduleValue).toISOString() }).eq('id', c.id)
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
    await supabase.storage.from('creatives').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('creatives').getPublicUrl(path)
    await supabase.from('campaigns').update({ image_url: data.publicUrl }).eq('id', c.id)
    setUploadingId(null)
    e.target.value = ''
    fetchCampaigns()
  }

  async function removeCampaign(c) {
    const warn = c.status === 'draft'
      ? `Remover "${c.name}"? Isso não pode ser desfeito.`
      : `"${c.name}" já teve envios (${c.sent_count || 0}). Remover apaga o registro do Histórico, mas as mensagens já enviadas continuam entregues — não tem como "desenviar". Continuar?`
    if (!confirm(warn)) return
    await supabase.from('message_logs').delete().eq('campaign_id', c.id)
    await supabase.from('campaigns').delete().eq('id', c.id)
    fetchCampaigns()
    setModalCampaign(null)
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
        <div className="space-y-3">
          {campaigns.map(c => {
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
                  {c.status === 'draft' && (
                    <button onClick={() => setModalCampaign({ campaign: c, mode: 'edit' })}
                      className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors">
                      <Pencil size={13} /> Editar
                    </button>
                  )}
                  <button onClick={() => removeCampaign(c)}
                    className="flex items-center gap-1.5 border border-red-400/30 text-red-400 hover:bg-red-400/10 px-3 py-2 rounded-lg text-xs font-body transition-colors">
                    <Trash2 size={13} /> Remover
                  </button>

                  {launchable && (
                    <>
                      <input ref={el => (fileRefs.current[c.id] = el)} type="file" accept="image/*" onChange={e => handleImageChange(c, e)} className="hidden" />
                      <button onClick={() => fileRefs.current[c.id]?.click()} disabled={uploadingId === c.id}
                        className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors disabled:opacity-50">
                        <ImageIcon size={13} /> {uploadingId === c.id ? 'Enviando...' : c.image_url ? 'Trocar imagem' : 'Adicionar imagem'}
                      </button>

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
          })}
        </div>
      )}

      {modalCampaign && (
        <CampaignModal
          campaign={modalCampaign.campaign}
          mode={modalCampaign.mode}
          onClose={() => setModalCampaign(null)}
          onSaved={() => { setModalCampaign(null); fetchCampaigns() }}
        />
      )}
    </div>
  )
}

function CampaignModal({ campaign, mode, onClose, onSaved }) {
  const [name, setName] = useState(campaign.name || '')
  const [caption, setCaption] = useState(campaign.caption || '')
  const [saving, setSaving] = useState(false)
  const editing = mode === 'edit'

  async function handleSave() {
    setSaving(true)
    await supabase.from('campaigns').update({ name, caption }).eq('id', campaign.id)
    setSaving(false)
    onSaved()
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 animate-fadein">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-white">{editing ? 'Editar disparo' : 'Detalhes do disparo'}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>

        {campaign.image_url && <img src={campaign.image_url} alt="" className="w-full max-h-56 rounded-lg object-contain bg-black/20" />}

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
            <textarea rows={6} value={caption} onChange={e => setCaption(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
          ) : (
            <p className="text-sm text-white font-body whitespace-pre-wrap">{campaign.caption}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-body text-muted">
          <div><span className="text-white">{campaign.total_count || 0}</span> contatos no total</div>
          <div><span className="text-green-400">{campaign.sent_count || 0}</span> enviados</div>
          {campaign.follow_up_delay_days != null && <div>Follow-up após <span className="text-white">{campaign.follow_up_delay_days} dias</span> sem resposta</div>}
        </div>

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
