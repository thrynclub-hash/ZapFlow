import { useState } from 'react'
import { Tag, Download, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

const ZAPI_PER_INSTANCE = 99.99
const MAKE_CORE = 45
const SUPABASE_PRO = 125
const FIXED_OVERHEAD = MAKE_CORE + SUPABASE_PRO // R$170/mês fixo

const PLANS = [
  { name: 'Starter', numbers: 1, maxContacts: 500, setup: 800, monthly: 299, features: ['1 número WPP', '500 contatos', 'Disparo manual', 'Histórico'] },
  { name: 'Basic', numbers: 2, maxContacts: 1500, setup: 1300, monthly: 449, features: ['2 números WPP', '1.500 contatos', 'Disparo manual', 'Aniversários', 'Relatórios'] },
  { name: 'Pro', numbers: 3, maxContacts: 5000, setup: 1800, monthly: 599, features: ['3 números WPP', '5.000 contatos', 'Tudo do Basic', 'Exportação Excel', 'Suporte prioritário'] },
  { name: 'Business', numbers: 5, maxContacts: 10000, setup: 2500, monthly: 899, features: ['5 números WPP', '10.000 contatos', 'Tudo do Pro', 'Relatórios avançados'] },
  { name: 'Enterprise', numbers: 10, maxContacts: null, setup: 4000, monthly: 1499, features: ['10+ números WPP', 'Contatos ilimitados', 'SLA garantido', 'Consultoria mensal'] },
]

function calcMargin(plan) {
  const zapiCost = plan.numbers * ZAPI_PER_INSTANCE
  const totalCost = zapiCost + (FIXED_OVERHEAD / Math.max(1, 3)) // distribui fixo por 3 clientes base
  const margin = plan.monthly - totalCost
  const pct = Math.round((margin / plan.monthly) * 100)
  return { zapiCost, totalCost: totalCost.toFixed(0), margin: margin.toFixed(0), pct }
}

export default function AdminPricing() {
  const [clientCount, setClientCount] = useState(5)
  const totalZapi = PLANS.reduce((s, p) => s, 0) // placeholder

  const fixedPerClient = FIXED_OVERHEAD / clientCount
  const revenue = PLANS.map(p => p.monthly).reduce((s, m) => s + m, 0)

  function exportExcel() {
    const data = PLANS.map(p => {
      const { zapiCost, margin, pct } = calcMargin(p)
      return {
        Plano: p.name,
        'Números WPP': p.numbers,
        'Máx. contatos': p.maxContacts || 'Ilimitado',
        'Setup (R$)': p.setup,
        'Mensalidade (R$)': p.monthly,
        'Custo Z-API (R$)': zapiCost.toFixed(2),
        'Custo fixo/cliente (R$)': fixedPerClient.toFixed(2),
        'Custo total estimado (R$)': (zapiCost + fixedPerClient).toFixed(2),
        'Margem estimada (R$)': margin,
        'Margem (%)': pct + '%',
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Precificação')
    XLSX.writeFile(wb, 'zapflow_precificacao.xlsx')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Planilha de Precificação</h1>
          <p className="text-muted text-sm font-body mt-1">Cálculo de margem por plano com base nos custos reais</p>
        </div>
        <button onClick={exportExcel} className="flex items-center gap-2 border border-border text-muted hover:text-white px-4 py-2.5 rounded-lg text-sm font-body transition-colors">
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      {/* Custos fixos */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-semibold text-white mb-4">Custos fixos mensais (sua infra)</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <CostCard label="Make.com (Core)" value="R$ 45" note="/mês" />
          <CostCard label="Supabase Pro" value="R$ 125" note="/mês" />
          <CostCard label="Z-API" value="R$ 99,99" note="por instância" color />
        </div>
        <div className="bg-surface rounded-xl p-4 flex items-center gap-4">
          <div>
            <p className="text-muted text-xs font-body">Quantos clientes ativos você tem agora?</p>
            <p className="text-xs text-muted font-body mt-0.5">Isso distribui o custo fixo entre eles</p>
          </div>
          <input type="number" min={1} max={100} value={clientCount} onChange={e => setClientCount(Number(e.target.value))}
            className="w-20 bg-card border border-border rounded-lg px-3 py-2 text-white text-sm font-body text-center focus:outline-none focus:border-accent ml-auto" />
          <p className="text-muted text-sm font-body">= <span className="text-white font-medium">R$ {(FIXED_OVERHEAD / clientCount).toFixed(0)}</span>/cliente</p>
        </div>
      </div>

      {/* Tabela de planos */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-white">Análise de margem por plano</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Plano</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Números</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Setup</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Mensalidade</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Custo Z-API</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Custo fixo/cliente</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Custo total</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Margem R$</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-body">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {PLANS.map(p => {
                const zapiCost = p.numbers * ZAPI_PER_INSTANCE
                const fixedPc = FIXED_OVERHEAD / clientCount
                const totalCost = zapiCost + fixedPc
                const margin = p.monthly - totalCost
                const pct = Math.round((margin / p.monthly) * 100)
                const marginColor = pct >= 50 ? 'text-green-400' : pct >= 30 ? 'text-accent' : 'text-red-400'

                return (
                  <tr key={p.name} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-white font-body font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted font-body">{p.maxContacts ? `${p.maxContacts.toLocaleString()} ctts` : '∞'}</span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-white font-body">{p.numbers}</td>
                    <td className="px-5 py-4 text-right text-sm text-white font-body">R$ {p.setup.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-sm font-body font-medium text-accent">R$ {p.monthly}</td>
                    <td className="px-5 py-4 text-right text-sm text-muted font-body">R$ {zapiCost.toFixed(0)}</td>
                    <td className="px-5 py-4 text-right text-sm text-muted font-body">R$ {fixedPc.toFixed(0)}</td>
                    <td className="px-5 py-4 text-right text-sm text-red-400 font-body">R$ {totalCost.toFixed(0)}</td>
                    <td className={`px-5 py-4 text-right text-sm font-body font-medium ${marginColor}`}>R$ {margin.toFixed(0)}</td>
                    <td className={`px-5 py-4 text-right text-sm font-body font-bold ${marginColor}`}>{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards dos planos */}
      <div>
        <h3 className="font-display font-semibold text-white mb-4">O que cada plano inclui</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PLANS.map(p => (
            <div key={p.name} className={`bg-card border rounded-xl p-5 ${p.name === 'Basic' ? 'border-accent' : 'border-border'}`}>
              {p.name === 'Basic' && <span className="text-xs bg-accent text-bg px-2 py-0.5 rounded font-body font-medium mb-3 inline-block">Mais vendido</span>}
              <h4 className="font-display font-bold text-xl text-white">{p.name}</h4>
              <p className="text-3xl font-display font-bold text-accent mt-2">R$ {p.monthly}<span className="text-base text-muted font-body font-normal">/mês</span></p>
              <p className="text-xs text-muted font-body mt-1">+ R$ {p.setup.toLocaleString()} de setup</p>
              <ul className="mt-4 space-y-2">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted font-body">
                    <span className="text-accent">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CostCard({ label, value, note, color }) {
  return (
    <div className={`bg-surface border rounded-xl p-4 ${color ? 'border-accent/30' : 'border-border'}`}>
      <p className="text-xs text-muted font-body">{label}</p>
      <p className={`text-2xl font-display font-bold mt-1 ${color ? 'text-accent' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-muted font-body">{note}</p>
    </div>
  )
}
