import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JWTPayload {
  userId:   string
  // Boutique active : null tant qu'aucune boutique n'est sélectionnée (multi-boutiques).
  tenantId: string | null
  role:     string
  // Multi-boutiques : boutique active explicite. Absent des anciens JWT (rétro-compat).
  activeTenantId?: string | null
  // Admin PLATEFORME (super-admin SaaS) — propriété per-user, INDÉPENDANTE du rôle tenant.
  // Signé côté serveur depuis User.isPlatformAdmin ; jamais modifiable côté client.
  // Absent des anciens JWT → traité comme false (fail-closed) par authenticateAdmin.
  isPlatformAdmin?: boolean
}

// ── Helpers de typage des handlers Fastify ──
// request.user (JWTPayload) et request.tenantId sont fournis par les
// augmentations plus bas ; Req ne type que Body/Params/Querystring.
export type Reply = FastifyReply
export type Req<B = unknown, P = unknown, Q = unknown> = FastifyRequest<{
  Body:        B
  Params:      P
  Querystring: Q
}>

export interface IdParam { id: string }
export interface EmployeeIdParam { employeeId: string }
export interface ResourceParam { resource: string }

// ── Bodies des routes (couvrent les champs déstructurés) ──
export interface ProductBody {
  sku?: string; name?: string; category?: string; unit?: string
  buyPrice?: number; sellPrice?: number; stockQty?: number; stockMin?: number
  taxRate?: number; description?: string; barcode?: string; isActive?: boolean
  emoji?: string; wholesalePrice?: number; semiWholesalePrice?: number
  hasPromotion?: boolean; promotionPrice?: number
  supplierId?: string | null
  notes?: string
  priceTiers?: { minQty: number; price: number; label?: string }[] | null
}
export interface CustomerBody {
  name?: string; type?: string; phone?: string; email?: string; address?: string
  loyaltyPoints?: number; totalRevenue?: number
}
export interface EmployeeBody {
  name?: string; role?: string; dept?: string; type?: string; salary?: number
  phone?: string; email?: string; address?: string; photo?: string
  isActive?: boolean; color?: string; hiredAt?: string; perf?: number; avatar?: string
}
export interface SaleBody {
  items?: any[]; paymentMode?: string; total?: number
  discount?: { amount?: number; type?: string }
  customerId?: string | null
  idempotencyKey?: string | null
  // Paiement mixte (split) — renseignés quand paymentMode='mixed'.
  cashAmount?: number; mobileMoneyAmount?: number; cardAmount?: number
  // MTN MoMo — UUID retourné par /api/payments/mtn/request (traçabilité).
  mtnMomoReference?: string | null
  // Campay — référence retournée par /api/payments/campay/request (traçabilité).
  campayReference?: string | null
  // PayDunya — token de facture retourné par /api/payments/paydunya/initiate (traçabilité).
  paydunyaReference?: string | null
}
export interface OrderBody {
  supplierId?: string; items?: any[]; expectedAt?: string; notes?: string; status?: string
}
export interface TenantUpdateBody {
  name?: string; currency?: string; country?: string; vatRate?: number
  address?: string; phone?: string; email?: string
  lang?: string
  // POS
  posVatIncluded?: boolean
  posAutoprint?: boolean
  autoWhatsApp?: boolean
  enableAutoWhatsApp?: boolean
  enableLoyalty?: boolean
  requireCashier?: boolean
  enableScanner?: boolean
  priceMode?: string
  posDefaultFund?: number
  // Fidélité v1 (seuils) + v2 (remises par palier)
  pointsPerAmount?: number
  bronzeThreshold?: number
  silverThreshold?: number
  bronzeDiscount?: number
  silverDiscount?: number
  goldDiscount?: number
  // Notifications
  notifEmailSales?: boolean
  notifEmailStock?: boolean
  notifEmailPayroll?: boolean
  notifSmsSales?: boolean
  notifSmsStock?: boolean
  notifPushAll?: boolean
  // Catalogue public
  description?: string
  whatsappPhone?: string
  catalogVisible?: boolean
  // Rapports WhatsApp auto (soir/matin) — numéro du gérant ; null/vide = désactivé
  ownerPhone?: string | null
  // Identifiants légaux (pied de facture/devis) — noms alignés sur generateInvoice (frontend)
  ninea?: string | null
  rccm?: string | null
  vatNumber?: string | null
}
export interface InviteUserBody {
  name?: string; email?: string; password?: string; role?: string
}
export interface BonusBody {
  employeeId?: string; amount?: number; reason?: string; date?: string
}
export interface SalaryHistoryBody {
  employeeId?: string; oldSalary?: number; newSalary?: number; reason?: string; date?: string
}
export interface AdminCreateTenantBody {
  name?: string; currency?: string; country?: string; plan?: string
  adminEmail?: string; adminPassword?: string
}
export interface AdminReviewBody {
  action?: 'approve' | 'reject'; adminNotes?: string
}
export interface ExportQuery { lang?: string }
export interface SalesQuery { limit?: string; offset?: string }

export interface LoginBody {
  email:    string
  password: string
}

export interface RegisterBody {
  shopName:   string
  ownerName?: string
  name?:      string
  email:      string
  password:   string
  currency?:  string
  country?:   string
  language?:  string
  phone?:     string
}

export interface BillingBody {
  plan:          string
  period:        string
  paymentMethod: string
  paymentRef?:   string
  notes?:        string
}

// Typage du JWT : request.user = payload signé
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTPayload
  }
}
// request.tenantId injecté par le middleware authenticate
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string
  }
}
