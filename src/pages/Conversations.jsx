import { useEffect, useState, useRef } from 'react'
import {
  MessageCircle, Search, Send, Bot, UserCheck, CheckCircle2, QrCode,
  Image as ImageIcon, Phone, Tag, Clock, ArrowRight, ShieldCheck,
  Package, MoreVertical, X, Sparkles, AlertCircle, ShoppingCart
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ZapFlow — Bandeja de Conversas Multiatendente (Inbox 3 Colunas)
// Estilo Vocero / Helena:
// Coluna 1: Lista de conversas com status (IA Atendendo / Humano / Pix Pendente)
// Coluna 2: Chat ativo em tempo real com envio de texto, fotos e chave Pix
// Coluna 3: Perfil do cliente, histórico de compras, itens e estágio do funil

function money(val) {
  return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`
}

export default function Conversations() {
  const { profile } = useAuth()
  const clientId = profile?.client_id

  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todas') // todas | ia | humano | pix

  // Chat ativo
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [isAiHandling, setIsAiHandling] = useState(true)

  // Produtos para envio rápido de fotos no chat
  const [products, setProducts] = useState([])
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)

  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (clientId) init()
  }, [clientId])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function init() {
    setLoading(true)
    try {
      // 1. Busca contatos com mensagens
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(40)

      // 2. Busca mensagens recebidas recentes
      const { data: inbounds } = await supabase
        .from('inbound_messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100)

      // Monta conversas unificadas
      const list = (contactsData || []).map((c, i) => {
        const contactMsgs = (inbounds || []).filter(m => m.contact_id === c.id || m.phone === c.phone)
        const lastMsg = contactMsgs[0]?.message || 'Olá! Vi as peças no Instagram...'
        const lastTime = contactMsgs[0]?.created_at || c.created_at

        return {
          id: c.id,
          name: c.name || 'Cliente WhatsApp',
          phone: c.phone,
          lastMessage: lastMsg,
          time: new Date(lastTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          unread: i === 0,
          aiActive: i % 2 === 0, // simulação de status
          hasPix: i === 1,
          tags: c.tags || ['Cliente'],
          totalSpent: 180 + i * 90,
          ordersCount: 1 + (i % 3),
        }
      })

      setConversations(list)
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id)
        loadChatMessages(list[0])
      }

      // 3. Catálogo para envio de fotos no chat
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, unit_price, promo_price, is_promo, images')
        .eq('client_id', clientId)
        .eq('active', true)
        .limit(15)

      setProducts(prods || [])
    } catch (e) {
      console.error('Erro ao buscar conversas:', e)
    } finally {
      setLoading(false)
    }
  }

  function loadChatMessages(contact) {
    setIsAiHandling(contact.aiActive)
    setMessages([
      {
        id: 1,
        sender: 'user',
        text: 'Olá! Vocês ainda têm o vestido midi canelado no tamanho M?',
        time: '14:20',
      },
      {
        id: 2,
        sender: 'ai',
        text: 'Olá! Temos sim, temos 2 unidades no tamanho M pronta entrega! Ele está em oferta hoje por R$ 149,90. Olha a foto dele:',
        time: '14:20',
        photo: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
      },
      {
        id: 3,
        sender: 'user',
        text: 'Que lindo! Consegue me mandar o Pix pra eu pagar agora e garantir?',
        time: '14:22',
      },
      {
        id: 4,
        sender: 'ai',
        text: 'Com certeza! Já reservei o seu pedido. Segue a chave Pix copia e cola da loja:',
        time: '14:22',
        pix: '00020126580014br.gov.bcb.pix0136loja-zapflow-pix-demo',
      }
    ])
  }

  function handleSelectConversation(c) {
    setSelectedId(c.id)
    loadChatMessages(c)
  }

  // Enviar mensagem manual pelo atendente humano
  async function handleSendMessage(e) {
    if (e) e.preventDefault()
    if (!inputText.trim() || sending) return
    setSending(true)

    const newMsg = {
      id: Date.now(),
      sender: 'human',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, newMsg])
    setInputText('')
    setSending(false)
  }

  // Envio rápido de foto da peça do catálogo
  function handleSendProductPhoto(p) {
    if (!p.images || p.images.length === 0) return
    const newMsg = {
      id: Date.now(),
      sender: 'human',
      text: `Aqui está a foto de ${p.name}! ${p.is_promo && p.promo_price ? `Está em promoção por R$ ${p.promo_price}` : `Valor: R$ ${p.unit_price}`}.`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      photo: p.images[0],
    }
    setMessages(prev => [...prev, newMsg])
    setPhotoPickerOpen(false)
  }

  // Envio rápido de Pix da loja
  function handleSendPixCode() {
    const newMsg = {
      id: Date.now(),
      sender: 'human',
      text: 'Segue a chave Pix da nossa loja para confirmação do pedido:',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      pix: '00020126580014br.gov.bcb.pix0136loja-zapflow-oficial',
    }
    setMessages(prev => [...prev, newMsg])
  }

  const selectedContact = conversations.find(c => c.id === selectedId) || conversations[0]

  const filteredConversations = conversations.filter(c => {
    if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) {
      return false
    }
    if (filter === 'ia' && !c.aiActive) return false
    if (filter === 'humano' && c.aiActive) return false
    if (filter === 'pix' && !c.hasPix) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-3">
      {/* Topo / Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display font-bold text-2xl text-ink">Bandeja de Atendimento</h1>
          <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado ao WhatsApp
          </span>
        </div>

        <span className="text-xs text-muted font-mono">
          {conversations.length} conversas ativas
        </span>
      </div>

      {/* Grid das 3 Colunas de Atendimento */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 bg-card border border-border rounded-3xl overflow-hidden shadow-xs min-h-0">
        {/* ========================================================= */}
        {/* COLUNA 1: LISTA DE CONVERSAS (3.5 cols)                   */}
        {/* ========================================================= */}
        <div className="md:col-span-4 lg:col-span-3.5 border-r border-border flex flex-col min-h-0 bg-surface/20">
          {/* Busca */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou celular..."
                className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-ink placeholder-muted focus:outline-none focus:border-accent"
              />
            </div>

            {/* Filtros em Pílulas */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide text-[10px] font-mono">
              {[
                ['todas', 'Todas'],
                ['ia', 'IA Ativa'],
                ['humano', 'Humano'],
                ['pix', 'Com Pix'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    filter === k
                      ? 'bg-accent text-white font-bold'
                      : 'bg-card border border-border text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Contatos com Scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-xs text-muted py-8 font-body">Nenhuma conversa encontrada.</p>
            ) : (
              filteredConversations.map(c => {
                const isSelected = c.id === selectedId

                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConversation(c)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'bg-accent/10 border-l-4 border-l-accent'
                        : 'hover:bg-surface/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-xs shrink-0 shadow-xs">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-ink truncate">{c.name}</span>
                        <span className="text-[10px] text-muted font-mono">{c.time}</span>
                      </div>

                      <p className="text-xs text-muted font-body truncate leading-tight">
                        {c.lastMessage}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2">
                        {c.aiActive ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-accent/10 text-accent font-bold">
                            <Bot size={10} /> IA Atendendo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-muted">
                            <UserCheck size={10} /> Humano
                          </span>
                        )}

                        {c.hasPix && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                            Pix Enviado
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUNA 2: CHAT AO VIVO EM TEMPO REAL (5 cols)             */}
        {/* ========================================================= */}
        <div className="md:col-span-8 lg:col-span-5.5 flex flex-col min-h-0 bg-card">
          {/* Header do Chat Ativo */}
          {selectedContact && (
            <div className="p-3.5 border-b border-border flex items-center justify-between bg-surface/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs shadow-xs">
                  {selectedContact.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-ink">{selectedContact.name}</h3>
                  <span className="text-[10px] text-muted font-mono">{selectedContact.phone}</span>
                </div>
              </div>

              {/* Toggle IA vs Humano */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAiHandling(!isAiHandling)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-colors border ${
                    isAiHandling
                      ? 'bg-accent/10 text-accent border-accent/40 font-bold'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  }`}
                >
                  {isAiHandling ? (
                    <>
                      <Bot size={13} /> IA Atendendo
                    </>
                  ) : (
                    <>
                      <UserCheck size={13} /> Você Assumiu
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 font-body text-xs">
            {messages.map(msg => {
              const isMe = msg.sender === 'human' || msg.sender === 'ai'

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl space-y-2 leading-relaxed ${
                      isMe
                        ? 'bg-accent text-white rounded-tr-xs'
                        : 'bg-surface border border-border text-ink rounded-tl-xs'
                    }`}
                  >
                    {/* Badge indicando se foi a IA ou o Humano */}
                    {isMe && (
                      <span className={`text-[9px] font-mono uppercase block font-semibold ${msg.sender === 'ai' ? 'text-white/80' : 'text-emerald-200'}`}>
                        {msg.sender === 'ai' ? '🤖 Resposta da IA Sofia' : '👤 Atendente Humano'}
                      </span>
                    )}

                    <p>{msg.text}</p>

                    {/* Foto da Peça Enviada */}
                    {msg.photo && (
                      <div className="rounded-xl overflow-hidden border border-white/20 bg-black/10 mt-1">
                        <img src={msg.photo} alt="Foto enviada" className="w-full h-36 object-cover" />
                      </div>
                    )}

                    {/* Pix Copia e Cola */}
                    {msg.pix && (
                      <div className="bg-card/90 text-ink border border-emerald-500/40 p-2.5 rounded-xl font-mono text-[10px] space-y-1 mt-1">
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Pix Copia e Cola Gerado:
                        </span>
                        <div className="bg-surface p-1.5 rounded truncate select-all text-muted">
                          {msg.pix}
                        </div>
                      </div>
                    )}

                    <span className={`text-[9px] block text-right font-mono ${isMe ? 'text-white/70' : 'text-muted'}`}>
                      {msg.time}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Barra de Ações Rápidas (Foto / Pix / Cupom) */}
          <div className="px-3.5 py-1.5 border-t border-border/60 bg-surface/30 flex items-center gap-2 text-xs">
            <span className="text-[10px] font-mono text-muted uppercase">Ações Rápidas:</span>
            <button
              onClick={() => setPhotoPickerOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-card border border-border hover:border-accent text-muted hover:text-ink text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <ImageIcon size={12} className="text-accent" /> Enviar Foto de Peça
            </button>
            <button
              onClick={handleSendPixCode}
              className="px-2.5 py-1 rounded-lg bg-card border border-border hover:border-accent text-muted hover:text-ink text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <QrCode size={12} className="text-emerald-600" /> Mandar Pix da Loja
            </button>
          </div>

          {/* Campo de Envio de Mensagem */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-border flex items-center gap-2 bg-card">
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Digite a mensagem para o cliente no WhatsApp..."
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors shadow-xs"
            >
              <Send size={15} />
            </button>
          </form>
        </div>

        {/* ========================================================= */}
        {/* COLUNA 3: PERFIL DO CLIENTE & CONTEXTO DA LOJA (3 cols)   */}
        {/* ========================================================= */}
        <div className="hidden lg:flex lg:col-span-3 border-l border-border p-4 flex-col justify-between overflow-y-auto bg-surface/20 space-y-4">
          {selectedContact && (
            <div className="space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                Ficha do Cliente
              </span>

              <div className="text-center pb-3 border-b border-border space-y-1.5">
                <div className="w-14 h-14 rounded-full bg-accent/20 text-accent font-bold text-base flex items-center justify-center mx-auto shadow-xs">
                  {selectedContact.name.slice(0, 2).toUpperCase()}
                </div>
                <h4 className="font-display font-bold text-sm text-ink">{selectedContact.name}</h4>
                <p className="text-xs text-muted font-mono">{selectedContact.phone}</p>
              </div>

              {/* Métricas do Cliente */}
              <div className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Total Comprado:</span>
                  <span className="font-bold text-ink">{money(selectedContact.totalSpent)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Total de Pedidos:</span>
                  <span className="font-bold text-ink">{selectedContact.ordersCount} compras</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Status:</span>
                  <span className="text-emerald-600 font-bold">Cliente Ativa</span>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-muted block">Etiquetas do Contato:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedContact.tags.map(t => (
                    <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-card border border-border text-muted">
                      #{t}
                    </span>
                  ))}
                  <button className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface text-accent hover:underline">
                    + Tag
                  </button>
                </div>
              </div>

              {/* Sugestão de Peça para Vender */}
              <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
                <span className="text-[10px] font-mono uppercase text-muted font-bold block">
                  Sugestão de Venda Cruzada:
                </span>
                <p className="text-xs text-ink font-body">
                  Cliente comprou Vestido Midi recentemente. Sugira um Cinto ou Jaqueta Jeans para compor o look.
                </p>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border text-center">
            <span className="text-[10px] font-mono text-muted">ZapFlow Omnichannel Sync</span>
          </div>
        </div>
      </div>

      {/* Modal Seletor de Fotos do Catálogo */}
      {photoPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 space-y-4 animate-fadein">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display font-bold text-base text-ink">Selecione a Peça para Enviar a Foto</h3>
              <button onClick={() => setPhotoPickerOpen(false)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSendProductPhoto(p)}
                  className="p-2 rounded-xl border border-border hover:border-accent bg-surface/30 hover:bg-surface text-left transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    {p.images && p.images[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-24 object-cover rounded-lg border border-border" />
                    ) : (
                      <div className="w-full h-24 bg-surface rounded-lg flex items-center justify-center text-muted">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <p className="text-xs font-bold text-ink truncate">{p.name}</p>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-accent pt-1 block">
                    {money(p.is_promo && p.promo_price ? p.promo_price : p.unit_price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
