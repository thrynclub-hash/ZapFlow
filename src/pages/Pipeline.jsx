import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Pipeline CRM (visual do lifecycle_stage que já existe desde a
// Fase 2/Phase 5 — ver Contacts.jsx). Antes disso o dado só vivia como
// dropdown na lista; aqui vira board, igual referência (vocero-crm "pipeline
// kanban"). Drag nativo HTML5, sem lib nova — 4 colunas fixas, dá pra
// arrastar card entre elas. VIP continua manual (REGRA do CRM-03, nunca
// automático), as outras 3 mudam de mão livre aqui também (o cron/webhook
// de verdade continuam sendo a fonte "automática"; isto é ajuste manual).
const STAGES = [
  { key: 'Novo', label: 'Novo', tint: 'bg-blue-400/10 text-blue-300 border-blue-400/20' },
  { key: 'Ativo', label: 'Ativo', tint: 'bg-green-400/10 text-green-400 border-green-400/20' },
  { key: 'Dormindo', label: 'Dormindo', tint: 'bg-muted/10 text-muted border-border' },
  { key: 'VIP', label: 'VIP', tint: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
]

export default function Pipeline() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragOverStage, setDragOverStage] = useState(null)

  useEffect(() => { if (clientId) fetchContacts() }, [clientId])

  async function fetchContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('id, name, phone, lifecycle_stage, lifecycle_last_interaction_at')
      .eq('client_id', clientId)
      .order('lifecycle_last_interaction_at', { ascending: false, nullsFirst: false })
    setContacts(data || [])
    setLoading(false)
  }

  async function moveTo(contact, nextStage) {
    const current = contact.lifecycle_stage || 'Novo'
    if (current === nextStage) return
    setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, lifecycle_stage: nextStage } : c))
    await supabase.from('contacts').update({ lifecycle_stage: nextStage }).eq('id', contact.id)
    await supabase.from('contact_lifecycle_log').insert({
      contact_id: contact.id, client_id: clientId, from_stage: current, to_stage: nextStage, reason: 'movido no pipeline',
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Pipeline</h1>
        <p className="text-muted text-sm font-body mt-1">Arrasta o contato pra mudar de estágio.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGES.map((stage) => {
          const items = contacts.filter((c) => (c.lifecycle_stage || 'Novo') === stage.key)
          return (
            <div
              key={stage.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.key) }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverStage(null)
                const id = e.dataTransfer.getData('text/plain')
                const contact = contacts.find((c) => c.id === id)
                if (contact) moveTo(contact, stage.key)
              }}
              className={`rounded-[14px] border p-3 min-h-[200px] transition-colors ${
                dragOverStage === stage.key ? 'border-accent bg-accent/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-3">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wide border ${stage.tint}`}>
                  {stage.label}
                </span>
                <span className="text-muted text-xs font-mono">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                    className="bg-bg border border-border rounded-[10px] p-3 cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
                  >
                    <p className="text-sm text-white font-body font-medium truncate">{c.name}</p>
                    <p className="text-muted text-xs font-body mt-1 flex items-center gap-1.5">
                      <Phone size={11} />
                      {c.phone}
                    </p>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-muted text-xs font-body text-center py-6">Nenhum contato</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
