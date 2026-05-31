import { describe, it, expect } from 'vitest'
import { toInputDate, displayDate, calcAnciennete, calcHeures, calcPonctualite } from '@/components/hr/hrShared'

// Logique métier HR pure (hrShared) — verrouille le comportement après la découpe HR.
// Paie (calcNet/calcBrut/payrollBreakdown, buildMonths/monthLabel) déjà couverte par
// payroll-calc.test.ts + payroll-months.test.ts → ici : DATES/CONTRATS + PRÉSENCES.

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

// ─── PRÉSENCES : agrégation heures / ponctualité ──────────────────────────────
// ⚠️ NOTE (documentée) : calcHeures/calcPonctualite lisent la fixture STATIQUE POINTAGE
// (par index 1-6), pas des données de présence réelles → valeurs de démo. Voir RAPPORT.
describe('calcHeures — agrégation des heures travaillées (arrivée→départ)', () => {
  it('somme la semaine de l\'employé 1 = 43h36', () => {
    // 538 + 547 + 445 + 541 + 545 = 2616 min = 43h36 (jours repos ignorés)
    expect(calcHeures(1)).toBe('43h36')
  })
  it('minutes < 10 → zéro-paddées (emp 2 = 55h05)', () => {
    // 600+595+610+600+600+300 = 3305 min = 55h05 → vérifie le padStart(2,"0") des minutes
    expect(calcHeures(2)).toBe('55h05')
  })
  it('jours sans arrivée/départ (congé/repos) ignorés → emp 5 (tout congé) = 0h', () => {
    expect(calcHeures(5)).toBe('0h')
  })
  it('employé inconnu → 0h (POINTAGE absent)', () => {
    expect(calcHeures(999)).toBe('0h')
  })
})

describe('calcPonctualite — % de ponctualité (present/retard comptés, absent non)', () => {
  it('aucun absent → 100 % (emp 1)', () => {
    expect(calcPonctualite(1)).toBe(100)
  })
  it('1 absent sur 5 jours travaillés → 80 % (emp 3)', () => {
    expect(calcPonctualite(3)).toBe(80)
  })
  it('aucun jour travaillé (tout congé/repos) → 100 % par défaut (emp 5)', () => {
    expect(calcPonctualite(5)).toBe(100)
  })
})
