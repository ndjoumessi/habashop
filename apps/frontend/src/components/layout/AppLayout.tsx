import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAppStore } from '@/stores/appStore'
import { useEffect } from 'react'

export default function AppLayout() {
  const { theme } = useAppStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div id="app" style={{ display: 'flex' }}>
      <Sidebar />
      <div id="main">
        <Header />
        <div id="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
