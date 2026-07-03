import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Smartphone, CheckCircle, XCircle, RefreshCw, MessageCircle, Users, CreditCard } from 'lucide-react'
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
  const { profile } = useAuth()
  const [numbers, setNumbers] = useState([])
  const [statuses, setStatuses] = useState({})
  const [addons, setAddons] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyingType, setBuyingType] = useState(null)

  useEffect(() => {
    if (!profile?.client_id) return
    fetchNumbers()
    fetchAddons()
  }, [profile])

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
