import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout({ isAdmin = false }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 overflow-auto">
        <div className="p-8 animate-fadein">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
