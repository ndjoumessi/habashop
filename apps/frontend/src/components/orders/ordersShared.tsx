import type { CSSProperties } from 'react'
import { CheckCircle, Truck, Clock, FileText, XCircle } from 'lucide-react'

// Types + constantes + helpers partagés des commandes (extraits de Orders.tsx — comportement inchangé).

export type OrderStatus = 'BROUILLON' | 'ENVOYÉE' | 'CONFIRMÉE' | 'EN TRANSIT' | 'REÇUE' | 'ANNULÉE'

export interface OrderItem { product: string; qty: number; unit: string; unitPrice: number }
export interface Order {
  id: string; ref: string; supplier: string; date: string
  expectedAt: string; status: OrderStatus; total: number
  items: OrderItem[]; notes: string
  type?: 'client' | 'supplier'
}

export const STATUS_CONFIG: Record<OrderStatus, { cls: string; icon: React.ReactNode; color: string }> = {
  'BROUILLON':  { cls: 'badge-gray',   icon: <FileText size={11}/>,    color: 'var(--warn)'  },
  'ENVOYÉE':    { cls: 'badge-blue',   icon: <Clock size={11}/>,        color: 'var(--warn)'   },
  'CONFIRMÉE':  { cls: 'badge-violet', icon: <CheckCircle size={11}/>,  color: 'var(--acc3)'  },
  'EN TRANSIT': { cls: 'badge-amber',  icon: <Truck size={11}/>,        color: 'var(--acc3)'  },
  'REÇUE':      { cls: 'badge-green',  icon: <CheckCircle size={11}/>,  color: 'var(--acc2)'  },
  'ANNULÉE':    { cls: 'badge-red',    icon: <XCircle size={11}/>,      color: 'var(--danger)' },
}

/* ── Pills sémantiques (langage visuel POS/Stock) — mapping COULEUR seulement,
   les valeurs/clés de statut restent inchangées (pattern data traduites) :
   attente (brouillon/envoyée) = orange · confirmé/en cours = bleu · livré = vert · annulé = rouge */
const PILL_ORANGE = { bg: 'var(--c-orange-bg)', border: 'var(--c-orange-border)', text: 'var(--warn)'   }
const PILL_BLUE   = { bg: 'var(--c-blue-bg)',   border: 'var(--c-blue-border)',   text: 'var(--acc3)'   }
const PILL_GREEN  = { bg: 'var(--c-green-bg)',  border: 'var(--c-green-border)',  text: 'var(--acc2)'   }
const PILL_RED    = { bg: 'var(--c-red-bg)',    border: 'var(--c-red-border)',    text: 'var(--danger)' }
export const STATUS_PILL: Record<OrderStatus, { bg: string; border: string; text: string }> = {
  'BROUILLON':  PILL_ORANGE,
  'ENVOYÉE':    PILL_ORANGE,
  'CONFIRMÉE':  PILL_BLUE,
  'EN TRANSIT': PILL_BLUE,
  'REÇUE':      PILL_GREEN,
  'ANNULÉE':    PILL_RED,
}
export const PILL_BASE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, width: 'fit-content',
  padding: '3px 9px', borderRadius: 'var(--r-full)', fontSize: 12,
  fontWeight: 'var(--fw-semibold)' as any, lineHeight: 1.5, whiteSpace: 'nowrap',
}
export function OrderStatusPill({ status, lang }: { status: OrderStatus; lang: string }) {
  const p = STATUS_PILL[status] ?? PILL_ORANGE
  return (
    <span style={{ ...PILL_BASE, background: p.bg, border: `1px solid ${p.border}`, color: p.text }}>
      {STATUS_CONFIG[status]?.icon} {orderStatusLabel(status, lang)}
    </span>
  )
}

export const STATUSES: OrderStatus[] = ['BROUILLON','ENVOYÉE','CONFIRMÉE','EN TRANSIT','REÇUE','ANNULÉE']

type L4 = 'fr' | 'en' | 'es' | 'it'
export const ORDER_STATUS_LABELS: Record<OrderStatus, Record<L4, string>> = {
  'BROUILLON':  { fr: 'Brouillon',  en: 'Draft',      es: 'Borrador',   it: 'Bozza' },
  'ENVOYÉE':    { fr: 'Envoyée',    en: 'Sent',       es: 'Enviada',    it: 'Inviata' },
  'CONFIRMÉE':  { fr: 'Confirmée',  en: 'Confirmed',  es: 'Confirmada', it: 'Confermata' },
  'EN TRANSIT': { fr: 'En transit', en: 'In transit', es: 'En tránsito',it: 'In transito' },
  'REÇUE':      { fr: 'Reçue',      en: 'Received',   es: 'Recibida',   it: 'Ricevuta' },
  'ANNULÉE':    { fr: 'Annulée',    en: 'Cancelled',  es: 'Cancelada',  it: 'Annullata' },
}
export const orderStatusLabel = (s: OrderStatus, lang: string) => ORDER_STATUS_LABELS[s]?.[lang as L4] ?? s

const API_TO_LOCAL_STATUS: Record<string, OrderStatus> = {
  DRAFT: 'BROUILLON', SENT: 'ENVOYÉE', CONFIRMED: 'CONFIRMÉE',
  IN_TRANSIT: 'EN TRANSIT', RECEIVED: 'REÇUE', CANCELLED: 'ANNULÉE',
}
export const LOCAL_TO_API_STATUS: Record<string, string> = {
  BROUILLON: 'DRAFT', ENVOYÉE: 'SENT', CONFIRMÉE: 'CONFIRMED',
  'EN TRANSIT': 'IN_TRANSIT', REÇUE: 'RECEIVED', ANNULÉE: 'CANCELLED',
}

export function mapApiOrder(o: any): Order {
  return {
    id: o.id,
    ref: o.ref,
    supplier: o.supplier?.name || o.supplierId || '',
    date: o.createdAt?.split('T')[0] ?? '',
    expectedAt: o.expectedAt?.split('T')[0] ?? '',
    status: (API_TO_LOCAL_STATUS[o.status] ?? 'BROUILLON') as OrderStatus,
    total: o.total ?? 0,
    items: (o.items || []).map((i: any) => ({ product: i.productName, qty: i.qty, unit: 'unité', unitPrice: i.unitPrice })),
    notes: o.notes || '',
  }
}
