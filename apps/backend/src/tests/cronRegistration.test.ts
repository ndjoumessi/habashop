import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PAS_MS, FENETRE_MINUTES } from '../lib/cronWindow'

/**
 * ENREGISTREMENT DES CRONS — aucune garde de minute écrite À LA MAIN.
 *
 * ⚠️ Le défaut d'origine n'était pas une faute de frappe, c'était une COMBINAISON : une garde
 * `getMinutes() > 5` écrite en ligne, et un pas de `setInterval` plus grand que la fenêtre.
 * Chacune des deux est inoffensive seule ; ensemble, elles rendaient la tâche inexécutable
 * pour 54 minutes de démarrage sur 60. Ce verrou interdit la combinaison en interdisant la
 * première moitié : la décision passe par `doitTourner`, qui porte l'invariant.
 *
 * ⚠️ Verrou de FORME sur le fichier source, et c'est assumé : la cause vit dans
 * l'ENREGISTREMENT des crons, que `server.ts` effectue au chargement du module — un test de
 * comportement ne peut pas l'observer sans démarrer le serveur, ce qui est précisément la
 * raison pour laquelle ces boucles sont restées hors de portée de tout verrou jusqu'ici.
 */
const SERVER = join(__dirname, '..', 'server.ts')
const src = readFileSync(SERVER, 'utf8')

/** Lignes utiles — commentaires retirés, sinon le verrou interdit de l'expliquer. */
const utiles = src.split('\n').filter(l => {
  const t = l.trim()
  return t !== '' && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
})

describe('enregistrement des crons', () => {
  it('COUVERTURE : le fichier est lu et contient bien des `setInterval`', () => {
    // Un chemin faux rendrait un fichier vide, donc un vert qui ne garde rien.
    expect(utiles.length).toBeGreaterThan(200)
    expect(utiles.filter(l => l.includes('setInterval')).length).toBeGreaterThanOrEqual(1)
  })

  it('⚠️ AUCUNE garde de minute écrite à la main — la décision passe par `doitTourner`', () => {
    const fautes = utiles.filter(l => /getMinutes\s*\(\s*\)/.test(l))
    expect(
      fautes,
      `garde de minute en ligne dans server.ts — passer par \`doitTourner\` :\n${fautes.join('\n')}`,
    ).toEqual([])
  })

  it('⚠️ aucun `setInterval` à pas horaire ne porte de garde de jour ou d’heure', () => {
    // La combinaison fatale : un pas d'une heure + une cible plus fine qu'une heure.
    const fautes = utiles.filter(l =>
      /setInterval/.test(l) === false &&
      /(getHours|getDay|getDate)\s*\(\s*\)/.test(l) &&
      !/doitTourner/.test(l))
    expect(fautes, `cible temporelle lue hors de \`doitTourner\` :\n${fautes.join('\n')}`).toEqual([])
  })

  it('les cinq crons à fenêtre sont enregistrés, et NOMMÉMENT', () => {
    for (const nom of ['rapport-hebdo', 'balayage-pii-demo', 'alertes-stock', 'recap-paie', 'purge-demos']) {
      expect(src, `cron \`${nom}\` absent de server.ts`).toContain(`'${nom}'`)
    }
  })

  it('⚠️ les noms de cron sont UNIQUES — deux crons homonymes se bloqueraient mutuellement', () => {
    const noms = [...src.matchAll(/planifier\(\s*'([^']+)'/g)].map(m => m[1])
    expect(noms.length).toBeGreaterThanOrEqual(5)
    expect(new Set(noms).size, `doublon parmi : ${noms.join(', ')}`).toBe(noms.length)
  })

  it('⚠️ L’INVARIANT : le pas ne dépasse pas la fenêtre', () => {
    // C'est lui qui garantit qu'un tick tombe dans la fenêtre quelle que soit la minute de
    // démarrage. Le relever au-delà ferait revenir le défaut mesuré, en silence.
    expect(PAS_MS).toBeLessThanOrEqual((FENETRE_MINUTES + 1) * 60_000)
  })
})
