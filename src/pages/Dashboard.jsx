import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Megaphone, Cake, TrendingUp, Plus, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function StatCard({ icon: Icon, label, value, color = 'accent' }) {
  const colors = {
    accent: 'text-accent bg-accent/10',
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  }
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-display font-bold text-white">{value}</p>
      <p className="text-muted text-sm font-body mt-1">{label}</p>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ contacts: 0, campaigns: 0, birthdays: 0, sent: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.client_id) return
    fetchStats()
  }, [profile])

  async function fetchStats() {
    const clientId = profile.client_id

    const [contacts, campaigns, logs] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('campaigns').select('id', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('message_logs').select('id', { count: 'exact' }).eq('client_id', clientId).eq('status', 'sent'),
    ])

    // Aniversários hoje — birth_date é coluna tipo DATE, e o operador LIKE
    // (~~) do Postgres não existe pra esse tipo (só pra texto), então filtrar
    // com .like() direto no banco quebrava a query (404 no console). Busca
    // só a coluna de nascimento de quem tem e filtra mês/dia em JS.
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const { data: withBirthdate } = await supabase
      .from('contacts')
      .select('birth_date')
      .eq('client_id', clientId)
      .not('birth_date', 'is', null)
    const birthdays = (withBirthdate || []).filter(c => { const p = c.birth_date.split('-'); return p[1] === mm && p[2] === dd }).length

    // Campanhas recentes
    const { data: recentData } = await supabase
      .from('campaigns')
      .select('*, number:client_numbers(label)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5)

    setStats({
      contacts: contacts.count || 0,
      campaigns: campaigns.count || 0,
      birthdays: birthdays || 0,
      sent: logs.count || 0,
    })
    setRecent(recentData || [])
    setLoading(false)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = profile?.full_name?.split(' ')[0] || 'por aí'

  const statusColors = {
    draft: 'text-muted bg-muted/10',
    sending: 'text-accent bg-accent/10',
    completed: 'text-green-400 bg-green-400/10',
    error: 'text-red-400 bg-red-400/10',
  }
  const statusLabels = {
    draft: 'Rascunho', sending: 'Enviando', completed: 'Concluído', error: 'Erro',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-sm font-body">{greeting} 👋</p>
          <h1 className="font-display font-bold text-3xl text-white mt-1">{name}</h1>
        </div>
        <Link
          to="/campaigns/new"
          className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg font-display font-bold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          Novo Disparo
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Contatos cadastrados" value={stats.contacts.toLocaleString()} color="blue" />
        <StatCard icon={Megaphone} label="Campanhas criadas" value={stats.campaigns} color="accent" />
        <StatCard icon={TrendingUp} label="Mensagens enviadas" value={stats.sent.toLocaleString()} color="green" />
        <StatCard icon={Cake} label="Aniversários hoje" value={stats.birthdays} color="purple" />
      </div>

      {/* Aniversários alerta */}
      {stats.birthdays > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cake size={20} className="text-accent" />
            <div>
              <p className="text-white font-body font-medium">{stats.birthdays} aniversariante{stats.birthdays > 1 ? 's' : ''} hoje!</p>
              <p className="text-muted text-sm font-body">Não perca a oportunidade de enviar uma mensagem especial</p>
            </div>
          </div>
          <Link to="/birthdays" className="text-accent text-sm font-display font-bold hover:underline flex items-center gap-1">
            Ver <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Campanhas recentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-white">Últimas campanhas</h2>
          <Link to="/campaigns" className="text-muted text-sm font-body hover:text-white transition-colors">
            Ver todas →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Megaphone size={32} className="text-muted mx-auto mb-3" />
            <p className="text-muted font-body">Nenhuma campanha ainda.</p>
            <Link to="/campaigns/new" className="inline-block mt-4 text-accent text-sm font-display font-bold hover:underline">
              Criar primeiro disparo →
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Campanha</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Loja</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Enviados</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Status</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(c => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-4 text-sm text-white font-body">{c.name || 'Disparo'}</td>
                    <td className="px-5 py-4 text-sm text-muted font-body">{c.number?.label || '—'}</td>
                    <td className="px-5 py-4 text-sm text-white font-body">{c.sent_count || 0}/{c.total_count || 0}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-body ${statusColors[c.status] || statusColors.draft}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted font-body">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
