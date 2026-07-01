import { useState } from 'react'
import { Tag, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

// =============================================
// Precificação por custo real + margem (2026-07-01)
// Fórmula pedida pelo Leonardo: mensalidade = custo de infra do plano
// (Z-API por número + fatia do custo fixo) × 1,30 (30% de lucro em cima
// do custo, não 30% de margem sobre a receita — são coisas diferentes;
// isso aqui é markup de 30%).
//
// Custos reais (ajuste aqui se o valor pago mudar):
// =============================================
const ZAPI_PER_INSTANCE = 99.99   // pago por número/instância WhatsApp
const MAKE_CORE = 45              // Make.com — pode cair pra R$0 (free tier)
                                    // agora que nenhuma automação de cliente
                                    // depende mais do Make (ver decisão de
                                    // 2026-07-01 no AGENT.md do CTO-ZapFlow)
const SUPABASE_PRO = 125          // banco + auth + edge functions, fixo
const FIXED_OVERHEAD = MAKE_CORE + SUPABASE_PRO
const MARKUP = 1.30               // 30% de lucro em cima do custo
const BASELINE_CLIENTS = 10       // premissa pra ratear custo fixo ao definir PREÇO DE TABELA
                                    // (diferente do simulador de margem abaixo, que usa a
                                    // contagem real de clientes ativos)

function computeMonthly(numbers) {
  const cost = numbers * ZAPI_PER_INSTANCE + FIXED_OVERHEAD / BASELINE_CLIENTS
  return { cost, monthly: cost * MARKUP }
}

// Nomes/estrutura substituem Starter/Basic/Pro/Business/Enterprise antigos.
// Setup começa em R$800 (pedido explícito) e escala com a complexidade —
// não é fórmula de custo, é decisão comercial; ajuste livremente.
const PLANS = [
  { name: 'Starter', numbers: 1, maxContacts: 1000, setup: 800 },
  { name: 'Growth', numbers: 2, maxContacts: 2000, setup: 1500 },
  { name: 'Scale', numbers: 5, maxContacts: 5000, setup: 2800 },
  { name: 'Enterprise', numbers: 10, maxContacts: null, setup: 4500 },
].map(p => {
  const { cost, monthly } = computeMonthly(p.numbers)
  // Arredonda pra terminar em 9 (convenção comum de SaaS BR) sem se afastar
  // muito do valor calculado pela fórmula.
  const monthlyRounded = Math.round(monthly / 10) * 10 - 1
  return { ...p, costBasis: cost, monthly: monthlyRounded }
})

function calcMargin(plan, clientCount) {
  const zapiCost = plan.numbers * ZAPI_PER_INSTANCE
  const fixedPc = FIXED_OVERHEAD / Math.max(1, clientCount)
  const totalCost = zapiCost + fixedPc
  const margin = plan.monthly - totalCost
  const pct = Math.round((margin / plan.monthly) * 100)
  return { zapiCost, fixedPc, totalCost, margin, pct }
}

export default function AdminPricing() {
  const [clientCount, setClientCount] = useState(5)

  function exportExcel() {
    const data = PLANS.map(p => {
      const { zapiCost, fixedPc, totalCost, margin, pct } = calcMargin(p, clientCount)
      return {
        Plano: p.name,
        'Números WPP': p.numbers,
        'Máx. contatos': p.maxContacts || 'Ilimitado',
        'Setup (R$)': p.setup,
        'Mensalidade (R$)': p.monthly,
        'Custo Z-API (R$)': zapiCost.toFixed(2),
        'Custo fixo/cliente (R$)': fixedPc.toFixed(2),
        'Custo total estimado (R$)': totalCost.toFixed(2),
        'Margem estimada (R$)': margin.toFixed(0),
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
          <p className="text-muted text-sm font-body mt-1">Mensalidade = (custo real de infra) × 1,30 — 30% de lucro em cima do custo</p>
        </div>
        <button onClick={exportExcel} className="flex items-center gap-2 border border-border text-muted hover:text-white px-4 py-2.5 rounded-lg text-sm font-body transition-colors">
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-semibold text-white mb-4">Custos fixos mensais (sua infra)</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <CostCard label="Make.com (Core)" value="R$ 45" note="/mês — reavaliar, sem uso ativo hoje" />
          <CostCard label="Supabase Pro" value="R$ 125" note="/mês" />
          <CostCard label="Z-API" value="R$ 99,99" note="por instância/mês" color />
        </div>
        <div className="bg-surface rounded-xl p-4 flex items-center gap-4">
          <div>
            <p className="text-muted text-xs font-body">Quantos clientes ativos você tem agora?</p>
            <p className="text-xs text-muted font-body mt-0.5">Só afeta a simulação de margem abaixo — o preço de tabela usa uma base fixa de {BASELINE_CLIENTS} clientes pra não mudar toda hora</p>
          </div>
          <input type="number" min={1} max={200} value={clientCount} onChange={e => setClientCount(Number(e.target.value))}
            className="w-20 bg-card border border-border rounded-lg px-3 py-2 text-white text-sm font-body text-center focus:outline-none focus:border-accent ml-auto" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display font-semibold text-white">Análise de margem por plano (com {clientCount} clientes ativos)</h3>
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
                const { zapiCost, fixedPc, totalCost, margin, pct } = calcMargin(p, clientCount)
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

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Tag size={16} className="text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-muted font-body">
            <strong className="text-white">Onde isso trava de verdade:</strong> os limites de número e contato de cada plano (tabela <code className="text-accent">plan_limits</code>, ver <code className="text-accent">supabase_planos_limites.sql</code>) bloqueiam de fato quem tenta importar mais contatos ou cadastrar mais números do que o plano permite — não é só informativo, essa página aqui é a referência de preço, quem trava é o sistema.
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-display font-semibold text-white mb-4">Planos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map(p => (
            <div key={p.name} className={`bg-card border rounded-xl p-5 ${p.name === 'Growth' ? 'border-accent' : 'border-border'}`}>
              {p.name === 'Growth' && <span className="text-xs bg-accent text-bg px-2 py-0.5 rounded font-body font-medium mb-3 inline-block">Mais vendido</span>}
              <h4 className="font-display font-bold text-xl text-white">{p.name}</h4>
              <p className="text-3xl font-display font-bold text-accent mt-2">R$ {p.monthly}<span className="text-base text-muted font-body font-normal">/mês</span></p>
              <p className="text-xs text-muted font-body mt-1">+ R$ {p.setup.toLocaleString()} de setup (único)</p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-xs text-muted font-body"><span className="text-accent">✓</span> {p.numbers} número{p.numbers > 1 ? 's' : ''} WhatsApp</li>
                <li className="flex items-center gap-2 text-xs text-muted font-body"><span className="text-accent">✓</span> {p.maxContacts ? `${p.maxContacts.toLocaleString()} contatos` : 'Contatos ilimitados'}</li>
                <li className="flex items-center gap-2 text-xs text-muted font-body"><span className="text-accent">✓</span> Campanhas e automações (sem disparo manual — tudo passa pelo motor automático)</li>
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
