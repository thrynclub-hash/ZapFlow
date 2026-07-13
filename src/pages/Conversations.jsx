import { useEffect, useState } from 'react'
import { MessageCircle, CheckCircle2, EyeOff, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
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
// Só mostra resposta de CAMPANHA de verdade (campaign_id não nulo, gravado
// pelo webhook — ver supabase_inbound_campaign_origin.sql) — mensagem
// avulsa de quem nunca recebeu nada nosso fica de fora, pedido do Leonardo
// pra não misturar contato desconhecido com quem respondeu a Semana 1.
//
// Uma linha por CONTATO, não por mensagem (2026-07-13) — pedido do
// Leonardo depois de ver o mesmo contato repetido várias vezes na lista
// (cada mensagem que a pessoa manda vira uma linha nova em inbound_messages,
// mas ele só quer ver o estado atual da conversa). Consulta a view
// `inbound_messages_latest` (supabase_inbound_latest_per_contact.sql), que
// já traz só a mensagem mais recente de cada contato.
//
// Paginado no servidor (20 por página, não carrega tudo de uma vez) — com
// o histórico crescendo, carregar tudo de uma vez travaria a tela.
const PAGE_SIZE = 20

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
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(0) // quantas linhas vieram nesta página (pra saber se tem "próxima")
  const [counts, setCounts] = useState({ novo: 0, resolvido: 0, ignorado: 0, todas: 0 })
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    if (profile?.client_id) { setPage(0); fetchCounts() }
  }, [profile, tab])

  useEffect(() => {
    if (profile?.client_id) fetchPage()
  }, [profile, tab, page])

  async function fetchCounts() {
    const clientId = profile.client_id
    const base = () => supabase.from('inbound_messages_latest').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
    const [novo, resolvido, ignorado, todas] = await Promise.all([
      base().eq('status', 'novo'),
      base().eq('status', 'resolvido'),
      base().eq('status', 'ignorado'),
      base(),
    ])
    setCounts({ novo: novo.count || 0, resolvido: resolvido.count || 0, ignorado: ignorado.count || 0, todas: todas.count || 0 })
  }

  async function fetchPage() {
    setLoading(true)
    const clientId = profile.client_id
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase.from('inbound_messages_latest').select('id, contact_id, campaign_id, phone, message, received_at, status')
      .eq('client_id', clientId)
      .order('received_at', { ascending: false }).range(from, to)
    if (tab !== 'todas') query = query.eq('status', tab)

    const { data: inbound, error } = await query
    if (error) { console.error('Erro buscando conversas:', error); setMessages([]); setPageCount(0); setLoading(false); return }

    // Só resolve nome do contato e nome da campanha pras linhas desta
    // página (não pro histórico inteiro) — é isso que mantém a tela leve.
    const contactIds = [...new Set((inbound || []).map(m => m.contact_id).filter(Boolean))]
    const campaignIds = [...new Set((inbound || []).map(m => m.campaign_id).filter(Boolean))]
    const [{ data: contacts }, { data: campaigns }] = await Promise.all([
      contactIds.length ? supabase.from('contacts').select('id, name').in('id', contactIds) : Promise.resolve({ data: [] }),
      campaignIds.length ? supabase.from('campaigns').select('id, name').in('id', campaignIds) : Promise.resolve({ data: [] }),
    ])
    const contactById = new Map((contacts || []).map(c => [c.id, c]))
    const campaignById = new Map((campaigns || []).map(c => [c.id, c]))

    setMessages((inbound || []).map(m => ({
      ...m,
      contactName: contactById.get(m.contact_id)?.name || null,
      campaignName: campaignById.get(m.campaign_id)?.name || null,
    })))
    setPageCount((inbound || []).length)
    setLoading(false)
  }

  async function updateStatus(id, status) {
    setUpdatingId(id)
    const { error } = await supabase.from('inbound_messages').update({ status }).eq('id', id)
    setUpdatingId(null)
    if (error) { alert('Erro ao atualizar: ' + error.message); return }
    // Sai da lista atual se não pertence mais a este filtro (ex: marcou
    // resolvido enquanto olhava "Novas") — senão só atualiza o status ali.
    if (tab !== 'todas' && tab !== status) {
      setMessages(list => list.filter(m => m.id !== id))
      setPageCount(c => Math.max(0, c - 1))
    } else {
      setMessages(list => list.map(m => m.id === id ? { ...m, status } : m))
    }
    fetchCounts()
  }

  const hasNext = pageCount === PAGE_SIZE
  const hasPrev = page > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Conversas</h1>
        <p className="text-muted text-sm font-body mt-1">Última mensagem de cada contato que respondeu campanha — inclusive o que o robô não reconheceu automaticamente. Mensagem avulsa de quem nunca recebeu nada nosso não aparece aqui.</p>
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
      ) : messages.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <MessageCircle size={32} className="text-muted mx-auto mb-3" />
          <p className="text-white font-body font-medium mb-1">Nada por aqui</p>
          <p className="text-muted text-sm font-body">{page > 0 ? 'Não tem mais nada nas próximas páginas.' : STATUS_TABS.find(t => t.key === tab)?.hint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
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

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={!hasPrev}
              className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-xs text-muted font-body">Página {page + 1}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!hasNext}
              className="flex items-center gap-1.5 border border-border text-muted hover:text-white px-3 py-2 rounded-lg text-xs font-body transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
