import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings as SettingsIcon, Smartphone, CheckCircle, XCircle, RefreshCw, MessageCircle, Users, CreditCard, Gauge, Image as ImageIcon, Bot, Clock, FileText, Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Número de WhatsApp para pedir mais capacidade (order bump) — enquanto
// não existe checkout automático, abre uma conversa já com o pedido pronto.
const SUPPORT_WHATSAPP = '5519997051919'
function addonLink(kind, companyName) {
  const label = kind === 'contacts' ? '+1000 contatos' : '+1 número de WhatsApp'
  const text = `Oi! Sou d${companyName ? 'a empresa ' + companyName : 'o ZapFlow'} e quero contratar o add-on "${label}" no meu plano.`
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`
}

export default function Settings() {
  const { profile, isReseller, client } = useAuth()
  const [numbers, setNumbers] = useState([])
  const [statuses, setStatuses] = useState({})
  const [addons, setAddons] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyingType, setBuyingType] = useState(null)
  const [usage, setUsage] = useState(null) // { contacts, numbers, campaigns, limits: {...} }
  const [logoUrl, setLogoUrl] = useState(client?.logo_url || null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const modules = profile?.client?.modules || {}

  // Upload do logo (white-label, 2026-11-07) — só revendedor usa isto.
  // RPC update_own_logo (security definer) grava só logo_url da própria
  // linha, não dá pra editar plan/access_key por aqui.
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const path = `logos/${profile.client_id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('creatives').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('creatives').getPublicUrl(path)
      const { error: rpcErr } = await supabase.rpc('update_own_logo', { new_logo_url: data.publicUrl })
      if (rpcErr) throw rpcErr
      setLogoUrl(data.publicUrl)
    } catch (err) {
      alert('Erro ao enviar logo: ' + err.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  useEffect(() => {
    if (!profile?.client_id) return
    fetchNumbers()
    fetchAddons()
    fetchUsage()
  }, [profile])

  // Fase 2, Phase 3 (Painel de Consumo) - CONS-01..05. Fonte única da
  // comparação: plan_limits (+ campaigns_limit, coluna nova) ampliado por
  // client_addons ativos - a mesma lógica que Contacts.jsx já usa pra
  // contatos, generalizada aqui pra números e campanhas também.
  async function fetchUsage() {
    const { data: client } = await supabase.from('clients').select('plan').eq('id', profile.client_id).single()
    if (!client?.plan) return
    const { data: limit } = await supabase.from('plan_limits').select('*').eq('plan', client.plan).single()
    if (!limit) return
    const { data: addonRows } = await supabase.from('client_addons').select('addon_type, quantity').eq('client_id', profile.client_id).eq('status', 'active')
    const extraContacts = (addonRows || []).filter(a => a.addon_type === 'contacts_1000').reduce((s, a) => s + a.quantity, 0) * 1000
    const extraNumbers = (addonRows || []).filter(a => a.addon_type === 'number').reduce((s, a) => s + a.quantity, 0)

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const [{ count: contactsCount }, { count: numbersCount }, { count: campaignsCount }] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', profile.client_id),
      supabase.from('client_numbers').select('id', { count: 'exact', head: true }).eq('client_id', profile.client_id).eq('active', true),
      supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('client_id', profile.client_id).gte('created_at', monthStart.toISOString()),
    ])

    setUsage({
      contacts: contactsCount || 0,
      numbers: numbersCount || 0,
      campaigns: campaignsCount || 0,
      limits: {
        contacts: limit.contacts_limit != null ? limit.contacts_limit + extraContacts : null,
        numbers: limit.numbers_limit != null ? limit.numbers_limit + extraNumbers : null,
        campaigns: limit.campaigns_limit ?? null,
      },
    })
  }

  async function fetchAddons() {
    const { data } = await supabase.from('client_addons').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false })
    setAddons(data || [])
  }

  // Checkout real via Mercado Pago — cria a assinatura no servidor
  // (mp-create-preapproval) e manda o cliente pro checkout hospedado.
  async function buyAddon(addonType) {
    setBuyingType(addonType)
    try {
      const { data, error } = await supabase.functions.invoke('mp-create-preapproval', { body: { addon_type: addonType } })
      if (error || data?.error) {
        alert('Não consegui iniciar o pagamento: ' + (data?.error || error.message) + '. Tenta pelo WhatsApp abaixo enquanto isso.')
        return
      }
      if (data?.checkout_url) window.open(data.checkout_url, '_blank')
      fetchAddons()
    } catch (e) {
      alert('Erro ao iniciar pagamento: ' + e.message)
    } finally {
      setBuyingType(null)
    }
  }

  async function fetchNumbers() {
    // BUG DE SEGURANÇA corrigido em 2026-07-03: select('*') trazia
    // zapi_token (credencial real da Z-API) pro navegador, e checkStatus
    // chamava a Z-API direto do cliente com esse token — qualquer pessoa
    // logada conseguia pegar o próprio token pelo DevTools e mandar
    // mensagem direto pela Z-API, por fora do limite diário, opt-out,
    // spintax e message_logs deste sistema. Ver supabase/functions/zapi-status.
    const { data } = await supabase.from('client_numbers').select('id, client_id, label, phone, active').eq('client_id', profile.client_id)
    setNumbers(data || [])
    setLoading(false)
  }

  async function checkStatus(number) {
    setStatuses(s => ({ ...s, [number.id]: 'checking' }))
    try {
      const { data, error } = await supabase.functions.invoke('zapi-status', { body: { number_id: number.id } })
      if (error || !data?.ok) throw new Error('erro ao checar status')
      setStatuses(s => ({ ...s, [number.id]: data.connected ? 'connected' : 'disconnected' }))
    } catch {
      setStatuses(s => ({ ...s, [number.id]: 'disconnected' }))
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Configurações</h1>
        <p className="text-muted text-sm font-body mt-1">Gerencie as configurações da sua conta</p>
      </div>

      {/* Info da conta */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-display font-semibold text-white flex items-center gap-2"><SettingsIcon size={16} /> Sua conta</h3>
        <div className="grid gap-3">
          <Row label="Empresa" value={profile?.client?.name || '—'} />
          <Row label="Plano" value={profile?.client?.plan || 'Basic'} accent />
          <Row label="E-mail" value={profile?.email || '—'} />
          <Row label="Função" value={profile?.role === 'admin' ? 'Administrador' : 'Usuário'} />
        </div>
      </div>

      {/* Marca do revendedor (white-label) — só revendedor vê isto; os
          clientes finais dele enxergam este logo no lugar de "ZapFlow". */}
      {isReseller && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white flex items-center gap-2"><ImageIcon size={16} /> Sua marca</h3>
          <p className="text-muted text-xs font-body">Esse logo aparece pros seus clientes finais no lugar do "ZapFlow".</p>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-14 h-14 rounded-lg object-cover border border-border" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-surface border border-border flex items-center justify-center text-muted text-xs font-body">sem logo</div>
            )}
            <label className="cursor-pointer text-sm font-display font-bold text-accent hover:underline">
              {uploadingLogo ? 'Enviando...' : 'Trocar logo'}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleLogoUpload} />
            </label>
          </div>
        </div>
      )}

      {/* Consumo do plano */}
      {usage && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-white flex items-center gap-2"><Gauge size={16} /> Consumo do plano</h3>
          <div className="grid gap-3">
            <UsageBar label="Contatos" used={usage.contacts} limit={usage.limits.contacts} />
            <UsageBar label="Números WhatsApp" used={usage.numbers} limit={usage.limits.numbers} />
            <UsageBar label="Campanhas este mês" used={usage.campaigns} limit={usage.limits.campaigns} />
          </div>
        </div>
      )}

      {/* Números WPP */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-display font-semibold text-white flex items-center gap-2"><Smartphone size={16} /> Números WhatsApp conectados</h3>
        <p className="text-muted text-xs font-body">Os números são configurados pelo administrador. Você pode verificar o status da conexão abaixo.</p>

        {loading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : numbers.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone size={32} className="text-muted mx-auto mb-3" />
            <p className="text-muted text-sm font-body">Nenhum número configurado ainda.</p>
            <p className="text-muted text-xs font-body mt-1">Fale com o administrador para configurar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {numbers.map(n => {
              const status = statuses[n.id]
              return (
                <div key={n.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-white font-body font-medium">{n.label}</p>
                    <p className="text-muted text-xs font-body mt-0.5">{n.phone || 'Número configurado pelo admin'}</p>
                  </div>
                  {status === 'checking' && <RefreshCw size={16} className="text-accent animate-spin" />}
                  {status === 'connected' && <div className="flex items-center gap-1 text-green-400 text-xs font-body"><CheckCircle size={14} /> Conectado</div>}
                  {status === 'disconnected' && <div className="flex items-center gap-1 text-red-400 text-xs font-body"><XCircle size={14} /> Desconectado</div>}
                  <button onClick={() => checkStatus(n)} disabled={status === 'checking'}
                    className="text-xs text-accent hover:underline font-body disabled:opacity-50">
                    Verificar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Agente de IA: horário de atendimento (2026-11-09) — fora disso o
          agente nem chama o modelo, só avisa o cliente e notifica a equipe
          (igual um atendente real faria). Config é da própria empresa
          (horário de funcionamento), não um segredo de integração — fica
          aqui mesmo no Settings do cliente. */}
      {modules.ia_agent && <AiAgentHoursCard clientId={profile.client_id} />}
      {modules.ia_agent && <KnowledgeBaseCard clientId={profile.client_id} />}

      {/* Fluxo de agendamento por palavra-chave (reply_flows) — a tela de
          Fluxos de Automação apontava pra cá dizendo "edite aqui", mas não
          existia campo nenhum: só o horário do Agente de IA (acima, e só
          visível com modules.ia_agent). Esse fluxo é o CONTRÁRIO — é o que
          roda pra quem NÃO tem ia_agent (ex: Clínica Hassum), sempre visível. */}
      <ScheduleFlowCard clientId={profile.client_id} />

      {/* Conexão self-service de marketplace (2026-11-10) — cliente conecta
          a PRÓPRIA conta Mercado Livre sem precisar de admin nem token:
          OAuth de verdade, loga direto no site do Mercado Livre. */}
      {modules.estoque && <MarketplaceConnectCard />}

      {/* Add-ons (order bump) — mais capacidade sem trocar de plano inteiro */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-display font-semibold text-white flex items-center gap-2"><Users size={16} /> Precisa de mais capacidade?</h3>
        <p className="text-muted text-xs font-body">Se o plano atual só falta um pouco (mais um número, ou mais um pouco de contatos), não precisa trocar de plano inteiro — dá pra contratar só o que falta.</p>

        {addons.length > 0 && (
          <div className="space-y-1.5">
            {addons.map(a => (
              <div key={a.id} className="flex justify-between items-center text-xs font-body text-muted bg-surface rounded-lg px-3 py-2">
                <span className="flex items-center gap-2">
                  {a.addon_type === 'number' ? `+${a.quantity} número(s) de WhatsApp` : `+${a.quantity * 1000} contatos`}
                  {a.status === 'pending' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300">aguardando pagamento</span>}
                  {a.status === 'past_due' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300">em atraso</span>}
                  {a.status === 'cancelled' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-400">cancelado</span>}
                </span>
                <span className="text-white">R$ {Number(a.monthly_price).toFixed(2)}{a.addon_type === 'number' ? '/mês' : ' (único)'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => buyAddon('number')} disabled={buyingType === 'number'}
            className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-3 rounded-lg text-sm font-display font-bold transition-colors">
            <CreditCard size={14} /> {buyingType === 'number' ? 'Abrindo...' : '+1 número — R$150/mês'}
          </button>
          <button onClick={() => buyAddon('contacts_1000')} disabled={buyingType === 'contacts_1000'}
            className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-3 rounded-lg text-sm font-display font-bold transition-colors">
            <CreditCard size={14} /> {buyingType === 'contacts_1000' ? 'Abrindo...' : '+1000 contatos — R$59,90 (pagamento único)'}
          </button>
        </div>
        <p className="text-muted text-xs font-body">Clique abre o checkout do Mercado Pago numa nova aba. O número é assinatura mensal recorrente; os contatos são cobrança única — libera automaticamente assim que confirmar o pagamento.</p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <a href={addonLink('number', profile?.client?.name)} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 border border-border text-muted hover:text-white px-4 py-2 rounded-lg text-xs font-body transition-colors">
            <MessageCircle size={12} /> Prefiro falar antes
          </a>
          <a href={addonLink('contacts', profile?.client?.name)} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 border border-border text-muted hover:text-white px-4 py-2 rounded-lg text-xs font-body transition-colors">
            <MessageCircle size={12} /> Prefiro falar antes
          </a>
        </div>
      </div>

      {/* Legal */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-display font-semibold text-white">Legal</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-body text-muted">
          <Link to="/termos" className="hover:text-white">Termos de Uso</Link>
          <span>·</span>
          <Link to="/privacidade" className="hover:text-white">Privacidade</Link>
          <span>·</span>
          <Link to="/cookies" className="hover:text-white">Cookies</Link>
          <span>·</span>
          <Link to="/contrato-assinatura" className="hover:text-white">Contrato de Assinatura</Link>
        </div>
      </div>
    </div>
  )
}

function UsageBar({ label, used, limit }) {
  const unlimited = limit == null
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  const near = !unlimited && pct >= 90
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-muted text-sm font-body">{label}</span>
        <span className={`text-sm font-body font-medium ${near ? 'text-amber-400' : 'text-white'}`}>
          {used.toLocaleString()}{unlimited ? '' : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${near ? 'bg-amber-400' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value, accent }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-muted text-sm font-body">{label}</span>
      <span className={`text-sm font-body font-medium ${accent ? 'text-accent' : 'text-white'}`}>{value}</span>
    </div>
  )
}

const WEEKDAYS = [
  ['mon', 'Seg'], ['tue', 'Ter'], ['wed', 'Qua'], ['thu', 'Qui'], ['fri', 'Sex'], ['sat', 'Sáb'], ['sun', 'Dom'],
]
const DEFAULT_DAY = { start: '09:00', end: '18:00' }

function AiAgentHoursCard({ clientId }) {
  const [hours, setHours] = useState({})
  const [handoffMessage, setHandoffMessage] = useState('')
  const [notifyPhone, setNotifyPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchConfig() }, [])

  async function fetchConfig() {
    const { data } = await supabase.from('reply_flows').select('ai_business_hours, ai_handoff_message, notify_phone').eq('client_id', clientId).maybeSingle()
    setHours(data?.ai_business_hours || { mon: DEFAULT_DAY, tue: DEFAULT_DAY, wed: DEFAULT_DAY, thu: DEFAULT_DAY, fri: DEFAULT_DAY })
    setHandoffMessage(data?.ai_handoff_message || 'Nosso atendimento automático está fora do horário agora. Já avisei a equipe, te respondem assim que possível!')
    setNotifyPhone(data?.notify_phone || '')
    setLoading(false)
  }

  function toggleDay(key) {
    setHours(h => {
      const next = { ...h }
      if (next[key]) delete next[key]
      else next[key] = { ...DEFAULT_DAY }
      return next
    })
  }
  function updateDay(key, field, value) {
    setHours(h => ({ ...h, [key]: { ...h[key], [field]: value } }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase.from('reply_flows').upsert({
      client_id: clientId, ai_business_hours: hours, ai_handoff_message: handoffMessage, notify_phone: notifyPhone || null,
    }, { onConflict: 'client_id' })
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-display font-semibold text-white flex items-center gap-2"><Bot size={16} /> Agente de IA — horário de atendimento</h3>
      <p className="text-muted text-xs font-body">Fora desse horário, o agente avisa o cliente que vai responder depois e chama a equipe — não tenta resolver sozinho.</p>

      <div className="space-y-2">
        {WEEKDAYS.map(([key, label]) => {
          const day = hours[key]
          return (
            <div key={key} className="flex items-center gap-3">
              <button onClick={() => toggleDay(key)}
                className={`w-16 shrink-0 text-xs font-body font-medium rounded-lg px-2 py-2 transition-colors ${day ? 'bg-accent/10 text-accent' : 'bg-surface text-muted'}`}>
                {label}
              </button>
              {day ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="time" value={day.start} onChange={e => updateDay(key, 'start', e.target.value)}
                    className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-white font-body focus:outline-none focus:border-accent" />
                  <span className="text-muted text-xs">até</span>
                  <input type="time" value={day.end} onChange={e => updateDay(key, 'end', e.target.value)}
                    className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-white font-body focus:outline-none focus:border-accent" />
                </div>
              ) : (
                <span className="text-muted text-xs font-body flex-1">Fechado</span>
              )}
            </div>
          )
        })}
      </div>

      <div>
        <label className="block text-xs text-muted font-body mb-1.5 flex items-center gap-1.5"><Clock size={12} /> Mensagem fora do horário</label>
        <textarea value={handoffMessage} onChange={e => setHandoffMessage(e.target.value)} rows={2}
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
      </div>
      <div>
        <label className="block text-xs text-muted font-body mb-1.5">WhatsApp da equipe (pra receber os avisos)</label>
        <input value={notifyPhone} onChange={e => setNotifyPhone(e.target.value)} placeholder="5519999999999"
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar horário'}
      </button>
    </div>
  )
}

function ScheduleFlowCard({ clientId }) {
  const [enabled, setEnabled] = useState(false)
  const [triggerKeyword, setTriggerKeyword] = useState('eu quero, quero, bora, quero sim, pode ser')
  const [askPeriodMessage, setAskPeriodMessage] = useState('Que ótimo, {{nome}}! Você prefere atendimento pela manhã ou à tarde?')
  const [confirmMessage, setConfirmMessage] = useState('Perfeito! Em breve nossa equipe entra em contato pra confirmar seu horário 📅')
  const [notifyPhone, setNotifyPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchConfig() }, [])

  async function fetchConfig() {
    const { data } = await supabase.from('reply_flows').select('enabled, trigger_keyword, ask_period_message, confirm_message, notify_phone').eq('client_id', clientId).maybeSingle()
    setEnabled(data?.enabled ?? false)
    if (data?.trigger_keyword) setTriggerKeyword(data.trigger_keyword)
    if (data?.ask_period_message) setAskPeriodMessage(data.ask_period_message)
    if (data?.confirm_message) setConfirmMessage(data.confirm_message)
    setNotifyPhone(data?.notify_phone || '')
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('reply_flows').upsert({
      client_id: clientId, enabled, trigger_keyword: triggerKeyword, ask_period_message: askPeriodMessage,
      confirm_message: confirmMessage, notify_phone: notifyPhone || null,
    }, { onConflict: 'client_id' })
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-white flex items-center gap-2"><Clock size={16} /> Fluxo de Agendamento via WhatsApp</h3>
        <button onClick={() => setEnabled(e => !e)}
          className={`px-3 py-1.5 rounded-lg text-xs font-body font-bold transition-colors ${enabled ? 'bg-emerald-600 text-white' : 'bg-surface text-muted border border-border'}`}>
          {enabled ? 'Ativo' : 'Pausado'}
        </button>
      </div>
      <p className="text-muted text-xs font-body">
        Quando o cliente escreve uma das palavras-gatilho, o sistema pergunta o turno (manhã/tarde) e confirma — sem precisar de atendente nem de IA.
      </p>

      <div>
        <label className="block text-xs text-muted font-body mb-1.5">Palavras-gatilho (separe por vírgula)</label>
        <input value={triggerKeyword} onChange={e => setTriggerKeyword(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent" />
      </div>
      <div>
        <label className="block text-xs text-muted font-body mb-1.5">Pergunta do turno (use {'{{nome}}'} pra personalizar)</label>
        <textarea value={askPeriodMessage} onChange={e => setAskPeriodMessage(e.target.value)} rows={2}
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
      </div>
      <div>
        <label className="block text-xs text-muted font-body mb-1.5">Mensagem de confirmação</label>
        <textarea value={confirmMessage} onChange={e => setConfirmMessage(e.target.value)} rows={2}
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body focus:outline-none focus:border-accent resize-none" />
      </div>
      <div>
        <label className="block text-xs text-muted font-body mb-1.5">WhatsApp da equipe (recebe aviso de cada agendamento)</label>
        <input value={notifyPhone} onChange={e => setNotifyPhone(e.target.value)} placeholder="5519999999999"
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar fluxo'}
      </button>
    </div>
  )
}

function MarketplaceConnectCard() {
  const [connected, setConnected] = useState(null) // null = carregando, false/true = status
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => { fetchStatus() }, [])

  // Sem SELECT direto em marketplace_channels pro role client (de
  // propósito — ver marketplace_channels_rls_fix.sql, credential não é
  // RLS-filtrável por coluna). Status vem pela edge function, que já lê
  // via service role mesmo.
  async function fetchStatus() {
    const { data } = await supabase.functions.invoke('ml-orders', { body: {} })
    setConnected(!!data?.connected)
  }

  async function connect() {
    setConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('ml-oauth-start', { body: {} })
      if (error || !data?.ok) { alert('Erro ao iniciar conexão: ' + (data?.error || error.message)); return }
      window.open(data.url, '_blank', 'noopener')
    } catch (e) {
      alert('Erro ao iniciar conexão: ' + e.message)
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    if (!confirm('Desconectar o Mercado Livre? Sincronização de estoque/preço para até reconectar — útil se conectou a conta errada.')) return
    setDisconnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('ml-disconnect', { body: {} })
      if (error || !data?.ok) { alert('Erro ao desconectar: ' + (data?.error || error.message)); return }
      setConnected(false)
    } catch (e) {
      alert('Erro ao desconectar: ' + e.message)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-display font-semibold text-white flex items-center gap-2"><RefreshCw size={16} /> Sincronizar Marketplace</h3>
      <p className="text-muted text-xs font-body">Conecte sua conta do Mercado Livre pra sincronizar estoque e preço automaticamente. Você loga direto no site do Mercado Livre — o ZapFlow nunca pede nem guarda sua senha.</p>

      {connected === null ? (
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      ) : connected ? (
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          <span className="flex items-center gap-1 text-green-400 text-xs font-body"><CheckCircle size={14} /> Mercado Livre conectado</span>
          <button onClick={disconnect} disabled={disconnecting} className="text-xs text-muted hover:text-red-400 font-body disabled:opacity-50">
            {disconnecting ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={connecting}
          className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2.5 rounded-lg text-xs font-display font-bold transition-colors">
          {connecting ? 'Abrindo...' : 'Conectar Mercado Livre'}
        </button>
      )}
    </div>
  )
}

const MAX_DOC_CHARS = 8000

function KnowledgeBaseCard({ clientId }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchDocs() }, [])

  async function fetchDocs() {
    const { data } = await supabase.from('knowledge_documents').select('id, title, content, created_at').eq('client_id', clientId).order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.txt')) { alert('Por enquanto só aceito arquivo .txt — cole o texto direto se for PDF.'); return }
    const reader = new FileReader()
    reader.onload = () => { setContent(String(reader.result).slice(0, MAX_DOC_CHARS)); if (!title) setTitle(file.name.replace(/\.txt$/, '')) }
    reader.readAsText(file)
  }

  async function save() {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    const { error } = await supabase.from('knowledge_documents').insert({ client_id: clientId, title: title.trim(), content: content.trim().slice(0, MAX_DOC_CHARS) })
    setSaving(false)
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    setTitle(''); setContent('')
    fetchDocs()
  }

  async function remove(id) {
    if (!confirm('Remover esse documento da base de conhecimento?')) return
    await supabase.from('knowledge_documents').delete().eq('id', id)
    fetchDocs()
  }

  const totalChars = docs.reduce((s, d) => s + d.content.length, 0)

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-display font-semibold text-white flex items-center gap-2"><FileText size={16} /> Base de conhecimento do Agente de IA</h3>
      <p className="text-muted text-xs font-body">Cole seu catálogo, tabela de preços, regras de frete ou FAQ. O agente usa esse texto pra responder com precisão sobre sua empresa.</p>

      {!loading && docs.length > 0 && (
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-white font-body font-medium truncate">{d.title}</p>
                <p className="text-muted text-xs font-body">{d.content.length.toLocaleString()} caracteres</p>
              </div>
              <button onClick={() => remove(d.id)} className="text-muted hover:text-red-400 transition-colors p-1 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
          <p className="text-muted text-[11px] font-body">{totalChars.toLocaleString()} caracteres no total.</p>
        </div>
      )}

      <div className="border-t border-border pt-4 space-y-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (ex: Catálogo de produtos)"
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
        <textarea value={content} onChange={e => setContent(e.target.value.slice(0, MAX_DOC_CHARS))} rows={5} placeholder="Cole o texto aqui..."
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent resize-none" />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-accent font-display font-bold cursor-pointer hover:underline">
            <Upload size={13} /> Enviar arquivo .txt
            <input type="file" accept=".txt" className="hidden" onChange={handleFile} />
          </label>
          <span className="text-muted text-[11px] font-mono">{content.length}/{MAX_DOC_CHARS}</span>
        </div>
        <button onClick={save} disabled={saving || !title.trim() || !content.trim()}
          className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
          {saving ? 'Salvando...' : 'Adicionar documento'}
        </button>
      </div>
    </div>
  )
}
