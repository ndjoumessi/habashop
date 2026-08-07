import { describe, it, expect } from 'vitest'
import { regrouperCategories, NOM_RELIQUAT } from '../lib/categoryBreakdown'

/**
 * VERROU — LA SOMME DES VALEURS RENDUES EST LE CA DU MOIS.
 *
 * ⚠️ Cet invariant est plus fort que « les pourcentages somment à 100 ». Un camembert peut
 * sommer à 100 % d'un total FAUX — c'est précisément ce que faisait celui-ci. On lie donc le
 * graphique au chiffre réel plutôt qu'à lui-même.
 *
 * ⚠️ LES CAS SONT À 8 CATÉGORIES ET PLUS. Un test à 3 reproduirait exactement la situation
 * qui a laissé passer le défaut : `demo-tenant-001` a **six** catégories — pile la limite —
 * et n'a donc jamais pu le montrer. Le cas qui compte est celui qui n'a jamais été exécuté.
 */

/** Distribution COPIÉE de `demo-tenant-002`, mars 2026 (7 catégories, 77 000 XOF perdus). */
const REEL_7 = [
  { name: 'Céréales', value: 1200000 },
  { name: 'Épicerie', value: 980000 },
  { name: 'Conserves', value: 750000 },
  { name: 'Corps gras', value: 620000 },
  { name: 'Laitiers', value: 340000 },
  { name: 'Boissons', value: 233950 },
  { name: 'Hygiène', value: 77000 },
]

const jeu = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Cat${String(i + 1).padStart(2, '0')}`, value: (n - i) * 1000 }))

const somme = (l: { value: number }[]) => l.reduce((s, c) => s + c.value, 0)

describe('l’invariant : Σ des valeurs rendues == CA du mois', () => {
  it('tient de 0 à 20 catégories — le balayage inclut 7, 8 et au-delà', () => {
    for (let n = 0; n <= 20; n++) {
      const entree = jeu(n)
      const rendu = regrouperCategories(entree, 6)
      expect(somme(rendu), `${n} catégories : le camembert doit répartir TOUT le CA`).toBe(somme(entree))
    }
  })

  it('tient sur la distribution RÉELLE qui perdait 77 000 XOF', () => {
    const rendu = regrouperCategories(REEL_7, 6)
    expect(somme(rendu)).toBe(4200950)
    // Avant : `.slice(0, 6)` laissait 77 000 dehors, en silence.
    expect(somme(REEL_7.slice(0, 6)), 'l’ancien dénominateur, pour mémoire').toBe(4123950)
  })

  it('SABOTAGE — sans reliquat, la somme diverge du CA du mois', () => {
    // Forme copiée de la production d'avant (`analytics.ts` : `.sort(...).slice(0, 6)`).
    const avant = [...REEL_7].sort((a, b) => b.value - a.value).slice(0, 6)
    expect(somme(avant)).not.toBe(somme(REEL_7))
    expect(somme(REEL_7) - somme(avant)).toBe(77000)
  })
})

describe('la forme du reliquat', () => {
  it('à 8 catégories : 5 nommées + « Autres » qui en agrège 3', () => {
    const rendu = regrouperCategories(jeu(8), 6)
    expect(rendu).toHaveLength(6)
    expect(rendu.slice(0, 5).every(c => c.count === 1 && !c.other)).toBe(true)
    const dernier = rendu[5]
    expect(dernier.name).toBe(NOM_RELIQUAT)
    expect(dernier.other).toBe(true)
    expect(dernier.count, '« Autres — 3 catégories » : le compte fait partie de l’information').toBe(3)
  })

  it('le reliquat agrège TOUJOURS au moins deux catégories', () => {
    // ⚠️ À 7 catégories, « les 6 premières + Autres » cacherait UNE catégorie nommable
    // derrière un libellé anonyme — moins informatif que de la nommer.
    for (let n = 7; n <= 15; n++) {
      const r = regrouperCategories(jeu(n), 6)
      const autres = r.find(c => c.other)
      expect(autres!.count, `${n} catégories`).toBeGreaterThanOrEqual(2)
    }
  })

  it('CAS LIMITE — exactement 6 : aucune tranche « Autres » vide', () => {
    const r = regrouperCategories(jeu(6), 6)
    expect(r).toHaveLength(6)
    expect(r.some(c => c.other), 'un secteur à 0 % se lit comme un graphique cassé').toBe(false)
    expect(r.every(c => c.value > 0)).toBe(true)
  })

  it('CAS LIMITE — zéro catégorie : tableau vide, jamais une ligne inventée', () => {
    expect(regrouperCategories([], 6)).toEqual([])
  })

  it('trie lui-même — l’exactitude ne dépend pas de l’ordre reçu', () => {
    // Une justesse qui dépend d'un invariant distant disparaît au premier réordonnancement,
    // sans qu'aucune suite ne rougisse (§ justesse empruntée).
    const desordre = [...REEL_7].sort((a, b) => a.value - b.value)
    expect(regrouperCategories(desordre, 6)).toEqual(regrouperCategories(REEL_7, 6))
    expect(regrouperCategories(desordre, 6)[0].name).toBe('Céréales')
  })

  it('n’identifie PAS le reliquat par son nom — une vraie catégorie peut s’appeler « Autres »', () => {
    // `analytics.ts` range déjà les produits sans catégorie sous « Autre ».
    const avecHomonyme = [...jeu(7), { name: NOM_RELIQUAT, value: 999999 }]
    const r = regrouperCategories(avecHomonyme, 6)
    const vraie = r.find(c => c.name === NOM_RELIQUAT && !c.other)
    expect(vraie, 'la catégorie réelle « Autres » reste nommée et distincte du reliquat').toBeDefined()
    expect(vraie!.value).toBe(999999)
    expect(r.filter(c => c.other)).toHaveLength(1)
    expect(somme(r)).toBe(somme(avecHomonyme))
  })
})
