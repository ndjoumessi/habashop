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
 * ⚠️ TOUT PASSE PAR `createMany`, et les identifiants sont générés ICI. La première version
 * enchaînait 412 instructions séquentielles, chacune avec un aller-retour réseau vers le
 * Postgres Railway, DANS une transaction : chaque requête de démo détenait une connexion du
 * pool pendant plusieurs secondes. Cinq visiteurs simultanés épuisaient le pool, et les
 * requêtes suivantes — y compris les `POST /api/sales` d'un commerçant réel en caisse —
 * échouaient en P2024, traduit en 500. Un endpoint public non authentifié pouvait dégrader la
 * caisse des clients payants. On est à SEPT allers-retours ; `demoDataset.test.ts` en borne
 * le nombre pour que la régression soit bruyante.
 *
 * ⚠️ Boutique SÉNÉGALAISE (XOF, TVA 18 %) : les démos restent ouest-africaines. Ne pas
 * « aligner » sur le marché par défaut camerounais — une démo sénégalaise sous un défaut
 * produit camerounais est la meilleure preuve que le multi-pays fonctionne.
 *
 * ⚠️ AUCUNE coordonnée personnelle plausible : noms de fantaisie, téléphone et e-mail NULS.
 * Le balayage PII hebdomadaire signale toute coordonnée réelle dans une démo — on ne lui en
 * fournit pas, et un prospect n'a rien à apprendre d'un faux numéro.
 */

import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

/** ⚠️ NEUF catégories — 6 est la valeur limite qui rendait le reliquat toujours nul. */
export const DEMO_CATEGORIES = [
  'Boissons', 'Épicerie', 'Hygiène', 'Entretien', 'Céréales',
  'Conserves', 'Frais', 'Snacks', 'Papeterie',
] as const


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
  product:  { createMany(a: { data: Prisma.ProductUncheckedCreateInput[] }): Promise<{ count: number }> }
  customer: { createMany(a: { data: Prisma.CustomerUncheckedCreateInput[] }): Promise<{ count: number }> }
  supplier: { createMany(a: { data: Prisma.SupplierUncheckedCreateInput[] }): Promise<{ count: number }> }
  employee: { createMany(a: { data: Prisma.EmployeeUncheckedCreateInput[] }): Promise<{ count: number }> }
  sale:     { createMany(a: { data: Prisma.SaleUncheckedCreateInput[] }): Promise<{ count: number }> }
  saleItem: { createMany(a: { data: Prisma.SaleItemUncheckedCreateInput[] }): Promise<{ count: number }> }
  expense:  { createMany(a: { data: Prisma.ExpenseUncheckedCreateInput[] }): Promise<{ count: number }> }
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

/**
 * ⚠️ FENÊTRE DE DEUX MOIS, ET LA DENSITÉ SE COMPTE PAR JOUR — jamais en total.
 *
 * La première version étalait 180 ventes uniformément sur 120 jours. Mesuré en production
 * le 2026-10-01 : `/api/dashboard/stats` ne lit que le mois EN COURS (`monthStart`) et le
 * jour courant, si bien que le 1ᵉʳ du mois le prospect voyait **3 ventes sur 180 — 1,7 %
 * du jeu** sur le premier écran de l'application. Rien n'était faux ; le jeu était trop
 * clairsemé là où il est REGARDÉ.
 *
 * D'où un tirage JOUR PAR JOUR : chaque jour de la fenêtre porte son propre lot. Un
 * tirage uniforme sur la fenêtre laisse des jours vides (94 jours distincts sur 120 à
 * l'ancienne densité) et ne garantit RIEN sur le jour courant.
 */
const JOURS_D_HISTORIQUE = 60
const VENTES_PAR_JOUR_MIN = 8
const VENTES_PAR_JOUR_MAX = 14
const PRODUITS_PAR_CATEGORIE = 4
/**
 * Heures d'ouverture, en heure LOCALE du serveur (Railway = UTC = heure de Dakar), la même
 * convention que les frontières de `/api/dashboard/stats` et que les crons.
 *
 * ⚠️ Ce n'est pas de la décoration : « activité récente » affiche l'HEURE des cinq
 * dernières ventes. À 1,5 vente par jour la question ne se posait pas ; à une dizaine, un
 * horodatage à 3 h du matin se remarque — et une boutique qui vend la nuit n'est pas
 * crédible.
 */
const OUVERTURE_H = 8
const FERMETURE_H = 21
/**
 * ⚠️ PLANCHER DU JOUR COURANT — exemption NOMMÉE, et elle est assumée.
 *
 * Le jour courant est tronqué par `now` : au prorata des heures écoulées, une démo ouverte
 * à 10 h le 1ᵉʳ du mois montrerait deux ventes, soit le défaut qu'on corrige. On pose donc
 * un plancher : le prospect voit une matinée de boutique. Au-dessus du plancher, c'est le
 * prorata qui décide — on ne compresse jamais une journée entière dans une heure.
 */
const VENTES_PLANCHER_JOUR_COURANT = 6
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
  await tx.supplier.createMany({
    data: fournisseurs.map(f => ({
      id: randomUUID(), tenantId: o.tenantId, name: f.nom, rating: f.rating, phone: null, email: null,
    })),
  })

  // ── Produits : 9 catégories × 4 = 36 ───────────────────────────────────────
  const produits: { id: string; sellPrice: number }[] = []
  const lignesProduits: Prisma.ProductUncheckedCreateInput[] = []
  for (const [ic, categorie] of DEMO_CATEGORIES.entries()) {
    for (let k = 0; k < PRODUITS_PAR_CATEGORIE; k++) {
      const buyPrice = 250 + Math.round(r() * 20) * 125
      const sellPrice = buyPrice + 100 + Math.round(r() * 12) * 50
      const id = randomUUID()
      lignesProduits.push({
        id,
        tenantId: o.tenantId,
        sku: `DEMO-${String(ic + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`,
        name: `${categorie} — article ${k + 1}`,
        category: categorie,
        buyPrice, sellPrice,
        stockQty: 4 + Math.round(r() * 120),
        stockMin: 5,
        taxRate: TVA_DEMO,
        emoji: '📦',
      })
      produits.push({ id, sellPrice })
    }
  }
  await tx.product.createMany({ data: lignesProduits })

  // ── Clients ────────────────────────────────────────────────────────────────
  const clients: string[] = []
  const lignesClients: Prisma.CustomerUncheckedCreateInput[] = []
  for (const nom of ['Cliente A', 'Client B', 'Boutique C', 'Restaurant D', 'Cliente E']) {
    const id = randomUUID()
    lignesClients.push({
      id, tenantId: o.tenantId, name: nom, type: r() > 0.6 ? 'wholesale' : 'retail', phone: null, email: null,
    })
    clients.push(id)
  }
  await tx.customer.createMany({ data: lignesClients })

  // ── Employés — ⚠️ une partie NON évaluée (`perf: null`) ────────────────────
  const equipe: { name: string; role: string; dept: string; salary: number; perf: number | null }[] = [
    { name: 'Caissier 1', role: 'Caissier',   dept: 'Vente',     salary: 90_000,  perf: 4 },
    { name: 'Caissier 2', role: 'Caissier',   dept: 'Vente',     salary: 90_000,  perf: null },
    { name: 'Magasinier', role: 'Magasinier', dept: 'Stock',     salary: 110_000, perf: 3 },
    { name: 'Gérante',    role: 'Gérant',     dept: 'Direction', salary: 180_000, perf: null },
  ]
  await tx.employee.createMany({
    data: equipe.map((e, k) => ({
      id: randomUUID(),
      tenantId: o.tenantId, name: e.name, role: e.role, dept: e.dept, type: 'CDI',
      salary: e.salary, perf: e.perf, avatar: String(k + 1),
      hiredAt: new Date(o.now.getTime() - (200 + k * 90) * 86_400_000),
      phone: null, email: null,
    })),
  })

  // ── Ventes : JOUR PAR JOUR sur deux mois (cf. l'en-tête des constantes) ────
  const minuitAujourdhui = new Date(o.now)
  minuitAujourdhui.setHours(0, 0, 0, 0)
  const lignesVentes: Prisma.SaleUncheckedCreateInput[] = []
  const lignesArticles: Prisma.SaleItemUncheckedCreateInput[] = []

  for (let j = JOURS_D_HISTORIQUE - 1; j >= 0; j--) {
    const minuit = new Date(minuitAujourdhui.getTime() - j * 86_400_000)
    const ouverture = new Date(minuit); ouverture.setHours(OUVERTURE_H, 0, 0, 0)
    const fermeture = new Date(minuit); fermeture.setHours(FERMETURE_H, 0, 0, 0)

    const parJour = VENTES_PAR_JOUR_MIN
      + Math.floor(r() * (VENTES_PAR_JOUR_MAX - VENTES_PAR_JOUR_MIN + 1))

    // Bornes de placement. Le jour COURANT est tronqué par `now` : jamais une vente dans
    // l'avenir, et le nombre suit le prorata des heures ouvrées écoulées — avec le
    // plancher ci-dessus pour que le premier écran ne soit pas désert.
    let debut = ouverture.getTime()
    let fin = fermeture.getTime()
    let nb = parJour
    if (j === 0) {
      fin = Math.min(o.now.getTime(), fin)
      if (fin <= debut) {
        // `now` précède l'ouverture. Une boutique ne vend pas à 3 h du matin — mais un
        // tableau de bord VIDE à 3 h du matin le 1ᵉʳ du mois perd le prospect, et c'est le
        // seul écran qu'il regarde. On place le plancher dans l'heure qui précède `now`.
        debut = Math.max(minuit.getTime(), o.now.getTime() - 3_600_000)
        fin = o.now.getTime()
        nb = VENTES_PLANCHER_JOUR_COURANT
      } else {
        const prorata = (fin - debut) / (fermeture.getTime() - ouverture.getTime())
        nb = Math.max(VENTES_PLANCHER_JOUR_COURANT, Math.round(parJour * prorata))
      }
    }

    for (let v = 0; v < nb; v++) {
      const createdAt = new Date(debut + Math.floor(r() * Math.max(1, fin - debut)))
      const nbLignes = 1 + Math.floor(r() * 4)
      const saleId = randomUUID()
      let total = 0
      for (let l = 0; l < nbLignes; l++) {
        const p = produits[Math.floor(r() * produits.length)]
        const qty = 1 + Math.floor(r() * 5)
        const ligneTotal = p.sellPrice * qty
        total += ligneTotal
        lignesArticles.push({ id: randomUUID(), saleId, productId: p.id, qty, unitPrice: p.sellPrice, total: ligneTotal })
      }
      const avecClient = r() > 0.55
      lignesVentes.push({
        id: saleId,
        tenantId: o.tenantId,
        cashierId: o.cashierId,
        // ⚠️ `total` est la SOMME des lignes. Un total découplé des lignes est l'ancien
        // « trust client total », refusé par l'intégrité prix serveur-autoritaire.
        total,
        paymentMode: MODES[Math.floor(r() * MODES.length)],
        customerId: avecClient ? clients[Math.floor(r() * clients.length)] : null,
        createdAt,
      })
    }
  }
  // ⚠️ Les ventes AVANT leurs lignes : `SaleItem.saleId` est une FK vers `Sale`.
  await tx.sale.createMany({ data: lignesVentes })
  await tx.saleItem.createMany({ data: lignesArticles })

  // ── Dépenses ───────────────────────────────────────────────────────────────
  // ⚠️ `Expense` n'a PAS de champ `amount` : il porte `amountHT`, `vat`, `amountTTC` et un
  // `mode` REQUIS. Le TTC est DÉRIVÉ du HT et du taux — deux montants saisis à la main
  // divergeraient, et c'est le genre d'incohérence qu'une démo ne doit pas montrer.
  //
  // ⚠️ MÊME DÉFAUT DE DENSITÉ QUE LES VENTES, AUTRE ÉCRAN. Les quatre dépenses étaient
  // datées à J−15, J−30, J−45 et J−60 : le 1ᵉʳ du mois, AUCUNE ne tombait dans le mois en
  // cours et l'écran « Dépenses » — un des huit modules du manuel — s'ouvrait vide. Elles
  // sont désormais RÉCURRENTES, une occurrence par mois de la fenêtre, à un jour fixe du
  // mois : le loyer tombe le 1ᵉʳ, ce qui est aussi ce que fait un vrai commerçant.
  const charges = [
    { label: 'Loyer',       ht: 150_000, jourDuMois: 1 },
    { label: 'Électricité', ht: 42_000,  jourDuMois: 4 },
    { label: 'Eau',         ht: 12_000,  jourDuMois: 6 },
    { label: 'Transport',   ht: 25_000,  jourDuMois: 9 },
    { label: 'Emballages',  ht: 18_000,  jourDuMois: 14 },
    { label: 'Téléphone',   ht: 8_000,   jourDuMois: 20 },
  ]
  const debutFenetre = minuitAujourdhui.getTime() - (JOURS_D_HISTORIQUE - 1) * 86_400_000
  const lignesDepenses: Prisma.ExpenseUncheckedCreateInput[] = []
  // Du mois le plus ancien de la fenêtre au mois courant inclus.
  for (let reculMois = 2; reculMois >= 0; reculMois--) {
    for (const c of charges) {
      const date = new Date(o.now.getFullYear(), o.now.getMonth() - reculMois, c.jourDuMois, OUVERTURE_H, 30, 0, 0)
      // ⚠️ Ni avant la fenêtre, ni dans l'avenir — une dépense future fausserait le
      // « Budget vs Réel » du mois en cours.
      if (date.getTime() < debutFenetre || date.getTime() > o.now.getTime()) continue
      lignesDepenses.push({
        id: randomUUID(),
        tenantId: o.tenantId,
        label: c.label,
        category: 'Charges',
        amountHT: c.ht,
        vat: TVA_DEMO,
        amountTTC: Math.round(c.ht * (1 + TVA_DEMO / 100) * 100) / 100,
        mode: 'cash',
        date,
      })
    }
  }
  await tx.expense.createMany({ data: lignesDepenses })
}
