import { useEffect, useState } from 'react'
import { Building2, Smartphone, Megaphone, Users, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ clients: 0, numbers: 0, campaigns: 0, contacts: 0, sent: 0 })
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [c, n, camp, cont, logs] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('client_numbers').select('id', { count: 'exact' }),
      supabase.from('campaigns').select('id', { count: 'exact' }),
      supabase.from('contacts').select('id', { count: 'exact' }),
      supabase.from('message_logs').select('id', { count: 'exact' }).eq('status', 'sent'),
    ])
    setStats({ clients: c.count, numbers: n.count, campaigns: camp.count, contacts: cont.count, sent: logs.count })

    const { data } = await supabase.from('clients').select('*, numbers:client_numbers(count), contacts:contacts(count)').order('created_at', { ascending: false }).limit(10)
    setClients(data || [])
    setLoading(false)
  }

  const statCards = [
    { icon: Building2, label: 'Clientes ativos', value: stats.clients, color: 'text-accent bg-accent/10' },
    { icon: Smartphone, label: 'Números WPP', value: stats.numbers, color: 'text-blue-400 bg-blue-400/10' },
    { icon: Users, label: 'Total de contatos', value: stats.contacts?.toLocaleString(), color: 'text-purple-400 bg-purple-400/10' },
    { icon: TrendingUp, label: 'Mensagens enviadas', value: stats.sent?.toLocaleString(), color: 'text-green-400 bg-green-400/10' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Painel Admin</h1>
        <p className="text-muted text-sm font-body mt-1">Visão geral de todos os clientes e operações</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color}`}><Icon size={18} /></div>
            <p className="text-3xl font-display font-bold text-white">{value || 0}</p>
            <p className="text-muted text-sm font-body mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-display font-semibold text-xl text-white mb-4">Clientes cadastrados</h2>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Segmento</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Plano</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Números</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Contatos</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-4 text-sm text-white font-body font-medium">{c.name}</td>
                    <td className="px-5 py-4 text-sm text-muted font-body">{c.segment || '—'}</td>
                    <td className="px-5 py-4"><span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded font-body">{c.plan || 'Basic'}</span></td>
                    <td className="px-5 py-4 text-sm text-white font-body text-right">{c.numbers?.[0]?.count || 0}</td>
                    <td className="px-5 py-4 text-sm text-white font-body text-right">{c.contacts?.[0]?.count || 0}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-body ${c.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-muted/10 text-muted'}`}>
                        {c.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
