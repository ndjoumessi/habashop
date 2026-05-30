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
  'BROUILLON':  { cls: 'badge-gray',   icon: <FileText size={11}/>,    color: 'var(--text3)'  },
  'ENVOYÉE':    { cls: 'badge-blue',   icon: <Clock size={11}/>,        color: '#60A5FA'       },
  'CONFIRMÉE':  { cls: 'badge-violet', icon: <CheckCircle size={11}/>,  color: 'var(--p3)'    },
  'EN TRANSIT': { cls: 'badge-amber',  icon: <Truck size={11}/>,        color: 'var(--acc)'   },
  'REÇUE':      { cls: 'badge-green',  icon: <CheckCircle size={11}/>,  color: 'var(--acc2)'  },
  'ANNULÉE':    { cls: 'badge-red',    icon: <XCircle size={11}/>,      color: 'var(--danger)' },
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
