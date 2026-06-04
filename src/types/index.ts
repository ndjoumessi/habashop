// Types des réponses backend HabaShop (sous-ensemble consommé par le mobile).
// Formes vérifiées sur l'API Railway réelle (cf. audit M1). Source de vérité côté mobile
// pour remplacer les `any` de la couche API.

// ── Rôles / auth ──────────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'SUPER_ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'HR'

export interface User {
  id: string
  name: string
  email: string
  role: Role | string
  tenantId: string
}

// GET /api/tenant — objet tenant complet (beaucoup de champs ; on type ceux que l'app lit,
// les autres restent accessibles via l'index signature sans perdre le typage des champs connus).
export interface Tenant {
  id: string
  name: string
  plan: string
  currency: string
  lang: string
  status: string
  country?: string
  vatRate?: number
  posVatIncluded?: boolean
  priceMode?: string
  [key: string]: unknown
}

// POST /api/auth/login → { token, user, tenant }
export interface LoginResponse {
  token: string
  user: User
  tenant: Tenant
}

// GET /api/auth/me → objet À PLAT (PAS { user, tenant }).
export interface MeResponse {
  id: string
  name: string
  email: string
  role: Role | string
  shopName?: string
  currency?: string
}

// ── Produits ──────────────────────────────────────────────────────────────
export interface PriceTier {
  minQty: number
  price: number
  label?: string
}

// GET /api/products → tableau plat (objet Prisma brut).
export interface Product {
  id: string
  tenantId?: string
  sku?: string
  name: string
  description?: string | null
  category: string
  unit?: string
  buyPrice?: number
  sellPrice: number
  wholesalePrice?: number | null
  semiWholesalePrice?: number | null
  stockQty: number
  stockMin: number
  supplierId?: string | null
  barcode?: string | null
  /** Champ non garanti côté backend — référencé en fallback de scan. */
  ean?: string | null
  taxRate?: number
  isActive: boolean
  hasPromotion?: boolean
  promotionPrice?: number | null
  promotionEnd?: string | null
  emoji: string
  notes?: string | null
  priceTiers?: PriceTier[] | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

/** Corps d'un PUT /api/products/:id (mise à jour partielle). */
export type ProductUpdate = Partial<Omit<Product, 'id'>>

// ── Clients ───────────────────────────────────────────────────────────────
// GET /api/customers → [{ id, name, phone, email, type, loyaltyPoints, totalRevenue }]
export interface Customer {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  type?: string
  loyaltyPoints?: number
  totalRevenue?: number
  /** Niveau de fidélité si le backend l'expose un jour. */
  tier?: string
}

// ── Ventes (POS) ──────────────────────────────────────────────────────────
export interface SaleItemInput {
  productId: string
  qty: number
  price: number
  tierLabel?: string
}

export interface SaleDiscount {
  amount: number
  type: string
}

// Corps POST /api/sales (⚠️ `qty`, pas `quantity`).
export interface SalePayload {
  items: SaleItemInput[]
  total: number
  paymentMode: string
  discount?: SaleDiscount
  customerId?: string
}

// POST /api/sales → la vente créée (objet Prisma Sale).
export interface SaleResponse {
  id: string
  total: number
  paymentMode: string
  discountAmount?: number
  discountType?: string | null
  customerId?: string | null
  cashierId?: string
  createdAt?: string
  /** Crédité fidélité si le backend le renvoie (sinon absent). */
  loyaltyPointsEarned?: number
  customerLoyaltyPoints?: number
}

export interface SaleLine {
  id?: string
  productId: string
  qty: number
  unitPrice: number
  total: number
  tierLabel?: string | null
  product?: Product
}

// GET /api/sales?limit=N → liste des ventes (items inclus).
export interface SaleRecord {
  id: string
  total: number
  paymentMode: string
  discountAmount?: number
  createdAt: string
  items?: SaleLine[]
  customerId?: string | null
  // ── Remboursement (champs additifs renvoyés par le backend, cf. modèle Prisma Sale) ──
  status?: string            // 'completed' | 'refunded'
  refundedAt?: string | null
  refundReason?: string | null
  restocked?: boolean | null
}

// POST /api/sales/:id/refund → { ok, id, status:'refunded', restocked }
export interface RefundResponse {
  ok: boolean
  id: string
  status: string
  restocked: boolean
}

// ── Fidélité ──────────────────────────────────────────────────────────────
// GET /api/customers/:id/loyalty → { points, tier, history } (tier canonique côté backend).
export interface LoyaltyHistoryEntry {
  id: string
  points: number          // >0 = gain (vente) · <0 = retrait (remboursement)
  type?: string
  reason?: string | null
  saleId?: string | null
  createdAt?: string
}
export interface LoyaltyResponse {
  points: number
  tier: string            // 'Bronze' | 'Silver' | 'Gold'
  history: LoyaltyHistoryEntry[]
}

// ── Dashboard ─────────────────────────────────────────────────────────────
// GET /api/dashboard/stats → réponse à plat.
export interface DashboardTopProduct { name: string; ca: number }
export interface DashboardStockAlert { name: string; stockQty: number; stockMin: number }
export interface DashboardStats {
  salesToday?: number
  transactionsToday?: number
  salesMonth?: number
  totalProducts?: number
  activeEmployees?: number
  pendingOrders?: number
  topProducts?: DashboardTopProduct[]
  stockAlerts?: DashboardStockAlert[]
}

// ── Compte (suppression) ──────────────────────────────────────────────────
export interface TenantUser {
  id: string
  name?: string
  email?: string
  role?: Role | string
  deletedAt?: string | null
}
