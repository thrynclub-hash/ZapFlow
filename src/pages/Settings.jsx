import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Smartphone, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { checkInstanceStatus } from '../lib/zapi'

export default function Settings() {
  const { profile } = useAuth()
  const [numbers, setNumbers] = useState([])
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.client_id) return
    fetchNumbers()
  }, [profile])

  async function fetchNumbers() {
    const { data } = await supabase.from('client_numbers').select('*').eq('client_id', profile.client_id)
    setNumbers(data || [])
    setLoading(false)
  }

  async function checkStatus(number) {
    setStatuses(s => ({ ...s, [number.id]: 'checking' }))
    try {
      const res = await checkInstanceStatus(number.zapi_instance_id, number.zapi_token)
      setStatuses(s => ({ ...s, [number.id]: res.connected ? 'connected' : 'disconnected' }))
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
