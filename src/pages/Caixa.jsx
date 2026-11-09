import { useEffect, useState } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'

// ZapFlow — Caixa (2026-11-09). Abre/fecha sessão, registra sangria e
// suprimento, confere dinheiro informado x esperado no fechamento. O
// "esperado" soma opportunity_payments (vendas do PDV nesta sessão) +
// saldo inicial + suprimentos - sangrias, só pro método dinheiro (os
// outros métodos não têm "gaveta" pra conferir).
function money(n) {
  return `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`
}

export default function Caixa() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [session, setSession] = useState(null)
  const [payments, setPayments] = useState([])
  const [movements, setMovements] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialAmount, setInitialAmount] = useState('')
  const [movementModal, setMovementModal] = useState(null) // 'sangria' | 'suprimento' | null
  const [closeModal, setCloseModal] = useState(false)

  useEffect(() => { if (clientId) fetchSession() }, [clientId])

  async function fetchSession() {
    setLoading(true)
    const { data: sess } = await supabase.from('cash_sessions').select('*').eq('client_id', clientId).eq('status', 'open').maybeSingle()
    setSession(sess || null)
    if (sess) {
      const { data: pays } = await supabase.from('opportunity_payments').select('method, amount').eq('cash_session_id', sess.id)
      setPayments(pays || [])
      const { data: movs } = await supabase.from('cash_movements').select('*').eq('cash_session_id', sess.id).order('created_at', { ascending: false })
      setMovements(movs || [])
    } else {
      const { data: hist } = await supabase.from('cash_sessions').select('*').eq('client_id', clientId).eq('status', 'closed').order('closed_at', { ascending: false }).limit(5)
      setHistory(hist || [])
    }
    setLoading(false)
  }

  async function openSession(e) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('cash_sessions').insert({ client_id: clientId, opened_by: userData?.user?.id, initial_amount: Number(initialAmount) || 0 })
    setInitialAmount('')
    fetchSession()
  }

  const byMethod = (method) => payments.filter(p => p.method === method).reduce((s, p) => s + Number(p.amount), 0)
  const sangrias = movements.filter(m => m.type === 'sangria').reduce((s, m) => s + Number(m.amount), 0)
  const suprimentos = movements.filter(m => m.type === 'suprimento').reduce((s, m) => s + Number(m.amount), 0)
  const expectedCash = session ? Number(session.initial_amount) + byMethod('dinheiro') + suprimentos - sangrias : 0
  const totalSales = payments.reduce((s, p) => s + Number(p.amount), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!session) return (
    <div className="max-w-md mx-auto mt-10 space-y-6">
      <div>
        <h1 className="font-display font-bold text-3xl text-white">Caixa</h1>
        <p className="text-muted text-sm font-body mt-1">Nenhum caixa aberto.</p>
      </div>
      <form onSubmit={openSession} className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs text-muted font-body mb-1.5">Saldo inicial (troco)</label>
          <input type="number" min="0" step="0.01" value={initialAmount} onChange={e => setInitialAmount(e.target.value)} placeholder="0,00" autoFocus
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-lg text-white font-body text-center focus:outline-none focus:border-accent" />
        </div>
        <button type="submit" className="w-full bg-accent hover:bg-accent-dim text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors flex items-center justify-center gap-2">
          <Wallet size={16} /> Abrir caixa
        </button>
      </form>

      {history.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-white text-sm mb-3 flex items-center gap-2"><History size={14} /> Últimos fechamentos</h3>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-card border border-border rounded-lg px-4 py-2.5 flex justify-between text-xs font-body">
                <span className="text-muted">{new Date(h.closed_at).toLocaleDateString('pt-BR')}</span>
                <span className="text-white">{money(h.counted_cash)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Caixa</h1>
          <p className="text-muted text-sm font-body mt-1">Aberto desde {new Date(session.opened_at).toLocaleString('pt-BR')}.</p>
        </div>
        <button onClick={() => setCloseModal(true)} className="bg-red-400/10 hover:bg-red-400/20 text-red-400 px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
          Fechar caixa
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-muted text-[11px] font-mono uppercase tracking-wide mb-1">Total vendido</p>
          <p className="text-2xl font-display font-bold text-white">{money(totalSales)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-muted text-[11px] font-mono uppercase tracking-wide mb-1">Dinheiro esperado na gaveta</p>
          <p className="text-2xl font-display font-bold text-accent">{money(expectedCash)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-semibold text-white text-sm mb-3">Por forma de pagamento</h3>
        <div className="space-y-2">
          {['dinheiro', 'pix', 'debito', 'credito'].map(m => (
            <div key={m} className="flex justify-between text-sm font-body">
              <span className="text-muted capitalize">{m}</span>
              <span className="text-white">{money(byMethod(m))}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setMovementModal('sangria')} className="flex-1 flex items-center justify-center gap-2 bg-card border border-border hover:border-red-400/40 text-white py-2.5 rounded-lg text-sm font-body transition-colors">
          <ArrowDownCircle size={15} className="text-red-400" /> Sangria
        </button>
        <button onClick={() => setMovementModal('suprimento')} className="flex-1 flex items-center justify-center gap-2 bg-card border border-border hover:border-green-400/40 text-white py-2.5 rounded-lg text-sm font-body transition-colors">
          <ArrowUpCircle size={15} className="text-green-400" /> Suprimento
        </button>
      </div>

      {movements.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {movements.map(m => (
            <div key={m.id} className="flex justify-between items-center px-5 py-3 border-b border-border/50 last:border-0 text-sm font-body">
              <div>
                <span className={m.type === 'sangria' ? 'text-red-400' : 'text-green-400'}>{m.type === 'sangria' ? 'Sangria' : 'Suprimento'}</span>
                {m.reason && <span className="text-muted ml-2">· {m.reason}</span>}
              </div>
              <span className="text-white">{money(m.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {movementModal && <MovementModal type={movementModal} sessionId={session.id} onClose={() => setMovementModal(null)} onSaved={() => { setMovementModal(null); fetchSession() }} />}
      {closeModal && <CloseModal session={session} expectedCash={expectedCash} onClose={() => setCloseModal(false)} onSaved={() => { setCloseModal(false); fetchSession() }} />}
    </div>
  )
}

function MovementModal({ type, sessionId, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('cash_movements').insert({ cash_session_id: sessionId, type, amount: Number(amount), reason })
    setSaving(false)
    onSaved()
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm animate-fadein">
        <h3 className="font-display font-bold text-xl text-white mb-5 capitalize">{type}</h3>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Valor</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required autoFocus
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-lg text-white font-body text-center focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Motivo</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: troco pro vizinho, pagamento fornecedor..."
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">{saving ? 'Salvando...' : 'Confirmar'}</button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

function CloseModal({ session, expectedCash, onClose, onSaved }) {
  const [counted, setCounted] = useState('')
  const [saving, setSaving] = useState(false)
  const diff = counted !== '' ? Number(counted) - expectedCash : null

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('cash_sessions').update({ status: 'closed', closed_at: new Date().toISOString(), counted_cash: Number(counted) }).eq('id', session.id)
    setSaving(false)
    onSaved()
  }

  return (
    <Modal>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm animate-fadein">
        <h3 className="font-display font-bold text-xl text-white mb-2">Fechar caixa</h3>
        <p className="text-muted text-sm font-body mb-5">Esperado na gaveta: <strong className="text-white">{money(expectedCash)}</strong></p>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Dinheiro contado agora</label>
            <input type="number" min="0" step="0.01" value={counted} onChange={e => setCounted(e.target.value)} required autoFocus
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-lg text-white font-body text-center focus:outline-none focus:border-accent" />
          </div>
          {diff !== null && (
            <p className={`text-sm font-body text-center ${Math.abs(diff) < 0.01 ? 'text-green-400' : diff > 0 ? 'text-amber-400' : 'text-red-400'}`}>
              {Math.abs(diff) < 0.01 ? 'Caixa bateu certinho.' : diff > 0 ? `Sobrou ${money(diff)}` : `Faltou ${money(Math.abs(diff))}`}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-muted py-3 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-3 rounded-lg text-sm font-display font-bold transition-colors">{saving ? 'Fechando...' : 'Fechar caixa'}</button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
