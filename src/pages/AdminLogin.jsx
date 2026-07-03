import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Zap, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const navigate = useNavigate()
  const { loginAdmin } = useAuth()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginAdmin(email, password)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // "Esqueci minha senha" — manda o email de recuperação já com o redirect
  // certo pra este mesmo site (não depende de nenhuma configuração manual
  // no painel do Supabase; window.location.origin resolve pra
  // https://zap-flow-smoky.vercel.app em produção, ou localhost em dev).
  async function handleForgotPassword() {
    if (!email.trim()) return setError('Digite seu email acima primeiro, depois clique em "Esqueci minha senha".')
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) return setError(err.message)
    setResetSent(true)
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
            <p className="text-accent text-xs font-body mt-0.5 flex items-center gap-1"><Shield size={10} /> Admin</p>
          </div>
        </div>

        <h2 className="font-display font-bold text-2xl text-white mb-1">Acesso administrativo</h2>
        <p className="text-muted text-sm font-body mb-8">Restrito ao administrador do sistema</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@email.com"
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white text-sm font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-muted font-body mb-1.5">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white text-sm font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <p className="text-red-400 text-sm font-body">{error}</p>
            </div>
          )}

          {resetSent && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
              <p className="text-green-400 text-sm font-body">Email de recuperação enviado! Verifique sua caixa de entrada (e o spam) e clique no link pra definir uma senha nova.</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-accent hover:bg-accent-dim text-bg font-display font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar como admin'}
          </button>

          <button type="button" onClick={handleForgotPassword} disabled={loading}
            className="w-full text-muted hover:text-white text-xs font-body transition-colors disabled:opacity-50">
            Esqueci minha senha
          </button>
        </form>
      </div>
    </div>
  )
}
