// Helpers purs pour l'annulation/remboursement de vente (parité avec le web + backend).
// Backend : POST /api/sales/:id/refund (remboursement TOTAL uniquement).

import type { SaleRecord } from '@/types'

// Remboursement réservé MANAGER + ADMIN (+ SUPER_ADMIN). Anti-fraude : le caissier
// ne peut PAS rembourser → action MASQUÉE côté UI (le backend renvoie 403 de toute façon).
// Miroir exact du backend `REFUND_ROLES` (src/routes/sales.ts).
const REFUND_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER']
// ⚠️ Le rôle est NORMALISÉ (trim + UPPERCASE) avant comparaison : la casse du champ
// `role` n'est PAS garantie d'un bout à l'autre de l'écosystème (le web fait déjà
// `String(role).toUpperCase()` dans son authStore). Sans ça, un rôle non-canonique
// (casse/espaces) ratait le test côté mobile alors que l'écran Réglages affichait
// quand même « SUPER_ADMIN » (il applique son propre `.toUpperCase()` à l'affichage,
// ce qui MASQUE le décalage) → bouton « Rembourser » invisible même en admin.
export const canRefundRole = (role?: string | null): boolean =>
  REFUND_ROLES.includes(String(role ?? '').trim().toUpperCase())

// Une vente est remboursée si son statut backend vaut 'refunded'.
export const isRefunded = (sale: Pick<SaleRecord, 'status'>): boolean =>
  sale.status === 'refunded'

// Moyens « mobile money » → le remboursement n'est qu'un SUIVI dans l'app ;
// le mouvement d'argent réel se fait manuellement via l'opérateur. Miroir du web.
const TRACKING_MODES = ['wave', 'orange', 'mtn', 'mobile']
export const isTrackingPayment = (mode?: string | null): boolean =>
  TRACKING_MODES.includes(String(mode ?? '').toLowerCase())
