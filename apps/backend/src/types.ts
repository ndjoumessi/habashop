import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JWTPayload {
  userId:   string
  tenantId: string
  role:     string
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
