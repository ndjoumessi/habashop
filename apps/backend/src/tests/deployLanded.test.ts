import { describe, it, expect } from 'vitest'
// @ts-expect-error — script `.mjs` sans déclaration de types ; on exerce sa décision PURE.
import { aAtterri } from '../../scripts/verify-deploy-landed.mjs'

/**
 * LE GARDE DE DÉPLOIEMENT — sa décision, exercée dans les DEUX sens.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * MESURÉ le 2026-08-11 : dix déploiements Railway ont échoué en deux mois sans
 * qu'aucun signal ne parte. La production s'en remet toujours — l'ancien conteneur
 * continue de servir — donc rien ne casse, et c'est ce qui rend le silence coûteux :
 * le jour où un correctif urgent n'atterrit pas, on le croira déployé.
 *
 * ⚠️ `smoke:version` NE PEUT PAS le voir : il compare la VERSION, et un commit qui
 * ne touche qu'un test n'en bump aucune. C'était exactement le cas ce jour-là.
 *
 * ─── CE QUI EST TESTÉ ICI ────────────────────────────────────────────────────
 * La DÉCISION seule : `boot = serverTime − uptime` est-il postérieur à la référence ?
 * Elle est extraite du script pour être exerçable SANS provoquer un déploiement réel.
 * Sans cette extraction, le garde ne serait vérifiable que dans un sens — celui de
 * l'échec — et *un garde qu'on n'a pas vu réussir pour la bonne raison ne garde rien*.
 *
 * ⚠️ CE QUI N'EST PAS TESTÉ : le sondage HTTP, la fenêtre de 12 minutes, le message
 * d'échec. Un test unitaire ne voit pas une régression d'environnement — c'est la
 * raison d'être du script lui-même.
 */

const T0 = Date.parse('2026-08-11T18:00:00.000Z')
const s = (iso: string) => Date.parse(iso)

describe('aAtterri — un nouveau conteneur sert-il ?', () => {
  it('⚠️ conteneur DÉMARRÉ APRÈS la référence : atterri', () => {
    // serverTime 18:05, uptime 60 s ⇒ boot 18:04, postérieur à T0.
    expect(aAtterri(T0, s('2026-08-11T18:05:00.000Z'), 60)).toBe(true)
  })

  it('⚠️ ANCIEN conteneur, même s’il répond parfaitement : PAS atterri', () => {
    /**
     * LE CŒUR DU DÉFAUT. Le 2026-08-11 l'ancien conteneur servait `/health` en 200,
     * l'API répondait à tout, et le déploiement avait ÉCHOUÉ. Un garde qui regarde
     * la santé conclut au vert ; celui-ci regarde l'ÂGE.
     */
    // serverTime 18:05, uptime 1800 s ⇒ boot 17:35, ANTÉRIEUR à T0.
    expect(aAtterri(T0, s('2026-08-11T18:05:00.000Z'), 1800)).toBe(false)
  })

  it('⚠️ un uptime qui GRANDIT ne fait jamais basculer le verdict', () => {
    // Le même conteneur vieillit : boot reste identique, la réponse reste fausse.
    // Sans quoi il suffirait d'attendre assez longtemps pour que le garde passe.
    for (const [t, u] of [['18:05', 1800], ['18:10', 2100], ['18:20', 2700]] as [string, number][]) {
      expect(aAtterri(T0, s(`2026-08-11T${t}:00.000Z`), u), `${t}/${u}s`).toBe(false)
    }
  })

  it('le cas LIMITE — boot exactement à T0 — n’est PAS un atterrissage', () => {
    // T0 est lu SUR le conteneur en place : un boot égal à T0 est donc ce même
    // conteneur, pas un nouveau. Strictement postérieur, jamais « ou égal ».
    expect(aAtterri(T0, s('2026-08-11T18:05:00.000Z'), 300)).toBe(false)
    expect(aAtterri(T0, s('2026-08-11T18:05:00.000Z'), 299)).toBe(true)
  })

  it('⚠️ une réponse ABÎMÉE ne vaut jamais un succès', () => {
    /**
     * `Date.parse` d'un `serverTime` absent rend `NaN`, et toute comparaison avec
     * `NaN` est fausse — le verdict serait donc « pas atterri », ce qui est le bon
     * défaut. On l'épingle quand même : si quelqu'un inversait la comparaison, un
     * champ manquant deviendrait un succès silencieux.
     */
    expect(aAtterri(T0, Number.NaN, 60)).toBe(false)
    expect(aAtterri(Number.NaN, s('2026-08-11T18:05:00.000Z'), 60)).toBe(false)
    expect(aAtterri(T0, s('2026-08-11T18:05:00.000Z'), Number.NaN)).toBe(false)
    expect(aAtterri(T0, s('2026-08-11T18:05:00.000Z'), -1)).toBe(false)
  })

  it('⚠️ l’horloge du RUNNER n’entre pas dans la décision', () => {
    /**
     * `serverTime` et `uptime` viennent tous deux du serveur : la fonction ne lit
     * jamais `Date.now()`. Une dérive d'horloge du runner CI ne peut donc pas
     * fausser le verdict — et ce cas rougirait si quelqu'un réintroduisait une
     * lecture d'horloge locale.
     */
    const src = readFichier()
    expect(src, 'la décision ne doit lire aucune horloge locale').not.toMatch(/function aAtterri[\s\S]{0,400}Date\.now\(\)/)
  })
})

function readFichier(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const src = readFileSync(join(__dirname, '../../scripts/verify-deploy-landed.mjs'), 'utf8')
  // ⚠️ COUVERTURE : un chemin cassé rendrait une chaîne vide, et le `not.toMatch`
  // ci-dessus serait vrai du vide — un vert qui ne garde rien.
  if (!src.includes('export function aAtterri')) throw new Error('script introuvable ou renommé')
  return src
}
