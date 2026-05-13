// Pages stub — À développer dans les prochains sprints

import { Construction } from 'lucide-react'

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 space-y-4 animate-fade-in">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(91,78,232,0.1)', color: 'var(--p)' }}
      >
        <Construction size={28} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>{title}</h2>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text3)' }}>{description}</p>
      </div>
      <span className="badge badge-purple text-xs">En développement — Sprint 2</span>
    </div>
  )
}

export function Orders() {
  return <ComingSoon title="Commandes" description="Création, suivi de statut, bons de livraison et facturation automatisée." />
}

export function Suppliers() {
  return <ComingSoon title="Fournisseurs" description="Fiches fournisseurs, notation, historique des commandes et relances." />
}

export function Customers() {
  return <ComingSoon title="Clients (CRM)" description="Fiches clients, types, programme de fidélité et historique des achats." />
}

export function Reports() {
  return <ComingSoon title="Rapports" description="KPIs par période, graphiques analytiques, exports CSV et PDF." />
}

export function HR() {
  return <ComingSoon title="Équipe RH" description="Fiches employés, gestion des présences et des congés." />
}

export function Planning() {
  return <ComingSoon title="Planning" description="Calendrier hebdomadaire, créneaux et types de quarts de travail." />
}

export function Payroll() {
  return <ComingSoon title="Paie" description="Bulletins de salaire, calcul automatique et exports." />
}

export function Expenses() {
  return <ComingSoon title="Dépenses" description="Journal des dépenses, catégories, budget vs réel." />
}

export function Forecasts() {
  return <ComingSoon title="Prévisions" description="Articles à commander, priorités et bons automatiques." />
}

export function Users() {
  return <ComingSoon title="Utilisateurs" description="Gestion RBAC, invitations, activation 2FA et désactivation de comptes." />
}

export function Activity() {
  return <ComingSoon title="Journal d'Activité" description="Audit trail complet, filtres avancés et export." />
}

export function Notifications() {
  return <ComingSoon title="Notifications" description="Canaux Email, SMS, Push et préférences personnalisées." />
}

export function Settings() {
  return <ComingSoon title="Paramètres" description="Configuration boutique, compte, langue, devise et thème." />
}
