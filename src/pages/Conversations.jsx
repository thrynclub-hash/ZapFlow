import { useEffect, useState } from 'react'
import { MessageCircle, CheckCircle2, EyeOff, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Tela de Conversas (2026-07-13) — pedido do Leonardo depois de achar, com
// dado real de produção da Hassum, que mensagens recebidas que não batem
// com clique de botão/"eu quero" (perguntas genuínas tipo "qual o valor pra
// colocar um dente") ficavam só no banco (inbound_messages), sem tela
// nenhuma pra ler o que a pessoa escreveu. O robô (zapi-webhook) já notifica
// o número interno quando não reconhece a mensagem (ver notifyUnrecognized);
// esta tela é o lugar de conferir com calma e marcar o que foi tratado.
//
// Mesmo teto de 1000 linhas por select do resto do projeto (Contacts.jsx,
// Reports.jsx, run-automations) — paginado com o mesmo padrão.
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

const STATUS_TABS = [
  { key: 'novo', label: 'Novas', hint: 'Ainda não foram lidas/tratadas.' },
  { key: 'resolvido', label: 'Resolvidas', hint: 'Já foram respondidas/tratadas na mão.' },
  { key: 'ignorado', label: 'Ignoradas', hint: 'Spam, engano, ou não precisava ação.' },
  { key: 'todas', label: 'Todas', hint: 'Tudo que chegou, qualquer status.' },
]

export default function Conversations() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('novo')
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    if (profile?.client_id) fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    const clientId = profile.client_id

    const [inbound, contacts, sentLogs, campaigns] = await Promise.all([
      fetchAllPages((from, to) =>
        supabase.from('inbound_messages').select('id, contact_id, phone, message, received_at, status').eq('client_id', clientId).order('received_at', { ascending: false }).range(from, to)
      ),
      fetchAllPages((from, to) => supabase.from('contacts').select('id, name, phone').eq('client_id', clientId).range(from, to)),
      fetchAllPages((from, to) =>
        supabase.from('message_logs').select('contact_id, campaign_id, sent_at').eq('client_id', clientId).eq('status', 'sent').range(from, to)
      ),
      fetchAllPages((from, to) => supabase.from('campaigns').select('id, name').eq('client_id', clientId).range(from, to)),
    ])

    const contactById = new Map(contacts.map(c => [c.id, c]))
    const campaignById = new Map(campaigns.map(c => [c.id, c]))
    // Pra achar "de qual campanha veio essa resposta": a última mensagem
    // enviada pra este contato ANTES do horário da resposta — mesma lógica
    // que zapi-webhook usa pra resolver campaignId de verdade.
    const logsByContact = {}
    for (const l of sentLogs) {
      if (!l.contact_id) continue
      ;(logsByContact[l.contact_id] ||= []).push(l)
    }
    for (const arr of Object.values(logsByContact)) arr.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))

    function originCampaign(contactId, receivedAt) {
      const logs = logsByContact[contactId] || []
      const match = logs.find(l => l.sent_at <= receivedAt)
      return match ? campaignById.get(match.campaign_id)?.name : null
    }

    const enriched = inbound.map(m => ({
      ...m,
      contactName: contactById.get(m.contact_id)?.name || null,
      campaignName: m.contact_id ? originCampaign(m.contact_id, m.received_at) : null,
    }))

    setMessages(enriched)
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setUpdatingId(id)
    const { error } = await supabase.from('inbound_messages').update({ status }).eq('id', id)
    setUpdatingId(null)
    if (error) { alert('Erro ao atualizar: ' + error.message); return }
    setMessages(list => list.map(m => m.id === id ? { ...m, status } : m))
  }

  const filtered = tab === 'todas' ? messages : messages.filter(m => (m.status || 'novo') === tab)
  const counts = STATUS_TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'todas' ? messages.length : messages.filter(m => (m.status || 'novo') === t.key).length
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Conversas</h1>
        <p className="text-muted text-sm font-body mt-1">Tudo que os contatos responderam — inclusive o que o robô não reconheceu automaticamente.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-body border transition-colors ${tab === t.key ? 'bg-accent text-bg border-accent font-bold' : 'border-border text-muted hover:text-white'}`}>
            {t.label} <span className="opacity-70">({counts[t.key] || 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <MessageCircle size={32} className="text-muted mx-auto mb-3" />
          <p className="text-white font-body font-medium mb-1">Nada por aqui</p>
          <p className="text-muted text-sm font-body">{STATUS_TABS.find(t => t.key === tab)?.hint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white font-body font-medium">{m.contactName || 'Contato não identificado'}</p>
                  <p className="text-muted text-xs font-body mt-0.5">
                    {m.phone} · {new Date(m.received_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {m.campaignName && <span className="text-accent"> · via {m.campaignName}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(m.status || 'novo') !== 'resolvido' && (
                    <button onClick={() => updateStatus(m.id, 'resolvido')} disabled={updatingId === m.id}
                      className="flex items-center gap-1.5 border border-green-400/40 text-green-400 hover:bg-green-400/10 px-3 py-1.5 rounded-lg text-xs font-body transition-colors disabled:opacity-50">
                      <CheckCircle2 size={13} /> Marcar resolvido
                    </button>
                  )}
                  {(m.status || 'novo') !== 'ignorado' && (
                    <button onClick={() => updateStatus(m.id, 'ignorado')} disabled={updatingId === m.id}
                      className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-1.5 rounded-lg text-xs font-body transition-colors disabled:opacity-50">
                      <EyeOff size={13} /> Ignorar
                    </button>
                  )}
                  {(m.status || 'novo') !== 'novo' && (
                    <button onClick={() => updateStatus(m.id, 'novo')} disabled={updatingId === m.id}
                      className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-1.5 rounded-lg text-xs font-body transition-colors disabled:opacity-50">
                      <RotateCcw size={13} /> Reabrir
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-white font-body mt-3 whitespace-pre-wrap bg-surface rounded-lg p-3">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
