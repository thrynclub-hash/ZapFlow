import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'

// Code splitting por rota (2026-07-03) — antes disso, TODAS as páginas
// (cliente + admin) iam pro mesmo bundle único de ~1.4MB, carregado de
// uma vez só na primeira visita, mesmo que a pessoa só fosse usar
// "Contatos" naquele acesso. Cada página agora vira um chunk separado,
// baixado sob demanda só quando a rota é visitada — melhora o
// carregamento inicial (principal métrica de Core Web Vitals em mobile
// com conexão mais lenta), sem mudar nenhuma funcionalidade.
const Landing = lazy(() => import('./pages/Landing'))
const Termos = lazy(() => import('./pages/Termos'))
const Privacidade = lazy(() => import('./pages/Privacidade'))
const CookiesPage = lazy(() => import('./pages/Cookies'))
const ContratoAssinatura = lazy(() => import('./pages/ContratoAssinatura'))
const Login = lazy(() => import('./pages/Login'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Contacts = lazy(() => import('./pages/Contacts'))
const NewCampaign = lazy(() => import('./pages/NewCampaign'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const Birthdays = lazy(() => import('./pages/Birthdays'))
const Conversations = lazy(() => import('./pages/Conversations'))
const Automations = lazy(() => import('./pages/Automations'))
const Reports = lazy(() => import('./pages/Reports'))
const Creatives = lazy(() => import('./pages/Creatives'))
const Settings = lazy(() => import('./pages/Settings'))
const Stock = lazy(() => import('./pages/Stock'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const Opportunities = lazy(() => import('./pages/Opportunities'))
const Pdv = lazy(() => import('./pages/Pdv'))
const Caixa = lazy(() => import('./pages/Caixa'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminClients = lazy(() => import('./pages/admin/AdminClients'))
const AdminPricing = lazy(() => import('./pages/admin/AdminPricing'))
const AdminNumbers = lazy(() => import('./pages/admin/AdminNumbers'))

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return children
}

// Revendedor (reforma white-label, 2026-11-07): mesmo login de cliente
// (chave de acesso), mas a linha em `clients` tem is_reseller=true — não é
// papel novo em `profiles`, reusa 100% do login/sessão já existente.
function ResellerRoute({ children }) {
  const { isAuthenticated, isReseller, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isReseller) return <Navigate to="/dashboard" replace />
  return children
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted text-sm font-body">Carregando...</p>
      </div>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, isAdmin, isReseller } = useAuth()

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/contrato-assinatura" element={<ContratoAssinatura />} />
        <Route path="/login" element={isAuthenticated && !isAdmin ? <Navigate to={isReseller ? '/reseller' : '/dashboard'} /> : <Login />} />
        <Route path="/admin/login" element={isAdmin ? <Navigate to="/admin" /> : <AdminLogin />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* App cliente */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/new" element={<NewCampaign />} />
          <Route path="birthdays" element={<Birthdays />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="negocios" element={<Opportunities />} />
          <Route path="pdv" element={<Pdv />} />
          <Route path="caixa" element={<Caixa />} />
          <Route path="stock" element={<Stock />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="creatives" element={<Creatives />} />
          <Route path="automations" element={<Automations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<AdminRoute><Layout isAdmin /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="numbers" element={<AdminNumbers />} />
        </Route>

        {/* Revendedor — white-label, reforma 2026-11-07. Reusa AdminClients/
            AdminNumbers (já 100% guiados por RLS, select('*') sem filtro
            manual) — eles mesmos detectam o modo revendedor via useAuth(). */}
        <Route path="/reseller" element={<ResellerRoute><Layout isReseller /></ResellerRoute>}>
          <Route index element={<Navigate to="clients" replace />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="numbers" element={<AdminNumbers />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
