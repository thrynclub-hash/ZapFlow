import { useState } from 'react'
import {
  Workflow, Play, Plus, Sparkles, CheckCircle, ArrowRight, Clock,
  Bot, ShoppingBag, QrCode, AlertCircle, ArrowDown, ChevronRight,
  Zap, Copy, Sliders, ToggleLeft, ToggleRight, Layers, MessageSquare
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Builder Visual de Automações & Fluxos (Estilo n8n / Helena)
// Substitui formulários e tabelas antigas por um canvas visual com nós conectados,
// ramificações de decisão e templates prontos de alta conversão para o varejo.

const TEMPLATES = [
  {
    id: 'recuperacao-pix',
    name: 'Recuperação de Pix Abandonado',
    desc: 'Quando a cliente pede a chave Pix mas não paga em 30 min, a atendente manda um lembrete com foto da peça reservada.',
    badge: 'Mais Lucrativo (+35% vendas)',
    nodes: [
      { id: 1, type: 'trigger', title: 'Gatilho: Pix Gerado', detail: 'Cliente solicitou compra e recebeu o Pix' },
      { id: 2, type: 'wait', title: 'Aguardar: 35 minutos', detail: 'Tempo de tolerância para pagamento' },
      { id: 3, type: 'condition', title: 'Condição: Pix foi pago?', detail: 'Checa confirmação bancária' },
      { id: 4, type: 'action_yes', title: 'Se SIM: Baixa Estoque & Emite Nota', detail: 'Avisa a expedição para envio imediato' },
      { id: 5, type: 'action_no', title: 'Se NÃO: Mensagem Amigável', detail: 'Oi! Guardei a sua peça por mais 1h, precisa de ajuda com o Pix?' },
    ]
  },
  {
    id: 'boas-vindas-anuncios',
    name: 'Boas-Vindas a Leads de Anúncios',
    desc: 'Leads vindos do Instagram/TikTok são atendidos em 2 segundos pela IA, que envia a foto da peça anunciada.',
    badge: 'Atendimento Imediato',
    nodes: [
      { id: 1, type: 'trigger', title: 'Gatilho: Clique em Anúncio', detail: 'Cliente clicou no anúncio do Reels/Stories' },
      { id: 2, type: 'ai', title: 'Agente Sofia: Acolhimento Humanizado', detail: 'Olá! Vi que você gostou do vestido do anúncio!' },
      { id: 3, type: 'action', title: 'Ação: Enviar Fotos & Tabela de Medidas', detail: 'Envia fotos da peça na arara e grade disponível' },
      { id: 4, type: 'condition', title: 'Condição: Cliente escolheu tamanho?', detail: 'Identifica se é P, M ou G' },
      { id: 5, type: 'action_yes', title: 'Fechar Pedido & Gerar Pix', detail: 'Calcula frete e fecha a compra' },
    ]
  },
  {
    id: 'reativacao-clientes',
    name: 'Reativação de Clientes Inativos',
    desc: 'Dispara automaticamente para clientes que compraram há mais de 45 dias mas não voltaram à loja.',
    badge: 'Recompra Recorrente',
    nodes: [
      { id: 1, type: 'trigger', title: 'Gatilho: 45 Dias Sem Comprar', detail: 'Cliente da base sem novos pedidos' },
      { id: 2, type: 'ai', title: 'Mensagem com Novidades & Oferta', detail: 'Oi Camila! Chegou reposição da sua marca favorita!' },
      { id: 3, type: 'action', title: 'Cupom de R$ 20 de Boas-Vindas', detail: 'Cupom exclusivo válido por 48 horas' },
      { id: 4, type: 'wait', title: 'Aguardar 24 horas', detail: 'Tempo para abertura da conversa' },
      { id: 5, type: 'action_yes', title: 'Transferir p/ Vendedora Humana', detail: 'Se a cliente responder com dúvida' },
    ]
  },
  {
    id: 'aniversario-vip',
    name: 'Aniversariantes do Mês com Presente',
    desc: 'Lembra o aniversário da cliente no dia exato às 09h da manhã com um presente especial da loja.',
    badge: 'Fidelização',
    nodes: [
      { id: 1, type: 'trigger', title: 'Gatilho: Dia do Aniversário', detail: 'Disparo automático às 09:00' },
      { id: 2, type: 'ai', title: 'Mensagem Carinhosa Personalizada', detail: 'Parabéns {nome}! Um presente especial para o seu dia:' },
      { id: 3, type: 'action', title: 'Vale-Presente de 15% OFF', detail: 'Válido na loja física ou pelo WhatsApp' },
    ]
  }
]

export default function VisualAutomations() {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0])
  const [activeFlows, setActiveFlows] = useState({
    'recuperacao-pix': true,
    'boas-vindas-anuncios': true,
    'reativacao-clientes': false,
    'aniversario-vip': true,
  })

  function toggleFlow(id) {
    setActiveFlows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-3xl text-ink">Fluxos de Automação</h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold flex items-center gap-1">
              <Workflow size={12} /> Canvas Visual (n8n Style)
            </span>
          </div>
          <p className="text-muted text-sm font-body mt-1">
            Crie caminhos visuais que vendem, recuperam Pix abandonado e reativam clientes no piloto automático.
          </p>
        </div>

        <button
          onClick={() => alert('Novo fluxo em branco criado! Selecione os blocos no canvas.')}
          className="bg-accent hover:bg-accent-dim text-white font-display font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
        >
          <Plus size={16} /> Criar Novo Fluxo
        </button>
      </div>

      {/* Grid: Seletor de Fluxos & Templates (Esq 4 cols) x Canvas Interativo (Dir 8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* COLUNA ESQUERDA: LISTA DE FLUXOS & TEMPLATES (4 cols)     */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold block mb-1">
            Fluxos da Sua Loja
          </span>

          <div className="space-y-2.5">
            {TEMPLATES.map(tpl => {
              const isSelected = selectedTemplate.id === tpl.id
              const isActive = activeFlows[tpl.id]

              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 bg-card ${
                    isSelected
                      ? 'border-accent shadow-md ring-1 ring-accent/30'
                      : 'border-border hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface text-accent font-semibold">
                      {tpl.badge}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFlow(tpl.id)
                      }}
                      className="text-muted hover:text-ink transition-colors"
                    >
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-600">
                          <CheckCircle size={13} /> Ativo
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-muted">Pausado</span>
                      )}
                    </button>
                  </div>

                  <h3 className="font-display font-bold text-sm text-ink">{tpl.name}</h3>
                  <p className="text-xs text-muted font-body line-clamp-2 leading-relaxed">
                    {tpl.desc}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-2 border-t border-border/50">
                    <span>{tpl.nodes.length} etapas visuais</span>
                    <span className="text-accent flex items-center gap-1 font-semibold">
                      Abrir no canvas <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUNA DIREITA: CANVAS VISUAL DO FLUXO (8 cols)           */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-xl text-ink">{selectedTemplate.name}</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  activeFlows[selectedTemplate.id]
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                    : 'bg-surface text-muted'
                }`}>
                  {activeFlows[selectedTemplate.id] ? '● Fluxo Rodando' : 'Pausado'}
                </span>
              </div>
              <p className="text-xs text-muted font-body mt-0.5">{selectedTemplate.desc}</p>
            </div>

            <button
              onClick={() => toggleFlow(selectedTemplate.id)}
              className={`px-4 py-2 rounded-xl text-xs font-display font-bold transition-all ${
                activeFlows[selectedTemplate.id]
                  ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {activeFlows[selectedTemplate.id] ? 'Pausar Fluxo' : 'Ativar Fluxo'}
            </button>
          </div>

          {/* O Canvas Visual Interativo com Nós Conectados */}
          <div className="bg-surface/40 border border-border/80 rounded-2xl p-6 sm:p-8 space-y-4 relative overflow-hidden">
            {/* Linha visual pontilhada central */}
            <div className="space-y-6 max-w-xl mx-auto relative">
              {selectedTemplate.nodes.map((node, index) => {
                const isLast = index === selectedTemplate.nodes.length - 1

                return (
                  <div key={node.id} className="relative flex flex-col items-center">
                    {/* O Bloco / Nó */}
                    <div className={`w-full bg-card border rounded-2xl p-4 shadow-sm transition-all hover:scale-[1.01] ${
                      node.type === 'trigger'
                        ? 'border-accent bg-accent/5'
                        : node.type === 'condition'
                        ? 'border-amber-400 bg-amber-500/5'
                        : node.type === 'action_yes'
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : node.type === 'action_no'
                        ? 'border-purple-400 bg-purple-500/5'
                        : 'border-border'
                    }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {node.type === 'trigger' ? (
                            <Zap size={15} className="text-accent" />
                          ) : node.type === 'wait' ? (
                            <Clock size={15} className="text-muted" />
                          ) : node.type === 'condition' ? (
                            <Sliders size={15} className="text-amber-500" />
                          ) : node.type === 'action_yes' ? (
                            <CheckCircle size={15} className="text-emerald-600" />
                          ) : (
                            <Bot size={15} className="text-accent" />
                          )}
                          <span className="font-display font-bold text-xs text-ink">{node.title}</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase text-muted font-medium">Etapa #{node.id}</span>
                      </div>

                      <p className="text-xs text-muted font-body pl-6">{node.detail}</p>
                    </div>

                    {/* Conector / Linha para o próximo nó */}
                    {!isLast && (
                      <div className="my-2 flex flex-col items-center">
                        <div className="w-0.5 h-6 bg-border" />
                        <ArrowDown size={14} className="text-muted/60 -mt-1" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Métricas e Desempenho do Fluxo */}
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
            <div className="bg-surface/50 p-3 rounded-xl border border-border">
              <span className="text-[10px] font-mono text-muted uppercase block">Disparos no Mês</span>
              <span className="font-display font-bold text-lg text-ink">342</span>
            </div>

            <div className="bg-surface/50 p-3 rounded-xl border border-border">
              <span className="text-[10px] font-mono text-muted uppercase block">Taxa de Conversão</span>
              <span className="font-display font-bold text-lg text-emerald-600">38.4%</span>
            </div>

            <div className="bg-surface/50 p-3 rounded-xl border border-border">
              <span className="text-[10px] font-mono text-muted uppercase block">Receita Recuperada</span>
              <span className="font-display font-bold text-lg text-accent">R$ 14.820,00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
