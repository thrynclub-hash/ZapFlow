import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// Correção de arquitetura (2026-07-01): antes disso, o login de cliente
// (por chave de acesso) só guardava dados no localStorage, sem nunca
// criar uma sessão real do Supabase Auth. Como quase toda regra de
// segurança (RLS) do banco depende de auth.uid() — via my_client_id() —
// o cliente "logado" era tratado como anônimo pelo banco: client_numbers
// aparecia vazio, adicionar contato falhava, etc. Agora tanto admin
// quanto cliente passam por sessão real do Supabase Auth; a diferença
// entre os dois é só o campo `role` na tabela `profiles`.
// Ver supabase_client_real_auth.sql e supabase/functions/client-login.

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profileRow, setProfileRow] = useState(null) // linha de `profiles`
  const [clientRow, setClientRow] = useState(null)   // linha de `clients`, só quando role === 'client'
  const [loading, setLoading] = useState(true)

  const loadProfileFor = useCallback(async (userId) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfileRow(prof || null)
    if (prof?.role === 'client' && prof.client_id) {
      const { data: cli } = await supabase.from('clients').select('id, name, email, plan, status').eq('id', prof.client_id).single()
      setClientRow(cli || null)
    } else {
      setClientRow(null)
    }
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      if (session?.user) await loadProfileFor(session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) await loadProfileFor(session.user.id)
      else {
        setProfileRow(null)
        setClientRow(null)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfileFor])

  // Login admin (e-mail + senha)
  async function loginAdmin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (prof?.role !== 'admin') {
      await supabase.auth.signOut()
      throw new Error('Acesso restrito a administradores.')
    }
    setSession(data.session)
    await loadProfileFor(data.user.id)
    return data
  }

  // Login cliente (chave de acesso) — troca a chave por uma sessão real
  async function loginWithKey(key) {
    const { data, error: fnError } = await supabase.functions.invoke('client-login', {
      body: { access_key: key.trim().toLowerCase() },
    })

    if (fnError) throw new Error('Chave de acesso inválida ou expirada.')
    if (data?.error) throw new Error(data.error)

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) throw new Error('Chave de acesso inválida ou expirada.')

    setSession(signInData.session)
    await loadProfileFor(signInData.user.id)
    return signInData
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfileRow(null)
    setClientRow(null)
  }

  const isAdmin = profileRow?.role === 'admin'
  const isAuthenticated = !!session
  const clientId = profileRow?.client_id || null

  // profile compatível com o resto do app (mesmo formato de antes,
  // pra não precisar mexer em nenhuma outra página)
  const profile = profileRow
    ? profileRow.role === 'client'
      ? { client_id: profileRow.client_id, client: clientRow, role: 'client', full_name: clientRow?.name, email: clientRow?.email }
      : { role: 'admin', full_name: 'Administrador', email: session?.user?.email }
    : null

  return (
    <AuthContext.Provider value={{
      user: isAdmin ? session?.user : null,
      client: clientRow,
      profile, loading,
      isAdmin, isAuthenticated, clientId,
      loginAdmin, loginWithKey, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
