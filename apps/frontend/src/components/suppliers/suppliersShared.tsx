import type { CSSProperties } from 'react'
import { Star } from 'lucide-react'

export type SupplierStatus = 'Actif' | 'Pause' | 'Inactif'
export type L4 = 'fr' | 'en' | 'es' | 'it'

export interface SupplierOrder { ref: string; date: string; total: number; status: string }

/**
 * ⚠️ TYPES DE FRONTIÈRE — dérivés du BACKEND MESURÉ, jamais d'une supposition.
 *
 * `Supplier` (ci-dessous) est le type de l'INTERFACE : `categories` y est un `string[]`,
 * parce que l'UI filtre, compte et affiche des catégories une par une. Le FIL, lui, porte
 * une chaîne — ce sont deux formes différentes, et `mapApiSupplier` est la traversée.
 *
 * Typer la réponse de `GET /api/suppliers` comme `Supplier[]` NIERAIT cette traversée : le
 * compilateur laisserait alors passer un tableau vers `POST`/`PUT`, que le serveur REFUSE.
 * C'est arrivé, et `tsc` était vert — une assertion de type ne vérifie rien.
 *
 * Mesuré le 2026-07-29 sur `apps/backend` :
 *   · `prisma/schema.prisma` → `model Supplier { categories String? }`  (String, pas String[])
 *   · `routes/suppliers.ts`  → `GET` rend `prisma.supplier.findMany(...)` SANS `select` :
 *      la ligne brute, tous les champs scalaires, dates sérialisées en ISO
 *   · `routes/suppliers.ts`  → zod `categories: z.string().nullish()` sur POST et PUT.
 *      Vérifié en exécutant le schéma : `"Riz, Huile"` ACCEPTÉ · `["Riz","Huile"]` REJETÉ
 *      (« Expected string, received array ») ⇒ 400.
 *   · témoin indépendant : `GlobalSearch.tsx` fait `s.categories?.toLowerCase()`.
 *
 * ⚠️ Le zod vit côté backend et n'est pas importable ici (workspaces séparés) : la
 * correspondance est donc DOCUMENTÉE et VERROUILLÉE par `suppliersApiTypes.test.ts`, qui
 * relit `routes/suppliers.ts` et rougit si le backend change de forme.
 */

/** Forme FIL de `GET /api/suppliers` : la ligne Prisma brute. PAS `Supplier`. */
export interface ApiSupplier {
  id: string
  tenantId: string
  name: string
  categories: string | null
  phone: string | null
  email: string | null
  address: string | null
  leadTime: number
  rating: number
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * Miroir du zod `SUPPLIER_UPDATE` (`routes/suppliers.ts`). `nullish()` ⇒ `?: T | null`.
 * ⚠️ `categories` est une CHAÎNE : un `string[]` est refusé À LA COMPILATION, du bon côté.
 */
export interface SupplierWrite {
  name?: string
  categories?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  leadTime?: number
  rating?: number
  status?: string
  notes?: string | null
}

/** Miroir du zod `SUPPLIER_CREATE` : identique, `name` requis (`z.string().min(1)`). */
export type SupplierCreate = SupplierWrite & { name: string }

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

/* ── Pills sémantiques (langage visuel POS/Stock) — la valeur FR reste la clé ── */
export const PILL_BASE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, width: 'fit-content',
  padding: '3px 9px', borderRadius: 'var(--r-full)', fontSize: 12,
  fontWeight: 'var(--fw-semibold)' as any, lineHeight: 1.5, whiteSpace: 'nowrap',
}
export const STATUS_PILL: Record<SupplierStatus, { bg: string; border: string; text: string }> = {
  Actif:   { bg: 'var(--c-green-bg)',  border: 'var(--c-green-border)',  text: 'var(--acc2)'  },
  Pause:   { bg: 'var(--c-orange-bg)', border: 'var(--c-orange-border)', text: 'var(--warn)'  },
  Inactif: { bg: 'var(--bg3)',         border: 'var(--border)',          text: 'var(--text3)' },
}
export function SupplierStatusPill({ status, lang }: { status: SupplierStatus; lang: string }) {
  const p = STATUS_PILL[status] ?? STATUS_PILL.Inactif
  return (
    <span style={{ ...PILL_BASE, background: p.bg, border: `1px solid ${p.border}`, color: p.text }}>
      {statusLabel(status, lang)}
    </span>
  )
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
    <div role="img" aria-label={`${r}/5`} style={{ display:'flex', alignItems:'center', gap:2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} style={{ color: i <= r ? '#F0A500' : 'var(--border)', fill: i <= r ? '#F0A500' : 'none' }} />
      ))}
    </div>
  )
}

/** Traversée FIL → UI : la chaîne `"Riz, Huile"` devient `['Riz','Huile']`. */
export function mapApiSupplier(s: ApiSupplier): Supplier {
  return {
    id: s.id,
    name: s.name,
    categories: s.categories ? s.categories.split(',').map(c => c.trim()).filter(Boolean) : [],
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
