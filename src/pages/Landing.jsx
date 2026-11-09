import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, CheckCircle, Send, Users, Cake, BarChart2, ArrowRight, Columns3,
  Package, MessageCircle, Bot, FileText, Boxes, ShoppingBag, Store, ChevronDown,
  X, Sparkles, Check, DollarSign, ShieldCheck, Tag, Barcode, Printer, BookOpen, Clock,
  Smartphone, Building2, ShoppingCart, Banknote, QrCode, Play
} from 'lucide-react'
import { APP_VERSION, BUILD_ID } from '../lib/appInfo'

// ZapFlow — Landing Page de Alta Conversão
// Identidade visual técnica e elegante (Vocero + Linear), sem clichês de IA.
// Otimizada para SEO, GEO (Generative Engine Optimization) e AEO (Answer Engine Optimization).
// Contém demonstração viva em CSS, simulador interativo, artigos/tutoriais e funil whitelabel de 5 etapas.

// -------------------------------------------------------------
// DADOS DOS ARTIGOS E GUIAS PRÁTICOS (SEO / GEO / AEO)
// -------------------------------------------------------------
const ARTICLES = [
  {
    id: 'furo-estoque',
    tag: 'Estoque & Operação',
    readTime: '4 min de leitura',
    title: 'Como acabar com o furo de estoque entre a loja física e o WhatsApp',
    summary: 'O pesadelo do lojista: vender uma peça no balcão e, cinco minutos depois, fechar a mesma peça pelo WhatsApp. Entenda como o kardex unificado resolve isso em 1 segundo.',
    content: `
### O problema real do comércio que vende no balcão e no digital
Quando uma loja cresce e começa a atender tanto no espaço físico quanto pelo WhatsApp ou redes sociais, o controle manual vira um gargalo perigoso. É comum a vendedora do balcão passar uma peça tamanho M no caixa enquanto outra atendente está no WhatsApp prometendo a mesma peça para uma cliente online.

Quando a cliente online faz o Pix e a equipe vai separar o pedido, a peça já não existe mais na arara. Isso gera constrangimento, cancelamento de compra e perda definitiva do cliente.

### Por que planilhas e sistemas tradicionais falham?
1. **Latência de atualização**: Planilhas exigem que alguém lembre de dar baixa manual no fim do dia. Se a baixa não for em tempo real, o furo já aconteceu.
2. **Sistemas desconectados**: Ter um software para o caixa físico e outro celular para o WhatsApp cria duas bases de dados separadas que nunca conversam entre si.
3. **Falta de grade de variações**: No vestuário e calçados, não basta saber que existem "10 vestidos". É fundamental saber exatamente quantas unidades existem na cor Off-White no tamanho M.

### A solução com Kardex Nativo e Baixa Imediata
No ZapFlow, cada movimentação de estoque é centralizada:
- Se uma peça for vendida no balcão pelo PDV, o saldo diminui instantaneamente no sistema.
- Se a atendente do WhatsApp (ou o atendente autônomo) consultar o produto, o saldo exibido já reflete a saída do balcão.
- Se o cliente online solicitar a reserva e gerar o Pix, a peça fica temporariamente bloqueada para evitar que alguém no balcão a venda antes do pagamento.
    `
  },
  {
    id: 'atendente-whatsapp-fotos',
    tag: 'Atendimento & Vendas',
    readTime: '5 min de leitura',
    title: 'Como treinar um atendente digital que envia fotos e fecha vendas sem parecer robô',
    summary: 'Clientes odeiam menus numéricos do tipo "digite 1 para vestidos". Veja como um atendimento humanizado consulta a grade, envia fotos reais das peças e gera o Pix.',
    content: `
### Por que chatbots antigos espantam clientes no WhatsApp?
O consumidor brasileiro busca no WhatsApp a mesma experiência que teria com uma boa vendedora em uma loja física: atenção, rapidez e personalização.

Quando o cliente manda uma mensagem perguntando *"Vocês têm vestido longo para formatura?"* e recebe como resposta *"Olá! Digite 1 para financeiro, 2 para falar com atendente"*, o encanto acaba na hora. A taxa de desistência nesse tipo de fluxo passa de 65%.

### Os 3 pilares do atendimento de vendas humanizado:
1. **Compreensão de intenção natural**: O atendente deve entender gírias, áudios e perguntas abertas como *"Tem aquele conjunto verde que postaram no Reels?"*.
2. **Envio da foto real do produto**: Ninguém compra roupa ou calçado sem ver. O atendente precisa ter acesso à galeria de fotos do catálogo e mandar a imagem da peça direto na conversa em segundos.
3. **Fechamento imediato com Pix Copia e Cola**: Depois que o cliente escolheu o tamanho e confirmou o pedido, o atendente já calcula o total com o frete e manda a chave Pix ou QR Code na hora, reduzindo o tempo de indecisão.
    `
  },
  {
    id: 'fechamento-caixa-cego',
    tag: 'Financeiro & Caixa',
    readTime: '3 min de leitura',
    title: 'Checklist de conferência cega: fechamento de caixa sem diferenças no fim do dia',
    summary: 'Abertura com fundo de troco, registro rigoroso de sangrias e fechamento cego são as únicas formas comprovadas de proteger o fluxo financeiro da sua loja.',
    content: `
### O que é a Conferência Cega de Caixa?
Na conferência tradicional, o operador de caixa olha no sistema quanto dinheiro deveria ter na gaveta e conta as cédulas até bater o valor. O risco disso é o vício de contagem ou ocultação de pequenos desvios.

Na **conferência cega**, o sistema não mostra ao operador quanto dinheiro deveria ter na gaveta na hora de fechar. O operador apenas conta o valor físico existente, digita no sistema e o ZapFlow compara com os registros de vendas, suprimentos e sangrias, apontando eventuais sobras ou faltas para o gerente.

### O fluxo diário recomendado:
1. **Abertura de Caixa**: Definir o saldo inicial (fundo de troco para o dia, ex: R$ 150 em moedas e notas trocadas).
2. **Sangria durante o dia**: Retiradas para pagar despesas pontuais ou transferir valores altos para o cofre seguro devem ser lançadas na hora no PDV com o motivo.
3. **Múltiplos pagamentos**: Separar com clareza o que entrou em dinheiro físico do que entrou em Pix, Cartão de Débito e Crédito.
    `
  },
  {
    id: 'emissao-nfce-a1',
    tag: 'Fiscal Descomplicado',
    readTime: '4 min de leitura',
    title: 'Guia de emissão de NFC-e e NF-e com Certificado A1 direto no balcão',
    summary: 'Como emitir a Nota Fiscal de Consumidor Eletrônica em 3 segundos no PDV, imprimir em bobina térmica e evitar multas fiscais sem depender de ERPs externos.',
    content: `
### Por que o Certificado Digital A1 é o padrão ideal?
Diferente do certificado A3 (em cartão ou token USB, que pode quebrar ou perder o leitor), o **Certificado Digital A1** é um arquivo digital (.pfx) criptografado.

Isso permite que ele seja configurado no ZapFlow de forma segura, possibilitando a emissão de notas fiscais diretamente pela nuvem a partir de qualquer computador, tablet ou terminal PDV.

### Emissão de NFC-e com 1 clique no PDV
Ao concluir a venda no balcão, o ZapFlow gera o arquivo XML no padrão nacional da SEFAZ, assina digitalmente com o seu certificado e transmite para a Receita Estadual. Em menos de 3 segundos, o cupom fiscal está autorizado e pronto para impressão na impressora térmica (58mm ou 80mm).
    `
  }
]

// -------------------------------------------------------------
// DADOS DOS PLANOS
// -------------------------------------------------------------
const PLANS = [
  {
    name: 'Starter',
    monthly: 149,
    annualMonthly: 119,
    setup: 800,
    badge: 'Para quem está começando',
    desc: 'Ideal para lojas e pequenos negócios que querem profissionalizar o atendimento e as campanhas.',
    features: [
      '1 número de WhatsApp conectado',
      'Até 1.000 contatos cadastrados',
      'Catálogo de produtos com grade e fotos',
      'Campanhas automáticas e aniversários',
      'Disparos com anti-bloqueio seguro',
      'Suporte direto via WhatsApp'
    ]
  },
  {
    name: 'Growth',
    monthly: 279,
    annualMonthly: 219,
    setup: 1500,
    badge: 'Mais Escolhido',
    best: true,
    desc: 'A solução completa de ERP e CRM para lojas físicas que vendem no balcão e no digital.',
    features: [
      '2 números de WhatsApp conectados',
      'Até 2.500 contatos cadastrados',
      'Terminal PDV de Balcão Offline-First',
      'Controle de Caixa (abrir/fechar/sangria)',
      'Funil de Vendas (Negócios com valores R$)',
      'Atendente de Vendas inteligente 24/7',
      'Envio de fotos de peças no WhatsApp'
    ]
  },
  {
    name: 'Scale',
    monthly: 669,
    annualMonthly: 535,
    setup: 2800,
    badge: 'Para Varejo & Franquias',
    desc: 'Potência máxima para comércio com alto fluxo de clientes, promoções frequentes e balcão ativo.',
    features: [
      '5 números de WhatsApp conectados',
      'Até 7.500 contatos cadastrados',
      'Multi-atendentes na mesma conversa',
      'Emissão de NFC-e / NF-e integrada A1',
      'Rastreabilidade total de estoque (Kardex)',
      'Promoções automáticas no WhatsApp',
      'Treinamento da equipe e setup assistido'
    ]
  },
  {
    name: 'Enterprise / Whitelabel',
    monthly: 1319,
    annualMonthly: 1055,
    setup: 4500,
    badge: 'Parceiros & Agências',
    desc: 'Tenha seu próprio software com seu logotipo, domínio e cor, revendendo para seus lojistas.',
    features: [
      'Números e contatos ilimitados',
      'Whitelabel completo (sua marca e domínio)',
      'Painel de gestão de clientes e repasse',
      'Calculadora de margem e propostas',
      'Atendente Grokbot personalizado por cliente',
      'Acompanhamento e consultoria técnica VIP'
    ]
  }
]

// -------------------------------------------------------------
// DADOS DAS PERGUNTAS FREQUENTES (AEO / GEO)
// -------------------------------------------------------------
const FAQS = [
  {
    q: 'O ZapFlow depende do Bling ou de outro sistema ERP externo?',
    a: 'Não. O ZapFlow possui um motor próprio e independente de catálogo, grade de variações (cores e tamanhos), movimentação de estoque com Kardex, PDV de balcão e gestão de caixa. Você economiza mensalidades adicionais e elimina a latência de sistemas externos.'
  },
  {
    q: 'O PDV funciona se a internet da loja física cair?',
    a: 'Sim! O PDV do ZapFlow foi projetado com arquitetura offline-first. Suas vendedoras continuam registrando vendas, conferindo itens e calculando troco normalmente no balcão. Assim que a conexão de internet retornar, o sistema sincroniza os dados no banco automaticamente.'
  },
  {
    q: 'Como o atendente no WhatsApp sabe se tem a peça e manda a foto?',
    a: 'O atendente está conectado ao banco de dados nativo do ZapFlow. Quando uma cliente pergunta sobre um modelo ou tamanho, ele consulta o estoque físico real em frações de segundo. Se a peça estiver disponível, ele envia a foto correspondente direto na conversa e gera o Pix para fechar a venda.'
  },
  {
    q: 'O que acontece quando uma peça está em promoção?',
    a: 'No painel de Estoque, você pode ativar o botão "Em Promoção" e definir o preço promocional de qualquer peça. O atendente do WhatsApp passa a avisar as clientes sobre a oferta e o PDV do balcão aplica o desconto automaticamente na comanda.'
  },
  {
    q: 'Como funciona o modelo de parceria e revenda Whitelabel?',
    a: 'Se você é uma agência ou consultor, você pode colocar o seu logotipo, a sua cor de marca e o seu próprio domínio no ZapFlow. O lojista final paga a você, e o ZapFlow cobra apenas uma taxa base de infraestrutura, permitindo que você lucre tanto na implantação quanto na mensalidade recorrente.'
  }
]

export default function Landing() {
  const [annualBilling, setAnnualBilling] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [activeFaq, setActiveFaq] = useState(null)

  // Estados do Mockup Dinâmico
  const [mockupTab, setMockupTab] = useState('whatsapp') // whatsapp | pdv | estoque
  const [mockupStep, setMockupStep] = useState(0)

  // Estados do Funil Whitelabel Inline (Bolten-style)
  const [funnelOpen, setFunnelOpen] = useState(false)
  const [funnelStep, setFunnelStep] = useState(1)
  const [funnelData, setFunnelData] = useState({
    businessName: '',
    segment: 'Moda & Vestuário',
    primaryColor: '#0D5BFF',
    logoUrl: '',
    hasWhatsapp: true,
    hasPdv: true,
    hasFiscal: false,
    ownerName: '',
    whatsapp: '',
    email: '',
  })

  // Animação de eventos do Mockup Vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setMockupStep(s => (s + 1) % 4)
    }, 3200)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-body selection:bg-accent selection:text-white">
      {/* --------------------------------------------------------- */}
      {/* 1. NAVBAR / HEADER DE ALTA PRECISÃO                      */}
      {/* --------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-card/85 backdrop-blur-md border-b border-border/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white shadow-xs">
              <Zap size={20} className="fill-white" />
            </div>
            <div>
              <span className="font-display font-bold text-xl tracking-tight text-ink">ZapFlow</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                ERP + PDV + IA
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-muted">
            <a href="#demo" className="hover:text-ink transition-colors">Demonstração</a>
            <a href="#pilares" className="hover:text-ink transition-colors">Módulos</a>
            <a href="#tutoriais" className="hover:text-ink transition-colors">Artigos & Guias</a>
            <a href="#precos" className="hover:text-ink transition-colors">Planos</a>
            <a href="#faq" className="hover:text-ink transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs font-semibold text-muted hover:text-ink px-3 py-2 rounded-xl transition-colors"
            >
              Entrar
            </Link>
            <button
              onClick={() => {
                setFunnelOpen(true)
                setFunnelStep(1)
              }}
              className="bg-accent hover:bg-accent-dim text-white text-xs font-display font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Testar na Minha Loja</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- */}
      {/* 2. HERO SECTION (72px Desktop + Live Mockup CSS/JS)       */}
      {/* --------------------------------------------------------- */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 overflow-hidden">
        {/* Glow sutil de fundo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-accent/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Texto Principal */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-xs font-mono text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sem Bling. Sem terceiros. 100% nativo e independente.</span>
            </div>

            <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-[68px] leading-[1.08] tracking-tight text-ink">
              O sistema de vendas e gestão que a sua loja precisava.
            </h1>

            <p className="text-base sm:text-lg text-muted font-body max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Terminal PDV que <strong className="text-ink font-semibold">não para se a internet cair</strong>, catálogo com fotos e grade de tamanhos, e um atendente no WhatsApp que <strong className="text-ink font-semibold">manda a foto da peça e fecha no Pix na hora</strong>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={() => {
                  setFunnelOpen(true)
                  setFunnelStep(1)
                }}
                className="w-full sm:w-auto bg-accent hover:bg-accent-dim text-white font-display font-bold px-7 py-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>Simular Meu Negócio Grátis</span>
                <ArrowRight size={16} />
              </button>

              <a
                href="#demo"
                className="w-full sm:w-auto bg-card hover:bg-surface border border-border text-ink font-display font-bold px-6 py-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <Play size={14} className="text-accent fill-accent" />
                <span>Ver Demonstração Interativa</span>
              </a>
            </div>

            {/* Prova técnica sem ruído */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-muted font-mono">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                <span>PDV Offline-First</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                <span>NFC-e / NF-e Própria A1</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                <span>Envio de Fotos no WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Mockup Vivo em CSS/JS (Simulação em Tempo Real) */}
          <div className="lg:col-span-5 relative">
            <div className="rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
              {/* Barra de Janela Técnica */}
              <div className="bg-surface/70 px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 font-mono text-[10px] text-muted tracking-wide">zapflow.app/terminal</span>
                </div>
                <div className="flex items-center gap-1 bg-card rounded-lg p-0.5 border border-border/60">
                  <button
                    onClick={() => setMockupTab('whatsapp')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${mockupTab === 'whatsapp' ? 'bg-accent text-white font-bold' : 'text-muted'}`}
                  >
                    WhatsApp IA
                  </button>
                  <button
                    onClick={() => setMockupTab('pdv')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${mockupTab === 'pdv' ? 'bg-accent text-white font-bold' : 'text-muted'}`}
                  >
                    PDV Balcão
                  </button>
                  <button
                    onClick={() => setMockupTab('estoque')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${mockupTab === 'estoque' ? 'bg-accent text-white font-bold' : 'text-muted'}`}
                  >
                    Estoque
                  </button>
                </div>
              </div>

              {/* Conteúdo Dinâmico do Mockup */}
              <div className="p-5 h-[360px] flex flex-col justify-between">
                {mockupTab === 'whatsapp' ? (
                  <div className="space-y-3 font-body text-xs">
                    {/* Mensagem 1: Cliente */}
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center font-bold text-[10px] text-muted shrink-0">
                        CL
                      </div>
                      <div className="bg-surface border border-border rounded-2xl rounded-tl-xs p-3">
                        <p className="text-ink">Oi! Tem o Vestido Midi no tamanho M? Queria ver a cor real dele.</p>
                        <span className="text-[9px] text-muted font-mono block mt-1">14:32</span>
                      </div>
                    </div>

                    {/* Mensagem 2: Grokbot Atendente com Foto da Peça */}
                    <div className="flex items-start gap-2 max-w-[88%] ml-auto flex-row-reverse animate-fadein">
                      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white shrink-0 shadow-xs">
                        <Zap size={13} className="fill-white" />
                      </div>
                      <div className="bg-accent/10 border border-accent/30 rounded-2xl rounded-tr-xs p-3 text-ink space-y-2">
                        <p>Olá! Temos sim, restam <strong>2 unidades no M</strong> pronta entrega! Olha a foto real dele na arara:</p>
                        {/* Thumbnail da foto da peça */}
                        <div className="relative rounded-xl overflow-hidden border border-accent/20 bg-card">
                          <img
                            src="https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80"
                            alt="Vestido Midi"
                            className="w-full h-28 object-cover"
                          />
                          <div className="absolute top-2 right-2 bg-amber-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                            OFERTA R$ 149,90
                          </div>
                        </div>
                        <p className="text-[11px] text-ink font-medium">Ele está com 20% de desconto hoje. Quer que eu reserve e te envie a chave Pix?</p>
                        <span className="text-[9px] text-muted font-mono block text-right">14:32 · Resposta em 2s</span>
                      </div>
                    </div>

                    {/* Notificação de Pix Pago */}
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-mono text-emerald-800">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-emerald-600" />
                        Pix de R$ 149,90 confirmado!
                      </span>
                      <span className="font-bold">Estoque baixado</span>
                    </div>
                  </div>
                ) : mockupTab === 'pdv' ? (
                  <div className="space-y-3 font-body text-xs">
                    <div className="flex justify-between items-center bg-surface p-2.5 rounded-xl border border-border">
                      <span className="font-mono text-muted">Operador: Balcão 01</span>
                      <span className="text-emerald-600 font-bold font-mono">● Caixa Aberto (R$ 150)</span>
                    </div>

                    <div className="border border-border rounded-xl divide-y divide-border/60 bg-card">
                      <div className="p-2.5 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-ink">1x Vestido Midi Canelado</p>
                          <span className="text-[10px] text-muted font-mono">Tamanho M · Código 7891234</span>
                        </div>
                        <span className="font-mono font-bold text-ink">R$ 149,90</span>
                      </div>
                      <div className="p-2.5 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-ink">1x Cinto Fivela Dourada</p>
                          <span className="text-[10px] text-muted font-mono">Acessórios</span>
                        </div>
                        <span className="font-mono font-bold text-ink">R$ 49,90</span>
                      </div>
                    </div>

                    <div className="bg-surface p-3 rounded-xl border border-border flex justify-between items-center font-mono">
                      <span className="text-muted">Total Venda:</span>
                      <span className="text-base font-bold text-accent">R$ 199,80</span>
                    </div>

                    <button className="w-full bg-emerald-600 text-white font-display font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
                      <Printer size={14} /> Finalizar & Imprimir NFC-e
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 font-body text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-ink">Grade de Peças Cadastradas</span>
                      <span className="text-[10px] font-mono text-muted">142 itens ativos</span>
                    </div>

                    <div className="border border-border rounded-xl divide-y divide-border/60 bg-card">
                      <div className="p-2.5 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-ink">Vestido Midi Canelado</p>
                          <p className="text-[10px] text-amber-600 font-mono">Grade: P (1) · M (2) · G (0)</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                          3 un no total
                        </span>
                      </div>
                      <div className="p-2.5 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-ink">Conjunto Alfaiataria Risca</p>
                          <p className="text-[10px] text-muted font-mono">Grade: P (4) · M (3) · G (2)</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                          9 un no total
                        </span>
                      </div>
                      <div className="p-2.5 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-ink">Camisa Linho Pura</p>
                          <p className="text-[10px] text-red-500 font-mono">Estoque Esgotado</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                          0 un
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted font-mono text-center pt-1">
                      Kardex integrado: baixa automática em vendas de balcão e WhatsApp.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- */}
      {/* 3. DEMONSTRAÇÃO INTERATIVA SEM CADASTRO (#demo)           */}
      {/* --------------------------------------------------------- */}
      <section id="demo" className="py-20 bg-surface/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Experimente em 10 Segundos
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink">
              Veja a peça ser vendida e o estoque baixar ao vivo.
            </h2>
            <p className="text-muted text-sm font-body">
              Escolha uma peça do catálogo de demonstração abaixo e simule o fluxo completo sem precisar criar conta:
            </p>
          </div>

          <InteractiveDemoWidget />
        </div>
      </section>

      {/* --------------------------------------------------------- */}
      {/* 4. OS 4 PILARES DO SISTEMA NATIVO (#pilares)              */}
      {/* --------------------------------------------------------- */}
      <section id="pilares" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
            Motor Integrado
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink">
            Tudo o que a sua loja faz no dia a dia, num sistema só.
          </h2>
          <p className="text-muted text-sm font-body">
            Esqueça o caos de usar um software pro caixa, outro celular pro WhatsApp e uma planilha desatualizada para o estoque.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pilar 1 */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-accent/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Bot size={24} />
            </div>
            <h3 className="font-display font-bold text-lg text-ink">Atendente de Vendas 24/7</h3>
            <p className="text-muted text-xs font-body leading-relaxed">
              Atende como uma pessoa real da equipe: sabe tudo sobre a loja, envia fotos das peças no WhatsApp, consulta grade e manda Pix para fechar.
            </p>
            <ul className="text-xs text-ink/80 font-body space-y-1.5 pt-2 border-t border-border/60">
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Envia fotos reais da peça</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Sabe quais peças estão em promoção</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Transfere para humano se precisar</li>
            </ul>
          </div>

          {/* Pilar 2 */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-accent/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Boxes size={24} />
            </div>
            <h3 className="font-display font-bold text-lg text-ink">Catálogo & Grade com Fotos</h3>
            <p className="text-muted text-xs font-body leading-relaxed">
              Cadastro de peças com variações de cores e tamanhos (P, M, G), código de barras EAN-13, múltiplas fotos e rastreamento de Kardex.
            </p>
            <ul className="text-xs text-ink/80 font-body space-y-1.5 pt-2 border-t border-border/60">
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Controle de grade por tamanho</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Alerta de estoque baixo</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Curva ABC automatizada</li>
            </ul>
          </div>

          {/* Pilar 3 */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-accent/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <ShoppingCart size={24} />
            </div>
            <h3 className="font-display font-bold text-lg text-ink">PDV & Caixa Balcão</h3>
            <p className="text-muted text-xs font-body leading-relaxed">
              Venda rápida com leitor de código de barras ou busca instantânea. Abertura e fechamento de caixa com conferência cega e sangria.
            </p>
            <ul className="text-xs text-ink/80 font-body space-y-1.5 pt-2 border-t border-border/60">
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> 100% Offline-First (não para sem net)</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Múltiplos pagamentos por venda</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Cálculo automático de troco</li>
            </ul>
          </div>

          {/* Pilar 4 */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-accent/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <FileText size={24} />
            </div>
            <h3 className="font-display font-bold text-lg text-ink">Emissão Fiscal Própria A1</h3>
            <p className="text-muted text-xs font-body leading-relaxed">
              Emissão de NFC-e e NF-e com certificado A1 criptografado na nuvem. Emita comprovantes e cupons fiscais em segundos no balcão.
            </p>
            <ul className="text-xs text-ink/80 font-body space-y-1.5 pt-2 border-t border-border/60">
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Transmissão direta para SEFAZ</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Impressão em bobina térmica</li>
              <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-600" /> Zero custo de ERP terceiro</li>
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- */}
      {/* 5. ANTES X DEPOIS (A REALIDADE DO LOJISTA)                */}
      {/* --------------------------------------------------------- */}
      <section className="py-20 bg-surface/40 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="font-display font-bold text-3xl text-ink">A diferença entre improvisar e ter método</h2>
            <p className="text-muted text-sm font-body">Veja como a rotina da sua equipe muda ao centralizar tudo no ZapFlow:</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Antes */}
            <div className="bg-card border border-red-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-red-600 font-display font-bold text-base">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Como a maioria das lojas funciona hoje:
              </div>
              <ul className="text-xs font-body text-muted space-y-3">
                <li className="flex items-start gap-2">
                  <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <span>A cliente pede a foto de uma peça no WhatsApp e a vendedora passa 15 minutos procurando na galeria do celular.</span>
                </li>
                <li className="flex items-start gap-2">
                  <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <span>Venda no balcão feita ao mesmo tempo que a cliente do WhatsApp está pagando: furo de estoque e dor de cabeça.</span>
                </li>
                <li className="flex items-start gap-2">
                  <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <span>Internet da loja cai e o balcão trava, clientes formam fila sem conseguir pagar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <span>Pagar mensalidade cara do Bling/Tiny só para emitir nota e controlar estoque básico.</span>
                </li>
              </ul>
            </div>

            {/* Depois */}
            <div className="bg-card border border-emerald-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 font-display font-bold text-base">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Com o ZapFlow na operação:
              </div>
              <ul className="text-xs font-body text-ink space-y-3">
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>O atendente de WhatsApp consulta o estoque na hora, manda a foto da peça e fecha no Pix em segundos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Kardex centralizado: vendeu no balcão, o estoque do WhatsApp e do e-commerce zera na hora.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>O PDV funciona offline: a loja continua vendendo mesmo se o provedor de internet cair.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Uma assinatura única e acessível cobrindo WhatsApp, CRM, PDV, Estoque e Emissão Fiscal.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- */}
      {/* 6. ARTIGOS, TUTORIAIS & GUIAS (SEO / GEO / AEO) (#tutoriais) */}
      {/* --------------------------------------------------------- */}
      <section id="tutoriais" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Base de Conhecimento do Varejo
            </span>
            <h2 className="font-display font-bold text-3xl text-ink mt-1">Guias, Tutoriais & Boas Práticas</h2>
            <p className="text-muted text-sm font-body mt-1">
              Conteúdos práticos para transformar o atendimento e a gestão da sua loja física e digital.
            </p>
          </div>
          <span className="text-xs text-muted font-mono">{ARTICLES.length} guias disponíveis</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ARTICLES.map(art => (
            <article
              key={art.id}
              onClick={() => setSelectedArticle(art)}
              className="bg-card border border-border hover:border-accent/50 rounded-2xl p-5 space-y-3 cursor-pointer transition-all hover:-translate-y-1 flex flex-col justify-between group shadow-xs"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                  <span className="px-2 py-0.5 rounded-full bg-surface text-ink font-medium">{art.tag}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {art.readTime}</span>
                </div>
                <h3 className="font-display font-bold text-base text-ink group-hover:text-accent transition-colors leading-snug">
                  {art.title}
                </h3>
                <p className="text-xs text-muted font-body line-clamp-3 leading-relaxed">
                  {art.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-accent">
                <span>Ler artigo completo</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- */}
      {/* 7. PREÇOS TRANSPARENTES (#precos)                         */}
      {/* --------------------------------------------------------- */}
      <section id="precos" className="py-24 bg-surface/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Investimento Claro
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink">
              Planos dimensionados para o tamanho do seu negócio
            </h2>
            <p className="text-muted text-sm font-body">
              Sem taxas escondidas. Sem cobranças adicionais de provedores de terceiros.
            </p>

            {/* Toggle Mensal / Anual */}
            <div className="inline-flex items-center gap-3 bg-card border border-border p-1 rounded-xl mt-4">
              <button
                onClick={() => setAnnualBilling(false)}
                className={`px-4 py-2 rounded-lg text-xs font-display font-bold transition-colors ${
                  !annualBilling ? 'bg-accent text-white shadow-xs' : 'text-muted hover:text-ink'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setAnnualBilling(true)}
                className={`px-4 py-2 rounded-lg text-xs font-display font-bold transition-colors flex items-center gap-1.5 ${
                  annualBilling ? 'bg-accent text-white shadow-xs' : 'text-muted hover:text-ink'
                }`}
              >
                <span>Anual</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-700 px-1.5 py-0.2 rounded font-mono">
                  -20% OFF
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PLANS.map(p => {
              const currentPrice = annualBilling ? p.annualMonthly : p.monthly
              return (
                <div
                  key={p.name}
                  className={`bg-card border rounded-2xl p-6 flex flex-col justify-between transition-all ${
                    p.best ? 'border-accent shadow-xl ring-2 ring-accent/20' : 'border-border'
                  }`}
                >
                  <div className="space-y-4">
                    {p.badge && (
                      <span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full font-bold ${
                        p.best ? 'bg-accent text-white' : 'bg-surface text-muted'
                      }`}>
                        {p.badge}
                      </span>
                    )}

                    <h3 className="font-display font-bold text-xl text-ink">{p.name}</h3>
                    <p className="text-xs text-muted font-body leading-relaxed">{p.desc}</p>

                    <div className="pt-2">
                      <span className="text-3xl font-display font-bold text-ink">
                        R$ {currentPrice}
                      </span>
                      <span className="text-xs text-muted font-body">/mês</span>
                      <p className="text-[11px] text-muted font-mono mt-1">
                        + R$ {p.setup.toLocaleString()} setup e implantação
                      </p>
                    </div>

                    <ul className="space-y-2.5 pt-4 border-t border-border/60 text-xs font-body text-ink/80">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check size={14} className="text-accent shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setFunnelOpen(true)
                      setFunnelStep(1)
                    }}
                    className={`mt-6 w-full py-3 rounded-xl text-xs font-display font-bold transition-all ${
                      p.best
                        ? 'bg-accent hover:bg-accent-dim text-white shadow-md'
                        : 'bg-surface hover:bg-surface/80 text-ink border border-border'
                    }`}
                  >
                    Começar no {p.name}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- */}
      {/* 8. PERGUNTAS FREQUENTES (FAQ) — AEO & GEO (#faq)           */}
      {/* --------------------------------------------------------- */}
      <section id="faq" className="py-24 max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center space-y-2">
          <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">Tira-Dúvidas</span>
          <h2 className="font-display font-bold text-3xl text-ink">Perguntas Frequentes</h2>
          <p className="text-muted text-sm font-body">Respostas diretas sobre tecnologia, estabilidade e implantação.</p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl overflow-hidden transition-colors"
            >
              <button
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                className="w-full text-left p-5 flex items-center justify-between gap-4 font-body font-medium text-sm text-ink hover:text-accent transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown size={16} className={`text-muted transition-transform ${activeFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {activeFaq === i && (
                <div className="px-5 pb-5 pt-1 text-xs text-muted font-body leading-relaxed border-t border-border/40">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- */}
      {/* 9. MODAL: LEITOR DE ARTIGO COMPLETO (SEO & EDUCAÇÃO)      */}
      {/* --------------------------------------------------------- */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 animate-fadein space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-surface text-accent font-semibold">
                {selectedArticle.tag}
              </span>
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-muted hover:text-ink p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink leading-tight">
                {selectedArticle.title}
              </h2>
              <span className="text-xs text-muted font-mono flex items-center gap-1">
                <Clock size={12} /> {selectedArticle.readTime}
              </span>
            </div>

            <div className="text-xs sm:text-sm font-body text-ink/90 leading-relaxed space-y-4 whitespace-pre-line border-t border-border/50 pt-4">
              {selectedArticle.content}
            </div>

            <div className="bg-surface/50 border border-border rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4 mt-6">
              <div>
                <p className="font-bold text-ink text-sm">Quer aplicar isso na sua loja?</p>
                <p className="text-xs text-muted">O ZapFlow já tem esse fluxo configurado e pronto para rodar.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedArticle(null)
                  setFunnelOpen(true)
                }}
                className="bg-accent hover:bg-accent-dim text-white font-display font-bold px-4 py-2.5 rounded-xl text-xs"
              >
                Testar na Minha Loja →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 10. FUNIL DE CADASTRO INLINE COM LIVE-PREVIEW (BOLTEN-STYLE) */}
      {/* --------------------------------------------------------- */}
      {funnelOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-fadein grid grid-cols-1 md:grid-cols-12">
            {/* Lado Esquerdo: Formulário em 5 Etapas (7 cols) */}
            <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-accent font-bold">
                    Passo {funnelStep} de 5
                  </span>
                  <button onClick={() => setFunnelOpen(false)} className="text-muted hover:text-ink">
                    <X size={20} />
                  </button>
                </div>

                {/* Passo 1: Nome da Loja & Nicho */}
                {funnelStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-display font-bold text-2xl text-ink">Qual é a sua loja ou marca?</h3>
                    <p className="text-xs text-muted font-body">Vamos personalizar o seu terminal e catálogo de acordo com o seu segmento.</p>

                    <div>
                      <label className="block text-xs font-body text-muted mb-1">Nome da Empresa / Loja *</label>
                      <input
                        value={funnelData.businessName}
                        onChange={e => setFunnelData({ ...funnelData, businessName: e.target.value })}
                        placeholder="Ex: La Belle Boutique"
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-body text-muted mb-1">Segmento Principal</label>
                      <select
                        value={funnelData.segment}
                        onChange={e => setFunnelData({ ...funnelData, segment: e.target.value })}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent"
                      >
                        <option value="Moda & Vestuário">Moda & Vestuário (Roupas/Calçados)</option>
                        <option value="Beleza & Cosméticos">Beleza, Cosméticos & Acessórios</option>
                        <option value="Alimentação & Restaurante">Alimentação, Doceria & Cafeteria</option>
                        <option value="Clínica & Saúde">Saúde, Clínica & Consultório</option>
                        <option value="Varejo Geral">Varejo Geral & Presentes</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Passo 2: Identidade Visual (Cor & Logo) */}
                {funnelStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-display font-bold text-2xl text-ink">Personalize a sua marca</h3>
                    <p className="text-xs text-muted font-body">O painel e os comprovantes de venda assumem a identidade da sua loja.</p>

                    <div>
                      <label className="block text-xs font-body text-muted mb-2">Cor Principal de Destaque</label>
                      <div className="flex items-center gap-3">
                        {['#0D5BFF', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#141A17'].map(c => (
                          <button
                            key={c}
                            onClick={() => setFunnelData({ ...funnelData, primaryColor: c })}
                            className={`w-9 h-9 rounded-xl border-2 transition-transform ${
                              funnelData.primaryColor === c ? 'scale-110 border-ink' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-body text-muted mb-1">Link do Logotipo (Opcional)</label>
                      <input
                        value={funnelData.logoUrl}
                        onChange={e => setFunnelData({ ...funnelData, logoUrl: e.target.value })}
                        placeholder="Cole o link da sua logo (ex: https://...)"
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}

                {/* Passo 3: Escolha dos Módulos */}
                {funnelStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-display font-bold text-2xl text-ink">O que você precisa agora?</h3>
                    <p className="text-xs text-muted font-body">Ative apenas os módulos que fazem sentido para a sua operação:</p>

                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={funnelData.hasWhatsapp}
                          onChange={e => setFunnelData({ ...funnelData, hasWhatsapp: e.target.checked })}
                          className="rounded text-accent"
                        />
                        <div>
                          <p className="text-xs font-bold text-ink">Atendimento & Vendas no WhatsApp</p>
                          <p className="text-[11px] text-muted">Envio de fotos das peças, dúvidas e geração de Pix automático.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={funnelData.hasPdv}
                          onChange={e => setFunnelData({ ...funnelData, hasPdv: e.target.checked })}
                          className="rounded text-accent"
                        />
                        <div>
                          <p className="text-xs font-bold text-ink">PDV de Balcão & Controle de Caixa</p>
                          <p className="text-[11px] text-muted">Terminal de venda offline, sangria, suprimento e troco.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={funnelData.hasFiscal}
                          onChange={e => setFunnelData({ ...funnelData, hasFiscal: e.target.checked })}
                          className="rounded text-accent"
                        />
                        <div>
                          <p className="text-xs font-bold text-ink">Emissão de NFC-e / NF-e Própria A1</p>
                          <p className="text-[11px] text-muted">Transmissão direta SEFAZ com cupom na impressora térmica.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Passo 4: Dados de Acesso */}
                {funnelStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-display font-bold text-2xl text-ink">Quase pronto! Onde enviamos o acesso?</h3>
                    <p className="text-xs text-muted font-body">Seus dados para login e suporte da equipe:</p>

                    <div>
                      <label className="block text-xs font-body text-muted mb-1">Seu Nome *</label>
                      <input
                        value={funnelData.ownerName}
                        onChange={e => setFunnelData({ ...funnelData, ownerName: e.target.value })}
                        placeholder="Ex: Leonardo Marusso"
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-body text-muted mb-1">Seu WhatsApp (com DDD) *</label>
                      <input
                        value={funnelData.whatsapp}
                        onChange={e => setFunnelData({ ...funnelData, whatsapp: e.target.value })}
                        placeholder="Ex: (11) 98765-4321"
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-body text-muted mb-1">E-mail Comercial *</label>
                      <input
                        type="email"
                        value={funnelData.email}
                        onChange={e => setFunnelData({ ...funnelData, email: e.target.value })}
                        placeholder="Ex: contato@minhaloja.com.br"
                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}

                {/* Passo 5: Sucesso & Chave Gerada */}
                {funnelStep === 5 && (
                  <div className="space-y-5 text-center py-4">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle size={36} />
                    </div>

                    <h3 className="font-display font-bold text-2xl text-ink">Ambiente Configurado com Sucesso!</h3>
                    <p className="text-xs text-muted font-body max-w-sm mx-auto">
                      O terminal da <strong>{funnelData.businessName || 'sua loja'}</strong> foi criado e já está pronto para cadastrar peças e vender.
                    </p>

                    <div className="bg-surface p-4 rounded-2xl border border-border max-w-xs mx-auto">
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1">Sua Chave de Acesso</span>
                      <code className="text-base font-bold text-accent font-mono tracking-wider">
                        zap-demo-{Math.floor(1000 + Math.random() * 9000)}
                      </code>
                    </div>

                    <Link
                      to="/login"
                      className="inline-block bg-accent hover:bg-accent-dim text-white font-display font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-md"
                    >
                      Acessar Painel da Loja Agora →
                    </Link>
                  </div>
                )}
              </div>

              {/* Botões de Avanço */}
              {funnelStep < 5 && (
                <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
                  {funnelStep > 1 ? (
                    <button
                      onClick={() => setFunnelStep(s => s - 1)}
                      className="text-xs font-semibold text-muted hover:text-ink px-3 py-2"
                    >
                      ← Voltar
                    </button>
                  ) : <div />}

                  <button
                    onClick={() => {
                      if (funnelStep === 1 && !funnelData.businessName.trim()) {
                        return alert('Informe o nome da sua loja.')
                      }
                      if (funnelStep === 4 && (!funnelData.whatsapp || !funnelData.email)) {
                        return alert('Informe seu WhatsApp e e-mail para acesso.')
                      }
                      setFunnelStep(s => s + 1)
                    }}
                    className="bg-accent hover:bg-accent-dim text-white font-display font-bold px-6 py-3 rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <span>{funnelStep === 4 ? 'Gerar Acesso Imediato' : 'Continuar'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Lado Direito: Preview da Marca ao Vivo (5 cols) */}
            <div className="md:col-span-5 bg-surface/50 border-l border-border p-6 sm:p-8 flex flex-col justify-between hidden md:flex">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block mb-4">
                  Visualização ao Vivo da Marca
                </span>

                {/* Card de Demonstração com a cor e nome escolhidos */}
                <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2.5">
                    {funnelData.logoUrl ? (
                      <img src={funnelData.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs"
                        style={{ backgroundColor: funnelData.primaryColor }}
                      >
                        {(funnelData.businessName[0] || 'Z').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-ink truncate max-w-[140px]">
                        {funnelData.businessName || 'Sua Loja Aqui'}
                      </p>
                      <span className="text-[10px] text-muted font-mono">{funnelData.segment}</span>
                    </div>
                  </div>

                  <div className="bg-surface rounded-xl p-3 border border-border/80 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono text-muted">
                      <span>PDV Balcão:</span>
                      <span className="text-emerald-600 font-bold">Ativo</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-muted">
                      <span>Atendente WhatsApp:</span>
                      <span className="text-emerald-600 font-bold">Conectado</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-muted">
                      <span>Catálogo:</span>
                      <span className="text-ink font-bold">Pronto</span>
                    </div>
                  </div>

                  <button
                    className="w-full py-2 rounded-xl text-white font-display font-bold text-xs shadow-xs transition-colors"
                    style={{ backgroundColor: funnelData.primaryColor }}
                  >
                    Venda Rápida
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted font-body leading-relaxed">
                Essa tela se adapta 100% à cor e logotipo da sua empresa. Seus clientes e vendedoras nunca veem nomes de ERPs externos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 11. FOOTER INSTITUCIONAL & LGPD COMPLIANCE                */}
      {/* --------------------------------------------------------- */}
      <footer className="bg-card border-t border-border py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-muted font-body">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white">
              <Zap size={15} className="fill-white" />
            </div>
            <div>
              <span className="font-display font-bold text-sm text-ink">ZapFlow</span>
              <p className="text-[11px] text-muted mt-0.5">© {new Date().getFullYear()} ZapFlow Tecnologia Ltda. Todos os direitos reservados.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-medium">
            <Link to="/termos" className="hover:text-ink transition-colors">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-ink transition-colors">Privacidade (LGPD)</Link>
            <Link to="/cookies" className="hover:text-ink transition-colors">Cookies</Link>
            <Link to="/contrato-assinatura" className="hover:text-ink transition-colors">Contrato de Serviço</Link>
          </div>

          <div className="font-mono text-[10px] text-muted/70">
            Build {BUILD_ID} · v{APP_VERSION}
          </div>
        </div>
      </footer>
    </div>
  )
}

// -------------------------------------------------------------
// COMPONENTE: DEMONSTRAÇÃO INTERATIVA SEM CADASTRO
// -------------------------------------------------------------
function InteractiveDemoWidget() {
  const [selectedPiece, setSelectedPiece] = useState(0)
  const [demoState, setDemoState] = useState('idle') // idle | photo_sent | pix_generated | sold

  const samplePieces = [
    {
      name: 'Vestido Midi Canelado',
      price: 149.90,
      oldPrice: 189.90,
      promo: true,
      sizes: ['P', 'M', 'G'],
      image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Conjunto Alfaiataria Risca',
      price: 289.00,
      oldPrice: null,
      promo: false,
      sizes: ['M', 'G'],
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Jaqueta Jeans Oversized',
      price: 199.00,
      oldPrice: 249.00,
      promo: true,
      sizes: ['Único'],
      image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80',
    }
  ]

  const piece = samplePieces[selectedPiece]

  return (
    <div className="max-w-4xl mx-auto bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
      {/* Coluna 1: Escolha da Peça */}
      <div className="md:col-span-6 space-y-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold block">
          1. Escolha uma Peça da Arara
        </span>

        <div className="space-y-2">
          {samplePieces.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedPiece(i)
                setDemoState('idle')
              }}
              className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${
                selectedPiece === i
                  ? 'border-accent bg-accent/10 shadow-xs'
                  : 'border-border bg-surface/30 hover:bg-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-border" />
                <div>
                  <p className="text-xs font-bold text-ink">{p.name}</p>
                  <p className="text-[10px] text-muted font-mono">Tamanhos: {p.sizes.join(', ')}</p>
                </div>
              </div>

              <div className="text-right font-mono">
                {p.promo && <span className="text-[10px] text-amber-600 font-bold block">OFERTA</span>}
                <span className="text-xs font-bold text-ink">R$ {p.price.toFixed(2).replace('.', ',')}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Ações da Demonstração */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setDemoState('photo_sent')}
            className="bg-surface hover:bg-surface/80 border border-border text-ink font-body font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Smartphone size={14} className="text-accent" />
            <span>Pedir Foto no WhatsApp</span>
          </button>

          <button
            onClick={() => setDemoState('sold')}
            className="bg-accent hover:bg-accent-dim text-white font-display font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Barcode size={14} />
            <span>Passar no Balcão PDV</span>
          </button>
        </div>
      </div>

      {/* Coluna 2: Resultado ao Vivo na Tela */}
      <div className="md:col-span-6 bg-surface/50 border border-border rounded-2xl p-5 min-h-[300px] flex flex-col justify-between">
        <div className="space-y-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
            2. O que o Sistema Executa
          </span>

          {demoState === 'idle' ? (
            <div className="text-center py-12 space-y-2">
              <Sparkles size={28} className="text-muted/60 mx-auto" />
              <p className="text-xs text-muted font-body">
                Clique em <strong className="text-ink">"Pedir Foto no WhatsApp"</strong> ou <strong className="text-ink">"Passar no Balcão"</strong> para ver a automação.
              </p>
            </div>
          ) : demoState === 'photo_sent' ? (
            <div className="bg-card border border-accent/30 rounded-2xl p-4 space-y-3 animate-fadein">
              <div className="flex items-center gap-2 text-xs font-bold text-accent">
                <CheckCircle size={15} />
                <span>Foto enviada no WhatsApp da cliente!</span>
              </div>
              <img src={piece.image} alt="" className="w-full h-32 object-cover rounded-xl border border-border" />
              <p className="text-xs text-ink font-body">
                "Olá! Temos sim no tamanho M, olha a foto real dela! Está por R$ {piece.price.toFixed(2).replace('.', ',')}."
              </p>
              <button
                onClick={() => setDemoState('pix_generated')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <QrCode size={13} /> Gerar Pix Copia e Cola
              </button>
            </div>
          ) : demoState === 'pix_generated' ? (
            <div className="bg-card border border-emerald-500/30 rounded-2xl p-4 space-y-3 animate-fadein text-center">
              <CheckCircle size={28} className="text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-ink">Cobrança Pix de R$ {piece.price.toFixed(2).replace('.', ',')} Gerada</p>
              <div className="bg-surface p-2.5 rounded-xl font-mono text-[10px] text-muted truncate border border-border">
                00020126580014br.gov.bcb.pix0136zapflow-venda-demo
              </div>
              <p className="text-[11px] text-emerald-700 font-medium font-body">
                Peça reservada temporariamente no estoque físico até o pagamento.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-fadein">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-ink">Terminal Balcão</span>
                <span className="text-emerald-600">● Venda Registrada</span>
              </div>
              <div className="bg-surface p-2.5 rounded-xl text-xs font-mono flex justify-between">
                <span>1x {piece.name}</span>
                <span className="font-bold">R$ {piece.price.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-muted border-t border-border pt-2">
                <span>Estoque Restante:</span>
                <span className="font-bold text-ink">Baixado no Kardex</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                <span>Comprovante:</span>
                <span className="text-accent font-bold">NFC-e Autorizada</span>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted font-mono text-center pt-2">
          Operação 100% nativa sem latência de conexões externas.
        </p>
      </div>
    </div>
  )
}
