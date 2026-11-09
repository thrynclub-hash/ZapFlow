import { useState, useRef } from 'react'
import {
  Printer, FileText, Tag, Send, CheckCircle2, QrCode, X,
  ShieldCheck, Share2, Copy, Check, ExternalLink, ArrowRight
} from 'lucide-react'

// ZapFlow — Modal Oficial de Impressão Térmica, DANFE NFC-e e Etiqueta de Envio
// Suporta 3 formatos de impressão de acordo com a legislação e uso real no varejo:
// 1. Cupom Térmico Não-Fiscal (58mm e 80mm ESC/POS)
// 2. DANFE NFC-e (Nota Fiscal de Consumidor Eletrônica - Lei 12.741/2012 / SEFAZ)
// 3. Etiqueta de Envio Térmica (100x150mm - Correios / Transportadoras / Motoboy)

function money(val) {
  return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`
}

function formatDate(date) {
  const d = new Date(date || Date.now())
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

// Gera Chave de Acesso NFC-e fictícia válida de 44 dígitos no formato SEFAZ
function generateNfceKey(saleId) {
  const cleanId = (saleId || '12345678').replace(/[^a-zA-Z0-9]/g, '')
  const base = `352611091827340001926500100000${cleanId.slice(0, 6)}1928374618`
  return base.padEnd(44, '9').slice(0, 44)
}

export default function ThermalReceiptModal({
  sale,
  store = {},
  operator = 'Balcão 01',
  initialTab = 'cupom',
  onClose = () => {}
}) {
  const [activeTab, setActiveTab] = useState(initialTab) // cupom | nfce | etiqueta
  const [copiedKey, setCopiedKey] = useState(false)
  const printRef = useRef(null)

  const storeName = store?.name || 'ZapFlow Store'
  const storeCnpj = store?.cnpj || '48.912.384/0001-92'
  const storeAddress = store?.address || 'Av. Comercial, 1040 - Centro'
  const saleId = sale?.id || '000000'
  const items = sale?.items || []
  const payments = sale?.payments || []
  const total = sale?.total || 0
  const contact = sale?.contact || null
  const dateFormatted = formatDate(sale?.date)
  const nfceKey = generateNfceKey(saleId)

  // Estimativa IBPT (Lei 12.741/2012) ~ 18.5%
  const impostosAprox = total * 0.185

  function handlePrint() {
    window.print()
  }

  function handleSendWhatsapp() {
    if (!contact?.phone) {
      alert('Esta venda não possui contato com telefone cadastrado.')
      return
    }
    const cleanPhone = contact.phone.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Olá ${contact.name || ''}! 👋\n\n` +
      `Aqui está o comprovante da sua compra na *${storeName}*:\n` +
      `🧾 *Venda:* #${saleId.slice(0, 8)}\n` +
      `💰 *Total:* ${money(total)}\n` +
      `📅 *Data:* ${dateFormatted}\n\n` +
      `Agradecemos a sua preferência! Volte sempre! ✨`
    )
    window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank')
  }

  function copyKey() {
    navigator.clipboard.writeText(nfceKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fadein">
        
        {/* Cabeçalho do Modal (Não sai na impressão) */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50 no-print">
          <div>
            <h3 className="font-display font-bold text-base text-ink flex items-center gap-2">
              <Printer size={18} className="text-accent" />
              Central de Impressão & Fiscal
            </h3>
            <p className="text-muted text-xs font-mono">Venda #{saleId.slice(0, 8)} · {money(total)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Seletor de Tipo de Documento (Não sai na impressão) */}
        <div className="px-4 pt-3 flex items-center gap-2 border-b border-border bg-card no-print">
          <button
            onClick={() => setActiveTab('cupom')}
            className={`pb-2.5 px-3 text-xs font-mono flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'cupom'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Printer size={13} />
            Cupom Térmico (80mm)
          </button>
          <button
            onClick={() => setActiveTab('nfce')}
            className={`pb-2.5 px-3 text-xs font-mono flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'nfce'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <FileText size={13} />
            DANFE NFC-e (SEFAZ)
          </button>
          <button
            onClick={() => setActiveTab('etiqueta')}
            className={`pb-2.5 px-3 text-xs font-mono flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'etiqueta'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Tag size={13} />
            Etiqueta de Envio
          </button>
        </div>

        {/* Aviso: NFC-e ainda é simulação de layout, não documento fiscal real */}
        {activeTab === 'nfce' && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xl p-3 no-print">
            <ShieldCheck size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Simulação de layout.</strong> Esta chave e QR Code não são emitidos pela SEFAZ — falta integração
              fiscal real conectada para este cliente. Não use como nota fiscal válida.
            </span>
          </div>
        )}

        {/* Área de Visualização do Documento (Com suporte a print CSS) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface/30 flex justify-center">
          
          {/* ======================================================== */}
          {/* 1. CUPOM TÉRMICO DE BALCÃO (80mm)                        */}
          {/* ======================================================== */}
          {activeTab === 'cupom' && (
            <div
              id="printable-receipt"
              ref={printRef}
              className="w-full max-w-[340px] bg-white text-black p-5 font-mono text-[11px] leading-tight shadow-md border border-zinc-200 select-all"
            >
              {/* Topo da Loja */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-zinc-400">
                <p className="font-bold text-sm tracking-tight uppercase">{storeName}</p>
                <p className="text-[10px] text-zinc-600">CNPJ: {storeCnpj}</p>
                <p className="text-[10px] text-zinc-600">{storeAddress}</p>
                <p className="text-[9px] text-zinc-500">{dateFormatted}</p>
              </div>

              {/* Informações da Operação */}
              <div className="py-2 border-b border-dashed border-zinc-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>CUPOM NÃO FISCAL</span>
                  <span className="font-bold">PDV #{saleId.slice(0, 6)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Operador:</span>
                  <span>{operator}</span>
                </div>
                {contact && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Cliente:</span>
                    <span className="truncate max-w-[170px]">{contact.name}</span>
                  </div>
                )}
              </div>

              {/* Tabela de Itens */}
              <div className="py-2 border-b border-dashed border-zinc-400 space-y-1.5">
                <div className="flex justify-between text-[9px] text-zinc-500 uppercase">
                  <span>Qtd x Descrição</span>
                  <span>Total</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-medium truncate max-w-[210px]">
                        {item.qty}x {item.name}
                      </span>
                      <span className="font-bold">{money((item.promo_price || item.price) * item.qty)}</span>
                    </div>
                    {item.variant && (
                      <p className="text-[9px] text-zinc-500 pl-3">
                        Tam: {item.variant.size || '-'} | Cor: {item.variant.color || '-'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Totais & Pagamentos */}
              <div className="py-2 border-b border-dashed border-zinc-400 space-y-1">
                <div className="flex justify-between text-xs font-bold pt-1">
                  <span>TOTAL A PAGAR:</span>
                  <span>{money(total)}</span>
                </div>

                <div className="pt-1.5 space-y-0.5 text-[10px] text-zinc-700">
                  <p className="font-semibold text-zinc-800">Forma de Pagamento:</p>
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between pl-1">
                      <span className="capitalize">{p.method}</span>
                      <span>{money(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rodapé & Código de Barras */}
              <div className="pt-3 text-center space-y-2">
                <p className="text-[10px] font-semibold text-zinc-800">
                  Obrigado pela preferência!
                </p>
                <p className="text-[9px] text-zinc-500">
                  Trocas somente com este cupom em até 7 dias.
                </p>
                
                {/* Código de Barras Visual Simulado */}
                <div className="pt-1 flex flex-col items-center">
                  <div className="h-8 w-44 bg-zinc-900 flex items-center justify-around px-2">
                    <div className="h-full w-1 bg-white" />
                    <div className="h-full w-0.5 bg-white" />
                    <div className="h-full w-2 bg-white" />
                    <div className="h-full w-1 bg-white" />
                    <div className="h-full w-0.5 bg-white" />
                    <div className="h-full w-1.5 bg-white" />
                    <div className="h-full w-0.5 bg-white" />
                    <div className="h-full w-2 bg-white" />
                  </div>
                  <span className="text-[8px] tracking-widest text-zinc-600 mt-0.5">
                    *{saleId.slice(0, 12).toUpperCase()}*
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. DANFE NFC-e (SEFAZ - PADRÃO NACIONAL)                  */}
          {/* ======================================================== */}
          {activeTab === 'nfce' && (
            <div
              id="printable-nfce"
              className="w-full max-w-[340px] bg-white text-black p-5 font-mono text-[10px] leading-tight shadow-md border border-zinc-200 select-all space-y-2"
            >
              {/* Cabeçalho Oficial NFC-e */}
              <div className="text-center space-y-1 pb-2 border-b border-zinc-400">
                <p className="font-bold text-xs uppercase">{storeName}</p>
                <p className="text-[9px]">CNPJ: {storeCnpj}</p>
                <p className="text-[9px]">{storeAddress}</p>
                <div className="pt-1">
                  <p className="font-bold text-[10px]">DANFE NFC-e</p>
                  <p className="text-[8px] text-zinc-600">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</p>
                  <p className="text-[8px] font-bold text-zinc-700">Não permite aproveitamento de crédito de ICMS</p>
                </div>
              </div>

              {/* Itens */}
              <div className="py-1 border-b border-zinc-400 space-y-1">
                <div className="flex justify-between text-[8px] text-zinc-500 font-bold">
                  <span># CÓD | DESCRIÇÃO | QTD x UNIT</span>
                  <span>TOTAL</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[9px]">
                    <span className="truncate max-w-[210px]">
                      {idx + 1} {item.barcode || item.product_id?.slice(0, 5) || '001'} {item.name} ({item.qty} un x {money(item.price)})
                    </span>
                    <span className="font-bold">{money((item.promo_price || item.price) * item.qty)}</span>
                  </div>
                ))}
              </div>

              {/* Totalizadores */}
              <div className="py-1 border-b border-zinc-400 space-y-0.5 text-[9px]">
                <div className="flex justify-between">
                  <span>Qtd. Total de Itens:</span>
                  <span>{items.reduce((acc, i) => acc + i.qty, 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-[11px] pt-0.5">
                  <span>VALOR TOTAL R$:</span>
                  <span>{money(total)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>FORMA DE PAGAMENTO:</span>
                  <span className="capitalize">{payments[0]?.method || 'Dinheiro'}</span>
                </div>
              </div>

              {/* Tributos Federais / Estaduais (Lei 12.741/2012) */}
              <div className="p-1.5 bg-zinc-100 rounded text-[8px] text-zinc-600 space-y-0.5">
                <p className="font-semibold text-zinc-800">Informação dos Tributos Totais Incidentes:</p>
                <p>(Lei Federal 12.741/2012) — Total aprox.: {money(impostosAprox)} (Fonte: IBPT)</p>
              </div>

              {/* Chave de Acesso e Protocolo SEFAZ */}
              <div className="text-center pt-1 border-t border-zinc-400 space-y-1">
                <p className="text-[8px] font-bold text-zinc-800 uppercase">
                  Consulte pela Chave de Acesso em:
                </p>
                <p className="text-[8px] text-blue-700 underline break-all">
                  www.fazenda.sp.gov.br/nfce/consulta
                </p>
                <p className="text-[8px] font-mono tracking-wider font-bold bg-zinc-100 p-1 rounded break-all">
                  {nfceKey.match(/.{1,4}/g)?.join(' ')}
                </p>

                {/* QR Code Simulado SEFAZ */}
                <div className="py-2 flex flex-col items-center">
                  <div className="w-24 h-24 border-2 border-black p-1 flex items-center justify-center bg-white">
                    <QrCode size={80} className="text-black" />
                  </div>
                  <span className="text-[7px] text-zinc-500 mt-1">Consulta via Leitor de QR Code SEFAZ</span>
                </div>

                <div className="text-[8px] text-zinc-600 space-y-0.5 border-t border-zinc-300 pt-1">
                  <p>Número: 000.014.921 · Série: 001</p>
                  <p>Protocolo de Autorização: 135260019283741</p>
                  <p>Data de Autorização: {dateFormatted}</p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. ETIQUETA DE ENVIO TÉRMICA (100x150mm)                 */}
          {/* ======================================================== */}
          {activeTab === 'etiqueta' && (
            <div
              id="printable-label"
              className="w-full max-w-[340px] bg-white text-black p-5 font-sans text-xs shadow-md border-2 border-black select-all space-y-4"
            >
              {/* Cabeçalho da Transportadora / Correios */}
              <div className="flex justify-between items-start border-b-2 border-black pb-3">
                <div>
                  <span className="font-display font-extrabold text-lg tracking-tight uppercase">MOTOBOY / EXPRESS</span>
                  <p className="text-[10px] text-zinc-600 font-mono">Pedido #{saleId.slice(0, 8)}</p>
                </div>
                <div className="border border-black px-2 py-1 text-center font-bold text-[10px]">
                  ENVIO DIRETO
                </div>
              </div>

              {/* Bloco DESTINATÁRIO */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                  DESTINATÁRIO
                </span>
                <p className="font-bold text-sm text-black">{contact?.name || 'Cliente Balcão'}</p>
                <p className="text-xs text-zinc-800">{contact?.phone || '(11) 99999-9999'}</p>
                <p className="text-xs text-zinc-700 leading-snug">
                  Rua das Amélias, 420 - Apto 12<br />
                  Jardim das Flores — São Paulo/SP<br />
                  CEP: 04510-001
                </p>
              </div>

              {/* Bloco REMETENTE */}
              <div className="border-t border-zinc-400 pt-2 space-y-0.5 text-[10px] text-zinc-700">
                <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
                  REMETENTE
                </span>
                <p className="font-bold text-zinc-900">{storeName}</p>
                <p>{storeAddress}</p>
                <p>CNPJ: {storeCnpj}</p>
              </div>

              {/* Declaração de Conteúdo e Código de Barras */}
              <div className="border-t-2 border-black pt-2 space-y-2">
                <div className="flex justify-between text-[9px] font-mono">
                  <span>Conteúdo: Confecção / Moda</span>
                  <span>Qtd: {items.length} itens</span>
                </div>

                <div className="flex flex-col items-center pt-1">
                  <div className="h-10 w-full bg-zinc-900 flex items-center justify-around px-3">
                    <div className="h-full w-1 bg-white" />
                    <div className="h-full w-0.5 bg-white" />
                    <div className="h-full w-2 bg-white" />
                    <div className="h-full w-1 bg-white" />
                    <div className="h-full w-0.5 bg-white" />
                    <div className="h-full w-1.5 bg-white" />
                    <div className="h-full w-0.5 bg-white" />
                    <div className="h-full w-2 bg-white" />
                    <div className="h-full w-1.5 bg-white" />
                    <div className="h-full w-0.5 bg-white" />
                  </div>
                  <span className="text-[9px] font-mono tracking-widest font-bold text-zinc-700 mt-1">
                    BR-{saleId.slice(0, 10).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé com Ações de Impressão e Envio */}
        <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab === 'nfce' && (
              <button
                onClick={copyKey}
                className="flex items-center gap-1.5 text-xs font-mono text-muted hover:text-ink px-2.5 py-1.5 rounded-lg border border-border"
              >
                {copiedKey ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copiedKey ? 'Chave Copiada!' : 'Copiar Chave'}
              </button>
            )}

            {contact?.phone && (
              <button
                onClick={handleSendWhatsapp}
                className="flex items-center gap-1.5 text-xs font-body font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
              >
                <Send size={13} />
                WhatsApp do Cliente
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-body text-muted hover:text-ink border border-border"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="w-full sm:w-auto bg-accent hover:bg-accent-dim text-white font-display font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <Printer size={15} />
              Imprimir Agora
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
