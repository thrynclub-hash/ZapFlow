import { useEffect, useState } from 'react'
import { Calculator, Download, Info } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Apoio ao Carnê-Leão / Declaração Mensal de Receita.
// NÃO substitui contador nem gera DARF — só soma o que já entrou no caixa
// (opportunity_payments) por mês, pra facilitar a hora de passar pro
// contador ou lançar no programa Carnê-Leão da Receita Federal.

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function money(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
}

export default function CarneLeao() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState([]) // [{month, dinheiro, pix, debito, credito, total}]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientId) fetchData()
  }, [clientId, year])

  async function fetchData() {
    setLoading(true)
    const start = `${year}-01-01T00:00:00`
    const end = `${year + 1}-01-01T00:00:00`

    const { data: payments } = await supabase
      .from('opportunity_payments')
      .select('method, amount, created_at, opportunity_id, opportunities!inner(client_id)')
      .eq('opportunities.client_id', clientId)
      .gte('created_at', start)
      .lt('created_at', end)

    const byMonth = Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i], dinheiro: 0, pix: 0, debito: 0, credito: 0, total: 0,
    }))

    for (const p of payments || []) {
      const m = new Date(p.created_at).getMonth()
      const amount = Number(p.amount) || 0
      byMonth[m].total += amount
      if (p.method === 'dinheiro') byMonth[m].dinheiro += amount
      else if (p.method === 'pix') byMonth[m].pix += amount
      else if (p.method === 'debito') byMonth[m].debito += amount
      else if (p.method === 'credito') byMonth[m].credito += amount
    }

    setRows(byMonth)
    setLoading(false)
  }

  const yearTotal = rows.reduce((s, r) => s + r.total, 0)

  function exportXlsx() {
    const sheetRows = rows.map(r => ({
      Mês: r.month,
      Dinheiro: r.dinheiro,
      Pix: r.pix,
      Débito: r.debito,
      Crédito: r.credito,
      Total: r.total,
    }))
    sheetRows.push({ Mês: 'TOTAL', Dinheiro: rows.reduce((s, r) => s + r.dinheiro, 0), Pix: rows.reduce((s, r) => s + r.pix, 0), Débito: rows.reduce((s, r) => s + r.debito, 0), Crédito: rows.reduce((s, r) => s + r.credito, 0), Total: yearTotal })
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Receita ${year}`)
    XLSX.writeFile(wb, `receita-mensal-${year}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Apoio ao Carnê-Leão</h1>
          <p className="text-muted text-sm font-body mt-1">Receita mensal consolidada, pronta pra levar ao contador ou lançar na Receita Federal.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink font-body focus:outline-none focus:border-accent"
          >
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={exportXlsx}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white font-display font-bold px-4 py-2.5 rounded-xl transition-colors text-sm shadow-sm"
          >
            <Download size={15} /> Exportar planilha
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl p-4">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>
          Isto <strong>não substitui contador nem gera DARF automaticamente</strong> — é um apoio pra facilitar na
          hora das contas. Os valores vêm do que já foi registrado como recebido (PDV + vendas fechadas) no ZapFlow.
        </span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs text-muted font-body uppercase tracking-wider">Receita total em {year}</p>
        <p className="font-display font-bold text-3xl text-ink mt-1 flex items-center gap-2">
          <Calculator size={22} className="text-accent" /> {money(yearTotal)}
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface/40">
                <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Mês</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Dinheiro</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Pix</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Débito</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Crédito</th>
                <th className="text-right px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted text-sm">Carregando...</td></tr>
              ) : rows.map(r => (
                <tr key={r.month} className="hover:bg-surface/30 transition-colors">
                  <td className="px-5 py-3 text-sm text-ink font-body font-medium">{r.month}</td>
                  <td className="px-5 py-3 text-sm text-ink font-mono text-right">{money(r.dinheiro)}</td>
                  <td className="px-5 py-3 text-sm text-ink font-mono text-right">{money(r.pix)}</td>
                  <td className="px-5 py-3 text-sm text-ink font-mono text-right">{money(r.debito)}</td>
                  <td className="px-5 py-3 text-sm text-ink font-mono text-right">{money(r.credito)}</td>
                  <td className="px-5 py-3 text-sm text-ink font-mono text-right font-bold">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
