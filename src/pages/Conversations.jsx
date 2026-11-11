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
  const [numberRow, setNumberRow] = useState(null) // número WhatsApp real do cliente (p/ enviar de verdade)
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('')
  const [pixBeneficiary, setPixBeneficiary] = useState('')

  // Chat ativo
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)

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
      // 1. Busca contatos
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(200)

      // 2. Busca mensagens recebidas recentes (reais, via zapi-webhook)
      const { data: inbounds } = await supabase
        .from('inbound_messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(300)

      // Bug real achado ao vivo (2026-11-10): a bandeja mostrava TODO
      // contato cadastrado, mesmo quem nunca mandou mensagem — com texto
      // de exemplo inventado ("Olá! Vi as peças no Instagram...") pra
      // preencher o vazio. "Bandeja de Conversas" só faz sentido pra quem
      // realmente conversou — filtra pra isso, mostra só mensagem real.
      const list = (contactsData || [])
        .map(c => {
          const contactMsgs = (inbounds || []).filter(m => m.contact_id === c.id || m.phone === c.phone)
          if (contactMsgs.length === 0) return null
          const last = contactMsgs[0]
          return {
            id: c.id,
            name: c.name || 'Cliente WhatsApp',
            phone: c.phone,
            lastMessage: last.message,
            lastTimeRaw: last.created_at,
            time: new Date(last.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            tags: c.tags || [],
            lifecycleStage: c.lifecycle_stage,
            status: c.status,
          }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.lastTimeRaw) - new Date(a.lastTimeRaw))

      setConversations(list)
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id)
        loadChatMessages(list[0])
      }

      // 3. Número WhatsApp real do cliente (pra enviar de verdade)
      const { data: number } = await supabase
        .from('client_numbers')
        .select('id, active')
        .eq('client_id', clientId)
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      setNumberRow(number || null)

      // 3.5. Chave Pix real configurada em Estúdio da IA (ai_agent_settings)
      const { data: aiSettings } = await supabase
        .from('ai_agent_settings')
        .select('pix_key, pix_key_type, pix_beneficiary')
        .eq('client_id', clientId)
        .maybeSingle()
      setPixKey(aiSettings?.pix_key || '')
      setPixKeyType(aiSettings?.pix_key_type || '')
      setPixBeneficiary(aiSettings?.pix_beneficiary || '')

      // 4. Catálogo para envio de fotos no chat
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

  // Bug real achado ao vivo (2026-11-10): o chat aberto sempre mostrava o
  // MESMO script fixo (vestido/Pix de demonstração), pra qualquer cliente,
  // qualquer contato — nunca puxava mensagem real nenhuma. Mostra as
  // mensagens reais recebidas (inbound_messages); resposta enviada por
  // aqui ainda não fica salva em nenhuma tabela (só o status sent/error em
  // message_logs, sem o texto), então só entra no histórico local da
  // sessão atual, não é reconstruída do banco ao reabrir a conversa.
  async function loadChatMessages(contact) {
    const { data } = await supabase
      .from('inbound_messages')
      .select('*')
      .eq('client_id', clientId)
      .or(`contact_id.eq.${contact.id},phone.eq.${contact.phone}`)
      .order('created_at', { ascending: true })
      .limit(100)

    setMessages((data || []).map(m => ({
      id: m.id,
      sender: 'user',
      text: m.message,
      time: new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    })))
  }

  function handleSelectConversation(c) {
    setSelectedId(c.id)
    loadChatMessages(c)
  }

  // Envio real — chama a mesma function send-message usada no resto do
  // sistema (Campaigns, Birthdays), que de fato manda pela Z-API.
  async function sendReal(text, extra = {}) {
    if (!numberRow) {
      alert('Nenhum número de WhatsApp ativo configurado pra esta loja. Configure em Configurações antes de enviar.')
      return false
    }
    const { error } = await supabase.functions.invoke('send-message', {
      body: { number_id: numberRow.id, phone: selectedContact.phone, message: text, contact_id: selectedContact.id, ...extra },
    })
    if (error) {
      alert('Erro ao enviar: ' + error.message)
      return false
    }
    return true
  }

  // Enviar mensagem manual pelo atendente humano
  async function handleSendMessage(e) {
    if (e) e.preventDefault()
    if (!inputText.trim() || sending || !selectedContact) return
    setSending(true)
    const text = inputText.trim()
    const ok = await sendReal(text)
    if (ok) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'human', text, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
      setInputText('')
    }
    setSending(false)
  }

  // Envio rápido de foto do catálogo real
  async function handleSendProductPhoto(p) {
    if (!p.images || p.images.length === 0 || !selectedContact) return
    const priceText = p.is_promo && p.promo_price ? `Está em promoção por R$ ${p.promo_price}` : `Valor: R$ ${p.unit_price}`
    const text = `${p.name} — ${priceText}`
    const ok = await sendReal(text, { image_url: p.images[0] })
    if (ok) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'human', text, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), photo: p.images[0] }])
      setPhotoPickerOpen(false)
    }
  }

  // Envio da chave Pix REAL da loja (configurada em Estúdio da IA > Pix) —
  // antes mandava um código fixo de demonstração que não funciona de
  // verdade; sem chave configurada, agora avisa em vez de inventar uma.
  async function handleSendPixCode() {
    if (!selectedContact) return
    if (!pixKey) {
      alert('Nenhuma chave Pix configurada ainda. Configure em Estúdio da IA (Sofia) > Pix.')
      return
    }
    const text = `Segue nossa chave Pix${pixKeyType ? ` (${pixKeyType.toUpperCase()})` : ''}: ${pixKey}${pixBeneficiary ? ` — ${pixBeneficiary}` : ''}. Após pagar, me envia o comprovante por aqui pra eu confirmar :)`
    const ok = await sendReal(text)
    if (ok) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'human', text, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    }
  }

  const selectedContact = conversations.find(c => c.id === selectedId) || conversations[0]

  const filteredConversations = conversations.filter(c => {
    if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) {
      return false
    }
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
          {numberRow ? (
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado ao WhatsApp
            </span>
          ) : (
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 font-semibold">
              Nenhum número ativo
            </span>
          )}
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

                      {c.lifecycleStage && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-muted">
                            {c.lifecycleStage}
                          </span>
                        </div>
                      )}
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

              {/* Dados reais do contato — sem venda por contato rastreada
                  ainda (não existe tabela de pedidos ligada a contact_id),
                  então mostra o que já existe de verdade: etapa do funil e
                  status de envio, não número inventado. */}
              <div className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Etapa:</span>
                  <span className="font-bold text-ink">{selectedContact.lifecycleStage || 'Novo'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Status de envio:</span>
                  <span className={`font-bold ${selectedContact.status === 'Inativo' ? 'text-red-500' : 'text-emerald-600'}`}>
                    {selectedContact.status === 'Inativo' ? 'Descadastrado' : 'Ativo'}
                  </span>
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
