import type { Lang } from '@/stores/appStore'
import type { ThemeColors } from '@/constants/theme'

/**
 * STATUT DE BOUTIQUE — Record EXHAUSTIF sur les cinq valeurs.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * L'écran Réglages écrivait :
 *
 *   const statusColor = status === 'suspended' ? C.danger
 *                     : status === 'trial'     ? C.warn
 *                     : C.accent2                       // ← vert, « tout va bien »
 *
 * Trois branches pour cinq valeurs. `pending_payment` et `cancelled` tombaient donc
 * dans le VERT, avec pour libellé le champ brut de la base (`PENDING_PAYMENT`,
 * `CANCELLED`), non traduit.
 *
 * ⚠️ Ce n'est PAS un cas limite. Aucun encaissement en ligne ne fonctionne : la seule
 * voie d'abonnement est manuelle (`POST /api/billing/request-plan` → `PlanRequest`), et
 * elle laisse le tenant en **`pending_payment`** jusqu'à l'activation par un admin.
 * C'est donc l'état par défaut de **tout futur client payant** — il voyait un badge vert
 * « PENDING_PAYMENT » pendant qu'il attendait qu'on encaisse son virement.
 *
 * ⚠️ `Tenant.status` est une colonne `String`, PAS un enum Prisma : une valeur inconnue
 * est possible (script, migration, faute de frappe). Elle ne doit surtout pas retomber
 * sur « actif » — le repli est neutre et AFFICHE la valeur reçue, pour qu'on la voie.
 *
 * ⚠️ Ce fichier vit dans `src/lib/`, pas à côté de l'écran : sous `app/`, tout `.ts`
 * devient une route fantôme et pollue l'union `Href` des typed routes (cf. mobile/CLAUDE.md §9).
 */

/** Les cinq valeurs écrites par le backend (`prisma/schema.prisma`, `Tenant.status`). */
export const TENANT_STATUSES = [
  'trial', 'active', 'pending_payment', 'suspended', 'cancelled',
] as const

export type TenantStatus = typeof TENANT_STATUSES[number]

/** Rôle de couleur, résolu par l'appelant sur le thème courant. */
export type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral'

interface StatusView {
  tone: StatusTone
  label: Readonly<Record<Lang, string>>
}

/**
 * ⚠️ Record EXHAUSTIF : `Record<TenantStatus, …>` fait échouer `tsc` si le backend ajoute
 * un statut sans qu'on l'ajoute ici. C'est tout l'intérêt par rapport au ternaire — le
 * compilateur porte l'obligation, pas la vigilance du relecteur.
 */
const VIEWS: Record<TenantStatus, StatusView> = {
  trial: {
    tone: 'warn',
    label: { fr: 'Essai', en: 'Trial', es: 'Prueba', it: 'Prova' },
  },
  active: {
    tone: 'ok',
    label: { fr: 'Actif', en: 'Active', es: 'Activo', it: 'Attivo' },
  },
  // Le commerçant a demandé un plan et attend l'encaissement manuel : ni actif, ni en
  // faute. Ambre — « il se passe quelque chose, ce n'est pas encore réglé ».
  pending_payment: {
    tone: 'warn',
    label: {
      fr: 'Paiement en attente', en: 'Payment pending',
      es: 'Pago pendiente',      it: 'Pagamento in sospeso',
    },
  },
  suspended: {
    tone: 'danger',
    label: { fr: 'Suspendu', en: 'Suspended', es: 'Suspendido', it: 'Sospeso' },
  },
  cancelled: {
    tone: 'danger',
    label: { fr: 'Résilié', en: 'Cancelled', es: 'Cancelado', it: 'Disdetto' },
  },
}

export function isTenantStatus(v: unknown): v is TenantStatus {
  return typeof v === 'string' && (TENANT_STATUSES as readonly string[]).includes(v)
}

/** Ton d'un statut. Une valeur inconnue est NEUTRE — jamais « actif ». */
export function statusTone(status: string): StatusTone {
  return isTenantStatus(status) ? VIEWS[status].tone : 'neutral'
}

/**
 * Libellé traduit. Une valeur inconnue est rendue TELLE QUELLE (en capitales) : mieux vaut
 * un « FOO » visible à l'écran qu'un « Actif » rassurant et faux.
 */
export function statusLabel(status: string, lang: Lang): string {
  return isTenantStatus(status) ? VIEWS[status].label[lang] : status.toUpperCase()
}

/** Couleur du ton sur le thème courant. Aucun hex en dur — cf. § Couleurs. */
export function toneColor(tone: StatusTone, C: ThemeColors): string {
  const map: Record<StatusTone, string> = {
    ok: C.accent2, warn: C.warn, danger: C.danger, neutral: C.text3,
  }
  return map[tone]
}

/** Couleur d'un statut, en un appel — le cas courant côté écran. */
export function statusColor(status: string, C: ThemeColors): string {
  return toneColor(statusTone(status), C)
}
