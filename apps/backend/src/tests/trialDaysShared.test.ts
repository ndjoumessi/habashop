import { describe, it, expect } from 'vitest'
import { joursDEssaiRestants } from '../lib/trialDays'

/**
 * JOURS D'ESSAI RESTANTS — la règle vit ICI, et nulle part ailleurs.
 *
 * ⚠️ Ces cas ont vécu quelques heures dans `docs/shared-fixtures/trial-days-left.json`,
 * jumelés avec un module frontend. Le jumeau a été SUPPRIMÉ : le front lit désormais le
 * `trialDaysLeft` que cette règle produit, via `stores/billingStore.ts`. Un fichier rangé
 * sous « shared-fixtures » avec un seul consommateur annoncerait une anti-dérive qui
 * n'existe plus — les cas sont donc revenus auprès de la règle qu'ils gardent.
 */
const CAS: { nom: string; trialEnds: string | null; now: string; attendu: number }[] = [
  { nom: "quatorze jours pleins", trialEnds: "2026-10-15T12:00:00.000Z", now: '2026-10-01T12:00:00.000Z', attendu: 14 },
  { nom: "sept jours — la démo jetable", trialEnds: "2026-10-08T12:00:00.000Z", now: '2026-10-01T12:00:00.000Z', attendu: 7 },
  { nom: "un plan annuel activé repousse l'échéance", trialEnds: "2027-10-01T12:00:00.000Z", now: '2026-10-01T12:00:00.000Z', attendu: 365 },
  { nom: "quelques heures restantes → le jour entamé compte", trialEnds: "2026-10-01T23:00:00.000Z", now: '2026-10-01T12:00:00.000Z', attendu: 1 },
  { nom: "échéance atteinte à la seconde près", trialEnds: "2026-10-01T12:00:00.000Z", now: '2026-10-01T12:00:00.000Z', attendu: 0 },
  { nom: "échéance DÉPASSÉE — jamais un nombre négatif", trialEnds: "2026-09-20T12:00:00.000Z", now: '2026-10-01T12:00:00.000Z', attendu: 0 },
  { nom: "aucune échéance posée → zéro, pas quatorze", trialEnds: null, now: '2026-10-01T12:00:00.000Z', attendu: 0 },
  { nom: "échéance illisible → zéro, jamais NaN", trialEnds: "pas-une-date", now: '2026-10-01T12:00:00.000Z', attendu: 0 },
]

describe('joursDEssaiRestants', () => {
  it('les cas sont bien là', () => {
    expect(CAS.length).toBeGreaterThanOrEqual(8)
  })
  for (const c of CAS) {
    it(c.nom, () => {
      expect(joursDEssaiRestants(c.trialEnds, new Date(c.now))).toBe(c.attendu)
    })
  }
})
