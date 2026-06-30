import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Zap, Key } from 'lucide-react'

export default function Login() {
  const [accessKey, setAccessKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { loginWithKey } = useAuth()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginWithKey(accessKey)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-bg" fill="currentColor" />
          </div>
          <div>
            <h1 className="font-display font-bold text-white text-xl leading-none">ZapFlow</h1>
            <p className="text-muted text-xs font-body mt-0.5">por TOQY</p>
          </div>
        </div>

        <h2 className="font-display font-bold text-2xl text-white mb-1">Acessar painel</h2>
        <p className="text-muted text-sm font-body mb-8">Digite sua chave de acesso</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Chave de acesso</label>
            <div className="relative">
              <Key size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={accessKey}
                onChange={e => setAccessKey(e.target.value)}
                required
                placeholder="xxxx-xxxx-xxxx-xxxx"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-card border border-border rounded-lg pl-11 pr-4 py-3 text-white text-sm font-body placeholder-muted/40 focus:outline-none focus:border-accent transition-colors tracking-widest"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-red-400 text-sm font-body">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading || !accessKey.trim()}
            className="w-full bg-accent hover:bg-accent-dim text-bg font-display font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-muted font-body mt-8">
          Não tem sua chave? Fale com o administrador.
        </p>
      </div>
    </div>
  )
}
