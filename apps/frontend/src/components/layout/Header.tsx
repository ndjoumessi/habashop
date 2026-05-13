import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Search, Bell, Plus } from 'lucide-react'

const TITLES: Record<string, string> = {
  '/app/dashboard': 'Tableau de bord', '/app/pos': 'Point de vente',
  '/app/stock': 'Stock & Produits', '/app/orders': 'Commandes',
  '/app/suppliers': 'Fournisseurs', '/app/customers': 'Clients',
  '/app/reports': 'Rapports', '/app/hr': 'Employés',
  '/app/planning': 'Planning', '/app/payroll': 'Paie',
  '/app/expenses': 'Dépenses', '/app/forecasts': 'Prévisions',
  '/app/users': 'Utilisateurs', '/app/activity': 'Journal d\'activité',
  '/app/notifications': 'Notifications', '/app/settings': 'Paramètres',
}

export default function Header() {
  const location = useLocation()
  const { user } = useAuthStore()
  const title = TITLES[location.pathname] || 'HabaShop'

  return (
    <header className="topbar">
      {/* Title */}
      <div>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text)', letterSpacing: '-0.3px' }}>{title}</h1>
        {user && <p className="text-xs" style={{ color: 'var(--text3)' }}>{user.shopName}</p>}
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="search-box hidden md:block">
        <Search size={14} className="search-icon" />
        <input className="input pl-9 py-2 w-56 text-sm" placeholder="Rechercher…" />
      </div>

      {/* New button */}
      <button className="btn btn-primary btn-sm gap-1.5 hidden sm:flex">
        <Plus size={14} />
        <span>Nouveau</span>
      </button>

      {/* Notifications */}
      <button
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}
      >
        <Bell size={16} />
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
          style={{ background: 'var(--danger)' }}
        />
      </button>
    </header>
  )
}
