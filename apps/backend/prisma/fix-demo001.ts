import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TENANT = 'demo-tenant-001'

// PRNG déterministe (mulberry32) → le seed produit EXACTEMENT le même jeu de
// données à chaque exécution : le script est idempotent (delete + recreate stable).
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 3 mois récents seedés (CA cible ≈ 11M XOF / mois pour un grossiste/épicerie actif)
const MONTHS = [
  { ym: '2026-03', year: 2026, month: 2, target: 11_200_000 },
  { ym: '2026-04', year: 2026, month: 3, target: 11_800_000 },
  { ym: '2026-05', year: 2026, month: 4, target: 12_400_000 },
]

// Salaires propres et plausibles (Dakar) — total 1 660 000 XOF ≤ 2M.
const SALARIES: Record<string, number> = {
  'demo-emp-Fatoumata Ndiaye': 450_000, // Responsable
  'demo-emp-Aminata Touré':    350_000, // Comptable
  'demo-emp-Kofi Diallo':      320_000, // Magasinier
  'demo-emp-Marie Bakayoko':   280_000, // Caissière
  'demo-emp-Seydou Koné':      260_000, // Caissier
}

// Dépenses mensuelles cohérentes (HT) — proportionnelles au volume, non gonflées.
const MONTHLY_EXPENSES = [
  { slug: 'loyer',       label: 'Loyer boutique',         category: 'Loyer',       amountHT: 200_000, vat: 0,  mode: 'Virement',     status: 'PAYÉ',       recurrent: true },
  { slug: 'energie',     label: 'Électricité (Senelec)',  category: 'Énergie',     amountHT: 45_000,  vat: 18, mode: 'Espèces',      status: 'PAYÉ',       recurrent: true },
  { slug: 'transport',   label: 'Transport marchandises', category: 'Transport',   amountHT: 60_000,  vat: 0,  mode: 'Espèces',      status: 'PAYÉ',       recurrent: false },
  { slug: 'fournitures', label: 'Fournitures bureau',     category: 'Fournitures', amountHT: 20_000,  vat: 18, mode: 'Espèces',      status: 'PAYÉ',       recurrent: false },
  { slug: 'marketing',   label: 'Marketing local',        category: 'Marketing',   amountHT: 30_000,  vat: 18, mode: 'Mobile money', status: 'EN ATTENTE', recurrent: false },
]

async function run() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT } })
  if (!tenant) { console.log(`❌ ${TENANT} introuvable`); return }

  // ── 1. Devise → XOF (un commerce de Dakar ; corrige la dérive EUR) ──
  await prisma.tenant.update({ where: { id: TENANT }, data: { currency: 'XOF' } })
  console.log('✅ Devise tenant → XOF')

  // ── 2. Salaires : valeurs propres ≤ 2M (corrige la dérive en décimales) ──
  let payroll = 0
  for (const [id, salary] of Object.entries(SALARIES)) {
    const r = await prisma.employee.updateMany({ where: { id, tenantId: TENANT }, data: { salary } })
    if (r.count) payroll += salary
    else console.warn('   ⚠ employé absent:', id)
  }
  console.log(`✅ Masse salariale normalisée: ${payroll.toLocaleString('fr-FR')} XOF`)

  // cashier (FK requis sur Sale) = admin du tenant
  const cashier = await prisma.user.findFirst({ where: { tenantId: TENANT, deletedAt: null }, select: { id: true } })
  if (!cashier) { console.log('❌ aucun user pour cashierId'); return }

  const products = await prisma.product.findMany({ where: { tenantId: TENANT, deletedAt: null }, select: { id: true, sellPrice: true } })
  if (products.length === 0) { console.log('❌ aucun produit'); return }

  // ── 3. Ventes : delete + regenerate déterministe (idempotent) ──
  const oldSaleIds = (await prisma.sale.findMany({ where: { tenantId: TENANT }, select: { id: true } })).map(s => s.id)
  if (oldSaleIds.length) {
    await prisma.saleItem.deleteMany({ where: { saleId: { in: oldSaleIds } } })
    await prisma.sale.deleteMany({ where: { tenantId: TENANT } })
  }
  console.log(`🧹 Ventes existantes supprimées: ${oldSaleIds.length}`)

  const payModes = ['cash', 'wave', 'orange', 'card', 'cash', 'cash'] // cash plus fréquent
  let totalCreated = 0
  let grandCA = 0
  for (let mi = 0; mi < MONTHS.length; mi++) {
    const m = MONTHS[mi]
    const rand = rng(1000 + mi) // seed fixe par mois → déterministe
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
    let monthCA = 0
    let n = 0
    // tiers : ~70% petites (détail), ~22% moyennes (semi-gros), ~8% grosses (gros)
    while (monthCA < m.target) {
      const roll = rand()
      const tier = roll < 0.70 ? 'small' : roll < 0.92 ? 'medium' : 'large'
      const nLines = tier === 'large' ? 2 + Math.floor(rand() * 3) : tier === 'medium' ? 1 + Math.floor(rand() * 2) : 1
      const items: { productId: string; qty: number; unitPrice: number; total: number }[] = []
      let saleTotal = 0
      for (let l = 0; l < nLines; l++) {
        const p = pick(products)
        const qty = tier === 'large' ? 20 + Math.floor(rand() * 50)
                  : tier === 'medium' ? 5 + Math.floor(rand() * 15)
                  : 1 + Math.floor(rand() * 4)
        const lineTotal = Math.round(p.sellPrice * qty)
        items.push({ productId: p.id, qty, unitPrice: p.sellPrice, total: lineTotal })
        saleTotal += lineTotal
      }
      const day = 1 + Math.floor(rand() * 27)
      const hour = 8 + Math.floor(rand() * 11)
      await prisma.sale.create({
        data: {
          tenantId: TENANT, cashierId: cashier.id, total: saleTotal,
          paymentMode: pick(payModes),
          clientType: tier === 'large' ? 'wholesale' : tier === 'medium' ? 'semi' : 'retail',
          createdAt: new Date(Date.UTC(m.year, m.month, day, hour, Math.floor(rand() * 60))),
          items: { create: items },
        },
      })
      monthCA += saleTotal; n++
      // garde-fou anti-boucle infinie
      if (n > 2000) break
    }
    totalCreated += n; grandCA += monthCA
    console.log(`   ${m.ym}: ${n} ventes, CA ${monthCA.toLocaleString('fr-FR')} XOF`)
  }
  console.log(`✅ Ventes recréées: ${totalCreated} | CA total: ${grandCA.toLocaleString('fr-FR')} XOF`)

  // ── 4. Dépenses : delete + recreate cohérent (ids stables, idempotent) ──
  await prisma.expense.deleteMany({ where: { tenantId: TENANT } })
  let expCount = 0
  for (const m of MONTHS) {
    for (const e of MONTHLY_EXPENSES) {
      const amountTTC = Math.round(e.amountHT * (1 + e.vat / 100))
      await prisma.expense.create({
        data: {
          id: `demo-exp-001-${m.ym}-${e.slug}`,
          tenantId: TENANT,
          date: new Date(Date.UTC(m.year, m.month, 5)),
          label: e.label, category: e.category, amountHT: e.amountHT, vat: e.vat,
          amountTTC, mode: e.mode, status: e.status, recurrent: e.recurrent,
        },
      })
      expCount++
    }
  }
  console.log(`✅ Dépenses recréées: ${expCount} (${MONTHLY_EXPENSES.reduce((s, e) => s + e.amountHT, 0).toLocaleString('fr-FR')} XOF HT / mois)`)

  console.log('🎉 fix-demo001 terminé.')
}

run().catch(e => { console.error('❌', e); process.exit(1) }).finally(() => prisma.$disconnect())
