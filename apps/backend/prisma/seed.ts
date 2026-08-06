/**
 * ⚠️ CE SCRIPT NE DÉCRIT PAS LA DÉMO DE PRODUCTION.
 *
 * Les noms de tenant ont été neutralisés le 2026-08-06 (« Dakar Central » → « Boutique
 * Centrale », « Alimentation Koné — Abidjan » → « Alimentation Centrale »), en application
 * de la décision « les exemples ne nomment aucun pays ».
 *
 * ⚠️ Le seed n'a PAS été rejoué : `demo-tenant-001` et `demo-tenant-002` portent TOUJOURS
 * leurs anciens noms en base. Muter un tenant existant est interdit (§ Vérification en
 * PROD). Ce script sert aux PROCHAINS environnements, pas à réécrire celui-ci.
 *
 * ⚠️ Le jeu de données lui-même reste ouest-africain — clients « Teranga / Sahel / Médina /
 * Baobab / Yoff », adresses « Médina, Dakar », e-mails `@demo.sn`, numéros +221 et +225.
 * C'est de la couleur locale d'un jeu de démonstration, pas de la copie produit : hors
 * périmètre de la décision du 2026-08-06, qui vise les EXEMPLES montrés au prospect.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding HabaShop database...')

  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-001' },
    // lang re-posé à 'fr' à CHAQUE seed : le tenant démo est PARTAGÉ par les e2e (i18n-es-it
    // le bascule en es/it) → la valeur par défaut persistante doit être le français.
    update: { lang: 'fr' },
    create: {
      id: 'demo-tenant-001',
      name: 'HabaShop — Boutique Centrale',
      currency: 'XOF',
      country: 'SN',
      plan: 'business',
      vatRate: 18,
      lang: 'fr',
      address: 'Rue 10 × 23, Dakar, Sénégal',
      phone: '+221 77 000 00 00',
      email: 'contact@habashop.sn',
    },
  })

  const passwordHash = await bcrypt.hash('demo1234', 12)
  const demoUsers = [
    { email: 'admin@habashop.com',      name: 'Nelson Djoumessi', role: 'ADMIN'      },
    { email: 'manager@habashop.com',    name: 'Ibrahim Touré',    role: 'MANAGER'    },
    { email: 'cashier@habashop.com',    name: 'Aminata Touré',    role: 'CASHIER'    },
    { email: 'accountant@habashop.com', name: 'Fatou Sow',        role: 'ACCOUNTANT' },
    { email: 'hr@habashop.com',         name: 'Marie Bakayoko',   role: 'HR'         },
  ]
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, name: u.name },
      create: { ...u, passwordHash, tenantId: tenant.id },
    })
  }

  const products = [
    { sku: 'PRD-001', name: 'Riz parfumé 5kg',       category: 'Céréales',   emoji: '🌾', buyPrice: 3200, sellPrice: 4500, stockQty: 120, stockMin: 20 },
    { sku: 'PRD-002', name: 'Huile palme 1L',         category: 'Corps gras', emoji: '🫙', buyPrice: 1200, sellPrice: 1800, stockQty: 18,  stockMin: 25 },
    { sku: 'PRD-003', name: 'Sucre 1kg',              category: 'Épicerie',   emoji: '🍚', buyPrice: 600,  sellPrice: 850,  stockQty: 245, stockMin: 50 },
    { sku: 'PRD-004', name: 'Farine blé 1kg',         category: 'Céréales',   emoji: '🌾', buyPrice: 400,  sellPrice: 650,  stockQty: 89,  stockMin: 30 },
    { sku: 'PRD-005', name: 'Savon OMO 500g',         category: 'Hygiène',    emoji: '🧼', buyPrice: 280,  sellPrice: 500,  stockQty: 5,   stockMin: 10 },
    { sku: 'PRD-006', name: 'Lait poudre 400g',       category: 'Laitiers',   emoji: '🥛', buyPrice: 1500, sellPrice: 2200, stockQty: 67,  stockMin: 20 },
    { sku: 'PRD-007', name: 'Tomate concentrée 800g', category: 'Conserves',  emoji: '🍅', buyPrice: 900,  sellPrice: 1400, stockQty: 112, stockMin: 30 },
    { sku: 'PRD-008', name: 'Huile végétale 5L',      category: 'Corps gras', emoji: '🫒', buyPrice: 6500, sellPrice: 8500, stockQty: 34,  stockMin: 15 },
    { sku: 'PRD-009', name: 'Café soluble 200g',      category: 'Épicerie',   emoji: '☕', buyPrice: 2000, sellPrice: 2800, stockQty: 55,  stockMin: 10 },
    { sku: 'PRD-010', name: 'Sardines 155g',          category: 'Conserves',  emoji: '🐟', buyPrice: 600,  sellPrice: 900,  stockQty: 200, stockMin: 30 },
    { sku: 'PRD-011', name: 'Savon ménage 400g',      category: 'Hygiène',    emoji: '🫧', buyPrice: 200,  sellPrice: 350,  stockQty: 180, stockMin: 30 },
    { sku: 'PRD-012', name: 'Lait concentré 397g',    category: 'Laitiers',   emoji: '🥤', buyPrice: 750,  sellPrice: 1100, stockQty: 95,  stockMin: 20 },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: `demo-${p.sku}` },
      update: {},
      create: { id: `demo-${p.sku}`, tenantId: tenant.id, unit: 'unité', taxRate: 18, ...p },
    })
  }

  const suppliers = [
    { name: 'SONACO',   categories: 'Corps gras', phone: '+221 33 000 11 22', rating: 4, leadTime: 4 },
    { name: 'SENRIZ',   categories: 'Céréales',   phone: '+221 33 000 33 44', rating: 5, leadTime: 3 },
    { name: 'CSS',      categories: 'Épicerie',   phone: '+221 33 000 55 66', rating: 4, leadTime: 2 },
    { name: 'UNILEVER', categories: 'Hygiène',    phone: '+221 33 000 77 88', rating: 4, leadTime: 2 },
    { name: 'NESTLÉ',   categories: 'Laitiers',   phone: '+221 33 000 99 00', rating: 5, leadTime: 5 },
    { name: 'TOMAPOR',  categories: 'Conserves',  phone: '+221 33 111 22 33', rating: 3, leadTime: 2 },
  ]

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { id: `demo-sup-${s.name}` },
      update: {},
      create: { id: `demo-sup-${s.name}`, tenantId: tenant.id, status: 'Actif', ...s },
    })
  }

  const employees = [
    { name: 'Marie Bakayoko',   role: 'Caissière',   dept: 'Ventes',    type: 'CDI', salary: 350000, phone: '+221771112233', email: 'marie@shop.com',   avatar: 'MB', color: '#6C3FD6', perf: 5 },
    { name: 'Kofi Diallo',      role: 'Magasinier',  dept: 'Stock',     type: 'CDI', salary: 420000, phone: '+221772223344', email: 'kofi@shop.com',    avatar: 'KD', color: '#F59E0B', perf: 4 },
    { name: 'Aminata Touré',    role: 'Comptable',   dept: 'Finance',   type: 'CDD', salary: 280000, phone: '+221773334455', email: 'aminata@shop.com', avatar: 'AT', color: '#10B981', perf: 4 },
    { name: 'Seydou Koné',      role: 'Caissier',    dept: 'Ventes',    type: 'CDI', salary: 310000, phone: '+221774445566', email: 'seydou@shop.com',  avatar: 'SK', color: '#EF4444', perf: 3 },
    { name: 'Fatoumata Ndiaye', role: 'Responsable', dept: 'Direction', type: 'CDI', salary: 480000, phone: '+221775556677', email: 'fatou@shop.com',   avatar: 'FN', color: '#3B82F6', perf: 5 },
  ]

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: `demo-emp-${e.name}` },
      update: {},
      create: {
        id: `demo-emp-${e.name}`,
        tenantId: tenant.id,
        isActive: true,
        hiredAt: new Date('2023-01-01'),
        ...e,
      },
    })
  }

  // ─── 2e tenant de démo (isolation multi-tenant) ──────────────────────────────
  const tenant2 = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-002' },
    update: { lang: 'fr' },
    create: {
      id: 'demo-tenant-002',
      name: 'Alimentation Centrale',
      currency: 'XOF',
      country: 'CI',
      plan: 'starter',
      vatRate: 18,
      lang: 'fr',
      address: "Boulevard de Marseille, Abidjan, Côte d'Ivoire",
      phone: '+225 07 00 00 00',
      email: 'contact@kone-alim.ci',
    },
  })

  await prisma.user.upsert({
    where: { email: 'kone@habashop.com' },
    update: { role: 'ADMIN', name: 'Ibrahim Koné' },
    create: { email: 'kone@habashop.com', name: 'Ibrahim Koné', role: 'ADMIN', passwordHash, tenantId: tenant2.id },
  })

  const tenant2Products = [
    { sku: 'K-001', name: 'Attiéké 1kg',     category: 'Céréales',   emoji: '🥣', buyPrice: 500,  sellPrice: 800,  stockQty: 80, stockMin: 15 },
    { sku: 'K-002', name: 'Huile rouge 1L',  category: 'Corps gras', emoji: '🛢️', buyPrice: 1400, sellPrice: 2000, stockQty: 40, stockMin: 10 },
    { sku: 'K-003', name: 'Cube Maggi x100', category: 'Épicerie',   emoji: '🧂', buyPrice: 1800, sellPrice: 2500, stockQty: 25, stockMin: 8  },
  ]
  for (const p of tenant2Products) {
    await prisma.product.upsert({
      where: { id: `demo2-${p.sku}` },
      update: {},
      create: { id: `demo2-${p.sku}`, tenantId: tenant2.id, unit: 'unité', taxRate: 18, ...p },
    })
  }

  console.log('✅ Seed terminé ! (2 tenants : Boutique Centrale + Alimentation Centrale)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
