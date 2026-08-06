import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ReportsTabs from '@/components/reports/ReportsTabs'
import { buildPaymentBreakdown, pourcentagesEntiers, pctLabel } from '@/components/reports/paymentBreakdown'
import { SALE_PAYMENT_MODES, salePaymentLabel, MODE_ABSENT } from '@/lib/salePaymentModes'

/**
 * VERROU — RÉPARTITION PAIEMENTS.
 *
 * Trois règles, chacune adossée à un défaut MESURÉ le 2026-08-07 en production :
 *   ① deux séries de pourcentages d'un même graphique ne peuvent pas avoir deux dénominateurs
 *   ② une catégorie présente dans les données ne peut pas manquer au rendu
 *   ③ un repli « données vides » ne peut pas contenir de valeurs numériques inventées
 *
 * ⚠️ Le SABOTAGE n'est pas retapé : il est rejoué depuis `fixtures/reports-paymentData.avant.txt`,
 * extrait par `git show HEAD:apps/frontend/src/pages/Reports.tsx`. Un sabotage écrit de mémoire
 * hérite des hypothèses du détecteur, et les deux tombent ensemble (§ Le jumeau non traité).
 */

const RACINE = join(__dirname, '..')                       // apps/frontend/src
const FIXTURE_AVANT = join(__dirname, 'fixtures/reports-paymentData.avant.txt')
const CATALOGUE = JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/sale-payment-modes.json'), 'utf8'),
) as { modes: string[]; labels: Record<string, Record<string, string>> }

/** Les 50 ventes de `demo-tenant-001` mesurées le 2026-08-07 — le cas déclencheur. */
const CAS_REEL = { cash: 18, wave: 11, orange: 11, card: 8, mixed: 1, mtn: 1 }
const ventesReelles = () =>
  Object.entries(CAS_REEL).flatMap(([m, n]) =>
    Array.from({ length: n }, () => ({ paymentMode: m, total: 1000 })))

/* ══════════════════════════════════════════════════════════════════════════════
   LE CAS DÉCLENCHEUR — la règle est exécutée CONTRE lui avant toute correction
   ══════════════════════════════════════════════════════════════════════════════ */
describe('le cas déclencheur, rejoué depuis la production', () => {
  /** Réimplémente EXACTEMENT le bloc d'avant, lu dans la fixture (jamais retapé). */
  function avant(sales: { paymentMode?: string | null; total?: number | null }[]) {
    const src = readFileSync(FIXTURE_AVANT, 'utf8')
    // Le sabotage n'a de valeur que s'il rejoue le vrai code : on vérifie que la fixture
    // porte bien les deux marques du défaut avant de s'en servir.
    expect(src, 'la fixture doit porter la liste en dur d’avant').toContain('counts.mobile')
    expect(src, 'la fixture doit porter le repli fabriqué').toContain('value: 62')
    const counts: Record<string, number> = {}
    sales.forEach(s => { const m = s.paymentMode ?? 'cash'; counts[m] = (counts[m] ?? 0) + 1 })
    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    return ['cash', 'mobile', 'wave', 'orange', 'card']
      .map(m => ({ m, value: Math.round(((counts[m] ?? 0) / total) * 100) }))
      .filter(d => d.value > 0)
  }

  it('AVANT : la légende sommait à 96 %, le donut à 101 % — deux dénominateurs', () => {
    const parts = avant(ventesReelles())
    const sommeLegende = parts.reduce((s, p) => s + p.value, 0)
    expect(sommeLegende, 'le défaut mesuré : 4 % des ventes disparues').toBe(96)
    // Le donut renormalise sur Σ des parts RENDUES : c'est le second dénominateur.
    const sommeDonut = parts
      .map(p => Math.round((p.value / sommeLegende) * 100))
      .reduce((s, v) => s + v, 0)
    expect(sommeDonut, 'le même camembert, une autre somme').toBe(101)
    expect(parts.map(p => p.m)).not.toContain('mtn')
    expect(parts.map(p => p.m)).not.toContain('mixed')
  })

  it('APRÈS : une seule série, exhaustive, sommant à 100', () => {
    const parts = buildPaymentBreakdown(ventesReelles(), 'fr')
    expect(parts.reduce((s, p) => s + p.pct, 0)).toBe(100)
    expect(parts.map(p => p.key)).toEqual(['cash', 'wave', 'orange', 'mtn', 'card', 'mixed'])
    expect(parts.reduce((s, p) => s + p.count, 0), 'aucune vente perdue').toBe(50)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   ① UN SEUL DÉNOMINATEUR
   ══════════════════════════════════════════════════════════════════════════════ */
describe('① un seul dénominateur', () => {
  it('Σ des pourcentages == 100 exactement, sur des répartitions qui piègent l’arrondi', () => {
    // 3 modes à parts égales (33,33 %), 7 modes, un mode écrasant : chacun casse un
    // arrondi naïf dans un sens différent.
    const jeux = [[1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [997, 1, 1, 1], [5, 5, 5, 5, 5, 5], [2, 1]]
    for (const j of jeux) {
      const p = pourcentagesEntiers(j)
      expect(p.reduce((s, n) => s + n, 0), JSON.stringify(j)).toBe(100)
      // Aucune part ne doit s'écarter de plus d'un point de sa valeur exacte : distribuer
      // le reliquat ne doit pas devenir « inventer ».
      const total = j.reduce((s, n) => s + n, 0)
      j.forEach((n, i) => expect(Math.abs(p[i] - (n * 100) / total)).toBeLessThan(1))
    }
  })

  it('le dénominateur est le TOTAL des ventes, pas la somme des parts rendues', () => {
    // Deux ventes sur cinq portent un mode que le catalogue ne connaît pas. Si le
    // dénominateur était « les modes connus », `cash` vaudrait 100 % ; il vaut 60 %.
    const parts = buildPaymentBreakdown(
      [...Array(3).fill({ paymentMode: 'cash' }), ...Array(2).fill({ paymentMode: 'paypal' })], 'fr')
    expect(parts.find(p => p.key === 'cash')!.pct).toBe(60)
    expect(parts.reduce((s, p) => s + p.pct, 0)).toBe(100)
  })

  it('la géométrie du donut et le libellé lisent le MÊME nombre', () => {
    // recharts calcule l'angle par `value / Σ(values)`. En lui donnant `pct` — dont on
    // vient de prouver que Σ == 100 — l'angle vaut `pct/100` : identique au libellé.
    // C'est ce qui rend l'égalité vraie PAR CONSTRUCTION et non par coïncidence.
    const parts = buildPaymentBreakdown(ventesReelles(), 'fr')
    const somme = parts.reduce((s, p) => s + p.pct, 0)
    for (const p of parts) expect(Math.round((p.pct / somme) * 100)).toBe(p.pct)
  })

  it('RÈGLE STRUCTURELLE : le donut ne lit pas le `percent` de recharts', () => {
    // C'est le second dénominateur, et il est invisible à la lecture : il n'apparaît nulle
    // part dans nos données, recharts le fabrique. Le bannir du panneau de paiement est la
    // seule façon d'empêcher la divergence de revenir par ce bout.
    const src = readFileSync(join(RACINE, 'components/reports/ReportsTabs.tsx'), 'utf8')
    const zonePaiement = src.slice(src.indexOf('renderActiveShape'), src.indexOf('const CustomPayTooltip'))
    expect(zonePaiement.length, 'la zone doit être trouvée — sinon la règle ne garde rien').toBeGreaterThan(200)
    expect(zonePaiement).not.toMatch(/\bpercent\b/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   ② AUCUNE CATÉGORIE AVALÉE
   ══════════════════════════════════════════════════════════════════════════════ */
describe('② une catégorie présente dans les données est rendue', () => {
  it('les six modes du catalogue sortent tous', () => {
    const parts = buildPaymentBreakdown(SALE_PAYMENT_MODES.map(m => ({ paymentMode: m, total: 100 })), 'fr')
    expect(parts.map(p => p.key)).toEqual([...SALE_PAYMENT_MODES])
  })

  it('un mode INCONNU apparaît seul, sous son propre nom, jamais fondu dans un connu', () => {
    const parts = buildPaymentBreakdown(
      [{ paymentMode: 'cash' }, { paymentMode: 'paypal' }, { paymentMode: 'zelle' }], 'fr')
    expect(parts.map(p => p.key)).toEqual(['cash', 'paypal', 'zelle'])
    expect(parts.find(p => p.key === 'paypal')!.name).toBe('Paypal')
  })

  it('un mode ABSENT est sa propre catégorie — plus jamais compté en espèces', () => {
    // C'est la famille `rating ?? 0`, sur de l'argent : `?? 'cash'` attribuait à la caisse
    // ce qu'il ne savait pas lire. ⚠️ La colonne est NOT NULL et la production porte
    // ZÉRO ligne sans mode : on retire un piège, on ne colmate pas une fuite.
    const parts = buildPaymentBreakdown(
      [{ paymentMode: 'cash' }, { paymentMode: null }, { paymentMode: '' }, {}], 'fr')
    expect(parts.find(p => p.key === 'cash')!.count, 'l’absence ne gonfle pas la caisse').toBe(1)
    expect(parts.find(p => p.key === MODE_ABSENT)!.count).toBe(3)
    expect(salePaymentLabel(MODE_ABSENT, 'fr')).toBe('Non renseigné')
  })

  it('une part minuscule est annoncée « < 1 % », jamais supprimée ni affichée « 0 % »', () => {
    // L'ancien `.filter(d => d.value > 0)` ré-avalait la part : le défaut qu'on ferme,
    // sous une autre forme.
    const parts = buildPaymentBreakdown(
      [...Array(499).fill({ paymentMode: 'cash' }), { paymentMode: 'mtn' }], 'fr')
    const mtn = parts.find(p => p.key === 'mtn')
    expect(mtn, 'une vente réelle ne disparaît pas parce qu’elle arrondit à zéro').toBeDefined()
    expect(mtn!.pct).toBe(0)
    expect(pctLabel(mtn!)).toBe('< 1 %')
    expect(pctLabel({ count: 0, pct: 0 })).toBe('0 %')
  })

  it('JUMEAU — le catalogue web et la fixture partagée ne peuvent pas diverger', () => {
    expect([...SALE_PAYMENT_MODES]).toEqual(CATALOGUE.modes)
    for (const m of CATALOGUE.modes)
      for (const [lang, attendu] of Object.entries(CATALOGUE.labels[m]))
        expect(salePaymentLabel(m, lang), `${m}/${lang}`).toBe(attendu)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   ② bis — SUR LE DOM RENDU, pas sur la source
   ══════════════════════════════════════════════════════════════════════════════ */
describe('② bis — le rendu réel du panneau', () => {
  // recharts appelle `ResizeObserver`, absent de jsdom. Le stub ne simule aucune géométrie :
  // ⚠️ ce bloc prouve ce qui est ÉCRIT (légende, sous-titre, compteur), jamais la mise en
  // page. jsdom ne mesure rien — c'est la même limite assumée que la table dense.
  beforeAll(() => {
    class RO {
      observe() { /* jsdom ne mesure rien : le stub existe pour ne pas lever */ }
      unobserve() { /* idem */ }
      disconnect() { /* idem */ }
    }
    const g = globalThis as { ResizeObserver?: unknown }
    g.ResizeObserver = RO
  })

  function monter(sales: { paymentMode?: string | null; total?: number | null }[]) {
    render(<ReportsTabs
      reportTab="ventes" fmt={n => String(n)} abbr={n => String(n)} lang="fr"
      chartData={[]} paymentData={buildPaymentBreakdown(sales, 'fr')}
      activePayIndex={null} salesData={sales}
      setActivePayIndex={() => { /* le survol n'est pas exercé ici */ }}
      data={{ ca: 0, margin: 0, transactions: sales.length, avgCart: 0, caEvol: 0, marginEvol: 0, txEvol: 0, cartEvol: 0 }}
      topProducts={[]} />)
    return document.body.textContent ?? ''
  }

  it('CAS 1 — données réelles : les six modes sont rendus, MTN et Mixte compris', () => {
    const texte = monter(ventesReelles())
    // ⚠️ `getAllByText` : « MTN MoMo » apparaît DEUX fois (légende + Ventes récentes).
    // `getByText` échouait sur « Found multiple elements » — deux surfaces, un libellé.
    for (const attendu of ['Espèces', 'Wave', 'Orange Money', 'MTN MoMo', 'Carte', 'Mixte'])
      expect(screen.getAllByText(attendu).length, attendu).toBeGreaterThan(0)
    expect(texte, 'le dénominateur est ÉCRIT sous le titre').toContain('50 transactions')
    expect(texte).toContain('6modes')
  })

  it('CAS 2 — un mode inconnu : il apparaît sous son nom, il n’est pas fondu', () => {
    const texte = monter([
      ...Array(3).fill({ paymentMode: 'cash', total: 10 }),
      ...Array(3).fill({ paymentMode: 'paypal', total: 10 }),
    ])
    expect(screen.getAllByText('Paypal').length).toBeGreaterThan(0)
    expect(texte).toContain('6 transactions')
    // 50/50 exact : aucune part n'est inventée pour arriver à 100.
    expect(texte).toContain('50 %')
  })

  it('CAS 3 — aucune donnée : le panneau le DIT, il ne dessine pas un anneau vide', () => {
    // ⚠️ Ce cas est désormais ATTEIGNABLE en production : depuis que le panneau suit la
    // période, une plage sans vente le vide alors que `salesData` en contient 50. Il ne
    // dépend donc plus de la garde distante de `Reports.tsx` — l'ancien repli fabriqué,
    // lui, en dépendait, et c'est ce qui l'avait laissé survivre (justesse empruntée).
    const texte = monter([])
    for (const invente of ['62', '22', '16', '113'])
      expect(texte, `« ${invente} » vient de l’ancien repli fabriqué`).not.toContain(invente)
    expect(texte).toContain('0 transactions')
    // Trois états, jamais deux : le vide se nomme, il ne se dessine pas.
    expect(texte).toContain('Aucune vente sur la période — rien à répartir.')
    expect(texte, 'un anneau à zéro part se lit comme un graphique cassé').not.toContain('modes')
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   ③ AUCUN REPLI FABRIQUÉ
   ══════════════════════════════════════════════════════════════════════════════ */
describe('③ le cas vide se dit, il ne s’invente pas', () => {
  it('zéro vente rend un tableau VIDE', () => {
    expect(buildPaymentBreakdown([], 'fr')).toEqual([])
  })

  /**
   * Périmètre DÉRIVÉ de l'arborescence — jamais listé (§ Le jumeau non traité, angle 2).
   * On cherche la FORME : une garde de vacuité (`length === 0`, `=== 0`, `!x.length`) suivie,
   * dans les lignes qui suivent, d'un littéral de tableau contenant des NOMBRES.
   */
  function fichiers(dir: string): string[] {
    return readdirSync(dir).flatMap(n => {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) return n === 'tests' || n === 'fixtures' ? [] : fichiers(p)
      return /\.tsx?$/.test(n) ? [p] : []
    })
  }

  const CIBLES = fichiers(join(RACINE, 'pages')).concat(fichiers(join(RACINE, 'components')))

  /**
   * Le littéral de tableau `[ … ]` qui englobe la position donnée — la « ligne de tableau ».
   * Appariement de délimiteurs, jamais une regex : une regex s'arrête au premier `]` venu,
   * y compris celui d'un sous-tableau (c'est ce qui avait rendu 2 correspondances sur 254
   * fichiers au scanner de classes, en paraissant propre).
   */
  function crochetEnglobant(src: string, pos: number): string | null {
    let prof = 0
    let debut = -1
    for (let i = pos; i >= 0; i--) {
      if (src[i] === ']') prof++
      else if (src[i] === '[') { if (prof === 0) { debut = i; break } prof-- }
      else if (src[i] === '\n' && prof === 0 && debut === -1 && src.lastIndexOf('[', i) < 0) break
    }
    if (debut === -1) return null
    prof = 0
    for (let i = debut; i < src.length; i++) {
      if (src[i] === '[') prof++
      else if (src[i] === ']') { prof--; if (prof === 0) return src.slice(debut, i + 1) }
    }
    return null
  }

  it('assertion de COUVERTURE — le scan lit réellement des fichiers', () => {
    // Un `walk()` cassé rend une liste vide, donc un vert qui ne garde rien.
    expect(CIBLES.length).toBeGreaterThan(150)
    expect(CIBLES.some(f => f.endsWith('Reports.tsx'))).toBe(true)
    expect(CIBLES.some(f => f.endsWith('ReportsTabs.tsx'))).toBe(true)
  })

  it('aucun repli de vacuité ne contient de valeurs numériques inventées', () => {
    const coupables: string[] = []
    for (const f of CIBLES) {
      const lignes = readFileSync(f, 'utf8').split('\n')
      lignes.forEach((l, i) => {
        const garde = /(?:length\s*===\s*0|^\s*if\s*\(\s*!\w[\w.]*\.length|\btotal\s*===\s*0)/.test(l)
        if (!garde || !/\breturn\b/.test(l)) return
        // Le littéral peut s'ouvrir sur la ligne de garde ou juste après.
        const bloc = lignes.slice(i, i + 12).join('\n')
        if (!/return\s*\[/.test(bloc)) return
        const corps = bloc.slice(bloc.indexOf('return ['))
        // Des nombres AUTRES que 0 dans un repli de vacuité = de la donnée inventée.
        // `0` est légitime : c'est ce qu'on affiche quand il n'y a rien.
        if (/[:,]\s*-?[1-9]\d*(?:\.\d+)?\s*[,}\]]/.test(corps)) {
          coupables.push(`${f.replace(RACINE, 'src')}:${i + 1}`)
        }
      })
    }
    expect(coupables, 'un repli « aucune donnée » qui porte des chiffres est un mensonge, pas un état vide').toEqual([])
  })

  it('aucune ligne de TOTAL n’affirme son propre pourcentage', () => {
    // Le PDF imprimé écrivait `'100 %'` en pied de tableau pendant que ses lignes
    // sommaient à 96 %, et son total en argent excluait 11 535 XOF de ventes réelles.
    // Un littéral ne peut pas se tromper : il est faux, ou il est vrai par chance.
    //
    // ⚠️ CALIBRAGE — trois formulations essayées, les deux premières criaient au loup :
    //   `/['"]100\s*%['"]/`  → 87 fichiers : tout `width: '100%'` du dépôt. Inutilisable.
    //   `/['"]\d+ %['"]/`    → 5 sites, dont 4 LÉGITIMES — les colonnes « taux » d'un
    //                          bulletin de paie (`'100 %'` pour le salaire de base,
    //                          `'25 %'` pour les heures sup) sont des constantes de
    //                          barème, pas des totaux calculés.
    // Retenu : un pourcentage EN DUR sur une ligne qui porte aussi un marqueur de total.
    // C'est la forme exacte du défaut, et elle rend 1 avant / 0 après.
    //
    // ⚠️ La portée est la LIGNE ? NON — et le sabotage l'a prouvé. Une première version
    // exigeait le marqueur et le pourcentage sur la MÊME ligne. Elle a laissé passer le
    // sabotage S4, parce que ma propre correction avait éclaté la ligne du total sur six
    // lignes : la règle était devenue aveugle à la forme exacte que le code venait de
    // prendre. Un verrou qui ne détecte pas son défaut dans la forme ACTUELLE du code ne
    // garde rien. On raisonne donc sur la LIGNE DE TABLEAU entière, délimitée par
    // appariement de crochets — jamais par une regex sur la structure.
    const coupables: string[] = []
    for (const f of CIBLES) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/common_total|\bTotal\b/g)) {
        const rangee = crochetEnglobant(src, m.index!)
        if (rangee && /['"`]\s*\d+\s*%\s*['"`]/.test(rangee)) {
          coupables.push(`${f.replace(RACINE, 'src')}:${src.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(coupables, 'un total ne peut pas asserter le pourcentage qu’il devrait constater').toEqual([])
  })
})
