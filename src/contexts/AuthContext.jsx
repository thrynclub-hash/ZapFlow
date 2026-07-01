import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Supabase user (admin)
  const [client, setClient] = useState(null)   // Client por chave de acesso
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Verifica sessão admin (Supabase Auth)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
      }
      setLoading(false)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // 2. Verifica sessão cliente (localStorage)
    const savedClient = localStorage.getItem('zapflow_client')
    if (savedClient) {
      try { setClient(JSON.parse(savedClient)) } catch {}
    }
  }, [])

  // Login admin (email + senha)
  async function loginAdmin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Verifica se é admin
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).single()
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      throw new Error('Acesso restrito a administradores.')
    }
    return data
  }

  // Login cliente (chave de acesso)
  // Correção de segurança (2026-07-01): antes disso, este login fazia um
  // select direto na tabela `clients`, que tinha uma policy pública
  // ("Public key lookup", using (true)) permitindo listar TODOS os
  // clientes com a anon key. Agora usa uma função no banco que retorna
  // no máximo 1 linha, e só se a chave bater exatamente.
  // Ver supabase_fix_public_key_lookup.sql
  async function loginWithKey(key) {
    const { data, error } = await supabase
      .rpc('lookup_client_by_key', { p_access_key: key.trim().toLowerCase() })

    if (error || !data || data.length === 0) {
      throw new Error('Chave de acesso inválida ou expirada.')
    }

    const clientData = data[0]
    localStorage.setItem('zapflow_client', JSON.stringify(clientData))
    setClient(clientData)
    return clientData
  }

  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem('zapflow_client')
    setUser(null)
    setClient(null)
  }

  const isAdmin = !!user
  const isAuthenticated = !!user || !!client
  const clientId = client?.id || null

  // profile compatível com o resto do app
  const profile = client
    ? { client_id: client.id, client: client, role: 'client', full_name: client.name, email: client.email }
    : user
      ? { role: 'admin', full_name: 'Administrador', email: user.email }
      : null

  return (
    <AuthContext.Provider value={{
      user, client, profile, loading,
      isAdmin, isAuthenticated, clientId,
      loginAdmin, loginWithKey, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
