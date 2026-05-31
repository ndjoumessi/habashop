import { describe, it, expect } from 'vitest'
import { toInputDate, displayDate, calcAnciennete, eachDateInclusive } from '@/components/hr/hrShared'

// Logique métier HR pure (hrShared) — verrouille le comportement après la découpe HR.
// Paie (calcNet/calcBrut/payrollBreakdown, buildMonths/monthLabel) déjà couverte par
// payroll-calc.test.ts + payroll-months.test.ts → ici : DATES/CONTRATS.

// ─── CONTRATS : cohérence des dates ───────────────────────────────────────────
describe('toInputDate — normalisation de date (entrée formulaires contrat)', () => {
  it('ISO (YYYY-MM-DD[T…]) → tronqué à 10 caractères', () => {
    expect(toInputDate('2026-05-18')).toBe('2026-05-18')
    expect(toInputDate('2026-05-18T09:30:00.000Z')).toBe('2026-05-18')
  })
  it('format FR JJ/MM/AAAA → ISO', () => {
    expect(toInputDate('18/05/2026')).toBe('2026-05-18')
  })
  it('vide / null / undefined / non-date → chaîne vide', () => {
    expect(toInputDate('')).toBe('')
    expect(toInputDate(null)).toBe('')
    expect(toInputDate(undefined)).toBe('')
    expect(toInputDate('pas une date')).toBe('')
  })
})

describe('displayDate — affichage localisé', () => {
  it('vide / null → "—"', () => {
    expect(displayDate('')).toBe('—')
    expect(displayDate(null)).toBe('—')
  })
  it('date valide → motif JJ/MM/AAAA (fr-FR) — assertion tolérante au fuseau', () => {
    // new Date('YYYY-MM-DD') = minuit UTC ; le jour exact dépend du TZ de la machine,
    // donc on vérifie le MOTIF + l'année, pas le jour précis.
    expect(displayDate('2026-05-18', 'fr-FR')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    expect(displayDate('2026-05-18', 'fr-FR')).toContain('2026')
  })
})

describe('calcAnciennete — ancienneté contrat', () => {
  // Bug corrigé : la date de référence ("aujourd'hui") est désormais INJECTABLE (3e param,
  // défaut new Date()). On l'injecte ici (NOW figé) → tests déterministes sans dépendre
  // d'une date codée en dur dans la fonction ni de la date système réelle.
  const NOW = new Date('2026-05-18')
  it('≥ 1 an → "N ans [M mois]" (fr)', () => {
    expect(calcAnciennete('2024-05-18', 'fr', NOW)).toBe('2 ans') // 730 j / 30 ≈ 24 mois
  })
  it('< 1 an → "N mois"', () => {
    expect(calcAnciennete('2026-04-01', 'fr', NOW)).toBe('1 mois') // 47 j / 30 = 1
  })
  it('embauche dans le futur (réf.) → "—"', () => {
    expect(calcAnciennete('2027-01-01', 'fr', NOW)).toBe('—')
  })
  it('date vide → "—"', () => {
    expect(calcAnciennete('', 'fr', NOW)).toBe('—')
  })
  it('i18n en/es/it', () => {
    expect(calcAnciennete('2024-05-18', 'en', NOW)).toBe('2y')
    expect(calcAnciennete('2026-04-01', 'es', NOW)).toBe('1 mes')
    expect(calcAnciennete('2026-04-01', 'it', NOW)).toBe('1 mese')
  })
  it('par défaut (sans now) utilise la date du jour → ancienneté qui avance (≥ 1 an pour 2 ans en arrière)', () => {
    // embauche il y a ~2 ans relativement à aujourd'hui → contient "an" (fr), prouve que la réf. n'est plus figée
    const twoYearsAgo = new Date(); twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    expect(calcAnciennete(twoYearsAgo.toISOString().slice(0, 10))).toMatch(/an/)
  })
})

// (calcHeures/calcPonctualite + fixture POINTAGE supprimés en Phase 3 : code orphelin,
//  jamais branché à l'UI ; les présences réelles passent par l'API Attendance.)

// ─── eachDateInclusive : report congé approuvé → jours Attendance LEAVE (Phase 4) ──────
describe('eachDateInclusive', () => {
  it('intervalle multi-jours INCLUS (3 jours)', () => {
    expect(eachDateInclusive('2026-06-01', '2026-06-03')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
  it('un seul jour → [ce jour]', () => {
    expect(eachDateInclusive('2026-06-10', '2026-06-10')).toEqual(['2026-06-10'])
  })
  it('traverse une fin de mois (sans dérive UTC)', () => {
    expect(eachDateInclusive('2026-05-30', '2026-06-01')).toEqual(['2026-05-30', '2026-05-31', '2026-06-01'])
  })
  it('to < from ou date invalide → []', () => {
    expect(eachDateInclusive('2026-06-03', '2026-06-01')).toEqual([])
    expect(eachDateInclusive('', '2026-06-01')).toEqual([])
    expect(eachDateInclusive('03/06/2026', '2026-06-01')).toEqual([])
  })
})
