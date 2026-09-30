/**
 * JEU DE DONNÉES D'UNE DÉMO JETABLE.
 *
 * ⚠️ Les VOLUMES sont choisis pour DÉPASSER les seuils qui masquent les défauts, pas pour
 * faire joli. `demo-tenant-001` a exactement 6 catégories, or le camembert « CA par
 * catégorie » en affiche 6 : le reliquat « Autres » y valait toujours 0, et le défaut réel
 * sur `demo-002` y restait invisible. On en met NEUF.
 *
 * ⚠️ Les états VIDES doivent être atteignables : une partie des employés et une partie des
 * fournisseurs restent NON évalués (`perf`/`rating` nuls). Une démonstration qui note tout
 * le monde ne montre jamais le « — » que `ratingSummary` doit rendre.
 *
 * ⚠️ DÉTERMINISTE : un générateur congruentiel à graine fixe, jamais `Math.random`. Un jeu
 * qui change à chaque appel rend les verrous instables et une anomalie irreproductible.
 *
 * ⚠️ Boutique SÉNÉGALAISE (XOF, TVA 18 %) : les démos restent ouest-africaines. Ne pas
 * « aligner » sur le marché par défaut camerounais — une démo sénégalaise sous un défaut
 * produit camerounais est la meilleure preuve que le multi-pays fonctionne.
 *
 * ⚠️ AUCUNE coordonnée personnelle plausible : noms de fantaisie, téléphone et e-mail NULS.
 * Le balayage PII hebdomadaire signale toute coordonnée réelle dans une démo — on ne lui en
 * fournit pas, et un prospect n'a rien à apprendre d'un faux numéro.
 */

import type { Prisma } from '@prisma/client'

/** ⚠️ NEUF catégories — 6 est la valeur limite qui rendait le reliquat toujours nul. */
export const DEMO_CATEGORIES = [
  'Boissons', 'Épicerie', 'Hygiène', 'Entretien', 'Céréales',
  'Conserves', 'Frais', 'Snacks', 'Papeterie',
] as const

/** Ce qu'une création rend : seul `id` est lu par le générateur. */
interface Cree { id: string }

/**
 * Le sous-ensemble de `TxClient` réellement utilisé.
 *
 * ⚠️ Les `data` portent les types d'entrée GÉNÉRÉS par Prisma, pas un
 * `Record<string, unknown>`. C'est la seule chose qui fait vérifier les NOMS DE CHAMPS par
 * le compilateur : avec un `Record`, `tsc` ne voit rien, et ce module a réellement été
 * écrit avec un champ `Expense.amount` qui n'existe pas (la colonne s'appelle `amountHT`,
 * et `mode` est requis). Seule une relecture manuelle du schéma l'avait attrapé — une
 * garantie qui dépend d'une relecture n'est pas une garantie.
 *
 * ⚠️ Variante `Unchecked` : on écrit `tenantId` en scalaire, pas en `connect` de relation.
 */
export interface DemoTx {
  product:  { create(a: { data: Prisma.ProductUncheckedCreateInput }): Promise<Cree> }
  customer: { create(a: { data: Prisma.CustomerUncheckedCreateInput }): Promise<Cree> }
  supplier: { create(a: { data: Prisma.SupplierUncheckedCreateInput }): Promise<Cree> }
  employee: { create(a: { data: Prisma.EmployeeUncheckedCreateInput }): Promise<Cree> }
  sale:     { create(a: { data: Prisma.SaleUncheckedCreateInput }): Promise<Cree> }
  saleItem: { createMany(a: { data: Prisma.SaleItemUncheckedCreateInput[] }): Promise<{ count: number }> }
  expense:  { create(a: { data: Prisma.ExpenseUncheckedCreateInput }): Promise<Cree> }
}

export interface DemoDatasetOptions {
  tenantId: string
  /** `User.id` du compte éphémère — `Sale.cashierId` est une FK requise vers `User`. */
  cashierId: string
  /** Instant de référence. ⚠️ Paramètre, jamais `new Date()` implicite. */
  now: Date
}

/** Générateur congruentiel — déterministe, graine fixe. Pas de `Math.random`. */
function alea(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x1_0000_0000
  }
}

const MOIS_D_HISTORIQUE = 4
const PRODUITS_PAR_CATEGORIE = 4
const VENTES = 180
const MODES = ['cash', 'mobile_money', 'card', 'mtn_momo'] as const
/** ⚠️ TVA sénégalaise. Le taux du TENANT est dérivé du pays par la route, pas ici. */
const TVA_DEMO = 18

export async function buildDemoDataset(tx: DemoTx, o: DemoDatasetOptions): Promise<void> {
  const r = alea(20261001)

  // ── Fournisseurs — le troisième reste NON noté (état vide atteignable) ──────
  const fournisseurs: { nom: string; rating: number | null }[] = [
    { nom: 'Grossiste Sandaga', rating: 4 },
    { nom: 'Dakar Distribution', rating: 3 },
    { nom: 'Coopérative Thiès', rating: null },
  ]
  for (const f of fournisseurs) {
    await tx.supplier.create({
      data: { tenantId: o.tenantId, name: f.nom, rating: f.rating, phone: null, email: null },
    })
  }

  // ── Produits : 9 catégories × 4 = 36 ───────────────────────────────────────
  const produits: { id: string; sellPrice: number }[] = []
  for (const [ic, categorie] of DEMO_CATEGORIES.entries()) {
    for (let k = 0; k < PRODUITS_PAR_CATEGORIE; k++) {
      const buyPrice = 250 + Math.round(r() * 20) * 125
      const sellPrice = buyPrice + 100 + Math.round(r() * 12) * 50
      const p = await tx.product.create({
        data: {
          tenantId: o.tenantId,
          sku: `DEMO-${String(ic + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`,
          name: `${categorie} — article ${k + 1}`,
          category: categorie,
          buyPrice, sellPrice,
          stockQty: 4 + Math.round(r() * 120),
          stockMin: 5,
          taxRate: TVA_DEMO,
          emoji: '📦',
        },
      })
      produits.push({ id: p.id, sellPrice })
    }
  }

  // ── Clients ────────────────────────────────────────────────────────────────
  const clients: string[] = []
  for (const nom of ['Cliente A', 'Client B', 'Boutique C', 'Restaurant D', 'Cliente E']) {
    const c = await tx.customer.create({
      data: { tenantId: o.tenantId, name: nom, type: r() > 0.6 ? 'wholesale' : 'retail', phone: null, email: null },
    })
    clients.push(c.id)
  }

  // ── Employés — ⚠️ une partie NON évaluée (`perf: null`) ────────────────────
  const equipe: { name: string; role: string; dept: string; salary: number; perf: number | null }[] = [
    { name: 'Caissier 1', role: 'Caissier',   dept: 'Vente',     salary: 90_000,  perf: 4 },
    { name: 'Caissier 2', role: 'Caissier',   dept: 'Vente',     salary: 90_000,  perf: null },
    { name: 'Magasinier', role: 'Magasinier', dept: 'Stock',     salary: 110_000, perf: 3 },
    { name: 'Gérante',    role: 'Gérant',     dept: 'Direction', salary: 180_000, perf: null },
  ]
  for (const [k, e] of equipe.entries()) {
    await tx.employee.create({
      data: {
        tenantId: o.tenantId, name: e.name, role: e.role, dept: e.dept, type: 'CDI',
        salary: e.salary, perf: e.perf, avatar: String(k + 1),
        hiredAt: new Date(o.now.getTime() - (200 + k * 90) * 86_400_000),
        phone: null, email: null,
      },
    })
  }

  // ── Ventes sur 4 mois ──────────────────────────────────────────────────────
  const fenetreMs = MOIS_D_HISTORIQUE * 30 * 86_400_000
  for (let v = 0; v < VENTES; v++) {
    const createdAt = new Date(o.now.getTime() - Math.floor(r() * fenetreMs))
    const nbLignes = 1 + Math.floor(r() * 4)
    const lignes: Omit<Prisma.SaleItemUncheckedCreateInput, 'saleId'>[] = []
    let total = 0
    for (let l = 0; l < nbLignes; l++) {
      const p = produits[Math.floor(r() * produits.length)]
      const qty = 1 + Math.floor(r() * 5)
      const ligneTotal = p.sellPrice * qty
      total += ligneTotal
      lignes.push({ productId: p.id, qty, unitPrice: p.sellPrice, total: ligneTotal })
    }
    const avecClient = r() > 0.55
    const vente = await tx.sale.create({
      data: {
        tenantId: o.tenantId,
        cashierId: o.cashierId,
        // ⚠️ `total` est la SOMME des lignes. Un total découplé des lignes est l'ancien
        // « trust client total », refusé par l'intégrité prix serveur-autoritaire.
        total,
        paymentMode: MODES[Math.floor(r() * MODES.length)],
        customerId: avecClient ? clients[Math.floor(r() * clients.length)] : null,
        createdAt,
      },
    })
    await tx.saleItem.createMany({ data: lignes.map(l => ({ ...l, saleId: vente.id })) })
  }

  // ── Dépenses ───────────────────────────────────────────────────────────────
  // ⚠️ `Expense` n'a PAS de champ `amount` : il porte `amountHT`, `vat`, `amountTTC` et un
  // `mode` REQUIS. Le TTC est DÉRIVÉ du HT et du taux — deux montants saisis à la main
  // divergeraient, et c'est le genre d'incohérence qu'une démo ne doit pas montrer.
  const depenses = [
    { label: 'Loyer',       ht: 150_000 },
    { label: 'Électricité', ht: 42_000 },
    { label: 'Transport',   ht: 25_000 },
    { label: 'Emballages',  ht: 18_000 },
  ]
  for (const [k, d] of depenses.entries()) {
    await tx.expense.create({
      data: {
        tenantId: o.tenantId,
        label: d.label,
        category: 'Charges',
        amountHT: d.ht,
        vat: TVA_DEMO,
        amountTTC: Math.round(d.ht * (1 + TVA_DEMO / 100) * 100) / 100,
        mode: 'cash',
        date: new Date(o.now.getTime() - (k + 1) * 15 * 86_400_000),
      },
    })
  }
}
