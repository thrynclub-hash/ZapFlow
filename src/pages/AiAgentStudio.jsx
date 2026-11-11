import { useState, useEffect, useRef } from 'react'
import {
  Bot, Sparkles, Send, Image as ImageIcon, QrCode, CheckCircle, RefreshCw,
  Sliders, MessageSquare, ShieldCheck, Zap, DollarSign, Clock, HelpCircle,
  Plus, Trash2, ArrowRight, UserCheck, AlertCircle, Play
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Estúdio de Treinamento do Agente de IA (ZapFlow IA)
// Permite ao lojista configurar a persona da atendente, regras da loja, fotos,
// frete e chave Pix, com um Simulador Sandbox em tempo real para testar antes de ir pro WhatsApp.

export default function AiAgentStudio() {
  const { profile } = useAuth()
  // Nome do item configurável por cliente (Peça, Procedimento, Serviço...)
  // — o simulador tinha "peça"/"vestidos, conjuntos, calçados" fixos, errado
  // pra qualquer cliente que não vende roupa (ex: Clínica Hassum, odonto).
  const itemNoun = (profile?.client?.item_noun || 'Produto').toLowerCase()
  const clientId = profile?.client_id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Configurações do Agente
  const [settings, setSettings] = useState({
    persona_name: 'Sofia',
    persona_role: 'Consultora de Moda e Vendas',
    greeting_message: 'Olá! Seja muito bem-vinda à nossa loja! Como posso te ajudar hoje?',
    tone: 'consultiva', // consultiva | amigavel | direta | jovem
    allow_send_photos: true,
    allow_send_pix: true,
    auto_promo_announcement: true,
    pix_key: '',
    pix_key_type: 'cnpj',
    pix_beneficiary: '',
    shipping_policy: 'Entregamos via motoboy para a região em até 2 horas por taxa fixa de R$ 15. Para outras cidades enviamos via Correios. Frete grátis em compras acima de R$ 250.',
    exchange_policy: 'Trocas grátis em até 7 dias corridos com a etiqueta fixada na peça.',
    size_guide: 'P veste 36/38, M veste 40, G veste 42/44. Nossos tecidos possuem elastano para ajuste perfeito.',
    custom_instructions: '',
    active: true,
  })

  // FAQ / Dúvidas frequentes treinadas
  const [faqs, setFaqs] = useState([
    { q: 'Vocês têm loja física para provar as peças?', a: 'Sim! Ficamos na Rua das Flores, 120 - Centro. Nosso horário é de segunda a sábado das 9h às 19h.' },
    { q: 'Quais são as formas de pagamento?', a: 'Aceitamos Pix com 5% de desconto imediato ou cartão de crédito em até 3x sem juros.' }
  ])
  const [newFaqQ, setNewFaqQ] = useState('')
  const [newFaqA, setNewFaqA] = useState('')

  // Catálogo local para consulta do simulador
  const [products, setProducts] = useState([])

  // Simulador Sandbox (Chat ao vivo)
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Olá! Sou a Sofia, consultora da loja. Como posso te ajudar hoje? Posso te mostrar as novidades, consultar tamanhos ou mandar fotos das peças!',
      time: 'Agora',
      photo: null,
      pix: null,
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [simulating, setSimulating] = useState(false)
  const chatBottomRef = useRef(null)

  useEffect(() => {
    if (clientId) loadAgentSettings()
  }, [clientId])

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  async function loadAgentSettings() {
    setLoading(true)
    try {
      // 1. Busca configurações existentes
      const { data: ag } = await supabase
        .from('ai_agent_settings')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()

      if (ag) {
        setSettings(prev => ({ ...prev, ...ag }))
      }

      // 2. Busca catálogo de produtos para alimentar o simulador
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, unit_price, promo_price, is_promo, images, stock_qty, category')
        .eq('client_id', clientId)
        .eq('active', true)
        .limit(20)

      setProducts(prods || [])
    } catch (e) {
      console.error('Erro ao carregar estúdio da IA:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault()
    setSaving(true)
    setSavedSuccess(false)

    try {
      const payload = {
        client_id: clientId,
        provider: 'grok',
        model: 'grok-beta',
        persona_name: settings.persona_name,
        persona_role: settings.persona_role,
        greeting_message: settings.greeting_message,
        allow_send_photos: settings.allow_send_photos,
        allow_send_pix: settings.allow_send_pix,
        auto_promo_announcement: settings.auto_promo_announcement,
        pix_key: settings.pix_key,
        pix_key_type: settings.pix_key_type,
        pix_beneficiary: settings.pix_beneficiary,
        shipping_policy: settings.shipping_policy,
        exchange_policy: settings.exchange_policy,
        custom_instructions: `${settings.custom_instructions}\n\nGUIA DE TAMANHOS: ${settings.size_guide}\n\nFAQS:\n${faqs.map(f => `P: ${f.q}\nR: ${f.a}`).join('\n\n')}`,
        active: settings.active,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('ai_agent_settings')
        .upsert(payload, { onConflict: 'client_id' })

      if (error) throw error

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err) {
      alert('Erro ao salvar configurações do agente: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function addFaq() {
    if (!newFaqQ.trim() || !newFaqA.trim()) return
    setFaqs(prev => [...prev, { q: newFaqQ.trim(), a: newFaqA.trim() }])
    setNewFaqQ('')
    setNewFaqA('')
  }

  function removeFaq(index) {
    setFaqs(prev => prev.filter((_, i) => i !== index))
  }

  // Lógica do Simulador Sandbox (Responde com base no treinamento real)
  async function handleSendSimulation(userText) {
    const textToSend = userText || inputMessage
    if (!textToSend.trim() || simulating) return

    const userMsg = { sender: 'user', text: textToSend.trim(), time: 'Agora' }
    setChatMessages(prev => [...prev, userMsg])
    setInputMessage('')
    setSimulating(true)

    // Simula tempo de digitação natural (600ms a 1.2s)
    setTimeout(() => {
      const q = textToSend.toLowerCase()
      let replyText = ''
      let photoUrl = null
      let pixCode = null

      // 1. Pergunta sobre frete
      if (q.includes('frete') || q.includes('entrega') || q.includes('envio')) {
        replyText = `${settings.shipping_policy}`
      }
      // 2. Pergunta sobre troca / devolução
      else if (q.includes('troca') || q.includes('devolver') || q.includes('garantia')) {
        replyText = `${settings.exchange_policy}`
      }
      // 3. Pergunta sobre tamanho / medidas
      else if (q.includes('tamanho') || q.includes('medida') || q.includes('veste') || q.includes('caimento')) {
        replyText = `Nosso guia de medidas funciona assim: ${settings.size_guide}. Me diz sua altura ou manequim usual que te indico o tamanho certinho!`
      }
      // 4. Pergunta sobre Pix ou compra
      else if (q.includes('pix') || q.includes('comprar') || q.includes('pagar') || q.includes('fechar')) {
        replyText = `Perfeito! Já reservei o seu pedido no nosso sistema. Aqui está a chave Pix da loja (${settings.pix_key || 'contato@loja.com.br'}${settings.pix_beneficiary ? ` - ${settings.pix_beneficiary}` : ''}):`
        pixCode = '00020126580014br.gov.bcb.pix0136' + (settings.pix_key || 'zapflow-demo-pix')
      }
      // 5. Pergunta sobre catálogo / fotos / peças
      else {
        // Tenta achar produto pelo nome
        const matchedProduct = products.find(p => q.includes(p.name.toLowerCase().split(' ')[0])) || products[0]
        if (matchedProduct) {
          const promoInfo = matchedProduct.is_promo && matchedProduct.promo_price
            ? ` Ela está em oferta hoje: de R$ ${matchedProduct.unit_price} por apenas R$ ${matchedProduct.promo_price}!`
            : ` O valor dela é R$ ${matchedProduct.unit_price}.`

          replyText = `Temos sim ${itemNoun.endsWith('a') ? 'a' : 'o'} ${itemNoun} "${matchedProduct.name}" disponível!${promoInfo} Olha a foto:`
          if (settings.allow_send_photos && matchedProduct.images && matchedProduct.images.length > 0) {
            photoUrl = matchedProduct.images[0]
          }
        } else {
          replyText = `Temos boas opções no catálogo hoje! Você procura algum ${itemNoun} em especial ou quer ver nossas promoções ativas?`
        }
      }

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: replyText,
          time: 'Agora',
          photo: photoUrl,
          pix: pixCode,
        }
      ])
      setSimulating(false)
    }, 900)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-3xl text-ink">Estúdio do Agente de IA</h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold flex items-center gap-1">
              <Sparkles size={12} /> Motor ZapFlow IA
            </span>
          </div>
          <p className="text-muted text-sm font-body mt-1">
            Treine sua atendente virtual com a identidade da sua loja, regras de frete e fotos. Teste no simulador antes de ir ao ar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-emerald-600 text-xs font-mono font-medium flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
              <CheckCircle size={14} /> Treinamento Atualizado!
            </span>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white font-display font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
          >
            {saving ? 'Gravando...' : 'Salvar Treinamento'}
          </button>
        </div>
      </div>

      {/* Grid Principal: Treinamento (Esq 7 cols) x Simulador Sandbox (Dir 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LADO ESQUERDO: REGRAS E PERSONA (7 cols)                  */}
        {/* ========================================================= */}
        <form onSubmit={handleSaveSettings} className="lg:col-span-7 space-y-5">
          {/* 1. Persona & Identidade */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Bot size={18} className="text-accent" />
              <h3 className="font-display font-bold text-base text-ink">Identidade da Atendente</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-body text-muted mb-1">Nome da Atendente *</label>
                <input
                  required
                  value={settings.persona_name}
                  onChange={e => setSettings({ ...settings, persona_name: e.target.value })}
                  placeholder="Ex: Sofia, Amanda..."
                  className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent font-body"
                />
              </div>

              <div>
                <label className="block text-xs font-body text-muted mb-1">Papel na Loja</label>
                <input
                  value={settings.persona_role}
                  onChange={e => setSettings({ ...settings, persona_role: e.target.value })}
                  placeholder="Ex: Consultora de Vendas"
                  className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-accent font-body"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-body text-muted mb-1">Mensagem Inicial de Boas-Vindas</label>
                <textarea
                  rows={2}
                  value={settings.greeting_message}
                  onChange={e => setSettings({ ...settings, greeting_message: e.target.value })}
                  className="w-full bg-surface/50 border border-border rounded-xl px-3.5 py-2 text-sm text-ink focus:outline-none focus:border-accent font-body resize-none"
                />
              </div>
            </div>

            {/* Habilidades Automáticas */}
            <div className="border-t border-border/60 pt-3 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold block mb-2">
                Habilidades Ativas do Agente
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_send_photos}
                    onChange={e => setSettings({ ...settings, allow_send_photos: e.target.checked })}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-bold text-ink">Enviar Fotos</p>
                    <p className="text-[10px] text-muted">Manda fotos das peças no WhatsApp</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_send_pix}
                    onChange={e => setSettings({ ...settings, allow_send_pix: e.target.checked })}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-bold text-ink">Cobrança Pix</p>
                    <p className="text-[10px] text-muted">Gera chave copia e cola</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auto_promo_announcement}
                    onChange={e => setSettings({ ...settings, auto_promo_announcement: e.target.checked })}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-bold text-ink">Promoções</p>
                    <p className="text-[10px] text-muted">Avisa sobre ofertas ativas</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 2. Dados de Cobrança Pix da Loja */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-accent" />
                <h3 className="font-display font-bold text-base text-ink">Chave Pix para Fechamento de Vendas</h3>
              </div>
              <span className="text-[11px] text-muted font-body">Enviada pelo bot ao fechar o pedido</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-body text-muted mb-1">Tipo de Chave</label>
                <select
                  value={settings.pix_key_type}
                  onChange={e => setSettings({ ...settings, pix_key_type: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                >
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                  <option value="telefone">Celular</option>
                  <option value="email">E-mail</option>
                  <option value="aleatoria">Chave Aleatória</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-body text-muted mb-1">Chave Pix *</label>
                <input
                  value={settings.pix_key}
                  onChange={e => setSettings({ ...settings, pix_key: e.target.value })}
                  placeholder="Ex: 12.345.678/0001-90 ou celular"
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-ink font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-body text-muted mb-1">Nome do Titular / Beneficiário</label>
                <input
                  value={settings.pix_beneficiary}
                  onChange={e => setSettings({ ...settings, pix_beneficiary: e.target.value })}
                  placeholder="Ex: La Belle Comércio de Roupas Ltda"
                  className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* 3. Regras de Frete, Trocas e Tabela de Medidas */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <ShieldCheck size={18} className="text-accent" />
              <h3 className="font-display font-bold text-base text-ink">Regras da Loja (Treinamento do Bot)</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-body text-muted mb-1 flex items-center gap-1.5">
                  <Clock size={13} /> Regras de Frete & Entrega
                </label>
                <textarea
                  rows={2}
                  value={settings.shipping_policy}
                  onChange={e => setSettings({ ...settings, shipping_policy: e.target.value })}
                  placeholder="Explique valores de motoboy, prazos de correios e regras de frete grátis..."
                  className="w-full bg-surface/50 border border-border rounded-xl p-3 text-xs text-ink focus:outline-none focus:border-accent resize-none font-body leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-body text-muted mb-1">Política de Trocas & Devoluções</label>
                <textarea
                  rows={2}
                  value={settings.exchange_policy}
                  onChange={e => setSettings({ ...settings, exchange_policy: e.target.value })}
                  placeholder="Prazo para troca, exigência de etiqueta na peça, devolução..."
                  className="w-full bg-surface/50 border border-border rounded-xl p-3 text-xs text-ink focus:outline-none focus:border-accent resize-none font-body leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-body text-muted mb-1">Guia de Medidas & Caimento de Peças</label>
                <textarea
                  rows={2}
                  value={settings.size_guide}
                  onChange={e => setSettings({ ...settings, size_guide: e.target.value })}
                  placeholder="Qual numeração veste P, M, G? O tecido estica? Forma pequena ou grande?"
                  className="w-full bg-surface/50 border border-border rounded-xl p-3 text-xs text-ink focus:outline-none focus:border-accent resize-none font-body leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* 4. Perguntas & Respostas Frequentes (FAQ Customizado) */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-accent" />
                <h3 className="font-display font-bold text-base text-ink">Perguntas & Respostas da Loja</h3>
              </div>
              <span className="text-[11px] text-muted font-mono">{faqs.length} respostas treinadas</span>
            </div>

            {/* Lista de FAQs cadastrados */}
            <div className="space-y-2">
              {faqs.map((f, i) => (
                <div key={i} className="bg-surface/40 border border-border p-3 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-ink">P: {f.q}</p>
                    <button type="button" onClick={() => removeFaq(i)} className="text-muted hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-muted font-body">R: {f.a}</p>
                </div>
              ))}
            </div>

            {/* Adicionar nova FAQ */}
            <div className="bg-surface/50 border border-border/80 p-3.5 rounded-xl space-y-2">
              <input
                value={newFaqQ}
                onChange={e => setNewFaqQ(e.target.value)}
                placeholder="Pergunta do cliente (ex: Vocês abrem aos domingos?)"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
              />
              <textarea
                rows={2}
                value={newFaqA}
                onChange={e => setNewFaqA(e.target.value)}
                placeholder="Resposta que o bot deve dar com naturalidade..."
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent resize-none"
              />
              <button
                type="button"
                onClick={addFaq}
                disabled={!newFaqQ.trim() || !newFaqA.trim()}
                className="bg-card border border-border hover:border-accent disabled:opacity-40 text-ink px-4 py-1.5 rounded-lg text-xs font-medium"
              >
                + Adicionar ao Treinamento
              </button>
            </div>
          </div>
        </form>

        {/* ========================================================= */}
        {/* LADO DIREITO: SIMULADOR SANDBOX EM TEMPO REAL (5 cols)    */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 bg-card border border-border rounded-3xl p-5 shadow-xl flex flex-col h-[740px] sticky top-20">
          {/* Header do Simulador */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm shadow-xs">
                {settings.persona_name[0] || 'S'}
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-ink">{settings.persona_name}</h3>
                <span className="text-[10px] text-emerald-600 font-mono font-medium flex items-center gap-1">
                  ● Simulador Ativo
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setChatMessages([
                  {
                    sender: 'ai',
                    text: `Olá! Sou a ${settings.persona_name}, consultora da loja. Como posso te ajudar hoje? Posso consultar peças no estoque, mandar fotos e gerar o Pix!`,
                    time: 'Agora'
                  }
                ])
              }}
              title="Reiniciar conversa de teste"
              className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Atalhos de Teste Rápido */}
          <div className="py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-[10px] font-mono border-b border-border/40">
            {[
              `Tem ${itemNoun} disponível?`,
              `Manda foto d${itemNoun.endsWith('a') ? 'a' : 'o'} ${itemNoun}`,
              'Quanto custa o frete?',
              'Como funciona a troca?',
              'Quero pagar no Pix',
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSendSimulation(prompt)}
                className="px-2.5 py-1 rounded-full bg-surface border border-border text-muted hover:text-ink hover:border-accent shrink-0 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Área de Mensagens (Estilo WhatsApp) */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs font-body">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 max-w-[88%] ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-[10px] shrink-0 font-bold">
                    {settings.persona_name[0]}
                  </div>
                )}

                <div
                  className={`p-3 rounded-2xl space-y-2 leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-accent text-white rounded-tr-xs'
                      : 'bg-surface border border-border text-ink rounded-tl-xs'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Foto da Peça Enviada pelo Bot */}
                  {msg.photo && (
                    <div className="rounded-xl overflow-hidden border border-border bg-card mt-1">
                      <img src={msg.photo} alt="Foto da peça enviada" className="w-full h-32 object-cover" />
                    </div>
                  )}

                  {/* Pix Copia e Cola */}
                  {msg.pix && (
                    <div className="bg-card border border-emerald-500/30 p-2.5 rounded-xl space-y-1.5 mt-1 font-mono text-[10px]">
                      <div className="flex justify-between items-center text-emerald-700 font-bold">
                        <span>Chave Pix Copia e Cola:</span>
                        <span className="text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded">Reserva Ativa</span>
                      </div>
                      <div className="p-1.5 bg-surface rounded text-muted truncate select-all">
                        {msg.pix}
                      </div>
                    </div>
                  )}

                  <span className={`text-[9px] block text-right font-mono ${msg.sender === 'user' ? 'text-white/70' : 'text-muted'}`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {simulating && (
              <div className="flex items-center gap-2 text-muted text-[11px] font-mono animate-pulse">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span>{settings.persona_name} está digitando...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Campo de Envio de Teste */}
          <div className="pt-2 border-t border-border flex items-center gap-2">
            <input
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendSimulation()}
              placeholder={`Pergunte algo para a ${settings.persona_name}...`}
              className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => handleSendSimulation()}
              disabled={simulating || !inputMessage.trim()}
              className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors shadow-xs"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
