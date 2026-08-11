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
  // Fidélité configurable par tenant (cf. GET /api/tenant).
  enableLoyalty?: boolean
  pointsPerAmount?: number // unités de devise pour 1 point
  bronzeThreshold?: number // pts : Bronze → Silver
  silverThreshold?: number // pts : Silver → Gold
  // Loyalty v2 : remises % par palier (0 = désactivé)
  bronzeDiscount?: number
  silverDiscount?: number
  goldDiscount?: number
  [key: string]: unknown
}

// Boutique accessible (multi-boutiques v2). Renvoyée dans login.tenants[] et GET /api/auth/tenants.
export interface TenantSummary {
  id: string
  name: string
  currency?: string
  plan?: string
  role?: string
}

// Réponse BRUTE de POST /api/auth/login.
// Multi-boutiques v2 : un compte lié à ≠ 1 boutique reçoit `tenant: null` + `activeTenantId: null`
// + `tenants[]` → sélection requise avant les routes tenant-scopées (sinon 400 NO_ACTIVE_TENANT).
export interface RawLoginResponse {
  token: string
  user: User
  tenant: Tenant | null
  tenants?: TenantSummary[]
  activeTenantId?: string | null
}

// Réponse RÉSOLUE renvoyée par authApi.login() : boutique active toujours garantie
// (auto-sélection de la 1ʳᵉ boutique si le compte est multi-boutique). Contrat inchangé pour
// les appelants (setAuth attend un `tenant` non-null).
export interface LoginResponse {
  token: string
  user: User
  tenant: Tenant
}

// POST /api/auth/switch-tenant → { token, tenant, activeTenantId, role }
export interface SwitchTenantResponse {
  token: string
  tenant: Tenant
  activeTenantId: string
  role: string
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
  /**
   * ⚠️ LEGACY / mort par construction : AUCUNE colonne `ean` dans le modèle Prisma
   * Product (le backend n'a que `barcode`) → l'API ne renvoie JAMAIS ce champ, il
   * est toujours `undefined`. Conservé en lecture au scan (`pos/index.tsx`) comme
   * filet de sécurité, plus jamais écrit. À retirer si confirmé définitivement inutile.
   */
  ean?: string | null
  taxRate?: number
  isActive: boolean
  hasPromotion?: boolean
  promotionPrice?: number | null
  promotionEnd?: string | null
  emoji: string
  /** URL de la photo produit. ⚠️ Une URL, jamais des données : ce catalogue est
   *  persisté dans AsyncStorage pour le POS hors ligne (`PERSISTED_KEYS`). */
  image?: string | null
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
  /**
   * REJEU HORS-LIGNE : posé UNIQUEMENT par `useOfflineSync` quand il vide la file d'attente
   * (jamais par une vente en ligne directe). Le serveur n'honore le montant encaissé que si,
   * EN PLUS, le prix soumis était réellement celui du tarif déclaré il y a moins de 48 h
   * (`staleCatalogAt`, fait serveur). Sans qualification → re-tarification + avertissement.
   * ⚠️ Falsifiable : ce n'est pas un signal de sécurité, la protection est le cadre serveur
   * + la trace. Cf. backend `sales.ts` + CLAUDE.md § Intégrité prix.
   */
  offlineReplay?: boolean
  // Paiement mixte (paymentMode='mixed') : ventilation en XOF base, somme = total.
  // Le backend dédup/valide (≥2 seaux non nuls, somme ±1).
  cashAmount?: number
  mobileMoneyAmount?: number
  cardAmount?: number
  /**
   * Clé d'idempotence (UUID) générée par tentative de vente. Le backend dédup :
   * renvoyer la même clé NE crée PAS de doublon (retry réseau / resync offline sûrs).
   * ⚠️ Ne JAMAIS la régénérer pour une même vente (sinon doublon).
   */
  idempotencyKey?: string
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
  // Ventilation paiement mixte (paymentMode==='mixed') — renvoyée par GET /api/sales.
  cashAmount?: number | null
  mobileMoneyAmount?: number | null
  cardAmount?: number | null
  // Loyalty v2 : remise fidélité appliquée sur cette vente (0 ou null = aucune).
  loyaltyDiscount?: number | null
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
  // Config fidélité du tenant (renvoyée par le backend, source la plus fraîche).
  pointsPerAmount?: number // unités de devise pour 1 point
  bronzeThreshold?: number // pts : Bronze → Silver
  silverThreshold?: number // pts : Silver → Gold
  // Loyalty v2 : remises par palier
  bronzeDiscount?: number
  silverDiscount?: number
  goldDiscount?: number
}

// GET /api/customers/:id/loyalty-card → données pour la carte numérique.
export interface LoyaltyCardData {
  customerId: string
  customerName: string
  tier: string
  points: number
  bronzeThreshold: number
  silverThreshold: number
  nextTier: string | null
  pointsToNext: number
  shopName: string
  currency: string
  enableLoyalty: boolean
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

// ── OCR facture fournisseur ───────────────────────────────────────────────
// POST /api/suppliers/scan-invoice (multipart, champ `invoice`) → extraction
// ligne-à-ligne via Claude Vision côté backend. Miroir EXACT de
// `InvoiceOcrResult` (apps/backend/src/services/invoiceOcr.ts) — lecture seule.
export interface OcrInvoiceItem {
  name: string
  qty: number
  unitPrice: number
}
export interface OcrInvoiceResult {
  supplierName: string | null
  invoiceDate: string | null   // "YYYY-MM-DD"
  items: OcrInvoiceItem[]
  total: number | null
  notes: string | null
  error?: string               // 'parse_error' si le JSON n'a pas pu être extrait
  rawText?: string
}
