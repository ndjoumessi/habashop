import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * ⚠️ L'AUTRE MOITIÉ DU CONTRAT DU LIEN DE FACTURE — celle que l'HÉBERGEMENT décide.
 *
 * Mesuré en production le 2026-10-25 : le jeton s'écrivait `<id>.<sceau>`, et `/f/<id>.<sceau>`
 * rendait **404** là où `/f/abcdef` rendait 200. Cause : `vercel.json` ne réécrit vers
 * l'application que les chemins SANS POINT — un point fait lire l'URL comme une demande de
 * FICHIER. Le service worker porte la même règle de son côté (`navigateFallbackDenylist`).
 *
 * Rien ne pouvait le voir : le PDF était juste, la route d'API vivante, 49 tests verts, et le
 * QR imprimé menait à une page d'erreur. C'est la famille « LA SOURCE EST VALIDE, L'ARTEFACT
 * EST NUL », appliquée cette fois à la configuration de l'hôte.
 *
 * ⚠️ Les deux règles sont LUES dans leurs fichiers réels et ÉVALUÉES, jamais recopiées ici :
 * une copie se périmerait en silence, ce qui est exactement le défaut qu'on ferme.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
// ⚠️ `vercel.json` vit dans `apps/frontend/`, pas à la racine — le Root Directory du projet
// Vercel est le workspace front. Le chercher à la racine rendait ENOENT ; c'est le genre de
// chemin qu'on croit connaître et qu'il faut mesurer (`find`), pas supposer.

/** Forme réelle d'un chemin de facture : cuid + `~` + 16 caractères base64url. */
const CHEMIN_FACTURE = '/f/clx1a2b3c4d5e6f7g8h9i0j1~8lSWmANFa9O3jNQt'
/** La forme d'AVANT, celle qui a produit le 404. Le test doit la rejeter. */
const CHEMIN_FAUTIF = '/f/clx1a2b3c4d5e6f7g8h9i0j1.8lSWmANFa9O3jNQt'

describe('vercel.json — la réécriture SPA accepte-t-elle un chemin de facture ?', () => {
  const vercel = JSON.parse(readFileSync(join(RACINE, 'apps', 'frontend', 'vercel.json'), 'utf8')) as {
    rewrites: { source: string; destination: string }[]
  }
  const versIndex = vercel.rewrites.find(r => r.destination === '/index.html')
  // Assertion de COUVERTURE : sans elle, un `vercel.json` restructuré rendrait `undefined`
  // et tout le fichier passerait au vert en ne gardant plus rien.
  it('la règle de réécriture vers index.html existe bel et bien', () => {
    expect(versIndex, 'aucune réécriture vers /index.html dans vercel.json').toBeTruthy()
  })

  const regle = new RegExp(`^${versIndex!.source}$`)

  it('le modèle reproduit le comportement MESURÉ en production', () => {
    // Deux faits relevés sur habashop.vercel.app le 2026-10-25 : s'ils ne se reproduisent
    // pas ici, c'est le MODÈLE qui est faux, et le reste du fichier ne vaut rien.
    expect(regle.test('/f/abcdef')).toBe(true)   // → HTTP 200 en prod
    expect(regle.test('/f/abc.def')).toBe(false) // → HTTP 404 en prod
  })

  it('⚠️ un chemin de facture est réécrit vers l’application', () => {
    expect(regle.test(CHEMIN_FACTURE)).toBe(true)
  })

  it('⚠️ et l’ancienne forme à point ne l’est PAS — le test détecte bien le défaut d’origine', () => {
    expect(regle.test(CHEMIN_FAUTIF)).toBe(false)
  })
})

describe('service worker — la navigation vers une facture n’est pas mise de côté', () => {
  const vite = readFileSync(join(RACINE, 'apps', 'frontend', 'vite.config.ts'), 'utf8')
  // ⚠️ `(.*)` GOURMAND, borné à une ligne — donc jusqu'au DERNIER `]` de la ligne. Un
  // `[^\]]*` s'arrêtait au PREMIER, c'est-à-dire celui de la classe `[a-zA-Z0-9]` À
  // L'INTÉRIEUR du second motif : la denylist était tronquée en plein milieu, et il n'en
  // restait qu'un motif sur deux. Encore une mesure plutôt qu'une relecture.
  const ligne = /navigateFallbackDenylist:\s*\[(.*)\]/.exec(vite)
  it('la denylist est bien trouvée dans vite.config.ts', () => {
    expect(ligne, 'navigateFallbackDenylist introuvable').toBeTruthy()
  })

  // Les littéraux d'expression régulière sont ÉVALUÉS, pas comparés en texte : on juge ce
  // qu'ils FONT, pas la façon dont ils sont écrits.
  //
  // ⚠️ Corps NON GOURMAND, et borné par la virgule ou la fin. Avec un `+` gourmand, les deux
  // littéraux de la denylist se fondaient en UN SEUL motif bancal — et le fichier devenait un
  // verrou qui ne garde rien. C'est la contre-preuve ci-dessous qui l'a révélé ; sans elle,
  // ce test serait passé au vert en n'ayant rien mesuré.
  const motifs = [...ligne![1].matchAll(/\/((?:[^/\\\n]|\\.)+?)\/([gimsuy]*)\s*(?:,|$)/g)]
    .map(m => new RegExp(m[1], m[2]))

  it('la denylist porte bien les motifs attendus (plancher de couverture)', () => {
    // Plancher, pas égalité : la denylist peut grandir. Mais sous 2, c'est l'extraction qui
    // est cassée, pas la configuration.
    expect(motifs.length).toBeGreaterThanOrEqual(2)
  })

  it('⚠️ aucun motif ne met un chemin de facture de côté', () => {
    const bloques = motifs.filter(r => r.test(CHEMIN_FACTURE)).map(String)
    expect(bloques).toEqual([])
  })

  it('⚠️ l’ancienne forme à point, elle, ÉTAIT bloquée — contre-preuve', () => {
    expect(motifs.some(r => r.test(CHEMIN_FAUTIF))).toBe(true)
  })
})
