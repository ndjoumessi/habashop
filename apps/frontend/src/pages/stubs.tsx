import { Construction } from 'lucide-react'

function ComingSoon({ title, description, sprint }: { title: string; description: string; sprint: string }) {
  return (
    <div className="animate-in flex flex-col items-center justify-center py-20 space-y-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(99,102,241,0.10)' }}>
        <Construction size={28} style={{ color: 'var(--p2)' }} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black mb-2 tracking-tight" style={{ color: 'var(--text)' }}>{title}</h2>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text3)' }}>{description}</p>
      </div>
      <span className="badge badge-violet text-xs">{sprint}</span>
    </div>
  )
}

export function Orders()        { return <ComingSoon title="Commandes"           description="Création, suivi de statut, bons de livraison et facturation."      sprint="Sprint 2" /> }
export function Suppliers()     { return <ComingSoon title="Fournisseurs"        description="Fiches fournisseurs, notation et historique des commandes."          sprint="Sprint 2" /> }
export function Customers()     { return <ComingSoon title="Clients CRM"         description="Fiches clients, programme de fidélité et historique des achats."     sprint="Sprint 2" /> }
export function Reports()       { return <ComingSoon title="Rapports"            description="KPIs par période, graphiques analytiques, exports CSV et PDF."       sprint="Sprint 2" /> }
export function HR()            { return <ComingSoon title="Équipe RH"           description="Fiches employés, gestion des présences et congés."                  sprint="Sprint 3" /> }
export function Planning()      { return <ComingSoon title="Planning"            description="Calendrier hebdomadaire et créneaux de travail."                     sprint="Sprint 3" /> }
export function Payroll()       { return <ComingSoon title="Paie"                description="Bulletins de salaire et calcul automatique."                        sprint="Sprint 3" /> }
export function Expenses()      { return <ComingSoon title="Dépenses"            description="Journal des dépenses, catégories et budget vs réel."                sprint="Sprint 3" /> }
export function Users()         { return <ComingSoon title="Utilisateurs"        description="Gestion RBAC, invitations et 2FA."                                  sprint="Sprint 1" /> }
export function Settings()      { return <ComingSoon title="Paramètres"          description="Configuration boutique, langue, devise et thème."                   sprint="Sprint 1" /> }
