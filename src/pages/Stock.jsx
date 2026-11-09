import { useEffect, useState } from 'react'
import { Package, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ZapFlow — Estoque (ERP visual, 2026-11-08). Puxa direto do Bling via
// bling-estoque (edge function) — não existe cópia local de produto aqui,
// de propósito: o Bling já é a fonte real pra quem usa ele (ex: Lisa La
// Belle), copiar pra uma tabela própria só criaria mais um lugar pra
// desincronizar. Cliente sem canal Bling configurado vê estado vazio
// explicando isso, não uma tela quebrada.
export default function Stock() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [produtos, setProdutos] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { fetchStock() }, [])

  async function fetchStock() {
    setLoading(true)
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke('bling-estoque')
    if (fnError) {
      setError('Não foi possível consultar o Bling agora. Tenta de novo em instantes.')
      setLoading(false)
      return
    }
    if (!data?.ok) {
      setError(data?.error || 'Erro desconhecido ao consultar o Bling.')
      setLoading(false)
      return
    }
    setConnected(!!data.connected)
    setProdutos(data.produtos || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Estoque</h1>
          <p className="text-muted text-sm font-body mt-1">Direto do Bling, em tempo real.</p>
        </div>
        <button
          onClick={fetchStock}
          className="flex items-center gap-2 bg-card border border-border hover:border-accent text-white font-body font-medium px-4 py-2 rounded-lg transition-colors text-sm"
        >
          <RefreshCw size={15} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-[14px] p-5 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-400 shrink-0" />
          <p className="text-white font-body text-sm">{error}</p>
        </div>
      )}

      {!error && !connected && (
        <div className="bg-card border border-border rounded-[14px] p-10 text-center">
          <Package size={32} className="text-muted mx-auto mb-3" />
          <p className="text-white font-body font-medium">Nenhum ERP conectado ainda.</p>
          <p className="text-muted text-sm font-body mt-1">
            Conecta o Bling (ou outro ERP) em Configurações pra ver seu estoque real aqui.
          </p>
        </div>
      )}

      {connected && (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Produto</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Código</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Preço</th>
                  <th className="text-left px-5 py-3 text-[11px] text-muted font-mono uppercase tracking-wide">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {p.imagem ? (
                          <img src={p.imagem} alt="" className="w-9 h-9 rounded-[8px] object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-[8px] bg-surface flex items-center justify-center shrink-0">
                            <Package size={14} className="text-muted" />
                          </div>
                        )}
                        <span className="text-sm text-white font-body">{p.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted font-body">{p.codigo || '—'}</td>
                    <td className="px-5 py-3 text-sm text-white font-body">
                      {p.preco ? `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-body ${
                        p.estoque === null ? 'text-muted bg-muted/10'
                        : p.estoque === 0 ? 'text-red-400 bg-red-400/10'
                        : p.estoque <= 5 ? 'text-amber-400 bg-amber-400/10'
                        : 'text-green-400 bg-green-400/10'
                      }`}>
                        {p.estoque === null ? '—' : p.estoque}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
