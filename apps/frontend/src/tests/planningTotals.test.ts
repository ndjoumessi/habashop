import { describe, it, expect } from 'vitest'
import { shiftHours, estTravaille, calculerTotaux, formatHeures } from '@/components/planning/planningTotals'
import { SHIFT_TYPES } from '@/components/planning/planningShared'
import type { ShiftType } from '@/components/planning/planningShared'

/**
 * AGRÉGATS DU PLANNING.
 *
 * La grille ne répondait à aucune des deux questions qu'un gérant pose devant un
 * planning — « combien d'heures pour Marie ? », « qui couvre jeudi ? ». Elles se
 * comptaient à l'œil sur 5 employés × 7 jours. Ces deux agrégats les répondent, et
 * c'est ici qu'ils peuvent être FAUX sans que rien ne se voie à l'écran.
 */

describe('shiftHours', () => {
  it('les plages de la journée', () => {
    expect(shiftHours('morning')).toBe(5)    // 08:00-13:00
    expect(shiftHours('afternoon')).toBe(5)  // 13:00-18:00
    expect(shiftHours('full')).toBe(10)      // 08:00-18:00
  })

  it('⚠️ la NUIT franchit minuit — jamais un négatif', () => {
    // `20:00-06:00` : une soustraction naïve rend −14 h, et le total de la semaine
    // deviendrait plus PETIT à mesure qu'on ajoute des nuits.
    expect(shiftHours('night')).toBe(10)
    expect(shiftHours('night')).toBeGreaterThan(0)
  })

  it('⚠️ repos et congé valent ZÉRO — ce sont des absences, pas des durées', () => {
    expect(shiftHours('rest')).toBe(0)
    expect(shiftHours('leave')).toBe(0)
    expect(estTravaille('rest')).toBe(false)
    expect(estTravaille('leave')).toBe(false)
    expect(estTravaille('full')).toBe(true)
  })

  it('couvre TOUS les types déclarés — un type ajouté ne peut pas être oublié', () => {
    const types = Object.keys(SHIFT_TYPES) as ShiftType[]
    expect(types.length).toBeGreaterThanOrEqual(6)
    for (const t of types) {
      const h = shiftHours(t)
      expect(Number.isFinite(h), `${t} rend ${h}`).toBe(true)
      expect(h, `${t} négatif`).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('calculerTotaux', () => {
  const EMP = [{ id: 'a' }, { id: 'b' }]
  const S = (o: Record<string, Record<number, ShiftType[]>>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) =>
      [k, Object.fromEntries(Object.entries(v).map(([d, ts]) => [Number(d), ts.map(type => ({ type }))]))],
    )) as Parameters<typeof calculerTotaux>[1]

  it('somme les heures de la semaine par employé', () => {
    const t = calculerTotaux(EMP, S({ a: { 0: ['full'], 1: ['full'], 2: ['morning'] } }))
    expect(t.heuresParEmploye.a).toBe(25)   // 10 + 10 + 5
    expect(t.heuresParEmploye.b).toBe(0)
  })

  it('⚠️ PLUSIEURS shifts dans une case s’ADDITIONNENT', () => {
    // Le modèle autorise Matin + Après-midi le même jour : prendre le premier
    // rendrait 5 h au lieu de 10, et sous-estimerait la paie planifiée.
    const t = calculerTotaux(EMP, S({ a: { 0: ['morning', 'afternoon'] } }))
    expect(t.heuresParEmploye.a).toBe(10)
  })

  it('⚠️ le TOTAL est la somme des lignes, par construction', () => {
    const t = calculerTotaux(EMP, S({ a: { 0: ['full'] }, b: { 0: ['night'], 3: ['morning'] } }))
    const somme = EMP.reduce((acc, e) => acc + t.heuresParEmploye[e.id], 0)
    expect(t.heuresTotal).toBe(somme)
    expect(t.heuresTotal).toBe(25)
  })

  it('la couverture compte les PERSONNES au travail, pas les shifts', () => {
    const t = calculerTotaux(EMP, S({ a: { 0: ['morning', 'afternoon'] }, b: { 0: ['full'] } }))
    expect(t.couvertureParJour[0], 'deux personnes, trois shifts').toBe(2)
  })

  it('⚠️ repos et congé ne COUVRENT pas', () => {
    // Compter un congé comme une présence ferait croire à un jour couvert, et
    // c'est précisément le jour où la boutique n'a personne.
    const t = calculerTotaux(EMP, S({ a: { 4: ['leave'] }, b: { 4: ['rest'] } }))
    expect(t.couvertureParJour[4]).toBe(0)
    expect(t.heuresParEmploye.a).toBe(0)
  })

  it('⚠️ TROIS ÉTATS : « pas planifié » ≠ « planifié mais découvert »', () => {
    /**
     * Vu en PRODUCTION sur la 2.20.0 : une semaine vierge affichait SEPT zéros ROUGES.
     * Le rouge doit dire « ce jour n'est couvert par personne », pas « vous n'avez pas
     * commencé » — sinon il crie toujours et n'alerte plus quand il devient vrai.
     * `nbAffectations` est ce qui sépare les deux, et c'est ici qu'il peut être faux.
     */
    const vierge = calculerTotaux(EMP, S({}))
    expect(vierge.nbAffectations, 'semaine jamais touchée').toBe(0)

    const planifiee = calculerTotaux(EMP, S({ a: { 0: ['full'] } }))
    expect(planifiee.nbAffectations).toBe(1)
    expect(planifiee.couvertureParJour[3], 'jeudi réellement découvert').toBe(0)
  })

  it('⚠️ poser un CONGÉ compte comme une planification, sans couvrir', () => {
    // Une semaine où le gérant n'a saisi que des congés A ÉTÉ planifiée : afficher
    // « — » y serait faux. Mais le congé ne couvre pas pour autant.
    const t = calculerTotaux(EMP, S({ a: { 2: ['leave'] }, b: { 5: ['rest'] } }))
    expect(t.nbAffectations, 'congé et repos sont des actes de planification').toBe(2)
    expect(t.couvertureParJour[2], 'mais ils ne couvrent personne').toBe(0)
    expect(t.heuresTotal).toBe(0)
  })

  it('plusieurs shifts dans une case comptent chacun', () => {
    expect(calculerTotaux(EMP, S({ a: { 0: ['morning', 'afternoon'] } })).nbAffectations).toBe(2)
  })

  it('semaine vide : que des zéros, aucun NaN', () => {
    const t = calculerTotaux(EMP, S({}))
    expect(t.heuresTotal).toBe(0)
    expect(t.couvertureParJour).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(Number.isNaN(t.heuresTotal)).toBe(false)
  })

  it('aucun employé : la couverture reste un tableau de 7 zéros', () => {
    const t = calculerTotaux([], S({}))
    expect(t.couvertureParJour).toHaveLength(7)
    expect(t.heuresTotal).toBe(0)
  })
})

describe('formatHeures', () => {
  it('⚠️ ZÉRO rend une chaîne VIDE, jamais « 0 h »', () => {
    // Une colonne de « 0 h » sur une semaine non planifiée se lit comme une donnée,
    // alors que c'est l'absence de planning. Même règle que `ratingSummary`.
    expect(formatHeures(0)).toBe('')
    expect(formatHeures(-3)).toBe('')
    expect(formatHeures(Number.NaN)).toBe('')
  })

  it('heures pleines et demies', () => {
    expect(formatHeures(37)).toBe('37 h')
    expect(formatHeures(7.5)).toBe('7 h 30')
    expect(formatHeures(10)).toBe('10 h')
  })
})
