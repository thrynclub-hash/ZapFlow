import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Página que recebe o link de "esqueci minha senha" (Supabase Auth manda
// o token no hash da própria URL, ex: #access_token=...&type=recovery — o
// client do supabase-js já detecta isso sozinho e cria uma sessão temporária,
// disparando o evento PASSWORD_RECOVERY). Sem esta página, o link do email
// não tinha pra onde ir: caía em "/" sem nenhum jeito de definir a senha
// nova — é isso que faltava, não só a URL de redirect errada no Supabase.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // Se a sessão de recuperação já foi processada antes deste efeito rodar
    // (corrida rara, mas possível), confirma se já existe sessão válida.
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não são iguais.')
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) return setError(err.message)
    setDone(true)
    setTimeout(() => navigate('/admin/login'), 2000)
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
            <p className="text-accent text-xs font-body mt-0.5 flex items-center gap-1"><Shield size={10} /> Redefinir senha</p>
          </div>
        </div>

        {!ready ? (
          <p className="text-muted text-sm font-body">Confirmando o link de recuperação... Se esta mensagem não sumir em alguns segundos, o link pode ter expirado — peça um novo em "Esqueci minha senha".</p>
        ) : done ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
            <p className="text-green-400 text-sm font-body">Senha atualizada! Te levando pro login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-display font-bold text-2xl text-white mb-1">Nova senha</h2>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Nova senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••"
                className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white text-sm font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-muted font-body mb-1.5">Confirmar nova senha</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} placeholder="••••••••"
                className="w-full bg-card border border-border rounded-lg px-4 py-3 text-white text-sm font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm font-body">{error}</p>
              </div>
            )}
            <button type="submit" disabled={saving}
              className="w-full bg-accent hover:bg-accent-dim text-bg font-display font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
