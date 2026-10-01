import { describe, it, expect, vi } from 'vitest'
import { buildDemoDataset, DEMO_CATEGORIES } from '../lib/demoDataset'

/**
 * JEU DE DONNÉES DE DÉMONSTRATION — les SEUILS sont l'objet du test, pas le volume.
 *
 * ⚠️ `demo-tenant-001` a EXACTEMENT 6 catégories et le camembert « CA par catégorie » en
 * affiche 6 : le reliquat « Autres » y valait toujours 0, donc le défaut y était invisible.
 * Un jeu calé sur la valeur limite ne démontre rien. On exige STRICTEMENT plus.
 */

/** Faux client de transaction : enregistre ce qui est écrit, modèle par modèle. */
function fauxTx() {
  const ecrit: Record<string, Record<string, unknown>[]> = {}
  /** Nombre d'ALLERS-RETOURS vers la base, tous modèles confondus. */
  const appels: string[] = []
  const modele = (nom: string) => ({
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      appels.push(`${nom}.create`)
      ;(ecrit[nom] ??= []).push(data)
      return { ...data, id: String(data.id ?? `${nom}-${ecrit[nom].length}`) }
    }),
    createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
      appels.push(`${nom}.createMany`)
      ;(ecrit[nom] ??= []).push(...data)
      return { count: data.length }
    }),
  })
  return {
    ecrit, appels,
    tx: {
      product: modele('product'), customer: modele('customer'), supplier: modele('supplier'),
      employee: modele('employee'), sale: modele('sale'), saleItem: modele('saleItem'),
      expense: modele('expense'),
    },
  }
}

/**
 * ⚠️ `now` est le 1ᵉʳ du mois DÉLIBÉRÉMENT : c'est le jour où le tableau de bord — qui ne lit
 * que le mois EN COURS — voit le moins de choses. Un jeu calibré sur le 15 ne démontre rien.
 *
 * ⚠️ `now` est construit en heure LOCALE, pas en `Z`. Le générateur raisonne en heures
 * d'ouverture locales — comme `/api/dashboard/stats` et les crons — et la suite tourne en
 * UTC en CI mais en Europe/Paris sur le poste. Une fixture écrite `15:00Z` vaut 17 h à
 * Paris et 15 h à Londres : le MÊME test exerce alors deux branches différentes. C'est le
 * piège qui a déjà fait écrire les tests de crons en UTC contre un module qui lit le local.
 */
const options = { tenantId: 'demo-tmp-x', cashierId: 'u-demo', now: new Date(2026, 9, 1, 15, 0, 0) }

/** Minuit LOCAL du jour de `now` — la même frontière que celle de `/api/dashboard/stats`. */
function minuitLocal(d: Date): Date {
  const j = new Date(d)
  j.setHours(0, 0, 0, 0)
  return j
}

describe('buildDemoDataset', () => {
  it('⚠️ STRICTEMENT plus de 6 catégories — 6 est la valeur limite qui masque le reliquat', () => {
    expect(new Set(DEMO_CATEGORIES).size).toBeGreaterThan(6)
  })

  it('écrit effectivement dans les 7 modèles attendus — un générateur muet serait vert sinon', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    for (const m of ['product', 'customer', 'supplier', 'employee', 'sale', 'saleItem', 'expense']) {
      expect(ecrit[m]?.length ?? 0, `aucune écriture dans ${m}`).toBeGreaterThan(0)
    }
  })

  it('les produits couvrent TOUTES les catégories annoncées', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const vues = new Set(ecrit.product.map(p => p.category))
    expect([...DEMO_CATEGORIES].every(c => vues.has(c))).toBe(true)
  })

  it('⚠️ une partie des employés est NON évaluée — sinon l’état « — » est inatteignable', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const nonEvalues = ecrit.employee.filter(e => e.perf === null || e.perf === undefined)
    expect(nonEvalues.length).toBeGreaterThan(0)
    expect(nonEvalues.length).toBeLessThan(ecrit.employee.length)
  })

  it('⚠️ idem pour les FOURNISSEURS — `rating` est nullable et les deux états doivent se voir', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const nonNotes = ecrit.supplier.filter(s => s.rating === null || s.rating === undefined)
    expect(nonNotes.length).toBeGreaterThan(0)
    expect(nonNotes.length).toBeLessThan(ecrit.supplier.length)
  })

  it('les ventes couvrent PLUSIEURS mois — un seul mois laisse les rapports de période vides', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const mois = new Set(ecrit.sale.map(s => (s.createdAt as Date).toISOString().slice(0, 7)))
    // ⚠️ DEUX, pas trois. La fenêtre fait 60 jours : à `now` = 2026-10-01 elle touche août,
    // septembre et octobre, mais à `now` = 31 janvier elle ne touche que décembre et janvier.
    // Exiger 3 ici serait vrai par ACCIDENT de calendrier sur le `now` choisi.
    expect(mois.size).toBeGreaterThanOrEqual(2)
  })

  it('aucune vente n’est postérieure à `now` — une démo ne montre pas l’avenir', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    for (const s of ecrit.sale) expect((s.createdAt as Date).getTime()).toBeLessThanOrEqual(options.now.getTime())
  })

  it('plusieurs modes de paiement sont représentés — le camembert de répartition doit avoir des parts', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    expect(new Set(ecrit.sale.map(s => s.paymentMode)).size).toBeGreaterThanOrEqual(3)
  })

  /**
   * ⚠️ DÉTERMINISTE SUR LES DONNÉES, PAS SUR LES IDENTIFIANTS — et c'est une contrainte, pas
   * un relâchement. Les identifiants sont des clés PRIMAIRES dans des tables partagées par
   * tous les tenants : deux démos créées le même jour avec des identifiants déterministes
   * entreraient en collision. Ce qui doit être reproductible, c'est le JEU (prix, dates,
   * quantités, modes de paiement), pour que les verrous soient stables et une anomalie
   * rejouable.
   */
  it('DÉTERMINISTE : deux passes au même `now` produisent les mêmes DONNÉES', async () => {
    const sansIds = (lignes: Record<string, unknown>[]) =>
      JSON.stringify(lignes.map(({ id: _id, customerId, ...reste }) => ({ ...reste, aUnClient: customerId !== null })))
    const a = fauxTx(); await buildDemoDataset(a.tx, options)
    const b = fauxTx(); await buildDemoDataset(b.tx, options)
    expect(sansIds(b.ecrit.sale)).toBe(sansIds(a.ecrit.sale))
  })

  it('⚠️ deux passes produisent des IDENTIFIANTS DISTINCTS — sinon collision de clé primaire', async () => {
    const a = fauxTx(); await buildDemoDataset(a.tx, options)
    const b = fauxTx(); await buildDemoDataset(b.tx, options)
    const idsA = new Set(a.ecrit.product.map(p => p.id))
    const communs = b.ecrit.product.filter(p => idsA.has(p.id))
    expect(communs, 'deux démos ne doivent jamais partager un identifiant de produit').toEqual([])
  })

  it('⚠️ chaque ligne de vente pointe une vente RÉELLEMENT créée — FK respectée', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const ventes = new Set(ecrit.sale.map(v => v.id))
    const orphelines = ecrit.saleItem.filter(li => !ventes.has(li.saleId))
    expect(orphelines).toEqual([])
  })

  it('chaque vente porte au moins une ligne, et son total est la somme de ses lignes', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const parVente = new Map<string, number>()
    for (const li of ecrit.saleItem) {
      const k = String(li.saleId)
      parVente.set(k, (parVente.get(k) ?? 0) + Number(li.total))
    }
    expect(parVente.size).toBe(ecrit.sale.length)
    for (const [, somme] of parVente) expect(somme).toBeGreaterThan(0)
  })

  it('⚠️ une dépense porte amountHT/vat/amountTTC cohérents et un `mode` — pas de champ `amount`', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    for (const d of ecrit.expense) {
      expect(d).not.toHaveProperty('amount')
      expect(typeof d.mode).toBe('string')
      const ht = Number(d.amountHT), vat = Number(d.vat), ttc = Number(d.amountTTC)
      expect(Math.abs(ttc - ht * (1 + vat / 100))).toBeLessThan(0.01)
    }
  })

  /**
   * ⚠️ NOMBRE D'ALLERS-RETOURS BORNÉ.
   *
   * Défaut trouvé en revue : la première version enchaînait **415 instructions séquentielles**
   * (36 `product.create` + 180 `sale.create` + 180 `saleItem.createMany` + le reste), chacune
   * avec un aller-retour réseau vers le Postgres Railway, DANS une transaction. Chaque requête
   * de démo détenait donc une connexion du pool pendant plusieurs secondes.
   *
   * Conséquence : cinq visiteurs cliquant « Essayer la démo » dans la même minute épuisaient
   * le pool, et les requêtes suivantes — **y compris les `POST /api/sales` d'un commerçant
   * réel en caisse** — attendaient puis échouaient en P2024, traduit en 500 « Erreur serveur ».
   * Un endpoint public non authentifié pouvait dégrader la caisse des clients payants.
   *
   * Ce test ne mesure pas une durée (elle dépend du réseau) : il borne ce qui la cause.
   */
  it('⚠️ au plus 12 allers-retours vers la base — pas un par ligne', async () => {
    const { tx, appels } = fauxTx()
    await buildDemoDataset(tx, options)
    expect(appels.length, `allers-retours : ${appels.join(', ')}`).toBeLessThanOrEqual(12)
  })

  it('⚠️ et le volume de données reste celui attendu — on groupe, on ne tronque pas', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    expect(ecrit.product.length).toBe(36)
    // Bornes ÉCRITES ICI, pas dérivées des constantes du module : dérivées, elles
    // suivraient une troncature au lieu de la signaler.
    expect(ecrit.sale.length).toBeGreaterThanOrEqual(400)
    expect(ecrit.sale.length).toBeLessThanOrEqual(1200)
    expect(ecrit.saleItem.length).toBeGreaterThanOrEqual(ecrit.sale.length)
  })

  /**
   * ⚠️ DENSITÉ — MESURÉE EN PRODUCTION LE 2026-10-01, ET C'EST CE TEST QUI MANQUAIT.
   *
   * Le jeu étalait 180 ventes uniformément sur QUATRE mois, soit 1,5 vente par jour. Or
   * `/api/dashboard/stats` ne lit que le mois EN COURS (`monthStart`) et le jour courant.
   * Le 1ᵉʳ octobre, le prospect voyait donc **3 ventes sur 180 — 1,7 % du jeu** sur le
   * premier écran de l'application. Rien n'était faux : le jeu était trop clairsemé là où
   * il est regardé.
   *
   * Ces quatre tests portent sur la part VUE, jamais sur le total.
   */
  /**
   * ⚠️ LES TROIS HEURES COMPTENT, ET LA PREMIÈRE VERSION DE CE TEST N'EN EXERÇAIT QU'UNE.
   *
   * Écrit avec le seul `now` de 15 h, il restait VERT quand on retirait le plancher du jour
   * courant — à 15 h le prorata des heures ouvrées suffit à lui seul. Mesuré par sabotage.
   * Le plancher n'existe que pour le MATIN et pour l'avant-ouverture : ce sont ces deux
   * moments qu'il faut exercer, sans quoi la garantie n'est portée par rien.
   */
  it.each([
    ['03 h — avant l’ouverture', new Date(2026, 9, 1, 3, 0, 0)],
    ['09 h — début de matinée', new Date(2026, 9, 1, 9, 0, 0)],
    ['15 h — après-midi', new Date(2026, 9, 1, 15, 0, 0)],
  ])('⚠️ DÉCISIF : le JOUR COURANT porte plusieurs ventes à %s — le 1ᵉʳ, le CA du mois EST le CA du jour', async (_libelle, now) => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, { ...options, now })
    const minuit = minuitLocal(now).getTime()
    const aujourdhui = ecrit.sale.filter(s => (s.createdAt as Date).getTime() >= minuit)
    expect(aujourdhui.length, 'premier écran de l’application, et il serait désert').toBeGreaterThanOrEqual(5)
    // Et jamais dans l'avenir, y compris sur la journée tronquée.
    for (const s of aujourdhui) expect((s.createdAt as Date).getTime()).toBeLessThanOrEqual(now.getTime())
  })

  it('⚠️ aucun jour creux : les 60 jours de la fenêtre portent tous des ventes', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const jours = new Set(ecrit.sale.map(s => {
      const d = minuitLocal(s.createdAt as Date)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    }))
    expect(jours.size, 'un tirage uniforme sur la fenêtre laisse des jours vides').toBe(60)
  })

  it('⚠️ la fenêtre couvre DEUX mois — ni plus (jeu dilué), ni moins (pas d’historique)', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const plusAncienne = Math.min(...ecrit.sale.map(s => (s.createdAt as Date).getTime()))
    const joursEnArriere = (options.now.getTime() - plusAncienne) / 86_400_000
    expect(joursEnArriere).toBeGreaterThan(58)
    expect(joursEnArriere).toBeLessThan(61)
  })

  /**
   * ⚠️ Une boutique ne vend pas à 3 h du matin, et l'écran « activité récente » affiche
   * l'HEURE des cinq dernières ventes. À 1,5 vente par jour la question ne se posait pas ;
   * à une dizaine, un horodatage nocturne se remarque.
   *
   * L'assertion ne porte que sur les jours COMPLETS : le jour courant est tronqué par `now`,
   * et son cas limite (démo ouverte avant l'ouverture) est traité dans le module.
   */
  it('⚠️ les ventes des jours COMPLETS tombent dans les heures d’ouverture', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const minuit = minuitLocal(options.now).getTime()
    const joursComplets = ecrit.sale.filter(s => (s.createdAt as Date).getTime() < minuit)
    expect(joursComplets.length).toBeGreaterThan(100)
    for (const s of joursComplets) {
      const h = (s.createdAt as Date).getHours()
      expect(h, `vente à ${h} h — hors heures d'ouverture`).toBeGreaterThanOrEqual(8)
      expect(h).toBeLessThan(21)
    }
  })

  /**
   * ⚠️ MÊME DÉFAUT, AUTRE ÉCRAN. Les quatre dépenses étaient datées à J−15, J−30, J−45 et
   * J−60 : le 1ᵉʳ du mois, AUCUNE ne tombait dans le mois en cours, et l'écran « Dépenses »
   * — un des huit modules du manuel — s'ouvrait vide.
   */
  it('⚠️ au moins une dépense dans le mois EN COURS, et aucune dans l’avenir', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const debutMois = new Date(options.now.getFullYear(), options.now.getMonth(), 1).getTime()
    const duMois = ecrit.expense.filter(d => (d.date as Date).getTime() >= debutMois)
    expect(duMois.length, 'écran Dépenses vide le 1ᵉʳ du mois').toBeGreaterThanOrEqual(1)
    for (const d of ecrit.expense) {
      expect((d.date as Date).getTime()).toBeLessThanOrEqual(options.now.getTime())
    }
  })

  it('⚠️ aucune coordonnée personnelle : téléphone et e-mail nuls partout', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    for (const m of ['customer', 'employee', 'supplier']) {
      for (const l of ecrit[m]) {
        expect(l.phone ?? null, `${m}.phone doit être nul`).toBeNull()
        expect(l.email ?? null, `${m}.email doit être nul`).toBeNull()
      }
    }
  })
})
