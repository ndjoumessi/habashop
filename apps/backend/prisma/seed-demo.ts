import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Compte démo cible (par défaut le tenant "starter" Koné, quasi vide).
// Surchargeable : SEED_EMAIL=admin@habashop.com npx tsx prisma/seed-demo.ts
const TARGET_EMAIL = process.env.SEED_EMAIL ?? 'kone@habashop.com'

// PRNG déterministe (mulberry32) → données identiques à chaque exécution (idempotent).
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// Épicerie de quartier (Abidjan) : CA mensuel réaliste 4–5M XOF sur 3 mois récents.
const DEMO_MONTHS = [
  { ym: '2026-03', year: 2026, month: 2, target: 4_200_000 },
  { ym: '2026-04', year: 2026, month: 3, target: 4_500_000 },
  { ym: '2026-05', year: 2026, month: 4, target: 4_800_000 },
]
const DEMO_MONTHLY_EXPENSES = [
  { slug: 'loyer',       label: 'Loyer boutique',          category: 'Loyer',       amountHT: 120_000, vat: 0,  mode: 'Virement', status: 'PAYÉ',       recurrent: true },
  { slug: 'energie',     label: 'Électricité (CIE)',       category: 'Énergie',     amountHT: 38_000,  vat: 18, mode: 'Espèces',  status: 'PAYÉ',       recurrent: true },
  { slug: 'transport',   label: 'Transport marchandises',  category: 'Transport',   amountHT: 30_000,  vat: 0,  mode: 'Espèces',  status: 'PAYÉ',       recurrent: false },
  { slug: 'fournitures', label: 'Fournitures bureau',      category: 'Fournitures', amountHT: 15_000,  vat: 18, mode: 'Espèces',  status: 'EN ATTENTE', recurrent: false },
]

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

  // ── 1. Profil admin : nom générique fictif (captures Play Store publiques, zéro donnée perso) ──
  await prisma.user.update({ where: { id: user.id }, data: { name: 'Amadou Compte Démo' } })
  console.log('✅ Profil admin → "Amadou Compte Démo"')

  // ── 2. Devise du tenant : XOF (Franc CFA Ouest, cohérent avec Dakar — pas XAF) ──
  await prisma.tenant.update({ where: { id: tenantId }, data: { currency: 'XOF' } })
  console.log('✅ Devise tenant → XOF')

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

  // ── 3. Clients fictifs sénégalais (noms d'enseignes génériques, n° +221 non-attribuables) ──
  // Soldes (totalRevenue) variés non nuls → l'écran ne montre pas "0 FCFA" partout.
  const customers = [
    { id: 'demo-dkr-cust-1', name: 'Boutique Teranga', type: 'Grossiste', phone: '+221 77 000 01 01', email: 'teranga@demo.sn', address: 'Médina, Dakar',     loyaltyPoints: 480, totalRevenue: 1250000 },
    { id: 'demo-dkr-cust-2', name: 'Espace Sahel',     type: 'Semi-gros', phone: '+221 77 000 02 02', email: 'sahel@demo.sn',   address: 'Plateau, Dakar',    loyaltyPoints: 260, totalRevenue: 685000 },
    { id: 'demo-dkr-cust-3', name: 'Marché Médina',    type: 'Grossiste', phone: '+221 77 000 03 03', email: 'medina@demo.sn',  address: 'Médina, Dakar',     loyaltyPoints: 350, totalRevenue: 940000 },
    { id: 'demo-dkr-cust-4', name: 'Comptoir Baobab',  type: 'Détail',    phone: '+221 77 000 04 04', email: 'baobab@demo.sn',  address: 'Sacré-Cœur, Dakar', loyaltyPoints: 120, totalRevenue: 215000 },
    { id: 'demo-dkr-cust-5', name: 'Supérette Yoff',   type: 'Détail',    phone: '+221 77 000 05 05', email: 'yoff@demo.sn',    address: 'Yoff, Dakar',       loyaltyPoints: 40,  totalRevenue: 78000 },
  ]
  for (const c of customers) {
    const { id, ...rest } = c
    await prisma.customer.upsert({ where: { id }, update: { ...rest, deletedAt: null }, create: { tenantId, id, ...rest } })
      .catch(e => console.warn('customer', c.name, e.message))
  }
  // Purge des clients réels (données perso) : tout client du tenant à id NON-démo → soft-delete.
  const purged = await prisma.customer.updateMany({
    where: { tenantId, deletedAt: null, NOT: { id: { startsWith: 'demo' } } },
    data: { deletedAt: new Date() },
  })
  console.log('✅ Clients fictifs upsert:', customers.length, '| clients réels retirés (soft-delete):', purged.count)

  // ── Employés (avatar = initiales, requis par le schéma) ──
  const employees = [
    { id: 'demo2-emp-1', name: 'Kouadio N\'Guessan', role: 'Caissier',   dept: 'Ventes', type: 'CDI', salary: 130000, phone: '+225 07 00 00 10', avatar: 'KN', color: '#6C3FD6', perf: 4, hiredAt: new Date('2024-02-01') },
    { id: 'demo2-emp-2', name: 'Aya Konan',          role: 'Vendeuse',   dept: 'Ventes', type: 'CDI', salary: 110000, phone: '+225 07 00 00 11', avatar: 'AK', color: '#10B981', perf: 5, hiredAt: new Date('2024-04-15') },
    { id: 'demo2-emp-3', name: 'Moussa Bamba',       role: 'Magasinier', dept: 'Stock',  type: 'CDD', salary: 120000, phone: '+225 07 00 00 12', avatar: 'MB', color: '#F59E0B', perf: 3, hiredAt: new Date('2024-07-01') },
  ]
  for (const e of employees) {
    // update applique le salaire → re-run soigne une éventuelle dérive de valeur.
    await prisma.employee.upsert({ where: { id: e.id }, update: { salary: e.salary, isActive: true }, create: { tenantId, isActive: true, ...e } })
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

  // ── Ventes : delete + regenerate déterministe (idempotent) → CA réaliste / mois ──
  const prods = await prisma.product.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, sellPrice: true } })
  const oldSaleIds = (await prisma.sale.findMany({ where: { tenantId }, select: { id: true } })).map(s => s.id)
  if (oldSaleIds.length) {
    await prisma.saleItem.deleteMany({ where: { saleId: { in: oldSaleIds } } })
    await prisma.sale.deleteMany({ where: { tenantId } })
  }
  const payModes = ['cash', 'wave', 'orange', 'card', 'cash', 'cash']

  // ── Rattachement client (#215) ────────────────────────────────────────────────
  // Le seed ne posait AUCUN `customerId` : les 3 mois de ventes étaient tous anonymes.
  // Conséquence — l'historique d'achats d'une fiche client (#214) et les KPI CRM ne
  // pouvaient RIEN montrer en démo, alors même que le code est correct. Une démo qui
  // affiche « aucun achat » à un client qui a 1,25 M de CA affiché juste au-dessus se
  // contredit à l'écran.
  //
  // Le taux dépend du PALIER, parce que c'est ainsi qu'un commerce fonctionne : on connaît
  // (et on facture) ses grossistes, un peu moins le semi-gros, et le détail est surtout du
  // passage anonyme. Ni 0 % (le défaut d'avant) ni 100 % (qui ferait disparaître le client
  // de passage, pourtant le cas dominant) ne seraient réalistes.
  const custByTier: Record<'large' | 'medium' | 'small', string[]> = {
    large:  customers.filter(c => c.type === 'Grossiste').map(c => c.id),
    medium: customers.filter(c => c.type === 'Semi-gros').map(c => c.id),
    small:  customers.filter(c => c.type === 'Détail').map(c => c.id),
  }
  const LINK_RATE = { large: 0.9, medium: 0.6, small: 0.12 } as const

  let totalSales = 0, linkedSales = 0
  for (let mi = 0; mi < DEMO_MONTHS.length; mi++) {
    const m = DEMO_MONTHS[mi]
    const rand = rng(2000 + mi)
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
    let monthCA = 0, n = 0
    while (monthCA < m.target && n <= 2000) {
      const roll = rand()
      const tier = roll < 0.78 ? 'small' : roll < 0.96 ? 'medium' : 'large' // épicerie → surtout du détail
      // Client rattaché (ou vente anonyme). Tiré du MÊME rng seedé → reste déterministe.
      const pool = custByTier[tier]
      const customerId = pool.length > 0 && rand() < LINK_RATE[tier] ? pick(pool) : null
      const nLines = tier === 'large' ? 2 + Math.floor(rand() * 2) : 1
      const items: { productId: string; qty: number; unitPrice: number; total: number }[] = []
      let saleTotal = 0
      for (let l = 0; l < nLines; l++) {
        const p = pick(prods)
        if (!p) break
        const qty = tier === 'large' ? 15 + Math.floor(rand() * 25)
                  : tier === 'medium' ? 4 + Math.floor(rand() * 10)
                  : 1 + Math.floor(rand() * 4)
        const lineTotal = Math.round(p.sellPrice * qty)
        items.push({ productId: p.id, qty, unitPrice: p.sellPrice, total: lineTotal })
        saleTotal += lineTotal
      }
      if (saleTotal === 0) break
      await prisma.sale.create({
        data: {
          tenantId, cashierId, total: saleTotal, customerId,
          paymentMode: pick(payModes),
          clientType: tier === 'large' ? 'wholesale' : tier === 'medium' ? 'semi' : 'retail',
          createdAt: new Date(Date.UTC(m.year, m.month, 1 + Math.floor(rand() * 27), 8 + Math.floor(rand() * 11), Math.floor(rand() * 60))),
          items: { create: items },
        },
      }).catch(e => console.warn('sale', e.message))
      monthCA += saleTotal; n++; if (customerId) linkedSales++
    }
    totalSales += n
    console.log(`   ${m.ym}: ${n} ventes, CA ${monthCA.toLocaleString('fr-FR')} XOF`)
  }
  // Le compte RATTACHÉ est loggé, pas seulement le total : c'est la propriété qu'on vient
  // de corriger (#215). Un « ✅ Ventes recréées » seul resterait vert même si le
  // rattachement retombait à 0 — exactement le vert muet qu'on ne veut plus.
  console.log(`✅ Ventes recréées: ${totalSales} (dont ${linkedSales} rattachées à un client, ${totalSales > 0 ? Math.round((linkedSales / totalSales) * 100) : 0} %)`)

  // ── Dépenses : delete + recreate cohérent sur les 3 mois (ids stables, idempotent) ──
  await prisma.expense.deleteMany({ where: { tenantId } })
  let expCount = 0
  for (const m of DEMO_MONTHS) {
    for (const e of DEMO_MONTHLY_EXPENSES) {
      const amountTTC = Math.round(e.amountHT * (1 + e.vat / 100))
      await prisma.expense.create({
        data: {
          id: `demo-exp-${tenantId}-${m.ym}-${e.slug}`,
          tenantId, date: new Date(Date.UTC(m.year, m.month, 5)),
          label: e.label, category: e.category, amountHT: e.amountHT, vat: e.vat,
          amountTTC, mode: e.mode, status: e.status, recurrent: e.recurrent,
        },
      }).catch(er => console.warn('expense', e.label, er.message))
      expCount++
    }
  }
  console.log('✅ Dépenses recréées:', expCount, `(${DEMO_MONTHLY_EXPENSES.reduce((s, e) => s + e.amountHT, 0).toLocaleString('fr-FR')} XOF HT / mois)`)

  console.log('🎉 Seed démo terminé pour', TARGET_EMAIL)
}

seedDemo()
  .catch(err => { console.error('❌ Seed error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
