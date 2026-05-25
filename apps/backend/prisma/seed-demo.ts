import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Compte démo cible (par défaut le tenant "starter" Koné, quasi vide).
// Surchargeable : SEED_EMAIL=admin@habashop.com npx tsx prisma/seed-demo.ts
const TARGET_EMAIL = process.env.SEED_EMAIL ?? 'kone@habashop.com'

async function seedDemo() {
  console.log(`🌱 Seed démo pour ${TARGET_EMAIL}…`)

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { tenant: true },
  }).catch(() => null)

  if (!user) {
    console.log(`❌ Compte ${TARGET_EMAIL} introuvable. Lancez d'abord le seed de base (db:seed).`)
    return
  }
  const tenantId = user.tenantId
  const cashierId = user.id
  console.log('✅ Tenant:', tenantId, '| cashier:', cashierId)

  // ── Produits (Abidjan / contexte ivoirien) — upsert idempotent par id ──
  const products = [
    { sku: 'K-004', name: 'Riz local 25kg',        category: 'Céréales',   emoji: '🌾', buyPrice: 9000, sellPrice: 11000, stockQty: 40,  stockMin: 10 },
    { sku: 'K-005', name: 'Lait concentré 397g',   category: 'Laitiers',   emoji: '🥛', buyPrice: 750,  sellPrice: 1100,  stockQty: 90,  stockMin: 20 },
    { sku: 'K-006', name: 'Savon de Marseille',    category: 'Hygiène',    emoji: '🧼', buyPrice: 300,  sellPrice: 500,   stockQty: 160, stockMin: 30 },
    { sku: 'K-007', name: 'Tomate concentrée 400g',category: 'Conserves',  emoji: '🍅', buyPrice: 450,  sellPrice: 700,   stockQty: 130, stockMin: 25 },
    { sku: 'K-008', name: 'Sucre morceaux 1kg',    category: 'Épicerie',   emoji: '🍬', buyPrice: 700,  sellPrice: 950,   stockQty: 110, stockMin: 20 },
    { sku: 'K-009', name: 'Café Touba 250g',       category: 'Épicerie',   emoji: '☕', buyPrice: 900,  sellPrice: 1300,  stockQty: 60,  stockMin: 15 },
    { sku: 'K-010', name: 'Eau minérale 1.5L',     category: 'Boissons',   emoji: '💧', buyPrice: 250,  sellPrice: 400,   stockQty: 240, stockMin: 48 },
    { sku: 'K-011', name: "Pâte d'arachide 500g",  category: 'Épicerie',   emoji: '🥜', buyPrice: 800,  sellPrice: 1200,  stockQty: 70,  stockMin: 15 },
    { sku: 'K-012', name: 'Poisson fumé 500g',     category: 'Conserves',  emoji: '🐟', buyPrice: 1500, sellPrice: 2200,  stockQty: 45,  stockMin: 10 },
  ]
  for (const p of products) {
    await prisma.product.upsert({
      where: { id: `demo2-${p.sku}` },
      update: {},
      create: { id: `demo2-${p.sku}`, tenantId, unit: 'unité', taxRate: 18, isActive: true, ...p },
    }).catch(e => console.warn('product', p.sku, e.message))
  }
  console.log('✅ Produits upsert:', products.length)

  // ── Clients ──
  const customers = [
    { id: 'demo2-cust-1', name: 'Grand Marché Adjamé',   type: 'Grossiste', phone: '+225 07 00 00 01', email: 'adjame@demo.ci', address: 'Marché Adjamé, Abidjan', loyaltyPoints: 520, totalRevenue: 1450000 },
    { id: 'demo2-cust-2', name: 'Boutique Koumassi',     type: 'Semi-gros', phone: '+225 07 00 00 02', email: 'koumassi@demo.ci', address: 'Koumassi, Abidjan',     loyaltyPoints: 240, totalRevenue: 720000 },
    { id: 'demo2-cust-3', name: 'Maquis Le Baoulé',      type: 'Fidèle',    phone: '+225 07 00 00 03', address: 'Cocody Angré, Abidjan', loyaltyPoints: 310, totalRevenue: 540000 },
    { id: 'demo2-cust-4', name: 'Famille Yao',           type: 'Détail',    phone: '+225 07 00 00 04', address: 'Yopougon, Abidjan',    loyaltyPoints: 60,  totalRevenue: 95000 },
  ]
  for (const c of customers) {
    await prisma.customer.upsert({ where: { id: c.id }, update: {}, create: { tenantId, ...c } })
      .catch(e => console.warn('customer', c.name, e.message))
  }
  console.log('✅ Clients upsert:', customers.length)

  // ── Employés (avatar = initiales, requis par le schéma) ──
  const employees = [
    { id: 'demo2-emp-1', name: 'Kouadio N\'Guessan', role: 'Caissier',   dept: 'Ventes', type: 'CDI', salary: 130000, phone: '+225 07 00 00 10', avatar: 'KN', color: '#6C3FD6', perf: 4, hiredAt: new Date('2024-02-01') },
    { id: 'demo2-emp-2', name: 'Aya Konan',          role: 'Vendeuse',   dept: 'Ventes', type: 'CDI', salary: 110000, phone: '+225 07 00 00 11', avatar: 'AK', color: '#10B981', perf: 5, hiredAt: new Date('2024-04-15') },
    { id: 'demo2-emp-3', name: 'Moussa Bamba',       role: 'Magasinier', dept: 'Stock',  type: 'CDD', salary: 120000, phone: '+225 07 00 00 12', avatar: 'MB', color: '#F59E0B', perf: 3, hiredAt: new Date('2024-07-01') },
  ]
  for (const e of employees) {
    await prisma.employee.upsert({ where: { id: e.id }, update: {}, create: { tenantId, isActive: true, ...e } })
      .catch(er => console.warn('employee', e.name, er.message))
  }
  console.log('✅ Employés upsert:', employees.length)

  // ── Fournisseurs (categories String, leadTime/rating Int) ──
  const suppliers = [
    { id: 'demo2-sup-1', name: 'SARL Vivriers CI',     categories: 'Céréales, Vivriers', phone: '+225 27 20 00 01', email: 'contact@vivriers.ci', address: 'Zone Industrielle Yopougon', leadTime: 2, rating: 5, status: 'Actif' },
    { id: 'demo2-sup-2', name: 'Import Corps Gras',    categories: 'Huiles, Corps gras', phone: '+225 27 20 00 02', email: 'info@corpsgras.ci',  address: 'Port Autonome, Abidjan',   leadTime: 3, rating: 4, status: 'Actif' },
    { id: 'demo2-sup-3', name: 'Distrib. Hygiène CI',  categories: 'Hygiène, Ménage',    phone: '+225 27 20 00 03',                                 address: 'Treichville, Abidjan',     leadTime: 2, rating: 4, status: 'Actif' },
  ]
  for (const s of suppliers) {
    await prisma.supplier.upsert({ where: { id: s.id }, update: {}, create: { tenantId, ...s } })
      .catch(e => console.warn('supplier', s.name, e.message))
  }
  console.log('✅ Fournisseurs upsert:', suppliers.length)

  // ── Ventes (uniquement si aucune — pas d'id naturel) ──
  const existingSales = await prisma.sale.count({ where: { tenantId } })
  if (existingSales === 0) {
    const prods = await prisma.product.findMany({ where: { tenantId, deletedAt: null }, take: 12 })
    const payModes = ['cash', 'wave', 'orange', 'card']
    const now = Date.now()
    let created = 0
    for (let i = 0; i < 24; i++) {
      const prod = prods[Math.floor(Math.random() * prods.length)]
      if (!prod) break
      const qty = Math.floor(Math.random() * 5) + 1
      const total = prod.sellPrice * qty
      await prisma.sale.create({
        data: {
          tenantId, cashierId, total,
          paymentMode: payModes[Math.floor(Math.random() * payModes.length)],
          clientType: 'retail',
          createdAt: new Date(now - Math.floor(Math.random() * 30) * 86400000),
          items: { create: [{ productId: prod.id, qty, unitPrice: prod.sellPrice, total }] },
        },
      }).then(() => { created++ }).catch(e => console.warn('sale', e.message))
    }
    console.log('✅ Ventes créées:', created)
  } else {
    console.log('ℹ️  Ventes déjà présentes:', existingSales)
  }

  // ── Dépenses (amountHT + amountTTC + mode requis) ──
  const expenses = [
    { id: 'demo2-exp-1', label: 'Loyer boutique',          category: 'Loyer',      amountHT: 200000, vat: 0,  mode: 'Virement', status: 'PAYÉ',       date: new Date('2026-05-01') },
    { id: 'demo2-exp-2', label: 'Électricité (CIE)',       category: 'Énergie',    amountHT: 38000,  vat: 18, mode: 'Espèces',  status: 'PAYÉ',       date: new Date('2026-05-06') },
    { id: 'demo2-exp-3', label: 'Transport marchandises',  category: 'Transport',  amountHT: 30000,  vat: 0,  mode: 'Espèces',  status: 'EN ATTENTE', date: new Date('2026-05-12') },
    { id: 'demo2-exp-4', label: 'Fournitures bureau',      category: 'Fournitures',amountHT: 15000,  vat: 18, mode: 'Espèces',  status: 'PAYÉ',       date: new Date('2026-05-15') },
  ]
  for (const e of expenses) {
    const amountTTC = Math.round(e.amountHT * (1 + e.vat / 100))
    await prisma.expense.upsert({ where: { id: e.id }, update: {}, create: { tenantId, amountTTC, ...e } })
      .catch(er => console.warn('expense', e.label, er.message))
  }
  console.log('✅ Dépenses upsert:', expenses.length)

  console.log('🎉 Seed démo terminé pour', TARGET_EMAIL)
}

seedDemo()
  .catch(err => { console.error('❌ Seed error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
