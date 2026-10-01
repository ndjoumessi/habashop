import { describe, it, expect } from 'vitest'
import { libelleRedis, type EtatRedis } from '@/components/integrations/OpsInfrastructure'

/**
 * AFFICHAGE DE LA SONDE REDIS DANS LA CONSOLE OPS.
 *
 * ⚠️ POURQUOI C'EST AFFICHÉ. `POST /api/demo/start` est FAIL-CLOSED sur Redis depuis le
 * 2026-10-01 : si Redis tombe, le bouton « Essayer la démo » de la vitrine cesse de
 * fonctionner. Avant, `/api/health-extended` rendait `redis: { status: 'configured' }` — un
 * champ déclaré que personne ne lisait, et qui n'aurait rien dit de toute façon.
 *
 * ⚠️ QUATRE états de rendu, dans l'ordre de la PRUDENCE : tant que la sonde n'a pas répondu
 * on n'est pas optimiste ; `absent` est une CONFIGURATION, pas une panne, donc il est neutre
 * et pas rouge ; le vert est le dernier cas, jamais le premier.
 */
describe('libelleRedis', () => {
  it('⚠️ sonde non revenue → NEUTRE, jamais optimiste', () => {
    const r = libelleRedis(null, 'fr')
    expect(r.ton).toBe('var(--text4)')
    expect(r.texte).toMatch(/vérification/i)
  })

  it('⚠️ `absent` est NEUTRE — une variable non posée est une configuration, pas une panne', () => {
    const r = libelleRedis('absent', 'fr')
    expect(r.ton, 'un déploiement volontairement sans cache ne doit pas rougir').toBe('var(--text4)')
    expect(r.texte).not.toMatch(/panne|erreur|NE répond/i)
  })

  it('`up` est le SEUL cas vert', () => {
    expect(libelleRedis('up', 'fr').ton).toBe('var(--acc2)')
  })

  it('⚠️ `down` ROUGIT, et dit la conséquence — pas seulement l’état', () => {
    const r = libelleRedis('down', 'fr')
    expect(r.ton).toBe('var(--danger)')
    expect(r.texte, 'un état sans conséquence n’oriente pas l’exploitant').toMatch(/démo/i)
  })

  it('⚠️ les quatre états rendent un texte dans les QUATRE langues', () => {
    const etats: (EtatRedis | null)[] = [null, 'absent', 'up', 'down']
    for (const e of etats) {
      for (const l of ['fr', 'en', 'es', 'it'] as const) {
        const t = libelleRedis(e, l).texte
        expect(t.trim().length, `état ${e} vide en ${l}`).toBeGreaterThan(3)
      }
    }
  })

  it('⚠️ et les traductions ne sont pas un copier-coller du français', () => {
    for (const e of ['absent', 'up', 'down'] as const) {
      const fr = libelleRedis(e, 'fr').texte
      for (const l of ['en', 'es', 'it'] as const) {
        expect(libelleRedis(e, l).texte, `état ${e} non traduit en ${l}`).not.toBe(fr)
      }
    }
  })

  it('⚠️ CONTRÔLE POSITIF : les quatre tons sont DISTINCTS deux à deux là où ils doivent l’être', () => {
    // Un verrou qui n'interdit que le vert est satisfait par une pastille éteinte pour
    // toujours. On exige donc que `up` et `down` diffèrent, et que `down` diffère du neutre.
    const up = libelleRedis('up', 'fr').ton
    const down = libelleRedis('down', 'fr').ton
    const neutre = libelleRedis(null, 'fr').ton
    expect(new Set([up, down, neutre]).size).toBe(3)
  })
})
