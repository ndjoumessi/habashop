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
  shift:    { createMany(a: { data: Prisma.ShiftUncheckedCreateInput[] }): Promise<{ count: number }> }
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
const VENTES_PAR_JOUR_MIN = 14
const VENTES_PAR_JOUR_MAX = 20
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
 * ⚠️ FORME INTRA-JOURNALIÈRE — poids par heure, de `OUVERTURE_H` à `FERMETURE_H − 1`.
 *
 * MESURÉ EN PRODUCTION LE 2026-10-01, SUR LE BADGE : le tableau de bord de démo affichait
 * « VENTES DU JOUR **+1005,3 %** ». Le produit avait raison — il compare le jour courant à
 * la veille sur la MÊME plage horaire écoulée. C'était le JEU qui était asymétrique : le
 * plancher ci-dessous mettait une matinée de ventes dans l'intervalle écoulé, alors que la
 * veille, étalée UNIFORMÉMENT de 08 h à 21 h, n'avait presque rien avant 10 h.
 *
 * Un étalement uniforme est donc faux deux fois : il fabrique un écart jour/veille absurde,
 * ET il rend des horodatages invraisemblables — « activité récente » affiche l'heure des
 * cinq dernières ventes. Une boutique de quartier ouest-africaine a deux pointes : le matin
 * avant le travail et l'école, puis la fin d'après-midi au retour. Le creux est l'après-midi,
 * pas la nuit.
 *
 * ⚠️ La courbe n'est pas de la décoration : c'est elle qui rend le PLANCHER presque inutile,
 * parce que la part de journée déjà écoulée à 9 h n'est plus 1/13 mais près d'un cinquième.
 * Verrou : `demoDataset.test.ts` exerce le rapport jour/veille à 09 h, 12 h, 15 h et 19 h —
 * et exige en plus que la courbe EXISTE, sinon on aurait corrigé l'écart en laissant une
 * boutique dont l'activité est plate de l'ouverture à la fermeture.
 */
const POIDS_HORAIRES = [20, 17, 13, 9, 7, 5, 4, 4, 5, 7, 9, 7, 4]
const POIDS_TOTAL = POIDS_HORAIRES.reduce((a, b) => a + b, 0)
const HEURE_MS = 3_600_000

/**
 * Décalage depuis l'ouverture, en millisecondes, pour un tirage `u` dans l'échelle des
 * POIDS (et non des heures). Interpolation linéaire DANS l'heure retenue : sans elle, toutes
 * les ventes d'une heure tomberaient à la même minute.
 */
function decalageSelonForme(u: number): number {
  let reste = u
  for (let h = 0; h < POIDS_HORAIRES.length; h++) {
    if (reste < POIDS_HORAIRES[h]) return (h + reste / POIDS_HORAIRES[h]) * HEURE_MS
    reste -= POIDS_HORAIRES[h]
  }
  return POIDS_HORAIRES.length * HEURE_MS
}

/** Poids CUMULÉ sur les `ms` écoulées depuis l'ouverture — la part de journée déjà faite. */
function poidsEcoule(ms: number): number {
  const heures = ms / HEURE_MS
  let acc = 0
  for (let h = 0; h < POIDS_HORAIRES.length && heures > h; h++) {
    acc += POIDS_HORAIRES[h] * Math.min(1, heures - h)
  }
  return acc
}

/**
 * ⚠️ PLANCHER DU JOUR COURANT — exemption NOMMÉE, et volontairement BASSE.
 *
 * Le jour courant est tronqué par `now`. Avec la courbe ci-dessus, la part de journée écoulée
 * suffit presque toujours : le plancher ne mord qu'à l'ouverture, et c'est exactement ce
 * qu'on veut — plus il mord, plus il creuse l'écart avec la veille, qui n'en a pas.
 */
const VENTES_PLANCHER_JOUR_COURANT = 5
const MODES = ['cash', 'mobile_money', 'card', 'mtn_momo'] as const

/** Seuil d'alerte de chaque produit (`Product.stockMin`). */
const SEUIL_STOCK = 5

/**
 * ⚠️ QUATRE PRODUITS SOUS LEUR SEUIL, PAR POSITION FIXE — dont UNE rupture franche.
 *
 * MESURÉ À L'ÉCRAN le 2026-10-01 : les 36 produits étaient tirés entre 4 et 124 pour un
 * seuil à 5, donc en pratique aucun n'y passait. Le tableau de bord annonçait « 0 alertes
 * stock », le panneau « Alertes Rupture » montrait son état vide, et un prospect ne voyait
 * JAMAIS fonctionner l'alerte de stock — l'un des modules du manuel.
 *
 * Même règle que `perf` et `rating` : une démonstration qui note tout le monde ne montre
 * jamais le « — ». Ici, une démonstration où tout va bien ne montre jamais l'alerte. Les
 * trois états existent donc : `0` → RUPTURE, `≤ seuil` → BAS, au-dessus → OK.
 *
 * ⚠️ Et l'inverse compte autant : une boutique en alerte partout ne démontre pas une
 * boutique qui va bien, et le panneau d'alertes y deviendrait du bruit. Quatre sur
 * trente-six.
 */
const STOCKS_EN_ALERTE: Record<number, number> = { 2: 0, 9: 2, 17: 4, 28: 3 }
/** ⚠️ TVA sénégalaise. Le taux du TENANT est dérivé du pays par la route, pas ici. */
const TVA_DEMO = 18

export async function buildDemoDataset(tx: DemoTx, o: DemoDatasetOptions): Promise<void> {
  const r = alea(20261001)

  /** Minuit LOCAL du jour de `now` — frontière partagée par les ventes, les charges et le
   *  planning. La même convention que `/api/dashboard/stats` et que les crons. */
  const minuitAujourdhui = new Date(o.now)
  minuitAujourdhui.setHours(0, 0, 0, 0)

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
      /**
       * ⚠️ LE TIRAGE EST SORTI DU LITTÉRAL, ET CE N'EST PAS DU STYLE. Écrit
       * `STOCKS_EN_ALERTE[i] ?? (8 + Math.round(r() * 118))`, le `??` COURT-CIRCUITE son
       * opérande droit : les quatre produits en alerte ne tiraient pas, et toute la suite du
       * générateur congruentiel se décalait de quatre crans — prix, quantités, dates. Le
       * commentaire qui l'accompagnait affirmait le contraire. Ici, le tirage a lieu pour
       * TOUS, et ça se lit sur une ligne au lieu de se raisonner.
       *
       * Plancher à 8 : seuls les produits NOMMÉS dans `STOCKS_EN_ALERTE` passent sous le seuil.
       */
      const stockTire = 8 + Math.round(r() * 118)
      const id = randomUUID()
      lignesProduits.push({
        id,
        tenantId: o.tenantId,
        sku: `DEMO-${String(ic + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`,
        name: `${categorie} — article ${k + 1}`,
        category: categorie,
        buyPrice, sellPrice,
        stockQty: STOCKS_EN_ALERTE[produits.length] ?? stockTire,
        stockMin: SEUIL_STOCK,
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
  //
  // ⚠️ DES PERSONNES, PAS DES MÉTIERS. Le jeu écrivait `name: 'Caissier 1'`, `'Magasinier'`,
  // `'Gérante'` : un métier dans le champ d'un NOM. Le rôle à côté se traduit (`ROLE_LABELS`),
  // le nom non — un visiteur hispanophone lisait donc « Cajero » au-dessus de « Caissier 1 ».
  // Un nom de personne ne se traduit pas, donc il ne doit pas en être un.
  //
  // ⚠️ `role` ET `dept` SONT DES CLÉS, pas du texte libre — et deux tombaient à côté :
  // `'Gérant'` est absent de `ROLE_LABELS`, et les trois tables du front (`DEPT_LABELS`,
  // `DEPT_COLORS`, et le sélecteur) portent `'Ventes'` au PLURIEL. `roleLabel`/`deptLabel`
  // replient en `?? r`, donc rien ne cassait : la valeur française s'affichait simplement
  // telle quelle dans les quatre langues, et la pastille de département restait sans couleur.
  // Même famille que le `category: 'Charges'` de la 2.24.11.
  //
  // ⚠️ LA CONVENTION EXISTAIT DÉJÀ, CE GÉNÉRATEUR ÉTAIT LE SEUL À NE PAS LA SUIVRE —
  // `prisma/seed.ts:103-110` (« Marie Bakayoko », rôle `'Caissière'`, dept `'Ventes'`,
  // `avatar: 'MB'`, couleurs distinctes, un `perf: null`) et `prisma/seed-demo.ts:112-113`
  // (« Kouadio N'Guessan », « Aya Konan ») la respectaient avant lui. Elle n'était juste
  // écrite nulle part, comme la lecture des fixtures à l'exécution avant qu'un verrou ne la
  // fixe. D'où `demoDataset.test.ts` § « équipe de démonstration ».
  //
  // ⚠️ L'ORDRE EST PORTEUR : `ROTATION` ci-dessous s'applique par INDICE (35 h · 35 h · 40 h
  // · 40 h). Réordonner cette liste redistribue les heures sans toucher au planning.
  //
  // ⚠️ `avatar: ''` est VOLONTAIRE — `hrShared.tsx` fait `e.avatar || initialesDe(e.name)`.
  // Le jeu y écrivait le rang (`'1'`…`'4'`), qui GAGNE sur les initiales : l'écran RH
  // affichait un numéro là où le lecteur attend quelqu'un. Laisser le champ vide garde UNE
  // source aux initiales — en écrire une seconde ici serait un jumeau sans raison d'être.
  //
  // ⚠️ `color` est posée ICI parce que le schéma a `@default("#6C3FD6")` : sans elle, les
  // quatre avatars sortaient du même violet et ne distinguaient personne. Valeurs tirées de
  // `COLORS` (`hrShared.tsx`).
  const equipe: {
    name: string; role: string; dept: string; salary: number; perf: number | null; color: string
  }[] = [
    { name: 'Awa Traoré',     role: 'Caissière',  dept: 'Ventes',    salary: 90_000,  perf: 4,    color: '#6C3FD6' },
    { name: 'Moussa Diop',    role: 'Caissier',   dept: 'Ventes',    salary: 90_000,  perf: null, color: '#3B82F6' },
    { name: 'Ibrahima Keïta', role: 'Magasinier', dept: 'Stock',     salary: 110_000, perf: 3,    color: '#10B981' },
    { name: 'Fatou Sow',      role: 'Manager',    dept: 'Direction', salary: 180_000, perf: null, color: '#F59E0B' },
  ]
  // ⚠️ Les identifiants sont capturés ICI : `Shift.employeeId` est une FK vers `Employee`,
  // et le planning ci-dessous en a besoin.
  const idsEquipe = equipe.map(() => randomUUID())
  await tx.employee.createMany({
    data: equipe.map((e, k) => ({
      id: idsEquipe[k],
      tenantId: o.tenantId, name: e.name, role: e.role, dept: e.dept, type: 'CDI',
      salary: e.salary, perf: e.perf, avatar: '', color: e.color,
      hiredAt: new Date(o.now.getTime() - (200 + k * 90) * 86_400_000),
      phone: null, email: null,
    })),
  })

  // ── Planning : trois semaines, de la semaine PRÉCÉDENTE à la SUIVANTE ───────
  //
  // ⚠️ MESURÉ À L'ÉCRAN le 2026-10-01 : la grille était VIDE. Quatre employés, sept colonnes,
  // « – » partout, ligne COUVERTURE à « — ». Le module distingue pourtant « pas encore
  // planifié » de « planifié mais non couvert » (`planningTotals.ts`) — une distinction
  // qu'une démo vide ne montre jamais.
  //
  // ⚠️ UN PLANNING VA DANS L'AVENIR, ET C'EST L'INVERSE DE LA RÈGLE DES VENTES. Une vente
  // postérieure à `now` gonflerait un chiffre d'affaires et le générateur l'interdit ; un
  // service planifié pour demain est le PROPRE d'un planning. Une grille qui s'arrête
  // aujourd'hui n'est pas un planning, c'est un journal. Trois semaines, pour que « Préc. »
  // et « Suiv. » n'ouvrent pas une grille vide.
  //
  // ⚠️ LIMITE ASSUMÉE, et elle vient du PRODUIT, pas du jeu : `SHIFT_TYPES` (front) s'arrête
  // à 18 h — Matin 08-13, Après-midi 13-18, Journée 08-18 — et saute ensuite à Nuit 20-06.
  // Aucun type ne couvre la tranche 18 h-21 h, pendant laquelle la courbe de ventes place
  // pourtant une pointe. On ne la planifie donc pas plutôt que de la dire en « Nuit », qui
  // désignerait autre chose.
  //
  // Rotation : les deux caissiers alternent matin et après-midi et se reposent des jours
  // DIFFÉRENTS (sinon un jour n'est couvert par personne) ; le magasinier tient la semaine ;
  // la gérante couvre le week-end, où les caissiers tournent.
  //
  // ⚠️ LES HEURES DOIVENT TENIR DEBOUT : la colonne « heures » du planning les additionne
  // (`planningTotals`), et un responsable à 55 h par semaine se remarque. La rotation ci-dessous
  // donne 35 h · 35 h · 40 h · 40 h, et laisse CHAQUE jour couvert par au moins deux
  // personnes — les deux caissiers se reposent des jours DIFFÉRENTS, sinon un jour tomberait
  // à découvert.
  const ROTATION: ReadonlyArray<readonly string[]> = [
    // lun         mar          mer          jeu          ven          sam          dim
    ['morning',   'morning',   'morning',   'morning',   'morning',   'full',      'rest'     ], // Awa Traoré     — 35 h
    ['rest',      'afternoon', 'afternoon', 'afternoon', 'afternoon', 'morning',   'full'     ], // Moussa Diop    — 35 h
    ['full',      'full',      'rest',      'full',      'full',      'rest',      'rest'     ], // Ibrahima Keïta — 40 h
    ['afternoon', 'morning',   'full',      'full',      'rest',      'afternoon', 'morning'  ], // Fatou Sow      — 40 h
  ]
  const SEMAINES_PLANIFIEES = 3

  /**
   * ⚠️ UN CONGÉ, SINON LE SIXIÈME ÉTAT EST INATTEIGNABLE. `SHIFT_TYPES` en compte six et la
   * rotation n'en exerce que quatre : sans cette exception, la pastille « Congé » n'apparaît
   * jamais dans la démonstration — même famille que le stock où rien n'alertait et que les
   * employés tous notés. Il tombe la SEMAINE PROCHAINE, ce qui rend aussi les trois semaines
   * distinctes : une rotation strictement identique trois fois se lit comme un gabarit.
   *
   * Clé : `semaine|employé|jour`. Le mercredi et le jeudi de la 3ᵉ semaine (indices 2 et 3)
   * pour Moussa Diop (indice 1). La couverture reste d'au moins deux ces jours-là.
   */
  const CONGES: ReadonlySet<string> = new Set(['2|1|2', '2|1|3'])

  const lundi = new Date(minuitAujourdhui)
  // `getDay()` rend 0 pour dimanche : on ramène au lundi de la semaine de `now`, puis on
  // recule d'une semaine pour que « Préc. » soit servi.
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7) - 7)
  const jourIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const lignesServices: Prisma.ShiftUncheckedCreateInput[] = []
  for (let j = 0; j < SEMAINES_PLANIFIEES * 7; j++) {
    const d = new Date(lundi)
    d.setDate(lundi.getDate() + j)
    const semaine = Math.floor(j / 7), jourSemaine = j % 7
    for (const [k, id] of idsEquipe.entries()) {
      lignesServices.push({
        id: randomUUID(),
        tenantId: o.tenantId,
        employeeId: id,
        date: jourIso(d),
        shiftTypeKey: CONGES.has(`${semaine}|${k}|${jourSemaine}`) ? 'leave' : ROTATION[k][jourSemaine],
      })
    }
  }
  await tx.shift.createMany({ data: lignesServices })

  // ── Ventes : JOUR PAR JOUR sur deux mois (cf. l'en-tête des constantes) ────
  const lignesVentes: Prisma.SaleUncheckedCreateInput[] = []
  const lignesArticles: Prisma.SaleItemUncheckedCreateInput[] = []

  for (let j = JOURS_D_HISTORIQUE - 1; j >= 0; j--) {
    const minuit = new Date(minuitAujourdhui.getTime() - j * 86_400_000)
    const ouverture = new Date(minuit); ouverture.setHours(OUVERTURE_H, 0, 0, 0)
    const fermeture = new Date(minuit); fermeture.setHours(FERMETURE_H, 0, 0, 0)

    const parJour = VENTES_PAR_JOUR_MIN
      + Math.floor(r() * (VENTES_PAR_JOUR_MAX - VENTES_PAR_JOUR_MIN + 1))

    // Placement. Le jour COURANT est tronqué par `now` : jamais une vente dans l'avenir, et
    // le nombre suit la part de journée écoulée SELON LA COURBE — pas au prorata des heures,
    // qui sous-estimait la matinée et creusait l'écart avec la veille.
    const ouvertureMs = ouverture.getTime()
    // `poidsMax` borne le tirage : plein pour un jour complet, tronqué pour aujourd'hui.
    let poidsMax = POIDS_TOTAL
    let nb = parJour
    /** Repli UNIFORME, utilisé seulement avant l'ouverture (la courbe n'y a pas de sens). */
    let plageAvantOuverture: { debut: number; fin: number } | null = null

    if (j === 0) {
      const finMs = Math.min(o.now.getTime(), fermeture.getTime())
      if (finMs <= ouvertureMs) {
        // `now` précède l'ouverture. Une boutique ne vend pas à 3 h du matin — mais un
        // tableau de bord VIDE à 3 h du matin le 1ᵉʳ du mois perd le prospect, et c'est le
        // seul écran qu'il regarde. On place le plancher dans l'heure qui précède `now`.
        plageAvantOuverture = { debut: Math.max(minuit.getTime(), o.now.getTime() - HEURE_MS), fin: o.now.getTime() }
        nb = VENTES_PLANCHER_JOUR_COURANT
      } else {
        poidsMax = poidsEcoule(finMs - ouvertureMs)
        nb = Math.max(VENTES_PLANCHER_JOUR_COURANT, Math.round(parJour * (poidsMax / POIDS_TOTAL)))
      }
    }

    for (let v = 0; v < nb; v++) {
      const createdAt = plageAvantOuverture
        ? new Date(plageAvantOuverture.debut + Math.floor(r() * Math.max(1, plageAvantOuverture.fin - plageAvantOuverture.debut)))
        : new Date(ouvertureMs + Math.floor(decalageSelonForme(r() * poidsMax)))
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
  //
  // ⚠️ `categorie` APPARTIENT AU DOMAINE, et `label` reste le nom précis de la charge — ce
  // sont deux rôles distincts. Le jeu écrivait `category: 'Charges'` pour tout : l'écran
  // Dépenses indexe sa table de styles avec cette valeur, obtenait `undefined`, et TOMBAIT
  // (« Cannot read properties of undefined (reading 'color') », mesuré en production le
  // 2026-10-01). L'écran ne tombe plus — `styleCategorie` rend un style neutre — mais une
  // démonstration qui écrit hors domaine démontre un produit cassé.
  //
  // Domaine faisant autorité : `apps/frontend/src/components/expenses/expensesShared.tsx`
  // (`CATEGORIES`). Recopié par le test, qui crie si la liste bouge — le contexte Docker du
  // backend est `apps/backend` seul, l'import est impossible.
  const charges = [
    { label: 'Loyer boutique',      categorie: 'Loyer',       ht: 150_000, jourDuMois: 1 },
    { label: 'Électricité',         categorie: 'Énergie',     ht: 42_000,  jourDuMois: 4 },
    { label: 'Eau',                 categorie: 'Énergie',     ht: 12_000,  jourDuMois: 6 },
    { label: 'Carburant livraison', categorie: 'Transport',   ht: 25_000,  jourDuMois: 9 },
    { label: 'Emballages',          categorie: 'Fournitures', ht: 18_000,  jourDuMois: 14 },
    { label: 'Téléphone & internet', categorie: 'Autre',      ht: 8_000,   jourDuMois: 20 },
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
        category: c.categorie,
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
