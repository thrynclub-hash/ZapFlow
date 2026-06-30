import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Megaphone, CheckCircle, Clock, XCircle, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const statusConfig = {
  draft: { label: 'Rascunho', icon: Clock, color: 'text-muted bg-muted/10' },
  sending: { label: 'Enviando', icon: Loader, color: 'text-accent bg-accent/10' },
  completed: { label: 'Concluído', icon: CheckCircle, color: 'text-green-400 bg-green-400/10' },
  error: { label: 'Erro', icon: XCircle, color: 'text-red-400 bg-red-400/10' },
}

export default function Campaigns() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.client_id) return
    supabase.from('campaigns')
      .select('*, number:client_numbers(label)')
      .eq('client_id', profile.client_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCampaigns(data || []); setLoading(false) })
  }, [profile])

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
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-5 flex items-center gap-5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${st.color}`}>
                  <Icon size={18} className={c.status === 'sending' ? 'animate-spin' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white font-body font-medium">{c.name || 'Disparo'}</p>
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
