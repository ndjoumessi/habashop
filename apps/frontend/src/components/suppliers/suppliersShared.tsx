import { Star } from 'lucide-react'

export type SupplierStatus = 'Actif' | 'Pause' | 'Inactif'
export type L4 = 'fr' | 'en' | 'es' | 'it'

export interface SupplierOrder { ref: string; date: string; total: number; status: string }

export interface Supplier {
  id: string; name: string; categories: string[]; phone: string
  email: string; address: string; contact: string
  leadTime: number; rating: number; status: SupplierStatus
  orders: SupplierOrder[]; notes: string
}

export const STATUS_CFG: Record<SupplierStatus, { cls: string }> = {
  Actif:   { cls: 'badge-green' },
  Pause:   { cls: 'badge-amber' },
  Inactif: { cls: 'badge-gray'  },
}
export const STATUS_LABELS: Record<SupplierStatus, Record<L4, string>> = {
  Actif:   { fr: 'Actif',    en: 'Active',   es: 'Activo',   it: 'Attivo'   },
  Pause:   { fr: 'En pause',  en: 'On hold',  es: 'En pausa', it: 'In pausa' },
  Inactif: { fr: 'Inactif',  en: 'Inactive', es: 'Inactivo', it: 'Inattivo' },
}
export const STATUS_LIST: SupplierStatus[] = ['Actif', 'Pause', 'Inactif']
export const STATUS_COLOR: Record<SupplierStatus, string> = { Actif: 'var(--acc2)', Pause: 'var(--warn)', Inactif: 'var(--danger)' }

export const statusLabel = (s: SupplierStatus, lang: string) => STATUS_LABELS[s]?.[lang as L4] ?? s

const SUPP_COLORS = ['#6C47FF','#00D084','#FF9500','#00B8FF','#FF3B5C','#F59E0B','#8B5CF6','#10B981']
export function supplierColor(name: string) { return SUPP_COLORS[name.charCodeAt(0) % SUPP_COLORS.length] }

export function StarRating({ rating }: { rating: number }) {
  const r = Number(rating) || 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} style={{ color: i <= r ? '#F0A500' : 'var(--border)', fill: i <= r ? '#F0A500' : 'none' }} />
      ))}
    </div>
  )
}

export function mapApiSupplier(s: any): Supplier {
  return {
    id: s.id,
    name: s.name,
    categories: s.categories ? s.categories.split(',').map((c: string) => c.trim()).filter(Boolean) : [],
    phone: s.phone || '',
    email: s.email || '',
    address: s.address || '',
    contact: '',
    leadTime: s.leadTime ?? 3,
    rating: s.rating ?? 3,
    status: (s.status || 'Actif') as SupplierStatus,
    orders: [],
    notes: s.notes || '',
  }
}
