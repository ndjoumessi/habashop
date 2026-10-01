import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
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
      expense: modele('expense'), shift: modele('shift'),
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

  /**
   * ⚠️ FORME INTRA-JOURNALIÈRE — MESURÉE EN PRODUCTION LE 2026-10-01, SUR LE BADGE.
   *
   * Le tableau de bord de démo affichait « VENTES DU JOUR **+1005,3 %** ». Le produit avait
   * raison : il comparait le jour courant à la veille sur la MÊME plage horaire écoulée.
   * C'était le JEU qui était asymétrique — le plancher du jour courant mettait une matinée
   * de ventes dans l'intervalle écoulé, alors que la veille, étalée uniformément de 08 h à
   * 21 h, n'avait presque rien à la même heure.
   *
   * Un étalement uniforme sur la journée est donc faux deux fois : il rend des horodatages
   * invraisemblables ET il fabrique un écart jour/veille absurde. Les ventes suivent
   * désormais une courbe horaire — pointe du matin, creux de l'après-midi, pointe du soir —
   * et c'est CETTE propriété que les deux tests ci-dessous verrouillent.
   */
  it.each([
    ['09 h', new Date(2026, 9, 1, 9, 0, 0)],
    ['12 h', new Date(2026, 9, 1, 12, 0, 0)],
    ['15 h', new Date(2026, 9, 1, 15, 0, 0)],
    ['19 h', new Date(2026, 9, 1, 19, 0, 0)],
  ])('⚠️ DÉCISIF : à %s, le jour courant est COMPARABLE à la veille sur la même plage', async (_l, now) => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, { ...options, now })
    const minuit = minuitLocal(now).getTime()
    const ecoule = now.getTime() - minuit
    const dans = (debut: number, fin: number) =>
      ecrit.sale.filter(s => {
        const t = (s.createdAt as Date).getTime()
        return t >= debut && t < fin
      }).length

    const aujourdhui = dans(minuit, now.getTime())
    const veille = dans(minuit - 86_400_000, minuit - 86_400_000 + ecoule)
    expect(veille, 'la veille ne porte RIEN sur cette plage → tout écart est absurde').toBeGreaterThan(0)
    const rapport = aujourdhui / veille
    expect(rapport, `jour=${aujourdhui} veille=${veille} → ${Math.round((rapport - 1) * 100)} %`).toBeLessThan(3)
    expect(rapport).toBeGreaterThan(0.34)
  })

  /**
   * ⚠️ ET LA COURBE DOIT EXISTER. Sans cette assertion, un étalement uniforme satisferait le
   * test ci-dessus dès que le volume monte assez — on aurait corrigé le symptôme (l'écart) en
   * manquant la cause (une boutique dont l'activité est plate de 08 h à 21 h, et dont
   * « activité récente » affiche des heures tirées au hasard).
   */
  it('⚠️ l’activité n’est pas PLATE : l’heure de pointe pèse au moins 1,8× l’heure creuse', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const minuit = minuitLocal(options.now).getTime()
    const parHeure = new Map<number, number>()
    for (const s of ecrit.sale) {
      const d = s.createdAt as Date
      if (d.getTime() >= minuit) continue          // jour courant tronqué → exclu
      parHeure.set(d.getHours(), (parHeure.get(d.getHours()) ?? 0) + 1)
    }
    expect(parHeure.size, 'toutes les heures d’ouverture doivent être couvertes').toBe(13)
    const comptes = [...parHeure.values()]
    const pointe = Math.max(...comptes), creux = Math.min(...comptes)
    expect(pointe / creux, `pointe=${pointe} creux=${creux}`).toBeGreaterThan(1.8)
  })

  /**
   * ⚠️ LES TROIS ÉTATS DE STOCK DOIVENT ÊTRE ATTEIGNABLES — MESURÉ À L'ÉCRAN le 2026-10-01.
   *
   * Les 36 produits étaient tirés entre 4 et 124 avec un seuil à 5 : en pratique AUCUN ne
   * passait sous son seuil. Le tableau de bord affichait « 0 alertes stock » et le panneau
   * « Alertes Rupture » son état vide, si bien qu'un prospect ne voyait JAMAIS fonctionner
   * l'alerte de stock — un argument de vente, et l'un des modules du manuel.
   *
   * C'est la même règle que pour `perf` et `rating` : une démonstration qui note tout le
   * monde ne montre jamais le « — ». Ici, une démonstration où tout va bien ne montre jamais
   * l'alerte. Les trois états du produit — `statusOf` côté stock, `niveauStock` côté caisse —
   * sont `0` → RUPTURE, `≤ seuil` → BAS, au-dessus → OK. Les trois doivent exister.
   */
  it('⚠️ le jeu porte les TROIS états de stock — rupture, bas, et OK', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const etat = (p: Record<string, unknown>) => {
      const q = Number(p.stockQty), seuil = Number(p.stockMin)
      expect(seuil, 'un seuil nul rendrait l’alerte inatteignable par construction').toBeGreaterThan(0)
      return q === 0 ? 'rupture' : q <= seuil ? 'bas' : 'ok'
    }
    const compte = { rupture: 0, bas: 0, ok: 0 }
    for (const p of ecrit.product) compte[etat(p) as keyof typeof compte]++

    expect(compte.rupture, 'aucune rupture → le badge rouge est inatteignable').toBeGreaterThanOrEqual(1)
    expect(compte.bas, 'aucun stock bas → le badge ambre est inatteignable').toBeGreaterThanOrEqual(2)
    // ⚠️ Et l'inverse compte autant : une boutique en alerte partout ne montre pas une
    // boutique qui va bien, et le panneau d'alertes y deviendrait du bruit.
    expect(compte.ok, 'la boutique doit majoritairement aller bien').toBeGreaterThanOrEqual(28)
  })

  /**
   * ⚠️ LE PLANNING — MESURÉ À L'ÉCRAN le 2026-10-01 : la grille était VIDE. Quatre employés,
   * sept colonnes, « – » partout, et la ligne COUVERTURE à « — ». Le module distingue
   * pourtant « pas encore planifié » de « planifié mais non couvert » (cf. `planningTotals`),
   * distinction qu'une démo vide ne montre jamais.
   *
   * ⚠️ UN PLANNING VA DANS L'AVENIR, ET C'EST L'INVERSE DE LA RÈGLE DES VENTES. Une vente
   * postérieure à `now` est un défaut — elle gonflerait un chiffre d'affaires. Un service
   * planifié pour demain est le PROPRE d'un planning : une grille qui s'arrête aujourd'hui
   * n'est pas un planning, c'est un journal. Les deux règles coexistent, sur deux modèles.
   */
  it('⚠️ la semaine EN COURS est planifiée — chaque jour couvert par au moins une personne', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    expect(ecrit.shift?.length ?? 0, 'aucun service écrit').toBeGreaterThan(0)

    const lundi = minuitLocal(options.now)
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))   // lundi de la semaine de `now`
    const jour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const TRAVAILLE = new Set(['morning', 'afternoon', 'full', 'night'])

    for (let i = 0; i < 7; i++) {
      const d = new Date(lundi); d.setDate(lundi.getDate() + i)
      const duJour = ecrit.shift.filter(sv => sv.date === jour(d))
      expect(duJour.length, `aucun service le ${jour(d)}`).toBeGreaterThan(0)
      const couverts = duJour.filter(sv => TRAVAILLE.has(String(sv.shiftTypeKey)))
      expect(couverts.length, `${jour(d)} n'est couvert par personne`).toBeGreaterThanOrEqual(1)
    }
  })

  it('⚠️ « Préc. » et « Suiv. » ne tombent pas dans le vide — trois semaines sont planifiées', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const jours = new Set(ecrit.shift.map(sv => String(sv.date)))
    expect(jours.size, 'une seule semaine planifiée : le bouton « Préc. » ouvre une grille vide').toBeGreaterThanOrEqual(21)
  })

  it('⚠️ chaque employé a du REPOS — sinon l’équipe travaille 7 j/7 et l’état « Repos » est inatteignable', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const parEmploye = new Map<string, string[]>()
    for (const sv of ecrit.shift) {
      const k = String(sv.employeeId)
      parEmploye.set(k, [...(parEmploye.get(k) ?? []), String(sv.shiftTypeKey)])
    }
    expect(parEmploye.size, 'tous les employés doivent apparaître au planning').toBe(ecrit.employee.length)
    for (const [emp, types] of parEmploye) {
      expect(types.filter(t => t === 'rest').length, `${emp} ne se repose jamais`).toBeGreaterThan(0)
    }
    // Et les CINQ types que la rotation doit exercer. ⚠️ `leave` en fait partie : sans lui,
    // la pastille « Congé » — l'un des six états de `SHIFT_TYPES` — n'apparaît jamais dans la
    // démonstration, exactement comme le stock où rien n'alertait.
    const types = new Set(ecrit.shift.map(sv => String(sv.shiftTypeKey)))
    for (const attendu of ['morning', 'afternoon', 'full', 'rest', 'leave']) {
      expect(types.has(attendu), `l'état « ${attendu} » est inatteignable dans la démo`).toBe(true)
    }
  })

  it('⚠️ aucun doublon (employé, date, type) — la contrainte unique SQL refuserait l’insertion', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const cles = ecrit.shift.map(sv => `${sv.employeeId}|${sv.date}|${sv.shiftTypeKey}`)
    expect(new Set(cles).size, 'doublon sur @@unique([tenantId, employeeId, date, shiftTypeKey])').toBe(cles.length)
    // FK : chaque service pointe un employé réellement créé.
    const employes = new Set(ecrit.employee.map(e => e.id))
    expect(ecrit.shift.filter(sv => !employes.has(sv.employeeId))).toEqual([])
  })

  /**
   * ⚠️ CRASH RÉEL EN PRODUCTION le 2026-10-01 : l'écran Dépenses d'une démo tombait sur
   * « Cannot read properties of undefined (reading 'color') ». Ce jeu écrivait
   * `category: 'Charges'`, qui n'appartient PAS au domaine des catégories de dépense ; le
   * front indexait sa table de styles avec et obtenait `undefined`.
   *
   * La fragilité a été traitée côté écran (`styleCategorie` rend un style neutre), mais la
   * CAUSE est ici : une démonstration doit écrire des valeurs du domaine, sinon elle
   * démontre un produit cassé. `label` porte déjà le nom précis de la charge ; `category`
   * porte la clé canonique, et les deux ont des rôles distincts.
   *
   * ⚠️ La liste fait AUTORITÉ côté front (`components/expenses/expensesShared.tsx`,
   * `CATEGORIES`). Elle est recopiée ici faute de pouvoir l'importer — le contexte Docker du
   * backend est `apps/backend` seul. Si elle bouge, c'est ce test qui doit crier.
   */
  it('⚠️ les dépenses portent des catégories du DOMAINE — « Charges » n’en est pas une', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const DOMAINE = ['Loyer', 'Énergie', 'Transport', 'Maintenance', 'Fournitures', 'Marketing', 'Formation', 'Autre']
    expect(ecrit.expense.length).toBeGreaterThan(0)
    const horsDomaine = [...new Set(ecrit.expense.map(d => String(d.category)))].filter(c => !DOMAINE.includes(c))
    expect(horsDomaine, 'l’écran Dépenses indexe une table de styles avec cette valeur').toEqual([])
  })

  it('⚠️ et PLUSIEURS catégories sont représentées — sinon le filtre par catégorie ne montre rien', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    expect(new Set(ecrit.expense.map(d => d.category)).size).toBeGreaterThanOrEqual(3)
  })

  it('⚠️ le LIBELLÉ reste précis — la catégorie ne doit pas effacer la nature de la charge', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const libelles = new Set(ecrit.expense.map(d => String(d.label)))
    expect(libelles.size, 'des libellés tous identiques rendraient le journal illisible').toBeGreaterThanOrEqual(5)
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

/**
 * L'ÉQUIPE DE DÉMONSTRATION — des PERSONNES, et des rôles qui SE TRADUISENT.
 *
 * ⚠️ MESURÉ le 2026-10-01, en réponse à « est-ce que la démo tient compte de la langue ? ».
 * Le jeu écrivait `name: 'Caissier 1'` / `'Magasinier'` / `'Gérante'` — des MÉTIERS dans le
 * champ d'un NOM. L'interface se traduit, eux non : un visiteur hispanophone lisait le rôle
 * « Cajero » au-dessus d'un employé nommé « Caissier 1 ». Le nom d'une personne ne se traduit
 * pas — donc il ne doit pas en être un.
 *
 * ⚠️ Et DEUX champs sur trois tombaient hors du domaine traduit : `role: 'Gérant'` (absent de
 * `ROLE_LABELS`) et `dept: 'Vente'` (les trois tables du front portent `'Ventes'`, au
 * PLURIEL). `roleLabel`/`deptLabel` replient en `?? r` — pas de crash, mais la valeur
 * FRANÇAISE s'affiche telle quelle dans les quatre langues, et `DEPT_COLORS` ne rend aucune
 * couleur. Même famille que le `category: 'Charges'` de la 2.24.11 : un jeu de démonstration
 * qui écrit en dehors d'un domaine que l'affichage ne peut qu'approximer.
 *
 * ⚠️ Le verrou juge la FORME, jamais des identifiants : un nom ne contient pas son propre
 * métier, et le domaine des rôles est DÉRIVÉ de la table du front, lue à l'EXÉCUTION (jamais
 * par `import` — le contexte Docker est `apps/backend` seul). Même mécanique que
 * `msisdnShared.test.ts`, qui lit déjà `apps/frontend/src/lib/msisdn.ts`.
 */
const FRONT = join(__dirname, '..', '..', '..', '..', 'apps', 'frontend', 'src')
const HR_SHARED = join(FRONT, 'components', 'hr', 'hrShared.tsx')
/**
 * ⚠️ DEUX TABLES DE RÔLES, ET C'EST UN JUMEAU. `payrollShared.tsx` porte son propre `ROLE_T` :
 * un rôle présent dans l'une et absent de l'autre s'affiche traduit sur l'écran RH et BRUT sur
 * le bulletin de paie. L'ancien `'Gérant'` manquait aux DEUX — c'est ce qui l'a rendu invisible.
 * Le verrou exige donc l'INTERSECTION, pas la première table trouvée.
 */
const PAYROLL_SHARED = join(FRONT, 'components', 'payroll', 'payrollShared.tsx')

/**
 * Clés d'une table `Record<string, Record<string, string>>` du front, extraites de la SOURCE.
 *
 * ⚠️ Le bloc est délimité par appariement de l'accolade ouvrante avec la PREMIÈRE accolade
 * fermante en colonne 0 — pas par une regex sur la structure, qui se ferait piéger par les
 * accolades internes de chaque ligne de traduction.
 */
function clesDeTable(src: string, nom: string): Set<string> {
  // `const X` matche aussi bien `export const X` : ROLE_T n'est PAS exportée.
  const debut = src.indexOf(`const ${nom}`)
  if (debut < 0) throw new Error(`table ${nom} introuvable dans hrShared.tsx`)
  const fin = src.indexOf('\n}', debut)
  if (fin < 0) throw new Error(`fin de la table ${nom} introuvable`)
  const bloc = src.slice(debut, fin)
  return new Set([...bloc.matchAll(/^\s{2}'([^']+)':/gm)].map(m => m[1]))
}

describe("équipe de démonstration — personnes nommées, rôles traduisibles", () => {
  it('⚠️ le domaine est bien LU : témoin positif présent, témoin inexistant absent', () => {
    const src = readFileSync(HR_SHARED, 'utf-8')
    const roles = clesDeTable(src, 'ROLE_LABELS')
    const depts = clesDeTable(src, 'DEPT_LABELS')

    // Couverture : une extraction cassée rend un ensemble vide, donc un vert qui ne garde rien.
    expect(roles.size, 'ROLE_LABELS doit être lue').toBeGreaterThanOrEqual(10)
    expect(depts.size, 'DEPT_LABELS doit être lue').toBeGreaterThanOrEqual(8)

    // Témoin POSITIF : une clé qu'on sait présente.
    expect(roles.has('Caissier'), 'témoin positif rôle').toBe(true)
    expect(depts.has('Ventes'), 'témoin positif département').toBe(true)

    // Témoin INEXISTANT : l'extraction doit distinguer le singulier du pluriel, sinon
    // l'assertion de domaine ci-dessous serait satisfaite par le défaut même qu'elle vise.
    expect(depts.has('Vente'), "'Vente' au singulier n'est PAS une clé").toBe(false)
  })

  it("⚠️ aucun nom d'employé ne contient son propre métier ni son département", async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)

    expect(ecrit.employee.length).toBeGreaterThan(0)
    for (const e of ecrit.employee) {
      const nom = String(e.name), role = String(e.role), dept = String(e.dept)
      expect(nom.includes(role), `« ${nom} » porte son rôle « ${role} » comme nom`).toBe(false)
      expect(nom.includes(dept), `« ${nom} » porte son département « ${dept} » comme nom`).toBe(false)
    }
  })

  it('⚠️ rôle ET département appartiennent au domaine TRADUIT du front', async () => {
    const src = readFileSync(HR_SHARED, 'utf-8')
    const roles = clesDeTable(src, 'ROLE_LABELS')
    const depts = clesDeTable(src, 'DEPT_LABELS')
    const couleurs = clesDeTable(src, 'DEPT_COLORS')
    const rolesPaie = clesDeTable(readFileSync(PAYROLL_SHARED, 'utf-8'), 'ROLE_T')
    expect(rolesPaie.size, 'ROLE_T doit être lue').toBeGreaterThanOrEqual(8)

    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)

    for (const e of ecrit.employee) {
      expect(roles.has(String(e.role)), `rôle « ${e.role} » hors de ROLE_LABELS`).toBe(true)
      expect(rolesPaie.has(String(e.role)), `rôle « ${e.role} » hors du ROLE_T de la paie`).toBe(true)
      expect(depts.has(String(e.dept)), `département « ${e.dept} » hors de DEPT_LABELS`).toBe(true)
      // Une pastille sans couleur se distingue de rien : le département doit aussi en avoir une.
      expect(couleurs.has(String(e.dept)), `département « ${e.dept} » hors de DEPT_COLORS`).toBe(true)
    }
  })

  it("⚠️ l'avatar laisse dériver les INITIALES — jamais un numéro de rang", async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)

    for (const e of ecrit.employee) {
      const av = String(e.avatar ?? '')
      // `hrShared.tsx` fait `e.avatar || initialesDe(e.name)` : un '1' GAGNE sur les initiales
      // et affiche un rang là où le lecteur attend une personne.
      expect(/^\d+$/.test(av), `avatar « ${av} » est un numéro de rang`).toBe(false)
    }
  })

  it('⚠️ chaque employé est DISTINGUABLE : nom, initiales et couleur', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)

    const noms = ecrit.employee.map(e => String(e.name))
    expect(new Set(noms).size, 'deux employés homonymes').toBe(noms.length)

    // Deux mots au moins : `initialesDe` découpe sur l'espace et rend sinon UNE lettre.
    for (const n of noms) {
      expect(n.trim().split(/\s+/).length, `« ${n} » doit porter prénom ET nom`).toBeGreaterThanOrEqual(2)
    }

    const initiales = noms.map(n => n.trim().split(/\s+/).map(m => m[0]).join('').slice(0, 2).toUpperCase())
    expect(new Set(initiales).size, `initiales en collision : ${initiales.join(', ')}`).toBe(initiales.length)

    const couleurs = ecrit.employee.map(e => String(e.color ?? ''))
    expect(new Set(couleurs).size, 'quatre avatars de la même couleur ne distinguent personne').toBe(couleurs.length)
  })
})
