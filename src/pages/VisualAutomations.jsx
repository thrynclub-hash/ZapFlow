import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Workflow, CheckCircle, ArrowRight, Clock,
  Bot, AlertCircle, ArrowDown, Sliders, Zap, MessageSquare
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Fluxos de Automação
//
// Bug real achado ao vivo (2026-11-10): esta tela era 100% estática —
// 4 templates fictícios de loja de roupa ("Recuperação de Pix Abandonado",
// "Boas-Vindas a Leads de Anúncios"...), nenhuma chamada ao Supabase,
// métricas inventadas (342 disparos, 38.4%, R$ 14.820,00 sempre iguais pra
// QUALQUER cliente, inclusive uma clínica odontológica). Mostrava a mesma
// coisa fake pra Lisa (moda) e pra Clínica Hassum (odonto).
//
// Reescrita pra mostrar o que REALMENTE está configurado pra este cliente:
// - reply_flows: o fluxo real de agendamento via WhatsApp ("EU QUERO" →
//   pergunta turno → confirma), configurado em Configurações da Loja —
//   é o que a Clínica Hassum usa de verdade pra marcar consulta.
// - campaigns com quick_replies configurados: botões de resposta rápida
//   reais (ex: ações send_message/trigger_flow da Sodie).
// Sem automação configurada = estado vazio honesto, não um template fake.
export default function VisualAutomations() {
  const { profile } = useAuth()
  const clientId = profile?.client_id

  const [loading, setLoading] = useState(true)
  const [flow, setFlow] = useState(null)
  const [quickReplyCampaigns, setQuickReplyCampaigns] = useState([])
  const [selected, setSelected] = useState(null) // { kind: 'flow' | 'campaign', data }
  const [inboundCount30d, setInboundCount30d] = useState(0)

  useEffect(() => { if (clientId) load() }, [clientId])

  async function load() {
    setLoading(true)
    try {
      const { data: flowData } = await supabase
        .from('reply_flows')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()

      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, name, quick_replies, status')
        .eq('client_id', clientId)
        .not('quick_replies', 'is', null)

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('inbound_messages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', since)

      const realCampaigns = (campaignsData || []).filter(c => Array.isArray(c.quick_replies) && c.quick_replies.length > 0)

      setFlow(flowData?.enabled ? flowData : (flowData || null))
      setQuickReplyCampaigns(realCampaigns)
      setInboundCount30d(count || 0)

      if (flowData?.trigger_keyword) setSelected({ kind: 'flow', data: flowData })
      else if (realCampaigns.length > 0) setSelected({ kind: 'campaign', data: realCampaigns[0] })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasAnyFlow = (flow && flow.trigger_keyword) || quickReplyCampaigns.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-3xl text-ink">Fluxos de Automação</h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold flex items-center gap-1">
              <Workflow size={12} /> WhatsApp
            </span>
          </div>
          <p className="text-muted text-sm font-body mt-1">
            Respostas automáticas reais configuradas para este número de WhatsApp.
          </p>
        </div>

        <div className="bg-surface/50 border border-border px-4 py-2.5 rounded-xl text-center">
          <span className="text-[10px] font-mono text-muted uppercase block">Mensagens recebidas (30 dias)</span>
          <span className="font-display font-bold text-lg text-ink">{inboundCount30d}</span>
        </div>
      </div>

      {!hasAnyFlow ? (
        <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-3">
          <Workflow size={32} className="mx-auto text-muted" />
          <p className="text-sm text-ink font-body font-medium">Nenhum fluxo de automação configurado ainda.</p>
          <p className="text-xs text-muted font-body max-w-md mx-auto">
            Fluxo de agendamento (pergunta "EU QUERO" → turno → confirmação) se configura em{' '}
            <Link to="/settings" className="text-accent hover:underline">Configurações da Loja</Link>.
            Botões de resposta rápida se configuram direto numa{' '}
            <Link to="/campaigns" className="text-accent hover:underline">campanha</Link>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lista */}
          <div className="lg:col-span-4 space-y-2.5">
            <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold block mb-1">
              Fluxos Ativos
            </span>

            {flow?.trigger_keyword && (
              <button
                onClick={() => setSelected({ kind: 'flow', data: flow })}
                className={`w-full text-left p-4 rounded-2xl border transition-all space-y-2 bg-card ${
                  selected?.kind === 'flow' ? 'border-accent shadow-md ring-1 ring-accent/30' : 'border-border hover:border-accent/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface text-accent font-semibold">Agendamento</span>
                  {flow.enabled ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-600"><CheckCircle size={13} /> Ativo</span>
                  ) : (
                    <span className="text-[11px] font-mono text-muted">Pausado</span>
                  )}
                </div>
                <h3 className="font-display font-bold text-sm text-ink">Agendamento via WhatsApp</h3>
                <p className="text-xs text-muted font-body">Gatilho: "{flow.trigger_keyword}"</p>
              </button>
            )}

            {quickReplyCampaigns.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected({ kind: 'campaign', data: c })}
                className={`w-full text-left p-4 rounded-2xl border transition-all space-y-2 bg-card ${
                  selected?.kind === 'campaign' && selected.data.id === c.id ? 'border-accent shadow-md ring-1 ring-accent/30' : 'border-border hover:border-accent/40'
                }`}
              >
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface text-accent font-semibold">Campanha</span>
                <h3 className="font-display font-bold text-sm text-ink">{c.name}</h3>
                <p className="text-xs text-muted font-body">{c.quick_replies.length} botão(ões) configurado(s)</p>
              </button>
            ))}
          </div>

          {/* Detalhe */}
          <div className="lg:col-span-8 bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
            {selected?.kind === 'flow' && (
              <>
                <div className="border-b border-border pb-4">
                  <h3 className="font-display font-bold text-xl text-ink">Agendamento via WhatsApp</h3>
                  <p className="text-xs text-muted font-body mt-0.5">
                    Edite gatilho e mensagens em <Link to="/settings" className="text-accent hover:underline">Configurações da Loja</Link>.
                  </p>
                </div>
                <div className="bg-surface/40 border border-border/80 rounded-2xl p-6 space-y-4">
                  <FlowNode icon={Zap} color="accent" title="Gatilho" detail={`Cliente escreve "${selected.data.trigger_keyword}" (ou variação configurada)`} />
                  <Connector />
                  <FlowNode icon={MessageSquare} color="muted" title="Pergunta o turno" detail={selected.data.ask_period_message || '(mensagem não configurada)'} />
                  <Connector />
                  <FlowNode icon={Sliders} color="amber" title="Cliente responde manhã ou tarde" detail="Reconhece a resposta automaticamente" />
                  <Connector />
                  <FlowNode icon={CheckCircle} color="emerald" title="Confirma e notifica" detail={selected.data.confirm_message || '(mensagem não configurada)'} />
                </div>
                {!selected.data.notify_phone && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Nenhum número interno configurado pra receber a notificação de agendamento.</span>
                  </div>
                )}
              </>
            )}

            {selected?.kind === 'campaign' && (
              <>
                <div className="border-b border-border pb-4">
                  <h3 className="font-display font-bold text-xl text-ink">{selected.data.name}</h3>
                  <p className="text-xs text-muted font-body mt-0.5">
                    Edite os botões em <Link to="/campaigns" className="text-accent hover:underline">Campanhas & Histórico</Link>.
                  </p>
                </div>
                <div className="bg-surface/40 border border-border/80 rounded-2xl p-6 space-y-4">
                  {selected.data.quick_replies.map((opt, i) => (
                    <div key={opt.id || i}>
                      <FlowNode icon={Bot} color="accent" title={`Botão: "${opt.label}"`} detail={`Ação: ${opt.action}${opt.message ? ` — "${opt.message}"` : ''}`} />
                      {i < selected.data.quick_replies.length - 1 && <Connector />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FlowNode({ icon: Icon, color, title, detail }) {
  const colorClasses = {
    accent: 'border-accent bg-accent/5',
    amber: 'border-amber-400 bg-amber-500/5',
    emerald: 'border-emerald-500 bg-emerald-500/5',
    muted: 'border-border',
  }
  const iconClasses = {
    accent: 'text-accent', amber: 'text-amber-500', emerald: 'text-emerald-600', muted: 'text-muted',
  }
  return (
    <div className={`w-full bg-card border rounded-2xl p-4 shadow-sm ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={15} className={iconClasses[color]} />
        <span className="font-display font-bold text-xs text-ink">{title}</span>
      </div>
      <p className="text-xs text-muted font-body pl-6">{detail}</p>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex flex-col items-center -my-1">
      <div className="w-0.5 h-5 bg-border" />
      <ArrowDown size={13} className="text-muted/60 -mt-1" />
    </div>
  )
}
