import { useState, useMemo } from 'react'
import { Tag, Download, Calculator, Bot, Sparkles, Copy, Check, DollarSign, ShieldCheck, ArrowRight, Layers } from 'lucide-react'
import * as XLSX from 'xlsx'

// ZapFlow — Precificação & Simulador de Propostas Comerciais (Grokbot + ERP Whitelabel)
// Permite ao Leonardo e aos Revendedores simularem custos de tokens, infraestrutura,
// margem de lucro garantida e gerarem propostas prontas para o lojista final.

const ZAPI_PER_INSTANCE = 99.99
const SUPABASE_PRO = 125
const FIXED_OVERHEAD = SUPABASE_PRO
const BASELINE_CLIENTS = 10

// Custo estimado xAI Grok (por conversa média com 10 interações + ferramentas de fotos e catálogo)
const GROK_COST_PER_CONVERSATION = 0.045 // ~R$ 0,045 por atendimento completo

const VERTICALS = [
  { id: 'moda', name: 'Moda & Loja de Roupas', defaultVolume: 1500, setupSuggested: 1500, monthlySuggested: 790 },
  { id: 'estetica', name: 'Clínica & Estética', defaultVolume: 800, setupSuggested: 1200, monthlySuggested: 690 },
  { id: 'varejo', name: 'Varejo & Acessórios', defaultVolume: 2000, setupSuggested: 1800, monthlySuggested: 890 },
  { id: 'alimentacao', name: 'Doceria & Alimentação', defaultVolume: 2500, setupSuggested: 1600, monthlySuggested: 850 },
  { id: 'servicos', name: 'Prestadores de Serviço', defaultVolume: 600, setupSuggested: 1000, monthlySuggested: 590 },
]

function money(val) {
  return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`
}

export default function AdminPricing() {
  const [activeTab, setActiveTab] = useState('simulador') // simulador | infra
  const [clientCount, setClientCount] = useState(10)

  // Estados do Simulador
  const [selectedVertical, setSelectedVertical] = useState('moda')
  const [conversations, setConversations] = useState(1500)
  const [hasGrok, setHasGrok] = useState(true)
  const [hasStock, setHasStock] = useState(true)
  const [hasPdv, setHasPdv] = useState(true)
  const [hasFiscal, setHasFiscal] = useState(false)
  const [copied, setCopied] = useState(false)

  // Margem personalizada do revendedor
  const currentVertical = VERTICALS.find(v => v.id === selectedVertical) || VERTICALS[0]
  const [customMonthly, setCustomMonthly] = useState(currentVertical.monthlySuggested)
  const [customSetup, setCustomSetup] = useState(currentVertical.setupSuggested)

  // Atualiza valores sugeridos ao mudar vertical
  function handleVerticalChange(vertId) {
    setSelectedVertical(vertId)
    const vert = VERTICALS.find(v => v.id === vertId)
    if (vert) {
      setConversations(vert.defaultVolume)
      setCustomMonthly(vert.monthlySuggested)
      setCustomSetup(vert.setupSuggested)
    }
  }

  // Cálculos do Simulador
  const simulation = useMemo(() => {
    // 1. Custo Real de Infraestrutura
    const zapiCost = ZAPI_PER_INSTANCE
    const grokTokenCost = hasGrok ? conversations * GROK_COST_PER_CONVERSATION : 0
    const fixedInfraShare = FIXED_OVERHEAD / Math.max(1, clientCount)
    const totalRealCost = zapiCost + grokTokenCost + fixedInfraShare

    // 2. Preço Cobrado pela Plataforma ZapFlow (Leonardo)
    // Cobre custos reais + margem saudável de 40%
    const zapflowBaseCharge = Math.max(249, Math.round((totalRealCost * 1.45) / 10) * 10 - 1)

    // 3. Lucro Líquido do Parceiro / Revendedor
    const partnerMonthlyProfit = customMonthly - zapflowBaseCharge
    const partnerFirstMonthTotal = Number(customSetup) + partnerMonthlyProfit
    const partnerMarginPct = Math.round((partnerMonthlyProfit / customMonthly) * 100)

    return {
      zapiCost,
      grokTokenCost,
      fixedInfraShare,
      totalRealCost,
      zapflowBaseCharge,
      partnerMonthlyProfit,
      partnerFirstMonthTotal,
      partnerMarginPct
    }
  }, [conversations, hasGrok, clientCount, customMonthly, customSetup])

  // Gerador de Proposta para WhatsApp
  function copyProposal() {
    const text = `*PROPOSTA COMERCIAL — SISTEMA DE VENDAS & GESTÃO*
Segmento: ${currentVertical.name}

Olá! Conforme conversamos, estruturei a solução ideal para automatizar o atendimento e as vendas da sua loja:

*O que está incluso na plataforma:*
${hasGrok ? '✅ Atendente de Vendas 24/7 no WhatsApp (envia fotos das peças, tira dúvidas de tamanhos, calcula frete e gera o Pix na hora sem parecer robô)' : ''}
${hasStock ? '✅ Catálogo & Controle de Estoque com Grade (cores, tamanhos P/M/G e fotos organizadas)' : ''}
${hasPdv ? '✅ Terminal PDV de Balcão Offline (sua loja nunca trava mesmo se a internet oscilar)' : ''}
${hasFiscal ? '✅ Emissão Integrada de NFC-e / NF-e no balcão' : ''}
✅ Zero dependência de ERP terceiro: tudo centralizado em um único painel.

*Investimento:*
• *Implantação & Setup*: ${money(customSetup)} (único — inclui cadastro inicial do catálogo, fotos e configuração da persona de atendimento)
• *Mensalidade Operacional*: ${money(customMonthly)}/mês (sem surpresas de faturas adicionais)

Com apenas 2 a 3 vendas a mais por mês recuperadas pelo atendimento rápido, o sistema já se paga totalmente.

Podemos dar início à implantação essa semana?`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-3xl text-ink">Precificação & Propostas</h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
              Motor Grokbot + Whitelabel
            </span>
          </div>
          <p className="text-muted text-sm font-body mt-1">
            Simulador de lucro para revendedores, cálculo de tokens e propostas sem risco de prejuízo.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
          <button
            onClick={() => setActiveTab('simulador')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-bold transition-colors ${
              activeTab === 'simulador' ? 'bg-accent text-white shadow-xs' : 'text-muted hover:text-ink'
            }`}
          >
            Simulador de Proposta
          </button>
          <button
            onClick={() => setActiveTab('infra')}
            className={`px-4 py-2 rounded-lg text-xs font-display font-bold transition-colors ${
              activeTab === 'infra' ? 'bg-accent text-white shadow-xs' : 'text-muted hover:text-ink'
            }`}
          >
            Custos de Infra
          </button>
        </div>
      </div>

      {activeTab === 'simulador' ? (
        <div className="space-y-6">
          {/* Grid de Configuração do Cliente da Ponta */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Lado Esquerdo: Configuração do Cenário (7 cols) */}
            <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Calculator size={18} className="text-accent" />
                <h3 className="font-display font-bold text-lg text-ink">Simular Novo Cliente / Loja</h3>
              </div>

              {/* Nicho */}
              <div>
                <label className="block text-xs font-body text-muted mb-2">Segmento da Loja do Cliente</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {VERTICALS.map(v => (
                    <button
                      key={v.id}
                      onClick={() => handleVerticalChange(v.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedVertical === v.id
                          ? 'border-accent bg-accent/10 text-accent font-semibold'
                          : 'border-border bg-surface/30 text-muted hover:text-ink'
                      }`}
                    >
                      <p className="text-xs font-body">{v.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume de Conversas da IA */}
              <div className="bg-surface/40 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-body font-medium text-ink block">
                      Volume Estimado de Atendimentos no WhatsApp
                    </label>
                    <span className="text-[11px] text-muted">Contatos vindos de anúncios, posts e clientes da base</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-accent bg-card px-3 py-1 rounded-lg border border-border">
                    {conversations.toLocaleString()} conversas/mês
                  </span>
                </div>

                <input
                  type="range"
                  min="200"
                  max="10000"
                  step="100"
                  value={conversations}
                  onChange={e => setConversations(Number(e.target.value))}
                  className="w-full accent-accent"
                />

                <div className="flex justify-between text-[10px] text-muted font-mono">
                  <span>200 (Loja início)</span>
                  <span>1.500 (Média com tráfego)</span>
                  <span>10.000 (Franquia)</span>
                </div>
              </div>

              {/* Módulos Habilitados */}
              <div className="space-y-2">
                <label className="block text-xs font-body text-muted">Módulos Contratados na Proposta</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasGrok}
                      onChange={e => setHasGrok(e.target.checked)}
                      className="rounded text-accent focus:ring-accent"
                    />
                    <div>
                      <p className="text-xs font-medium text-ink">Atendente Grokbot</p>
                      <p className="text-[10px] text-muted">Fotos + Pix + Promoções</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasStock}
                      onChange={e => setHasStock(e.target.checked)}
                      className="rounded text-accent focus:ring-accent"
                    />
                    <div>
                      <p className="text-xs font-medium text-ink">Estoque & Grade</p>
                      <p className="text-[10px] text-muted">Variações e Kardex nativo</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPdv}
                      onChange={e => setHasPdv(e.target.checked)}
                      className="rounded text-accent focus:ring-accent"
                    />
                    <div>
                      <p className="text-xs font-medium text-ink">PDV & Balcão</p>
                      <p className="text-[10px] text-muted">Venda rápida e Caixa</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasFiscal}
                      onChange={e => setHasFiscal(e.target.checked)}
                      className="rounded text-accent focus:ring-accent"
                    />
                    <div>
                      <p className="text-xs font-medium text-ink">Emissor Fiscal A1</p>
                      <p className="text-[10px] text-muted">NFC-e e NF-e própria</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Ajuste Fino dos Valores de Venda */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-body text-muted mb-1">Taxa de Setup / Implantação (R$)</label>
                  <input
                    type="number"
                    value={customSetup}
                    onChange={e => setCustomSetup(Number(e.target.value))}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-body text-muted mb-1">Mensalidade Cobrada do Lojista (R$)</label>
                  <input
                    type="number"
                    value={customMonthly}
                    onChange={e => setCustomMonthly(Number(e.target.value))}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink font-mono focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* Lado Direito: Breakdown Financeiro & Lucro Líquido (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <DollarSign size={18} className="text-emerald-600" />
                  <h3 className="font-display font-bold text-lg text-ink">Retorno & Margem Garantida</h3>
                </div>

                {/* Card de Lucro do Revendedor */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-body uppercase text-emerald-800 font-semibold tracking-wider">
                      Seu Lucro no 1º Mês
                    </span>
                    <span className="font-display font-bold text-2xl text-emerald-700">
                      {money(simulation.partnerFirstMonthTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline border-t border-emerald-500/20 pt-2 text-xs font-body text-emerald-900">
                    <span>Lucro Mensal Recorrente:</span>
                    <span className="font-mono font-bold text-sm">+{money(simulation.partnerMonthlyProfit)}/mês</span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs font-body text-emerald-900">
                    <span>Sua Margem Líquida:</span>
                    <span className="font-mono font-bold">{simulation.partnerMarginPct}% de margem</span>
                  </div>
                </div>

                {/* Composição de Custos Ocultos */}
                <div className="space-y-2 pt-2 border-t border-border font-mono text-xs">
                  <p className="text-[11px] font-body text-muted uppercase tracking-wider mb-2">Composição de Custos</p>

                  <div className="flex justify-between text-muted">
                    <span>Instância WhatsApp (Z-API):</span>
                    <span>{money(simulation.zapiCost)}</span>
                  </div>

                  {hasGrok && (
                    <div className="flex justify-between text-muted">
                      <span>Tokens Grokbot (~{conversations} conv):</span>
                      <span>{money(simulation.grokTokenCost)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-muted">
                    <span>Fatia Infraestrutura Supabase:</span>
                    <span>{money(simulation.fixedInfraShare)}</span>
                  </div>

                  <div className="flex justify-between text-red-500 font-medium pt-1 border-t border-border/50">
                    <span>Custo Real de Operação:</span>
                    <span>{money(simulation.totalRealCost)}</span>
                  </div>

                  <div className="flex justify-between text-accent font-bold pt-1">
                    <span>Custo ZapFlow (Repasse Leonardo):</span>
                    <span>{money(simulation.zapflowBaseCharge)}</span>
                  </div>
                </div>

                {/* Botão Copiar Proposta */}
                <button
                  onClick={copyProposal}
                  className="w-full bg-accent hover:bg-accent-dim text-white font-display font-bold py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={16} /> Proposta Copiada!
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Copiar Proposta para WhatsApp
                    </>
                  )}
                </button>
              </div>

              {/* Dica de Segurança e Anti-Prejuízo */}
              <div className="bg-surface/50 border border-border rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck size={18} className="text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-muted font-body leading-relaxed">
                  <strong className="text-ink">Trava Anti-Prejuízo:</strong> O custo dos tokens do Grokbot e do WhatsApp já está embutido na taxa do ZapFlow. O cliente nunca recebe faturas surpresa de APIs e você tem margem previsível todo mês.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Aba de Custos de Infraestrutura Fixos */
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-display font-semibold text-ink mb-4">Custos Fixos Mensais (Infraestrutura)</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <CostCard label="Supabase Pro" value="R$ 125,00" note="/mês (PostgreSQL + Auth + Storage)" />
              <CostCard label="Z-API WhatsApp" value="R$ 99,99" note="por instância/mês" color />
              <CostCard label="xAI Grok API" value="R$ 0,045" note="custo médio por conversa" />
            </div>

            <div className="bg-surface rounded-xl p-4 flex items-center gap-4">
              <div>
                <p className="text-muted text-xs font-body">Quantos clientes ativos na base?</p>
                <p className="text-xs text-muted font-body mt-0.5">Usado para ratear custos fixos e calcular a margem líquida global da plataforma.</p>
              </div>
              <input
                type="number"
                min={1}
                max={500}
                value={clientCount}
                onChange={e => setClientCount(Number(e.target.value))}
                className="w-24 bg-card border border-border rounded-xl px-3 py-2 text-ink text-sm font-mono text-center focus:outline-none focus:border-accent ml-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CostCard({ label, value, note, color }) {
  return (
    <div className={`bg-surface border rounded-xl p-4 ${color ? 'border-accent/40 bg-accent/5' : 'border-border'}`}>
      <p className="text-xs text-muted font-body">{label}</p>
      <p className={`text-2xl font-display font-bold mt-1 ${color ? 'text-accent' : 'text-ink'}`}>{value}</p>
      <p className="text-xs text-muted font-body mt-0.5">{note}</p>
    </div>
  )
}
