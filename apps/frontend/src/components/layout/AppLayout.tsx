import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAppStore } from '@/stores/appStore'
import { useEffect } from 'react'

export default function AppLayout() {
  const { theme, sidebarOpen } = useAppStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 'var(--sidebar)' : '72px' }}
      >
        <Header />
        <main
          id="main"
          className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--bg)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
