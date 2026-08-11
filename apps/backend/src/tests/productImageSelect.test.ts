import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * UN `select` EXPLICITE QUI OUBLIE LE CHAMP LE FAIT DISPARAÎTRE — EN SILENCE.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * MESURÉ le 2026-08-11, en ajoutant `Product.image` : SEPT `select` explicites
 * nommaient `emoji` sans nommer `image`. Le champ existait en base, le type le
 * portait, le front l'affichait — et il ne serait jamais arrivé, sur cinq écrans
 * d'abonnement, sur les transferts de stock, et sur le CATALOGUE PUBLIC, c'est-à-dire
 * précisément la surface où une photo produit a le plus de valeur.
 *
 * ⚠️ RIEN NE L'AURAIT SIGNALÉ. `tsc` est vert : un `select` restreint est valide, il
 * rend juste un type plus étroit que le front ne l'exige (les champs sont optionnels).
 * Les tests sont verts. La revue voit une ligne qui n'a pas changé. C'est la famille
 * du JUMEAU NON TRAITÉ : la correction s'arrête au premier fichier, et le reste vit.
 *
 * ⚠️ CE N'EST PAS UN TEST SUR `image`, C'EST UN TEST SUR LA PAIRE. Le jour où un
 * troisième champ de présentation produit apparaît, cette règle ne le couvrira pas
 * toute seule — mais elle rendra la question visible au premier `select` ajouté.
 */

const RACINE = join(__dirname, '..')

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e !== 'tests' && e !== 'node_modules') fichiers(p, acc)
    } else if (e.endsWith('.ts')) acc.push(p)
  }
  return acc
}

/**
 * La FORME visée : un bloc `select: { … }` qui nomme `emoji: true`. On raisonne par
 * BLOC et non par fichier — `subscriptions.ts` en porte cinq, et un fichier « qui
 * mentionne image quelque part » passerait alors qu'un de ses cinq blocs l'oublie.
 * C'est la leçon d'`exportAccountingExcel` : le verrou raisonne par SITE, pas par
 * fichier.
 */
function blocsSelect(src: string): string[] {
  const out: string[] = []
  const re = /select:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    // Appariement d'accolades, jamais une regex sur la structure : un `select` peut
    // s'étendre sur plusieurs lignes et en contenir d'autres. Un sabotage était déjà
    // passé VERT ailleurs parce que la règle scrutait UNE ligne d'un bloc éclaté.
    let prof = 1
    let i = m.index + m[0].length
    for (; i < src.length && prof > 0; i++) {
      if (src[i] === '{') prof++
      else if (src[i] === '}') prof--
    }
    out.push(src.slice(m.index, i))
  }
  return out
}

describe('⚠️ tout `select` de produit qui nomme `emoji` doit nommer `image`', () => {
  it('la règle tient sur tout `src/`', () => {
    const tous = fichiers(RACINE)
    // ⚠️ COUVERTURE : un `fichiers()` cassé rendrait une liste vide, donc un vert qui
    // ne garde rien.
    expect(tous.length, 'le balayage doit lire des fichiers').toBeGreaterThan(80)

    const fautifs: string[] = []
    let blocsVus = 0
    for (const f of tous) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const bloc of blocsSelect(src)) {
        if (!/\bemoji:\s*true\b/.test(bloc)) continue
        blocsVus++
        if (!/\bimage:\s*true\b/.test(bloc)) {
          fautifs.push(`${f.slice(RACINE.length + 1)} :: ${bloc.replace(/\s+/g, ' ').slice(0, 90)}`)
        }
      }
    }

    // ⚠️ CONTRÔLE POSITIF, DANS LA MÊME ASSERTION QUE LE VERDICT. Sans lui, un
    // `blocsSelect()` cassé rendrait « zéro fautif » — un vert qui décrit un monde
    // où la règle n'a rien examiné. Sept blocs ont été comptés le 2026-08-11.
    expect(blocsVus, 'la règle doit avoir RENCONTRÉ des select de produit').toBeGreaterThanOrEqual(7)
    expect(fautifs, 'ces select feraient disparaître la photo produit').toEqual([])
  })

  it('⚠️ le détecteur est DISCRIMINANT — il voit le manque, et seulement le manque', () => {
    const complet = 'select: { id: true, name: true, emoji: true, image: true, stockQty: true }'
    const nu = 'select: { id: true, name: true, emoji: true, stockQty: true }'
    const horsSujet = 'select: { id: true, name: true, sellPrice: true }'

    const juge = (s: string) => blocsSelect(s).filter(b => /\bemoji:\s*true\b/.test(b) && !/\bimage:\s*true\b/.test(b))
    expect(juge(nu), 'le bloc SANS image doit être vu').toHaveLength(1)
    expect(juge(complet), 'le bloc complet ne doit PAS être vu').toHaveLength(0)
    // Un select qui ne parle pas de présentation produit n'est pas concerné : une
    // règle qui crie au loup se fait désarmer.
    expect(juge(horsSujet), 'un select sans emoji n’est pas concerné').toHaveLength(0)
  })

  it('l’appariement d’accolades survit à un `select` IMBRIQUÉ', () => {
    // La forme réelle de `subscriptions.ts` : un select dans un include dans un select.
    const src = 'include: { items: { include: { product: { select: { id: true, emoji: true, image: true } } } } }'
    expect(blocsSelect(src)).toHaveLength(1)
    expect(blocsSelect(src)[0]).toContain('image: true')
  })
})
