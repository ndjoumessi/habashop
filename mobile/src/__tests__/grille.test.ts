import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { completerRangee, estCaseVide } from '../lib/grille'

/**
 * VERROU — la dernière rangée d'une grille ne s'étire pas.
 *
 * Défaut OBSERVÉ le 2026-08-13 sur émulateur : une `FlatList numColumns={N}` dont les
 * tuiles portent `flex: 1` répartit la largeur entre les tuiles PRÉSENTES. « Tomate
 * concentrée 800g », seul sur sa rangée, occupait toute la largeur de l'écran.
 * Jumeau natif du défaut `auto-fit` corrigé côté web le 2026-08-12 — deux moteurs de
 * mise en page, aucun code commun, le même symptôme.
 *
 * ⚠️ CE VERROU JUGE LA LOGIQUE ET LE CÂBLAGE, PAS LA GÉOMÉTRIE. jest n'exécute pas
 * Yoga : que la tuile mesure bien un tiers de la rangée ne se prouve que sur un
 * moteur de rendu, et ça l'a été (émulateur, captures avant/après).
 */
describe('completerRangee — la dernière rangée est complétée, jamais étirée', () => {
  const p = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `p${k}` }))

  it.each([[13, 3, 15], [1, 3, 3], [2, 3, 3], [5, 4, 8], [7, 4, 8]])(
    '%i éléments en %i colonnes → %i cases', (n, cols, attendu) => {
      expect(completerRangee(p(n), cols).length).toBe(attendu)
    })

  it('une liste DÉJÀ pleine n’est pas touchée — aucune rangée fantôme', () => {
    // ⚠️ Sans ce cas, on pourrait ajouter une rangée ENTIÈRE de cases vides, qui
    // occuperait de la hauteur pour rien en bas de chaque grille.
    for (const [n, cols] of [[12, 3], [3, 3], [8, 4]] as const) {
      expect(completerRangee(p(n), cols).length).toBe(n)
    }
  })

  it('une liste VIDE le reste — l’état vide doit rester l’état vide', () => {
    expect(completerRangee([], 3)).toEqual([])
    expect(completerRangee([], 4)).toEqual([])
  })

  it('les éléments RÉELS sont intacts et en tête, les cases vides identifiables', () => {
    const r = completerRangee(p(4), 3)
    expect(r.slice(0, 4)).toEqual(p(4))
    expect(r.slice(4).every(estCaseVide)).toBe(true)
    // ⚠️ Un produit ne doit JAMAIS être pris pour une case vide : le prédicat ne
    // regarde que le drapeau, jamais une forme d'identifiant qu'un produit
    // pourrait porter par hasard.
    expect(p(1).map(estCaseVide)).toEqual([false])
    expect(estCaseVide({ id: '__case_vide_0__' } as never)).toBe(false)
  })

  it('des clés DISTINCTES — une `FlatList` avec deux fois la même clé perd des lignes', () => {
    const vides = completerRangee(p(1), 4).filter(estCaseVide)
    expect(vides.length).toBe(3)
    expect(new Set(vides.map(v => v.id)).size).toBe(3)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   LE CÂBLAGE — car la règle pure ne dit rien de qui l'appelle
   ══════════════════════════════════════════════════════════════════════════════ */

const RACINES = ['src', 'app'].map(d => join(__dirname, '..', '..', d))

function fichiers(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p2 = join(dir, e)
    if (statSync(p2).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') out.push(...fichiers(p2)) }
    else if (e.endsWith('.tsx')) out.push(p2)
  }
  return out
}

describe('câblage — CHAQUE grille multi-colonnes complète sa dernière rangée', () => {
  const grilles = RACINES.flatMap(fichiers)
    .map(f => ({ f, src: readFileSync(f, 'utf8') }))
    .filter(x => /numColumns=\{\d+\}/.test(x.src))

  it('COUVERTURE — les grilles sont bien trouvées, dans `src/` ET `app/`', () => {
    // ⚠️ Sans ce compte, la suppression des deux grilles rendrait le verrou vert.
    // Mesuré le 2026-08-13 : la caisse (3 colonnes) et le kiosque (4).
    expect(grilles.length).toBeGreaterThanOrEqual(2)
    expect(grilles.some(g => g.f.includes('/app/'))).toBe(true)
  })

  it('aucune grille ne passe sa liste BRUTE à `data`', () => {
    const nues = grilles
      .filter(g => !/data=\{completerRangee\(/.test(g.src))
      .map(g => g.f.split('/mobile/')[1])
    // Une grille dont `data` n'est pas complétée étire sa dernière rangée dès que
    // l'effectif n'est pas multiple du nombre de colonnes.
    expect(nues).toEqual([])
  })

  it('et chacune REND la case vide au lieu de la traiter comme un produit', () => {
    const sansRendu = grilles
      .filter(g => !/estCaseVide\(/.test(g.src))
      .map(g => g.f.split('/mobile/')[1])
    // Sans ce rendu, la case vide part dans la carte produit : `item.name` est
    // `undefined` et l'écran plante — pire que le défaut qu'on corrige.
    expect(sansRendu).toEqual([])
  })
})
