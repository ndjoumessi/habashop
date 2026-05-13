import { useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/pos': 'Point de vente',
  '/stock': 'Stock & Produits',
  '/orders': 'Commandes',
  '/suppliers': 'Fournisseurs',
  '/customers': 'Clients',
  '/reports': 'Rapports',
  '/hr': 'Employés',
  '/planning': 'Planning',
  '/payroll': 'Paie',
  '/expenses': 'Dépenses',
  '/forecasts': 'Prévisions',
  '/users': 'Utilisateurs',
  '/activity': "Journal activités",
  '/notifications': 'Notifications',
  '/settings': 'Paramètres',
}

export default function Header() {
  const { theme, setTheme } = useAppStore()
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'HabaShop'

  return (
    <div className="topbar">
      <div className="page-title" id="pageTitle">{title}</div>
      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Rechercher produit, client…"
        />
      </div>
      <button className="topbar-btn">＋ Nouveau</button>
      <div className="icon-btn">
        🔔<div className="notif-dot"></div>
      </div>
      <div
        className="icon-btn"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        style={{ cursor: 'pointer' }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </div>
    </div>
  )
}
