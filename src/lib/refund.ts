// Helpers purs pour l'annulation/remboursement de vente (parité avec le web + backend).
// Backend : POST /api/sales/:id/refund (remboursement TOTAL uniquement).

import type { SaleRecord } from '@/types'

// Remboursement réservé MANAGER + ADMIN (+ SUPER_ADMIN). Anti-fraude : le caissier
// ne peut PAS rembourser → action MASQUÉE côté UI (le backend renvoie 403 de toute façon).
// Miroir exact du backend `REFUND_ROLES` (src/routes/sales.ts).
const REFUND_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER']
export const canRefundRole = (role?: string | null): boolean =>
  REFUND_ROLES.includes(String(role ?? ''))

// Une vente est remboursée si son statut backend vaut 'refunded'.
export const isRefunded = (sale: Pick<SaleRecord, 'status'>): boolean =>
  sale.status === 'refunded'

// Moyens « mobile money » → le remboursement n'est qu'un SUIVI dans l'app ;
// le mouvement d'argent réel se fait manuellement via l'opérateur. Miroir du web.
const TRACKING_MODES = ['wave', 'orange', 'mtn', 'mobile']
export const isTrackingPayment = (mode?: string | null): boolean =>
  TRACKING_MODES.includes(String(mode ?? '').toLowerCase())
