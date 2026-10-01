import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { normCat } from '@/utils/normCat'

/**
 * AUCUN OCTET NUL DANS LES SOURCES.
 *
 * ⚠️ MESURÉ : `pages/Dashboard.tsx` en portait UN, à l'octet 11832 — au milieu d'une chaîne, à
 * la place de l'espace de la clé réservée `' reliquat'`. Le comportement était correct par
 * accident (un NUL est aussi impossible à produire que l'espace), mais le fichier devenait du
 * BINAIRE pour l'outillage : `file(1)` le dit « data », et un `grep` le saute.
 *
 * ⚠️ CE N'EST PAS THÉORIQUE — ÇA M'EST ARRIVÉ DEUX FOIS DANS CETTE SESSION. Un balayage de
 * `grep` a rendu un faux « 0 occurrence » sur ce fichier, et un second a signalé 253 fichiers
 * sur 253. Un fichier source qu'un outil texte ne sait pas lire fausse toutes les mesures qui
 * le traversent, et c'est précisément sur des mesures que ce dépôt tranche ses décisions.
 *
 * ⚠️ `CLAUDE.md` DOCUMENTE LA CLÉ AVEC UNE ESPACE (`' reliquat'`). Le code portait un NUL : la
 * documentation et le code divergeaient sur une valeur que personne ne pouvait voir. L'espace
 * est rétablie, et sa propriété de sûreté est VÉRIFIÉE ci-dessous plutôt qu'affirmée.
 *
 * ⚠️ Périmètre DÉRIVÉ de l'arborescence, avec assertion de COUVERTURE : un `walk()` cassé rend
 * une liste vide, donc un vert qui ne garde rien.
 */

const RACINE = resolve(__dirname, '..', '..', '..', '..')
const CIBLES = [
  join(RACINE, 'apps', 'frontend', 'src'),
  join(RACINE, 'apps', 'backend', 'src'),
  join(RACINE, 'mobile', 'src'),
]

function parcourir(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) parcourir(p, acc)
    else if (/\.(ts|tsx|js|jsx|css|json|md)$/.test(e)) acc.push(p)
  }
  return acc
}

describe('sources — aucun octet NUL', () => {
  it('⚠️ aucun fichier source ne contient d’octet NUL', () => {
    const fichiers = CIBLES.flatMap(d => parcourir(d))
    // Couverture : sans elle, un chemin faux rendrait zéro fichier et ce test serait vide.
    expect(fichiers.length, 'le parcours doit trouver les sources').toBeGreaterThan(400)

    const fautifs = fichiers
      .map(f => ({ f, b: readFileSync(f) }))
      .filter(({ b }) => b.includes(0))
      .map(({ f, b }) => `${f.replace(RACINE + '/', '')} (octet ${b.indexOf(0)})`)

    expect(fautifs, `fichier(s) binaire(s) pour l’outillage texte :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  it('⚠️ la clé réservée du reliquat est INPRODUISIBLE par normCat — vérifié, pas affirmé', () => {
    // `normCat` finit par `.trim()` : il ne peut rendre aucune chaîne commençant par une espace.
    for (const essai of [' reliquat', '  reliquat', ' reliquat ', 'RELIQUAT', ' Reliquat']) {
      expect(normCat(essai), `normCat ne doit jamais rendre la clé réservée depuis « ${essai} »`)
        .not.toBe(' reliquat')
    }
    // Témoin positif : normCat fait bien son travail sur une entrée ordinaire.
    expect(normCat('  🥥 Épicerie  ')).toBe('épicerie')
  })
})
