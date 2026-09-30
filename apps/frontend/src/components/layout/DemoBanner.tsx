import { FlaskConical } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { fmtDate } from '@/lib/formatDate'

interface Props {
  /** `Tenant.demoExpiresAt` tel que le SERVEUR l'a rendu. `null` = pas une démo jetable. */
  demoExpiresAt: string | null | undefined
  /** ⚠️ Injectable : jamais de `new Date()` littéral dans le rendu (convention du dépôt). */
  maintenant?: Date
}

/**
 * Bandeau d'une démo jetable.
 *
 * ⚠️ L'échéance vient du SERVEUR. Un « +7 jours » recalculé côté client serait un champ
 * DÉCLARÉ : il ne pourrait pas être faux, donc il ne prouverait rien — et il mentirait dès
 * que le délai serveur changerait.
 *
 * ⚠️ Une échéance illisible n'affiche AUCUNE date : mieux vaut un bandeau sans date qu'une
 * date fausse. Le bandeau se dit quand même « démonstration », parce que c'est vrai.
 *
 * ⚠️ `fmtDate` (découpage de chaîne), jamais `new Date(iso).toLocaleDateString()` : ce dernier
 * décale le jour d'un cran en fuseau négatif — le 05 s'afficherait « 04 ».
 *
 * ⚠️ Les démos PERMANENTES (`demo-tenant-001/002`) portent `isDemo` mais AUCUNE échéance :
 * elles n'affichent donc pas ce bandeau, et c'est correct — elles n'expirent pas.
 */
export default function DemoBanner({ demoExpiresAt, maintenant = new Date() }: Props) {
  const { i } = useI18n()
  if (!demoExpiresAt) return null

  const echeance = new Date(demoExpiresAt)
  const lisible = !Number.isNaN(echeance.getTime())
  const expiree = lisible && echeance.getTime() <= maintenant.getTime()

  const texte = !lisible
    ? i('Boutique de démonstration', 'Demo shop', 'Tienda de demostración', 'Negozio dimostrativo')
    : expiree
      ? i('Démonstration expirée', 'Demo expired', 'Demostración caducada', 'Dimostrazione scaduta')
      : i(
          `Démonstration — expire le ${fmtDate(demoExpiresAt)}`,
          `Demo — expires on ${fmtDate(demoExpiresAt)}`,
          `Demostración — caduca el ${fmtDate(demoExpiresAt)}`,
          `Dimostrazione — scade il ${fmtDate(demoExpiresAt)}`,
        )

  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', fontSize: 'var(--fs-sm)', fontWeight: 600,
      background: expiree ? 'var(--c-red-bg)' : 'var(--c-amber-bg)',
      borderBottom: `1px solid ${expiree ? 'var(--c-red-border)' : 'var(--c-amber-border)'}`,
      color: 'var(--text)',
    }}>
      <FlaskConical size={15} strokeWidth={2.3} aria-hidden="true" />
      <span>{texte}</span>
    </div>
  )
}
