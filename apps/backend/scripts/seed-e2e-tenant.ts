import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// ═══════════════════════════════════════════════════════════════════════════════
//  Seed du TENANT E2E DÉDIÉ (issue #5).
//
//  ⚠️  Ce script écrit en PROD (la base des tests E2E = la prod). Il est STRICTEMENT
//      limité au tenant `e2e-tenant` : tout write est scopé sur ce tenantId, et le
//      script REFUSE de démarrer si l'opt-in explicite n'est pas là. Il ne doit
//      JAMAIS toucher `demo-tenant-001` / `demo-tenant-002` ni un tenant réel.
//
//  Idempotent : ré-exécutable sans doublon (upsert sur clés stables ; les ventes
//  sont purgées puis recréées, scopées au seul tenant E2E).
//
//  Fixtures RELATIVES À LA DATE : les ventes sont datées now() / now()-1j / now()-7j
//  pour que `dashboard-donut` ait toujours un `categoryBreakdown` non vide.
//
//  Montants en XOF BASE (comme toute l'app) ; l'affichage EUR convertit (÷ 655.957).
//
//  Usage :  E2E_SEED=1 npx tsx scripts/seed-e2e-tenant.ts
// ═══════════════════════════════════════════════════════════════════════════════

const prisma = new PrismaClient()

// ─── Constantes du tenant E2E ──────────────────────────────────────────────────
const E2E_TENANT_ID = 'e2e-tenant'
const E2E_SLUG = 'e2e-tenant'
const E2E_EMAIL = 'e2e@habashop.com'
const E2E_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'demo1234'
const FORBIDDEN_TENANTS = new Set(['demo-tenant-001', 'demo-tenant-002'])

// ─── GARDE-FOUS NON NÉGOCIABLES ────────────────────────────────────────────────
function assertGuard(): void {
  if (process.env.E2E_SEED !== '1') {
    throw new Error('REFUS : E2E_SEED=1 requis (opt-in explicite, anti-seed accidentel).')
  }
  if (E2E_TENANT_ID !== 'e2e-tenant' || FORBIDDEN_TENANTS.has(E2E_TENANT_ID)) {
    throw new Error(`REFUS : cible "${E2E_TENANT_ID}" interdite (tenant E2E dédié uniquement).`)
  }
}

// Barrière défensive : toute écriture passe un tenantId → refus si ≠ tenant E2E.
function scope(tenantId: string): string {
  if (tenantId !== E2E_TENANT_ID || FORBIDDEN_TENANTS.has(tenantId)) {
    throw new Error(`REFUS : écriture hors tenant E2E interdite (tenantId="${tenantId}").`)
  }
  return tenantId
}

// now() − N jours, à 10h UTC (heure ouvrée → dans les fenêtres analytics jour/semaine).
function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(10, 0, 0, 0)
  return d
}

async function main(): Promise<void> {
  assertGuard()
  const tenantId = scope(E2E_TENANT_ID)
  console.log(`🌱 Seed tenant E2E dédié : ${tenantId}`)

  // ── 1. Tenant : EUR + requireCashier=true + fidélité activée ──────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: 'HabaShop E2E', currency: 'EUR', requireCashier: true, enableLoyalty: true,
      posDefaultFund: 50000, plan: 'business', status: 'active', isActive: true,
      deletedAt: null, slug: E2E_SLUG, country: 'SN', lang: 'fr',
    },
    create: {
      id: tenantId, name: 'HabaShop E2E', currency: 'EUR', country: 'SN', lang: 'fr',
      requireCashier: true, enableLoyalty: true, posDefaultFund: 50000,
      plan: 'business', status: 'active', isActive: true, slug: E2E_SLUG,
    },
  })
  console.log(`✅ Tenant: ${tenant.id} (EUR, requireCashier=${tenant.requireCashier}, loyalty=${tenant.enableLoyalty})`)

  // ── 2. Compte E2E dédié SUPER_ADMIN (mono-boutique → login direct, pas de switch) ─
  const passwordHash = bcrypt.hashSync(E2E_PASSWORD, 12)
  const user = await prisma.user.upsert({
    where: { email: E2E_EMAIL },
    update: { role: 'SUPER_ADMIN', tenantId: scope(tenantId), isActive: true, deletedAt: null, passwordHash },
    create: { email: E2E_EMAIL, name: 'E2E Bot', role: 'SUPER_ADMIN', tenantId: scope(tenantId), passwordHash, isActive: true },
  })
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId } },
    update: { role: 'SUPER_ADMIN' },
    create: { userId: user.id, tenantId: scope(tenantId), role: 'SUPER_ADMIN' },
  })
  console.log(`✅ Compte: ${E2E_EMAIL} (SUPER_ADMIN, mono-boutique)`)

  // ── 3. Produits (≥2 catégories, stock>0 ; « Riz parfumé » attendu par pos-cash-field) ─
  // SKU au format app `PRD-NNNN` (attendu par stock-redesign-capture : /PRD-\d+/).
  const products = [
    { sku: 'PRD-0001', name: 'Riz parfumé 5kg',      category: 'Céréales',  emoji: '🌾', buyPrice: 4000, sellPrice: 6000, stockQty: 120, stockMin: 20 },
    { sku: 'PRD-0002', name: 'Huile végétale 1L',    category: 'Épicerie',  emoji: '🛢️', buyPrice: 1200, sellPrice: 1800, stockQty: 90,  stockMin: 15 },
    { sku: 'PRD-0003', name: 'Lait concentré 397g',  category: 'Laitiers',  emoji: '🥛', buyPrice: 750,  sellPrice: 1100, stockQty: 80,  stockMin: 20 },
    { sku: 'PRD-0004', name: 'Savon de Marseille',   category: 'Hygiène',   emoji: '🧼', buyPrice: 300,  sellPrice: 500,  stockQty: 150, stockMin: 30 },
    { sku: 'PRD-0005', name: 'Eau minérale 1.5L',    category: 'Boissons',  emoji: '💧', buyPrice: 250,  sellPrice: 400,  stockQty: 200, stockMin: 40 },
    { sku: 'PRD-0006', name: 'Café moulu 250g',      category: 'Épicerie',  emoji: '☕', buyPrice: 900,  sellPrice: 1300, stockQty: 60,  stockMin: 15 },
  ]
  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: scope(tenantId), sku: p.sku } },
      update: { name: p.name, category: p.category, emoji: p.emoji, buyPrice: p.buyPrice, sellPrice: p.sellPrice, stockQty: p.stockQty, stockMin: p.stockMin, isActive: true, deletedAt: null },
      create: { tenantId: scope(tenantId), unit: 'unité', taxRate: 18, isActive: true, ...p },
    })
  }
  // Purge (soft-delete) des produits E2E hors jeu courant (ex. anciens SKU) → idempotence propre.
  const keepSkus = products.map(p => p.sku)
  const purgedP = await prisma.product.updateMany({
    where: { tenantId: scope(tenantId), deletedAt: null, sku: { notIn: keepSkus } },
    data: { deletedAt: new Date() },
  })
  console.log(`✅ Produits upsert: ${products.length} | anciens SKU retirés: ${purgedP.count}`)

  // ── 4. Clients (≥1 requis par loyalty-card : bouton « Carte numérique » par ligne) ─
  // « Espace Sahel » : attendu (exact) par pos-customer-selector (recherche « es »).
  const customers = [
    { id: 'e2e-cust-001', name: 'Boutique Teranga', type: 'Grossiste', phone: '+221 77 000 90 01', email: 'teranga@e2e.test', loyaltyPoints: 480, totalRevenue: 1250000 },
    { id: 'e2e-cust-002', name: 'Comptoir Baobab',  type: 'Détail',    phone: '+221 77 000 90 02', email: 'baobab@e2e.test',  loyaltyPoints: 120, totalRevenue: 215000 },
    { id: 'e2e-cust-003', name: 'Espace Sahel',     type: 'Semi-gros', phone: '+221 77 000 90 03', email: 'sahel@e2e.test',   loyaltyPoints: 260, totalRevenue: 685000 },
  ]
  for (const c of customers) {
    const { id, ...rest } = c
    await prisma.customer.upsert({
      where: { id },
      update: { ...rest, deletedAt: null },
      create: { tenantId: scope(tenantId), id, ...rest },
    })
  }
  console.log(`✅ Clients upsert: ${customers.length}`)

  // ── 5. Employés — « Fatoumata Ndiaye » (450000 XOF) attendue par bulletin-pdf ─────
  const employees = [
    { id: 'e2e-emp-fatou', name: 'Fatoumata Ndiaye', role: 'Responsable', dept: 'Ventes', type: 'CDI', salary: 450000, phone: '+221 77 000 91 01', avatar: 'FN', color: '#6C3FD6', perf: 5, hiredAt: new Date('2024-01-15') },
    { id: 'e2e-emp-oumar', name: 'Oumar Sow',        role: 'Caissier',    dept: 'Ventes', type: 'CDI', salary: 180000, phone: '+221 77 000 91 02', avatar: 'OS', color: '#10B981', perf: 4, hiredAt: new Date('2024-05-01') },
  ]
  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: e.id },
      update: { salary: e.salary, role: e.role, isActive: true, deletedAt: null },
      create: { tenantId: scope(tenantId), isActive: true, ...e },
    })
  }
  console.log(`✅ Employés upsert: ${employees.length} (dont « Fatoumata Ndiaye » 450000 XOF)`)

  // ── 6. Fournisseur (page Fournisseurs des captures) ───────────────────────────
  await prisma.supplier.upsert({
    where: { id: 'e2e-sup-001' },
    update: {},
    create: { id: 'e2e-sup-001', tenantId: scope(tenantId), name: 'Distributeur E2E', categories: 'Céréales, Épicerie', phone: '+221 33 000 90 00', address: 'Dakar', leadTime: 2, rating: 4, status: 'Actif' },
  })
  console.log('✅ Fournisseur upsert: 1')

  // ── 7. Ventes RÉCENTES multi-catégories (dates relatives) → categoryBreakdown ────
  //     Purge + recréation scopées e2e-tenant uniquement (idempotent).
  const prods = await prisma.product.findMany({ where: { tenantId: scope(tenantId), deletedAt: null }, select: { id: true, sellPrice: true, category: true } })
  const oldSaleIds = (await prisma.sale.findMany({ where: { tenantId: scope(tenantId) }, select: { id: true } })).map(s => s.id)
  if (oldSaleIds.length) {
    await prisma.saleItem.deleteMany({ where: { saleId: { in: oldSaleIds } } })
    await prisma.sale.deleteMany({ where: { tenantId: scope(tenantId) } })
  }
  // 2 lignes / vente sur des catégories distinctes → donut à ≥2 secteurs, sur 3 dates.
  const offsets = [0, 1, 7] // now(), now()-1j, now()-7j
  let nSales = 0
  for (const off of offsets) {
    for (let k = 0; k < 3; k++) {
      const a = prods[(k * 2) % prods.length]
      const b = prods[(k * 2 + 1) % prods.length]
      const items = [a, b].filter(Boolean).map((p, i) => {
        const qty = 2 + i
        return { productId: p.id, qty, unitPrice: p.sellPrice, total: Math.round(p.sellPrice * qty) }
      })
      const total = items.reduce((s, it) => s + it.total, 0)
      if (total === 0) continue
      await prisma.sale.create({
        data: {
          tenantId: scope(tenantId), cashierId: user.id, total,
          paymentMode: ['cash', 'wave', 'card'][k % 3], clientType: 'retail',
          createdAt: daysAgo(off), items: { create: items },
        },
      })
      nSales++
    }
  }
  console.log(`✅ Ventes récentes recréées: ${nSales} (dates: now, −1j, −7j ; multi-catégories)`)

  console.log('🎉 Seed E2E terminé.')
}

main()
  .catch(err => { console.error('❌ Seed E2E error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
