import { useEffect, useState } from 'react'
import { Workflow, Plus, Trash2, Play, Pause, X, Cake, MessageCircle, Tag, Clock, GitBranch } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// MVP v1 — fluxo LINEAR (sem ramificação visual). O bloco "condição" existe
// no motor (automation_steps.next_step_id_if_false) mas nesta UI ele só
// funciona como um "portão": se falso, a automação termina ali. Ramificação
// completa (SIM/NÃO visual) fica para v2 — ver ROADMAP-AUTOMACAO-MVP.md.

const TRIGGERS = [
  { value: 'birthday', label: 'Aniversário do contato', icon: Cake, available: true },
  { value: 'tag_added', label: 'Tag adicionada (em breve)', icon: Tag, available: false },
  { value: 'first_purchase', label: 'Primeira compra (em breve)', icon: MessageCircle, available: false },
]

const STEP_TYPES = [
  { kind: 'action', block: 'send_whatsapp', label: 'Enviar WhatsApp', icon: MessageCircle },
  { kind: 'action', block: 'add_tag', label: 'Adicionar tag', icon: Tag },
  { kind: 'action', block: 'wait', label: 'Esperar', icon: Clock },
  { kind: 'condition', block: 'has_tag', label: 'Só continuar se tiver tag', icon: GitBranch },
]

export default function Automations() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [automations, setAutomations] = useState([])
  const [numbers, setNumbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { if (clientId) fetchData() }, [clientId])

  async function fetchData() {
    setLoading(true)
    const { data: autos } = await supabase
      .from('automations')
      .select('*, automation_steps(id, kind, block)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setAutomations(autos || [])
    const { data: nums } = await supabase.from('client_numbers').select('*').eq('client_id', clientId)
    setNumbers(nums || [])
    setLoading(false)
  }

  async function toggleStatus(automation) {
    const next = automation.status === 'active' ? 'paused' : 'active'
    await supabase.from('automations').update({ status: next, updated_at: new Date().toISOString() }).eq('id', automation.id)
    fetchData()
  }

  async function removeAutomation(id) {
    if (!confirm('Excluir esta automação? Isso não afeta execuções já concluídas, mas cancela as pendentes.')) return
    await supabase.from('automations').delete().eq('id', id)
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Automações</h1>
          <p className="text-muted text-sm font-body mt-1">Monte fluxos que rodam sozinhos, sem depender de disparo manual</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
          <Plus size={16} /> Nova automação
        </button>
      </div>

      {loading ? (
        <p className="text-muted text-sm font-body">Carregando...</p>
      ) : automations.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Workflow size={40} className="text-muted mx-auto mb-4" />
          <p className="text-white font-body font-medium mb-1">Nenhuma automação ainda</p>
          <p className="text-muted text-sm font-body">Crie a primeira — por exemplo, uma mensagem automática de aniversário</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {automations.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center shrink-0">
                <Workflow size={18} className="text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-white font-body font-medium">{a.name}</p>
                <p className="text-muted text-xs font-body">{(a.automation_steps || []).length} passo(s)</p>
              </div>
              <span className={`text-xs font-body px-2 py-1 rounded-full ${a.status === 'active' ? 'bg-accent/15 text-accent' : 'bg-border text-muted'}`}>
                {a.status === 'active' ? 'Ativa' : a.status === 'paused' ? 'Pausada' : 'Rascunho'}
              </span>
              <button onClick={() => toggleStatus(a)} title={a.status === 'active' ? 'Pausar' : 'Ativar'}
                className="text-muted hover:text-accent transition-colors p-2">
                {a.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button onClick={() => removeAutomation(a.id)} title="Excluir" className="text-muted hover:text-red-400 transition-colors p-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewAutomationModal clientId={clientId} numbers={numbers} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchData() }} />
      )}
    </div>
  )
}

function NewAutomationModal({ clientId, numbers, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [numberId, setNumberId] = useState(numbers[0]?.id || '')
  const [trigger, setTrigger] = useState('birthday')
  const [steps, setSteps] = useState([])
  const [saving, setSaving] = useState(false)

  function addStep(type) {
    setSteps(s => [...s, { localId: crypto.randomUUID(), kind: type.kind, block: type.block, config: {} }])
  }

  function updateStepConfig(localId, config) {
    setSteps(s => s.map(st => st.localId === localId ? { ...st, config } : st))
  }

  function removeStep(localId) {
    setSteps(s => s.filter(st => st.localId !== localId))
  }

  async function handleSave() {
    if (!name.trim()) return alert('Dá um nome pra automação.')
    if (!numberId) return alert('Selecione o número de WhatsApp que vai disparar.')
    if (steps.length === 0) return alert('Adiciona pelo menos um passo.')

    setSaving(true)
    try {
      const { data: automation, error: autoErr } = await supabase
        .from('automations')
        .insert({ client_id: clientId, number_id: numberId, name, status: 'active' })
        .select()
        .single()
      if (autoErr) throw autoErr

      // Gera ids client-side pra já poder linkar next_step_id no insert
      const triggerId = crypto.randomUUID()
      const stepIds = steps.map(() => crypto.randomUUID())

      const rows = [
        {
          id: triggerId, automation_id: automation.id, kind: 'trigger', block: trigger,
          config: {}, order_index: 0, next_step_id: stepIds[0] || null,
        },
        ...steps.map((s, i) => ({
          id: stepIds[i], automation_id: automation.id, kind: s.kind, block: s.block,
          config: s.config, order_index: i + 1,
          next_step_id: stepIds[i + 1] || null,
          // condição: se falso, termina a automação (v1 é "portão", não ramificação)
          next_step_id_if_false: s.kind === 'condition' ? null : null,
        })),
      ]

      const { error: stepsErr } = await supabase.from('automation_steps').insert(rows)
      if (stepsErr) throw stepsErr

      onCreated()
    } catch (e) {
      alert('Erro ao salvar: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-white">Nova automação</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>

        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Nome</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Boas-vindas de aniversário"
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body placeholder-muted/40 focus:outline-none focus:border-accent" />
        </div>

        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Número que vai disparar</label>
          <select value={numberId} onChange={e => setNumberId(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
            {numbers.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Gatilho</label>
          <div className="space-y-2">
            {TRIGGERS.map(t => (
              <label key={t.value} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer ${!t.available ? 'opacity-40 cursor-not-allowed' : trigger === t.value ? 'border-accent bg-accent/5' : 'border-border'}`}>
                <input type="radio" name="trigger" disabled={!t.available} checked={trigger === t.value} onChange={() => setTrigger(t.value)} className="accent-accent" />
                <t.icon size={16} className="text-muted" />
                <span className="text-sm text-white font-body">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Passos (em ordem)</label>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <StepEditor key={s.localId} index={i} step={s} numbers={numbers}
                onChange={cfg => updateStepConfig(s.localId, cfg)} onRemove={() => removeStep(s.localId)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {STEP_TYPES.map(t => (
              <button key={t.block} onClick={() => addStep(t)}
                className="flex items-center gap-1.5 text-xs text-accent border border-accent/30 px-3 py-1.5 rounded-lg font-body hover:bg-accent/10 transition-colors">
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-3 rounded-lg text-sm font-display font-bold transition-colors">
          {saving ? 'Salvando...' : 'Criar automação'}
        </button>
      </div>
    </div>
  )
}

function StepEditor({ index, step, onChange, onRemove }) {
  const type = STEP_TYPES.find(t => t.block === step.block)
  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-surface/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white font-body font-medium">
          <span className="text-muted text-xs">{index + 1}.</span>
          <type.icon size={14} className="text-accent" /> {type.label}
        </div>
        <button onClick={onRemove} className="text-muted hover:text-red-400"><X size={14} /></button>
      </div>

      {step.block === 'send_whatsapp' && (
        <textarea rows={2} placeholder="Mensagem — use {{nome}} para personalizar"
          value={step.config.message || ''} onChange={e => onChange({ ...step.config, message: e.target.value })}
          className="w-full bg-bg border border-border rounded px-3 py-2 text-xs text-white font-body placeholder-muted/40 focus:outline-none focus:border-accent resize-none" />
      )}

      {step.block === 'add_tag' && (
        <input placeholder="Nome da tag" value={step.config.tag || ''} onChange={e => onChange({ ...step.config, tag: e.target.value })}
          className="w-full bg-bg border border-border rounded px-3 py-2 text-xs text-white font-body placeholder-muted/40 focus:outline-none focus:border-accent" />
      )}

      {step.block === 'wait' && (
        <div className="flex items-center gap-2">
          <input type="number" min={0} placeholder="dias" value={step.config.days || ''}
            onChange={e => onChange({ ...step.config, days: Number(e.target.value) })}
            className="w-20 bg-bg border border-border rounded px-3 py-2 text-xs text-white font-body focus:outline-none focus:border-accent" />
          <span className="text-xs text-muted font-body">dias</span>
        </div>
      )}

      {step.block === 'has_tag' && (
        <input placeholder="Só continua se o contato tiver esta tag" value={step.config.tag || ''}
          onChange={e => onChange({ ...step.config, tag: e.target.value })}
          className="w-full bg-bg border border-border rounded px-3 py-2 text-xs text-white font-body placeholder-muted/40 focus:outline-none focus:border-accent" />
      )}
    </div>
  )
}
