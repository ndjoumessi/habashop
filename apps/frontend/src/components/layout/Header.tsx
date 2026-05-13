import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const TITLES: Record<string, string> = {
  '/app/dashboard': 'Tableau de bord',  '/app/pos': 'Point de vente',
  '/app/stock': 'Stock & Produits',      '/app/orders': 'Commandes',
  '/app/suppliers': 'Fournisseurs',      '/app/customers': 'Clients',
  '/app/reports': 'Rapports',            '/app/hr': 'Employés',
  '/app/planning': 'Planning',           '/app/payroll': 'Paie',
  '/app/expenses': 'Dépenses',           '/app/forecasts': 'Prévisions',
  '/app/users': 'Utilisateurs',          '/app/activity': "Journal d'activités",
  '/app/notifications': 'Notifications', '/app/settings': 'Paramètres',
}

export default function Header() {
  const location = useLocation()
  const { user } = useAuthStore()
  const title = TITLES[location.pathname] || 'HabaShop'

  return (
    <div className="topbar">
      <div className="page-title">{title}</div>
      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input type="text" placeholder="Rechercher produit, client…" />
      </div>
      <button className="topbar-btn">＋ Nouveau</button>
      <div className="icon-btn">
        🔔<div className="notif-dot" />
      </div>
    </div>
  )
}
