import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { completerRangee, estCaseVide, colonnesPourLargeur } from '../lib/grille'

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

describe('colonnesPourLargeur — la contrainte, pas le libellé', () => {
  it('dérive le nombre de colonnes de la largeur DISPONIBLE', () => {
    // Le kiosque figeait 4 colonnes. Sa grille partage la largeur avec le panier :
    // sur un téléphone elle vit dans ~250 dp, soit 60 dp par tuile — aucun libellé
    // ne tient là-dedans, et « Café soluble 200g » sortait « Café s / olubl… ».
    expect(colonnesPourLargeur(250)).toBe(2)   // téléphone, grille amputée du panier
    expect(colonnesPourLargeur(538)).toBe(4)   // tablette
    expect(colonnesPourLargeur(900)).toBe(6)   // grande tablette : plafonné
  })

  it('⚠️ ne rend JAMAIS 0 ni NaN — une `FlatList` y lève ou se vide en silence', () => {
    // Avant la première mesure d'`onLayout`, la largeur vaut 0. Le pire des deux cas
    // serait `NaN` : la liste se viderait sans erreur, donc sans signal.
    for (const mauvais of [0, -10, NaN, Infinity]) {
      expect(colonnesPourLargeur(mauvais)).toBe(2)
    }
  })

  it('reste dans des bornes lisibles quelle que soit la largeur', () => {
    for (const l of [1, 50, 131, 132, 5000]) {
      const c = colonnesPourLargeur(l)
      expect(c).toBeGreaterThanOrEqual(2)
      expect(c).toBeLessThanOrEqual(6)
    }
    // La tuile obtenue n'est jamais plus étroite que le minimum demandé.
    for (const l of [264, 400, 792]) {
      expect(l / colonnesPourLargeur(l)).toBeGreaterThanOrEqual(132)
    }
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
    .filter(x => /numColumns=\{[^}]+\}/.test(x.src))   // ⚠️ toute EXPRESSION, pas un chiffre

  it('COUVERTURE — les grilles sont bien trouvées, dans `src/` ET `app/`', () => {
    // ⚠️ Sans ce compte, la suppression des deux grilles rendrait le verrou vert.
    // Et il a servi le jour même : le détecteur cherchait `numColumns={<chiffre>}`,
    // or le kiosque est passé à `numColumns={colonnes}` — la règle est devenue
    // AVEUGLE au fichier qu'elle garde, et seule cette assertion l'a dit. Angle mort
    // de FORME, dans le verrou, causé par la correction qu'il accompagnait.
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

  /**
   * ⚠️ CE QUI PRÉCÈDE NE GARDE PAS LE *CHOIX* DU NOMBRE DE COLONNES — vérifié : un
   * sabotage qui refige `numColumns={4}` dans le kiosque laisse tout au VERT. La
   * règle générale ne peut pas trancher, car un nombre figé est LÉGITIME sur une
   * grille pleine largeur (la caisse, 3 colonnes, mesurée à l'écran).
   *
   * La distinction n'est pas détectable statiquement : elle tient à ce que la grille
   * partage ou non sa largeur avec autre chose. On NOMME donc les grilles à largeur
   * PARTAGÉE, avec leur raison — liste écrite à la main, et dite comme telle.
   */
  const LARGEUR_PARTAGEE: Record<string, string> = {
    'app/(app)/kiosk/index.tsx': 'partage la largeur avec la colonne panier (~30 %)',
  }

  it('une grille à largeur PARTAGÉE dérive ses colonnes, jamais un nombre figé', () => {
    for (const [chemin, raison] of Object.entries(LARGEUR_PARTAGEE)) {
      const g = grilles.find(x => x.f.endsWith(chemin))
      // ⚠️ Le fichier doit exister : renommé ou déplacé, la règle deviendrait muette.
      // (jest n'accepte qu'un argument dans `expect` — le message passe par l'erreur.)
      if (!g) throw new Error(`${chemin} introuvable — la règle ne garde plus rien (${raison})`)
      expect(/numColumns=\{\s*\d+\s*\}/.test(g.src)).toBe(false)
      expect(/colonnesPourLargeur\(/.test(g.src)).toBe(true)
    }
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
