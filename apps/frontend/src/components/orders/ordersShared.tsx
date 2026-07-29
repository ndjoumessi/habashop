import type { CSSProperties } from 'react'
import { CheckCircle, Truck, Clock, FileText, XCircle } from 'lucide-react'
import type { ApiSupplier, SupplierStatus } from '@/components/suppliers/suppliersShared'

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

/**
 * ⚠️ TYPES DE FRONTIÈRE — dérivés du BACKEND MESURÉ (2026-07-29), pas de l'interface `Order`.
 *
 * `GET /api/orders` rend `prisma.purchaseOrder.findMany({ where, include: { items: true,
 * supplier: true }, orderBy })` — **aucun `select`** : la ligne brute, plus deux relations.
 * Le domaine front (`Order`) en diffère sur QUATRE points, et c'est `mapApiOrder` qui traverse :
 *
 *   fil                                   domaine
 *   supplier: ApiSupplier (objet entier)  supplier: string  (le NOM)
 *   items[].productName                   items[].product   (+ `unit`, inventé côté écran)
 *   status: 'DRAFT' | 'SENT' | …          status: 'BROUILLON' | … (API_TO_LOCAL_STATUS)
 *   createdAt: ISO complet                date: 'YYYY-MM-DD'
 *
 * ⚠️ FRONTIÈRE DANS LA FRONTIÈRE : le `supplier` embarqué est la ligne Prisma BRUTE, donc
 * `ApiSupplier` — `categories` y est une CHAÎNE et `leadTime` du camelCase. Le typer avec
 * l'interface `Supplier` du front rouvrirait exactement le trou de la tranche 1.
 *
 * ⚠️ ASYMÉTRIE ÉCRITURE/LECTURE, à ne pas gommer : on ENVOIE `items[].product`, on REÇOIT
 * `items[].productName` (le handler mappe). Et `POST` fait `include: { items: true }` SANS
 * `supplier` : la réponse de création n'a donc PAS la forme d'une ligne de liste.
 */

/**
 * Miroir du zod `ORDER_CREATE` (`routes/orders.ts`), MESURÉ :
 *   supplierId: z.string().min(1)                       ← REQUIS (FK Supplier)
 *   items: z.array({ product, qty, unitPrice }).min(1)  ← `product`, PAS `name`
 *   expectedAt: z.any().nullish() · notes: z.string().nullish()
 *
 * ⚠️ ASYMÉTRIE : on ENVOIE `product`, le serveur range en `productName` (le handler mappe).
 * Le type qui manquait ici est la raison pour laquelle la création a été cassée en production
 * SANS que rien ne l'attrape : le front passait `NewOrderItem` — `{ id, name, price, qty,
 * emoji }` — tel quel, donc sans `product` ni `unitPrice`. Zod refusait, 400, 0 commande en
 * base. `create: (data: any)` laissait tout passer.
 */
export interface OrderWrite {
  supplierId: string
  items: Array<{ product: string; qty: number; unitPrice: number }>
  expectedAt?: string | null
  notes?: string | null
}

/** Ligne du formulaire « nouvelle commande » (vocabulaire de l'écran). */
export interface NewOrderLine { name: string; price: number; qty: number; emoji: string }

/**
 * Construit la charge utile de `POST /api/orders` depuis les lignes du formulaire.
 * PURE et exportée pour être exercée par un test — seul moyen de vérifier qu'elle satisfait le
 * zod sans lancer le serveur (cf. `docs/shared-fixtures/order-create-cases.json`, relu par un
 * test JUMEAU côté backend).
 *
 * ⚠️ `product` reprend `emoji + name`, exactement la chaîne que l'objet local affiche. Envoyer
 * le nom seul ferait diverger l'écran d'après création et l'écran d'après rechargement, le
 * serveur rendant `productName` tel quel via `mapApiOrder`.
 */
export function toOrderPayload(opts: {
  supplierId: string
  items: NewOrderLine[]
  expectedAt?: string | null
  notes?: string | null
}): OrderWrite {
  return {
    supplierId: opts.supplierId,
    items: opts.items.map(i => ({
      product: `${i.emoji} ${i.name}`.trim(),
      qty: i.qty,
      unitPrice: i.price,
    })),
    expectedAt: opts.expectedAt ?? null,
    notes: opts.notes ?? null,
  }
}

/** Ligne `PurchaseOrderItem` brute. ⚠️ `productName`, pas `product`. */
export interface ApiOrderItem {
  id: string
  orderId: string
  productName: string
  qty: number
  unitPrice: number
  total: number
}

/** Forme FIL de `GET /api/orders`. PAS `Order`. */
export interface ApiOrder {
  id: string
  tenantId: string
  ref: string
  supplierId: string
  createdById: string
  status: string
  total: number
  expectedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  items: ApiOrderItem[]
  supplier: ApiSupplier
}

/**
 * Option fournisseur du formulaire de commande — vocabulaire de l'ÉCRAN, alimenté depuis
 * `ApiSupplier`. Le typer (au lieu du `any[]` d'avant) rend deux fautes impossibles :
 *   · lire un champ que le serveur n'envoie pas → **TS2339** ;
 *   · comparer `status` à une valeur hors de l'union → **TS2367**.
 * Les deux existaient : `s.specialty` / `s.category` / `s.lead_time` n'ont JAMAIS existé
 * (la puce affichait le vide en production), et le filtre testait `!== 'inactive'` quand le
 * serveur n'émet que `'Actif' | 'Pause' | 'Inactif'` — un fournisseur désactivé restait donc
 * proposé à la commande.
 */
export interface OrderSupplierOption {
  id: string
  name: string
  /** Ce que le fournisseur fournit — vient de `ApiSupplier.categories` (chaîne du fil). */
  specialty: string
  phone: string
  leadTime: number
  rating: number
  status: SupplierStatus
}

/** Traversée `ApiSupplier` → option d'écran. */
export function toSupplierOption(s: ApiSupplier): OrderSupplierOption {
  return {
    id: s.id,
    name: s.name,
    // `categories` est DÉJÀ la chaîne saisie par le commerçant (« Riz, Huile ») : on la rend
    // telle quelle. La puce la tronque en CSS si elle déborde, plutôt que de perdre une
    // catégorie en n'affichant que la première.
    specialty: s.categories ?? '',
    phone: s.phone ?? '',
    // `Int @default(3)`, NON nullable côté Prisma → toujours un nombre, jamais de repli.
    leadTime: s.leadTime,
    rating: s.rating,
    status: (s.status as SupplierStatus) ?? 'Actif',
  }
}

export function mapApiOrder(o: ApiOrder): Order {
  return {
    id: o.id,
    ref: o.ref,
    supplier: o.supplier?.name || o.supplierId || '',
    date: o.createdAt?.split('T')[0] ?? '',
    expectedAt: o.expectedAt?.split('T')[0] ?? '',
    status: (API_TO_LOCAL_STATUS[o.status] ?? 'BROUILLON') as OrderStatus,
    total: o.total ?? 0,
    items: (o.items || []).map(i => ({ product: i.productName, qty: i.qty, unit: 'unité', unitPrice: i.unitPrice })),
    notes: o.notes || '',
  }
}
