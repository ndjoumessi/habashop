import { Search, Bell, Sun, Moon, Menu } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pos': 'Point de Vente',
  '/stock': 'Gestion des Stocks',
  '/orders': 'Commandes',
  '/suppliers': 'Fournisseurs',
  '/customers': 'Clients',
  '/reports': 'Rapports',
  '/hr': 'Ressources Humaines',
  '/planning': 'Planning',
  '/payroll': 'Paie',
  '/expenses': 'Dépenses',
  '/forecasts': 'Prévisions',
  '/users': 'Utilisateurs',
  '/activity': 'Journal d\'Activité',
  '/notifications': 'Notifications',
  '/settings': 'Paramètres',
}

export default function Header() {
  const { theme, setTheme, toggleSidebar } = useAppStore()
  const { user } = useAuthStore()
  const location = useLocation()

  const title = PAGE_TITLES[location.pathname] || 'HabaShop'

  return (
    <header
      className="flex items-center gap-4 px-6 h-16 border-b flex-shrink-0"
      style={{
        background: 'var(--bg2)',
        borderColor: 'var(--border)',
      }}
    >
      <button onClick={toggleSidebar} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--text2)' }}>
        <Menu size={20} />
      </button>

      <div>
        <h1 className="font-bold text-base" style={{ color: 'var(--text)' }}>{title}</h1>
        {user && <p className="text-xs" style={{ color: 'var(--text3)' }}>{user.shopName}</p>}
      </div>

      <div className="flex-1" />

      {/* Recherche */}
      <div className="relative hidden md:block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
        <input
          type="text"
          placeholder="Rechercher..."
          className="input pl-9 py-2 w-56 text-sm"
          style={{ background: 'var(--bg3)' }}
        />
      </div>

      {/* Notifications */}
      <button
        className="relative p-2 rounded-lg transition-all"
        style={{ background: 'var(--bg3)', color: 'var(--text2)' }}
      >
        <Bell size={18} />
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
          style={{ background: 'var(--danger)' }}
        />
      </button>

      {/* Toggle thème */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="p-2 rounded-lg transition-all"
        style={{ background: 'var(--bg3)', color: 'var(--text2)' }}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  )
}
