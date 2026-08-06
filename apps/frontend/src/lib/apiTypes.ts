import type { ApiProduct } from '@/components/stock/stockShared'

/**
 * Types de FRONTIÈRE transverses (#185) — pour les surfaces qui n'ont pas de module
 * `*Shared` de domaine : compte, facturation, journal d'audit.
 *
 * ⚠️ Chacun est dérivé de la réponse RÉELLE du handler (objet littéral construit, ou `select`
 * Prisma explicite), jamais du modèle supposé. Quand le handler fait un `select`, le type
 * NE DOIT PAS annoncer les colonnes non sélectionnées : elles ne sont pas sur le fil.
 */

/**
 * `GET /api/account/security-activity` — ⚠️ `select` EXPLICITE côté serveur (6 champs).
 * Le modèle `UserAuditLog` en porte davantage ; les annoncer ici ferait lire `undefined`.
 */
export interface ApiSecurityEvent {
  id: string
  action: string
  description: string
  ip: string | null
  severity: string
  createdAt: string
}

/**
 * `GET /api/admin/security-events` — ⚠️ MÊME TABLE, FORME DIFFÉRENTE.
 *
 * La route admin fait `basePrisma.userAuditLog.findMany({ orderBy, take })` — AUCUN `select`,
 * donc le modèle ENTIER traverse, instantanés d'identité compris. La route du compte, elle,
 * sélectionne 6 champs et n'expose PAS `userId`/`userEmailSnapshot`/`userNameSnapshot`.
 *
 * ⚠️ J'avais d'abord typé les deux routes avec `ApiSecurityEvent` : `tsc` a refusé, parce que
 * `SecurityEvents.tsx` lit précisément les trois champs que la route du COMPTE ne renvoie pas.
 * Deux routes sur une même table ne partagent pas forcément un type — c'est le `select` qui
 * décide, pas le modèle.
 *
 * ⚠️ Les instantanés (`…Snapshot`) existent parce que `UserAuditLog` n'a PAS de FK vers `User` :
 * un audit de sécurité doit survivre à la suppression du compte.
 */
export interface ApiAdminSecurityEvent extends ApiSecurityEvent {
  userId: string
  userEmailSnapshot: string
  userNameSnapshot: string
}

/**
 * `GET /api/audit-logs` — modèle `AuditLog` complet + `include` du NOM de l'utilisateur seul.
 * ⚠️ `user` peut être présent avec un seul champ : l'`include` est `{ user: { select: { name } } }`.
 */
export interface ApiAuditLog {
  id: string
  tenantId: string
  userId: string
  module: string
  action: string
  description: string
  ip: string | null
  severity: string
  createdAt: string
  user: { name: string } | null
}

/** Demande de plan en attente, telle que RECONSTRUITE par le handler (7 champs, pas le modèle). */
export interface ApiPendingPlanRequest {
  id: string
  plan: string
  period: string
  /** ⚠️ En XOF — console de facturation, cf. § Règles devise (exception plateforme). */
  amount: number
  paymentMethod: string
  status: string
  createdAt: string
}

/** `GET /api/billing/status` — objet littéral construit par le handler, pas un modèle. */
export interface ApiBillingStatus {
  plan: string
  /** ⚠️ `suspended` FORCÉ si l'essai est échu, même si la colonne dit autre chose. */
  status: string
  trialDaysLeft: number
  isTrialExpired: boolean
  planActivatedAt: string | null
  hasPendingRequest: boolean
  pendingRequest: ApiPendingPlanRequest | null
  canUpgrade: boolean
  canContinue: boolean
}

/** Corps de `POST /api/billing/request-plan`. */
export type PlanRequestWrite = {
  plan: string
  period?: string
  paymentMethod?: string
}

/* ─────────────────────────────── Ventes ─────────────────────────────── */

/**
 * FRONTIÈRE `Sale` — DÉFINIE UNE SEULE FOIS, consommée par `salesApi` ET `dashboardApi.sales`.
 *
 * ⚠️ C'est la raison pour laquelle `dashboardApi.sales` était resté `any` au lot 4 : deux
 * définitions du même retour, c'est le doublon `alertsApi` qu'on venait de supprimer.
 *
 * ⚠️ ASYMÉTRIE : `GET /api/sales` fait
 * `include: { items: { include: { product: true } }, cashier: { select: { name } } }`,
 * alors que `POST /api/sales` rend la vente NUE (la transaction retourne `newSale`, sans
 * include). Deux types, donc — et non un seul qui promettrait `items` partout.
 */
export interface ApiSale {
  id: string
  tenantId: string
  cashierId: string
  total: number
  paymentMode: string
  discountAmount: number
  discountType: string | null
  discountReason: string | null
  clientType: string
  customerId: string | null
  createdAt: string
  /** completed | refunded */
  status: string
  refundedAt: string | null
  refundedBy: string | null
  refundReason: string | null
  /** `null` tant que non remboursée — distinct de `false` (« non remis en stock »). */
  restocked: boolean | null
  idempotencyKey: string | null
  invoiceNumber: string | null
  loyaltyDiscount: number | null
  /** Trace d'audit : au moins une ligne a divergé du tarif catalogue. */
  priceDivergence: boolean | null
  cashAmount: number | null
  mobileMoneyAmount: number | null
  cardAmount: number | null
  mtnMomoReference: string | null
  campayReference: string | null
  paydunyaReference: string | null
}

/**
 * Ligne de vente. ⚠️ Les quatre derniers champs sont la TRACE d'audit d'intégrité prix :
 * `submittedPrice`/`catalogPrice` documentent l'écart, `staleCatalogAt` le qualifie, et
 * `pricingHonored` dit que l'argent a bougé — c'est le seul des quatre qui exige une
 * vérification de caisse.
 */
export interface ApiSaleItem {
  id: string
  saleId: string
  productId: string
  qty: number
  unitPrice: number
  total: number
  tierLabel: string | null
  submittedPrice: number | null
  catalogPrice: number | null
  staleCatalogAt: string | null
  pricingHonored: boolean
}

/** Forme rendue par la LISTE seule : lignes + produit complet + nom du caissier. */
export interface ApiSaleWithItems extends ApiSale {
  items: (ApiSaleItem & { product: ApiProduct })[]
  cashier: { name: string } | null
}

/** Réponse de `/api/reports/sales` — total/count/ventilation + les ventes de la fenêtre. */
export interface ApiReportSales {
  total: number
  count: number
  byPayment: Record<string, number>
  sales: ApiSaleWithItems[]
}

/**
 * Corps de `POST /api/sales`.
 *
 * ⚠️ `total` part en BRUT : le serveur applique lui-même la remise fidélité et fait autorité
 * sur le prix de chaque ligne. Envoyer le NET produirait une double remise (§ Fidélité).
 * ⚠️ `items[].clientType` porte le TARIF DÉCLARÉ PAR LIGNE — pas par vente : un panier monté
 * en Détail puis basculé en Grossiste garde légitimement ses prix détail.
 */
export type SaleWrite = {
  /** ⚠️ `price`, PAS `unitPrice` : c'est le zod `SALE_ITEM` qui fait foi, pas le modèle
   *  `SaleItem` (où la colonne s'appelle `unitPrice`). Une première version avait copié le
   *  nom de la COLONNE — `tsc` l'a refusé contre `toSaleItemPayload`. Le corps de requête et
   *  la table ne portent pas les mêmes noms, et c'est le corps qui compte ici. */
  items: { productId: string; qty: number; price?: number; clientType?: 'retail' | 'semi' | 'wholesale' | null; tierLabel?: string | null }[]
  paymentMode: string
  total: number
  customerId?: string | null
  discount?: { type: string; amount: number } | null
  cashAmount?: number
  mobileMoneyAmount?: number
  cardAmount?: number
  idempotencyKey?: string
  mtnMomoReference?: string | null
  campayReference?: string | null
  paydunyaReference?: string | null
  /** Posé UNIQUEMENT par la file de rejeu mobile (`saleReplay.ts`) — jamais par le POS en ligne. */
  offlineReplay?: boolean
}

/* ──────────────────────── Dépenses · objectifs · abonnements ──────────────────────── */

export interface ApiExpense {
  id: string
  tenantId: string
  date: string
  label: string
  category: string
  amountHT: number
  vat: number
  amountTTC: number
  mode: string
  recurrent: boolean
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Miroir d'`EXPENSE_FIELDS` — liste blanche STRICTE côté serveur (strip, anti mass-assignment). */
export type ExpenseWrite = {
  date?: string
  label?: string
  category?: string
  amountHT?: number
  vat?: number
  amountTTC?: number
  mode?: string
  recurrent?: boolean
  status?: string
  notes?: string | null
}

export interface ApiGoal {
  id: string
  tenantId: string
  label: string
  target: number
  current: number
  unit: string
  /** month | week | year */
  period: string
  color: string
  icon: string
  /** revenue | stock | customers | team */
  category: string
  /** salesMonth | transactionsMonth | avgBasket — `null` = objectif saisi à la main. */
  linkedMetric: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type GoalWrite = Partial<Omit<ApiGoal, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>

/**
 * ⚠️ Un abonnement ne stocke AUCUN total (dérivé de `product.sellPrice` → « au tarif du
 * jour ») et n'a AUCUNE colonne de fréquence : `dayOfWeek` impose l'hebdomadaire. Ne pas
 * promettre en UI ce que le modèle ne porte pas.
 */
export interface ApiSubscription {
  id: string
  tenantId: string
  customerId: string
  name: string
  /** 0 = dimanche … 6 = samedi. */
  dayOfWeek: number
  startDate: string | null
  /** active | paused | cancelled */
  status: string
  note: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Forme rendue par les LISTES : client et produits PARTIELLEMENT sélectionnés côté serveur.
 * ⚠️ `customer` n'a que 3 champs et `product` que 5 — déclarer le modèle entier ferait lire
 * `undefined` sur des colonnes qui ne sont pas sur le fil (cf. `ApiSecurityEvent`).
 */
export interface ApiSubscriptionWithItems extends ApiSubscription {
  customer: { id: string; name: string; phone: string | null } | null
  items: {
    id: string
    subscriptionId: string
    productId: string
    /** ⚠️ `quantity`, PAS `qty` — le modèle `SubscriptionItem` diffère de `SaleItem` sur ce
     *  point. Une première version de ce type avait copié `qty` par analogie : `tsc` l'a
     *  refusé, le front envoyait déjà la bonne clé. Dériver du MODÈLE, jamais du voisin. */
    quantity: number
    product: { id: string; name: string; sellPrice: number; emoji: string; stockQty: number } | null
  }[]
}

export type SubscriptionWrite = {
  customerId?: string
  name?: string
  dayOfWeek?: number
  startDate?: string | null
  status?: string
  note?: string | null
  items?: { productId: string; quantity: number }[]
}

/* ─────────────────────────────── IA ─────────────────────────────── */

/** `POST /api/ai/analyze` — objet littéral du handler. 503 si la clé Anthropic manque. */
export interface ApiAiAnalysis {
  success: boolean
  /** ⚠️ Le handler rend `analysis`. Il n'existe AUCUN champ `response` sur cette route —
   *  `AIAssistant` lisait `data.analysis ?? data.response`, un repli vers un champ qui
   *  n'arrive jamais. Repli retiré côté appelant plutôt que promis ici. */
  analysis: string
  data: {
    totalRevenue: number
    avgDailySales: number
    totalSales: number
    margin: number
    lowStockCount: number
    topProducts: { name: string; qty: number }[]
  }
}

/** `POST /api/ai/chat` — le handler rend UNIQUEMENT `{ response }`. */
export interface ApiAiChat {
  response: string
}

/* ──────────────────────── Console PLATEFORME (admin) ──────────────────────── */

/**
 * FRONTIÈRE de la console plateforme (#185).
 *
 * ⚠️ RÈGLE DE MONTANTS — `revenue` (CA par boutique) et `PlanRequest.amount` sont en **XOF**
 * et s'affichent en FCFA, JAMAIS dans la devise d'affichage du super-admin : `useFormatAmount`
 * y convertirait à des taux externes et rendrait un chiffre qui n'est celui de personne (un
 * opérateur réglé en EUR lisait « Starter — 15,09 € » au lieu de « 9 900 FCFA »). Ces montants
 * ne sont PAS en devise-tenant, le convertisseur per-viewer n'a rien à y faire.
 * Verrous : `adminXof.test.ts` (méta-test) + `adminXof.behaviour.test.tsx` (comportemental).
 *
 * ⚠️ NARROWING DÉLIBÉRÉ, et c'est la règle INVERSE de celle d'`ApiSecurityEvent` : la route
 * fait `return tenants.map(t => ({ ...t, revenue, lastActivityAt }))`, donc le modèle `Tenant`
 * ENTIER est sur le fil. On ne contracte ici que ce que la console lit. Déclarer MOINS que ce
 * qui arrive est sûr (aucune lecture d'`undefined`) ; déclarer PLUS est ce qui produit les
 * bugs de frontière. Les deux règles disent la même chose : ne promettre que du vérifié.
 */
export interface ApiAdminTenant {
  id: string
  name: string
  email: string | null
  plan: string
  status: string
  /** Devise de la BOUTIQUE (affichage tenant) — à ne pas confondre avec les montants XOF. */
  currency: string
  country: string | null
  isActive: boolean
  trialEnds: string | null
  createdAt: string
  /** Agrégat AJOUTÉ par le handler — pas une colonne. ⚠️ XOF. */
  revenue: number
  /** Dernière vente non remboursée ; `null` = aucune activité. */
  lastActivityAt: string | null
  _count: { users: number; products: number; sales: number }
}

/** `GET /api/admin/stats` — objet littéral d'agrégats. ⚠️ `totalRevenue` en XOF. */
export interface ApiAdminStats {
  totalTenants: number
  totalUsers: number
  totalSales: number
  totalRevenue: number
  totalProducts: number
  /** Boutiques démo / E2E / interne — EXCLUES de tous les totaux ci-dessus. */
  fixtureTenants?: number
  /** MRR en XOF : somme des tarifs mensuels des boutiques CLIENTES actives. */
  mrrXof?: number
  mrrParPlan?: { plan: string; tenants: number; mrrXof: number; surDevis: boolean }[]
}

/** `GET /api/admin/plan-requests` — modèle `PlanRequest` + `include: { tenant: true }`. */
export interface ApiPlanRequest {
  id: string
  tenantId: string
  plan: string
  period: string
  /** ⚠️ XOF (colonne `Int`, commentée « montant en XOF » au schéma). */
  amount: number
  currency: string
  paymentMethod: string
  paymentRef: string | null
  status: string
  notes: string | null
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  /** `include: { tenant: true }` — modèle entier ; seuls `id`/`name` sont lus par la console. */
  tenant: { id: string; name: string } | null
}

/** Corps de `POST /api/admin/tenants` — miroir du zod `ADMIN_CREATE_TENANT`. */
export type AdminCreateTenantWrite = {
  name: string
  email?: string
  plan?: string
  currency?: string
  country?: string
  phone?: string
  ownerName?: string
  ownerEmail?: string
  ownerPassword?: string
}

/* ──────────────────────── Catalogue PUBLIC (non authentifié) ──────────────────────── */

/**
 * ⚠️ CONTRAT VISIBLE DE L'EXTÉRIEUR — `GET /api/public/catalog/:slug` n'exige aucun jeton.
 * Sa forme n'est pas un détail interne : elle est servie à des navigateurs quelconques.
 *
 * ⚠️ `select` EXPLICITE des deux côtés. Le tenant expose 9 champs, le produit 11 — et
 * SURTOUT : ni `buyPrice`, ni `wholesalePrice`, ni `semiWholesalePrice`, ni `sku`, ni
 * `stockMin`, ni `priceTiers` ne sont sur le fil. Élargir ce type reviendrait à annoncer
 * comme public ce que la route ne publie pas ; élargir le `select` publierait des PRIX
 * D'ACHAT et des marges. Ne pas confondre `ApiPublicProduct` avec `ApiProduct`.
 */
export interface ApiPublicTenant {
  id: string
  name: string
  description: string | null
  logo: string | null
  /** Replié serveur : `whatsappPhone || phone || null`. */
  whatsappPhone: string | null
  // ⚠️ PAS de `phone` : le handler fait explicitement `phone: undefined` — « on ne renvoie
  // pas le phone interne séparément côté public ». Il EST dans le `select` mais retiré du
  // retour, donc absent du JSON. Le déclarer ici contredisait une décision de
  // CONFIDENTIALITÉ, et l'aurait fait lire comme disponible. Mesuré sur la vraie réponse.
  currency: string
  country: string | null
  lang: string
}

export interface ApiPublicProduct {
  id: string
  name: string
  description: string | null
  sellPrice: number
  promotionPrice: number | null
  hasPromotion: boolean
  promotionEnd: string | null
  emoji: string
  stockQty: number
  unit: string
  category: string
}

export type ApiPublicCatalog = { tenant: ApiPublicTenant; products: ApiPublicProduct[] }

/* ──────────────────────── Session ──────────────────────── */

/**
 * ⚠️ `GET /api/auth/me` — chemin de RAFRAÎCHISSEMENT, pas de login. `App.tsx` l'appelle au
 * montage et fait `.catch(() => logout())` : un type trop strict ici ne « casse » pas la
 * compilation, il DÉCONNECTE l'utilisateur au rechargement. C'est le chemin qu'on n'exerce
 * pas en regardant l'écran, et c'est pourquoi il est typé exactement.
 *
 * ⚠️ `shopName` et `currency` viennent de `tenant?.` : ils sont donc `undefined` quand aucune
 * boutique n'est active (multi-boutiques avant sélection). Les déclarer `string` ferait
 * promettre une valeur que la route ne rend pas.
 */
export interface ApiMe {
  id: string
  name: string
  email: string
  role: string
  shopName?: string
  currency?: string
  isPlatformAdmin: boolean
}

/** L'utilisateur tel que renvoyé par le LOGIN (forme distincte de `ApiMe`). */
export interface ApiSessionUser {
  id: string
  name: string
  email: string
  role: string
  shopName: string
  isPlatformAdmin: boolean
}

/* ──────────────────────── Boutique ──────────────────────── */

/**
 * FRONTIÈRE `Tenant` — ⚠️ RÉ-EXPORT de l'interface d'`appStore`, PAS une seconde définition.
 *
 * Deux interfaces « Tenant » libres de diverger seraient le doublon `alertsApi` en pire, sur
 * la structure la plus utilisée de l'app. On complète donc l'interface EXISTANTE (lot 8) et
 * on la ré-exporte sous le nom de frontière.
 *
 * ⚠️ Elle reste plus ÉTROITE que la réponse (81 colonnes traversent, on en déclare ~50) :
 * déclarer moins que ce qui arrive est sûr, déclarer plus produit les bugs.
 */
export type { Tenant as ApiTenant } from '@/stores/appStore'

/* ──────────────────────── Utilisateurs · ticket Z · fidélité · OCR ──────────────────────── */

/**
 * `GET /api/tenant/users` — ⚠️ le handler fait
 * `users.map(({ passwordHash, twoFASecret, ...u }) => u)` : ces DEUX champs sont RETIRÉS du
 * retour. Le modèle les porte, le fil non — et c'est une décision de sécurité, pas un oubli.
 * Les déclarer ici les ferait lire comme disponibles (le motif exact de `phone` sur le
 * catalogue public, lot 7).
 */
export interface ApiTenantUser {
  id: string
  tenantId: string
  name: string
  email: string
  role: string
  isPlatformAdmin: boolean
  twoFAEnabled: boolean
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Ticket Z — clôture de caisse serveur. `null` si aucun ticket pour le jour demandé. */
export interface ApiTicketZ {
  id: string
  tenantId: string
  date: string
  caVentes: number
  nbVentes: number
  totalRemboursements: number
  caNets: number
  cashAmount: number
  mobileMoneyAmount: number
  cardAmount: number
  panierMoyen: number
  nbClients: number
  generatedBy: string
  generatedAt: string
}

/** Mouvement de points — `select` de 6 champs, 50 lignes max, plus récent d'abord. */
export interface ApiLoyaltyTxn {
  id: string
  points: number
  type: string
  reason: string | null
  saleId: string | null
  createdAt: string
}

/**
 * ⚠️ LECTURE SEULE. Le créditage est 100 % SERVEUR (transaction de vente) — la route d'ajout
 * a été retirée, et ce type n'a donc aucun pendant en écriture.
 */
export interface ApiLoyalty {
  points: number
  tier: string
  history: ApiLoyaltyTxn[]
  pointsPerAmount: number
  bronzeThreshold: number
  silverThreshold: number
  bronzeDiscount?: number
  silverDiscount?: number
  goldDiscount?: number
}

/**
 * `POST /api/suppliers/scan-invoice` — miroir d'`InvoiceOcrResult`
 * (`apps/backend/src/services/invoiceOcr.ts`).
 *
 * ⚠️ Toutes les valeurs extraites sont NULLABLES : l'OCR peut ne rien reconnaître sur une
 * photo floue, et `error` est renseigné SANS que la requête échoue (200 avec un contenu
 * vide). Un type non-nullable ferait croire à une extraction toujours réussie.
 */
export interface ApiInvoiceOcr {
  supplierName: string | null
  invoiceDate: string | null
  items: { name: string; qty: number; unitPrice: number }[]
  total: number | null
  notes: string | null
  error?: string
  rawText?: string
}

/**
 * Corps de `POST /api/whatsapp/broadcast` — `{ phones, message, lang }` côté handler.
 *
 * ⚠️ `phones` part vers des numéros de CLIENTS : le serveur n'infère AUCUN pays pour eux
 * (`resolveRecipient`, flux client) et refuse tout ce qui n'est pas un international
 * explicite. Envoyer des numéros nationaux ici ne « marche » pas à moitié — ils sont écartés
 * et remontés dans `refused[]`. Cf. § Normalisation téléphonique.
 */
export type WhatsAppBroadcastWrite = {
  phones: string[]
  message: string
  lang: string
}
