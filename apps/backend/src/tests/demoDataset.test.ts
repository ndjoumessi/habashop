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

const options = { tenantId: 'demo-tmp-x', cashierId: 'u-demo', now: new Date('2026-10-01T10:00:00.000Z') }

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
    expect(mois.size).toBeGreaterThanOrEqual(3)
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
    expect(ecrit.sale.length).toBe(180)
    expect(ecrit.saleItem.length).toBeGreaterThanOrEqual(180)
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
