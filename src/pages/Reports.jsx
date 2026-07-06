import { useEffect, useState } from 'react'
import { BarChart2, Download, TrendingUp, MessageSquare, Users, CheckCircle, Reply } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import * as XLSX from 'xlsx'

// PostgREST/Supabase devolve no máximo 1000 linhas por select, mesmo sem
// LIMIT explícito (mesmo teto documentado e já tratado em
// supabase/functions/run-automations/index.ts:fetchAllPages). Sem paginar,
// message_logs/inbound_messages de um cliente com histórico grande (ex.
// 1190 contatos × campanhas semanais) vinham truncados e o relatório de
// "quem respondeu" ficava incompleto — além de mais lento por acumular tudo
// de uma vez sem necessidade real de trazer mais que 1000 por chamada.
const PAGE_SIZE = 1000
async function fetchAllPages(buildQuery) {
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
    if (error) { console.error('Erro paginando query:', error); break }
    all = all.concat(data || [])
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

export default function Reports() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [totals, setTotals] = useState({ sent: 0, campaigns: 0, contacts: 0, rate: 0 })
  const [replyRows, setReplyRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.client_id) return
    fetchData()
  }, [profile])

  async function fetchData() {
    const clientId = profile.client_id
    fetchReplyStats(clientId)

    const [camps, { count: totalContacts }] = await Promise.all([
      fetchAllPages((from, to) =>
        supabase.from('campaigns').select('*, number:client_numbers(label)').eq('client_id', clientId).eq('status', 'completed').order('created_at', { ascending: false }).range(from, to)
      ),
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    ])

    const allCamps = camps || []
    const totalSent = allCamps.reduce((s, c) => s + (c.sent_count || 0), 0)
    const totalTotal = allCamps.reduce((s, c) => s + (c.total_count || 0), 0)

    setTotals({
      sent: totalSent,
      campaigns: allCamps.length,
      contacts: totalContacts || 0,
      rate: totalTotal > 0 ? Math.round((totalSent / totalTotal) * 100) : 0,
    })
    setCampaigns(allCamps)

    // Dados mensais
    const byMonth = {}
    allCamps.forEach(c => {
      const key = new Date(c.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      byMonth[key] = (byMonth[key] || 0) + (c.sent_count || 0)
    })
    setMonthlyData(Object.entries(byMonth).slice(-6).map(([name, enviados]) => ({ name, enviados })))
    setLoading(false)
  }

  // Controle de respostas: quem respondeu, quem não respondeu, quem chegou
  // no follow-up e respondeu (ou não). Tudo calculado em memória a partir
  // de message_logs (o que foi enviado) + inbound_messages (o que chegou
  // de volta) — sem query por contato, então funciona bem mesmo com a
  // base toda.
  async function fetchReplyStats(clientId) {
    const [allLogs, inbound, allCampaigns] = await Promise.all([
      fetchAllPages((from, to) =>
        supabase.from('message_logs').select('campaign_id, contact_id, status, sent_at').eq('client_id', clientId).range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase.from('inbound_messages').select('contact_id, received_at').eq('client_id', clientId).range(from, to)
      ),
      fetchAllPages((from, to) =>
        supabase.from('campaigns').select('id, name, type, follow_up_of').eq('client_id', clientId).range(from, to)
      ),
    ])

    const inboundByContact = {}
    for (const m of inbound || []) {
      if (!m.contact_id) continue
      ;(inboundByContact[m.contact_id] ||= []).push(m.received_at)
    }
    function hasReplyAfter(contactId, sinceIso) {
      return (inboundByContact[contactId] || []).some(t => t >= sinceIso)
    }

    const baseCampaigns = (allCampaigns || []).filter(c => c.type !== 'followup')
    const rows = baseCampaigns.map(camp => {
      const sentLogs = (allLogs || []).filter(l => l.campaign_id === camp.id && l.status === 'sent')
      const replied = sentLogs.filter(l => hasReplyAfter(l.contact_id, l.sent_at)).length
      const followup = (allCampaigns || []).find(c => c.follow_up_of === camp.id)
      let fuSent = 0, fuReplied = 0
      if (followup) {
        const fuLogs = (allLogs || []).filter(l => l.campaign_id === followup.id && l.status === 'sent')
        fuSent = fuLogs.length
        fuReplied = fuLogs.filter(l => hasReplyAfter(l.contact_id, l.sent_at)).length
      }
      return {
        name: camp.name,
        sent: sentLogs.length,
        replied,
        notReplied: sentLogs.length - replied,
        hasFollowup: !!followup,
        fuSent,
        fuReplied,
        fuNotReplied: fuSent - fuReplied,
      }
    })
    setReplyRows(rows)
  }

  function exportExcel() {
    const data = campaigns.map(c => ({
      Campanha: c.name || 'Disparo',
      Loja: c.number?.label || '',
      'Data envio': new Date(c.created_at).toLocaleDateString('pt-BR'),
      'Total contatos': c.total_count || 0,
      Enviados: c.sent_count || 0,
      Erros: c.error_count || 0,
      'Taxa (%)': c.total_count > 0 ? Math.round(((c.sent_count || 0) / c.total_count) * 100) : 0,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
    XLSX.writeFile(wb, `relatorio_zapflow_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2">
        <p className="text-muted text-xs font-body">{label}</p>
        <p className="text-accent font-body font-medium">{payload[0].value} enviados</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Relatórios</h1>
          <p className="text-muted text-sm font-body mt-1">Visão geral dos seus disparos</p>
        </div>
        <button onClick={exportExcel} className="flex items-center gap-2 border border-border text-muted hover:text-white px-4 py-2 rounded-lg text-sm font-body transition-colors">
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: MessageSquare, label: 'Mensagens enviadas', value: totals.sent.toLocaleString(), color: 'text-accent bg-accent/10' },
          { icon: BarChart2, label: 'Campanhas realizadas', value: totals.campaigns, color: 'text-blue-400 bg-blue-400/10' },
          { icon: Users, label: 'Total de contatos', value: totals.contacts.toLocaleString(), color: 'text-purple-400 bg-purple-400/10' },
          { icon: CheckCircle, label: 'Taxa de entrega', value: `${totals.rate}%`, color: 'text-green-400 bg-green-400/10' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-3xl font-display font-bold text-white">{value}</p>
            <p className="text-muted text-sm font-body mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-display font-semibold text-white mb-6">Mensagens enviadas por mês</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D8" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#6B6560', fontSize: 12, fontFamily: 'Manrope' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B6560', fontSize: 12, fontFamily: 'Manrope' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,77,109,0.06)' }} />
              <Bar dataKey="enviados" fill="#FF4D6D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Controle de respostas */}
      <div>
        <h3 className="font-display font-semibold text-white mb-1 flex items-center gap-2"><Reply size={16} className="text-accent" /> Quem respondeu</h3>
        <p className="text-muted text-xs font-body mb-4">Por campanha: quantos receberam, quantos responderam, e o mesmo para o follow-up automático (2 dias depois, só pra quem não respondeu)</p>
        {replyRows.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center mb-6">
            <p className="text-muted font-body text-sm">Nenhum envio registrado ainda</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Campanha</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Enviados</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Responderam</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Não responderam</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Follow-up enviado</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Follow-up respondeu</th>
                </tr>
              </thead>
              <tbody>
                {replyRows.map(r => (
                  <tr key={r.name} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-4 text-sm text-white font-body">{r.name}</td>
                    <td className="px-5 py-4 text-sm text-white font-body text-right">{r.sent}</td>
                    <td className="px-5 py-4 text-sm text-green-400 font-body text-right">{r.replied}</td>
                    <td className="px-5 py-4 text-sm text-muted font-body text-right">{r.notReplied}</td>
                    <td className="px-5 py-4 text-sm text-white font-body text-right">{r.hasFollowup ? r.fuSent : '—'}</td>
                    <td className="px-5 py-4 text-sm text-green-400 font-body text-right">{r.hasFollowup ? r.fuReplied : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div>
        <h3 className="font-display font-semibold text-white mb-4">Detalhamento por campanha</h3>
        {campaigns.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <TrendingUp size={32} className="text-muted mx-auto mb-3" />
            <p className="text-muted font-body text-sm">Nenhuma campanha concluída ainda</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Campanha</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Loja</th>
                  <th className="text-left px-5 py-3 text-xs text-muted font-body">Data</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Enviados</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Erros</th>
                  <th className="text-right px-5 py-3 text-xs text-muted font-body">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const rate = c.total_count > 0 ? Math.round(((c.sent_count || 0) / c.total_count) * 100) : 0
                  return (
                    <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-white font-body">{c.name || 'Disparo'}</td>
                      <td className="px-5 py-4 text-sm text-muted font-body">{c.number?.label || '—'}</td>
                      <td className="px-5 py-4 text-sm text-muted font-body">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-5 py-4 text-sm text-green-400 font-body text-right">{c.sent_count || 0}</td>
                      <td className="px-5 py-4 text-sm text-right font-body">{c.error_count > 0 ? <span className="text-red-400">{c.error_count}</span> : <span className="text-muted">0</span>}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`text-sm font-body font-medium ${rate >= 90 ? 'text-green-400' : rate >= 70 ? 'text-accent' : 'text-red-400'}`}>{rate}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
