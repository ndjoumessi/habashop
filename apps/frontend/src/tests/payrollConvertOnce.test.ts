import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { payrollDisplay, payrollBreakdown } from '@/components/payroll/payrollShared'

/**
 * ⚠️ « CONVERTIR UNE FOIS » devient une convention EXÉCUTÉE, pas un accident par surface.
 *
 * Historique mesuré, en trois temps :
 *  1. chaque surface convertissait elle-même depuis XOF → lignes et total ne s'additionnaient
 *     pas en devise à décimales (69,36 vs 69,37) ;
 *  2. `payrollDisplay` a corrigé les surfaces de la page Paie… et a introduit une DOUBLE
 *     conversion dans le PDF de l'onglet RH, qui recevait désormais des montants déjà
 *     convertis et les repassait dans `fmt`. Sur 280 000 XOF en EUR : **NET 0,57 € au lieu de
 *     371,37 €** ;
 *  3. d'où ce méta-test. Une correction surface par surface produit exactement ce genre de
 *     régression : le trou se déplace au lieu de se fermer.
 *
 * Même patron que `csvInjection.test.ts` : on scanne le CODE réellement exécuté (commentaires
 * et imports retirés), on cible les SITES, et on exerce des sabotages en contre-preuve.
 */

// ── Le calcul : une seule source ─────────────────────────────────────────────
const RACINE = join(__dirname, '..')
const SOURCE = join('components', 'payroll', 'payrollShared.tsx')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'tests' || e === '__tests__' || e === 'dist') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** Retire commentaires ET imports : ce qui reste est du code exécuté. */
function codeSeul(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:/])\/\/.*$/gm, '$1')
    .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
}

/** Convertisseurs et formateurs-qui-convertissent : interdits dans une surface de paie. */
const CONVERTISSEURS = /\buseFormatAmount\b|\bformatAmount\s*\(|\bconvertFromXOF\s*\(|\bconvertAmount\s*\(|\buseConvertFromXOF\b/

/** Arithmétique de taux locale : interdite partout hors de la source. */
const TAUX_EN_DUR = /\*\s*0\.0[58]\b|\*\s*0\.8[27]\b|\*\s*0\.9[02]\b|\*\s*0\.056\b/

/** Une surface de PAIE = un fichier qui consomme le détail de paie. */
const CONSOMME_PAIE = /\bpayrollDisplay\s*\(|\bpayrollBreakdown\s*\(|\bfmtDisplay\s*\(/

/**
 * ⚠️ RÈGLE POSITIVE — celle qui MANQUAIT, et pourquoi le verrou a laissé passer un bug à 656×.
 *
 * Les 4 règles précédentes sont toutes NÉGATIVES : « ne convertis pas ici », « n'utilise pas
 * ça », « pas de taux en dur ». Elles attrapent la conversion EN TROP. Aucune n'exigeait de
 * convertir AU MOINS UNE FOIS. La cellule BRUT de la Grille rendait donc
 * `fmt(brut)` avec `brut = Number(emp.salary) || 0` (XOF brut) et `fmt` = un formateur qui NE
 * convertit pas : **ZÉRO conversion**, Marie affichée « 280 000,00 € » au lieu de « 426,86 € ».
 * Les 4 règles étaient vertes — aucun jeton interdit n'apparaissait.
 *
 * Autre part du diagnostic : le scan raisonnait par FICHIER (« contient-il un jeton interdit ? »)
 * pour une propriété qui est par CELLULE (« ce montant vient-il du bon endroit ? »). Exactement
 * la même erreur de maille que la première version du verrou `sanitizeCsv`.
 *
 * D'où cette règle : dans une surface de paie, un montant d'origine XOF ne doit JAMAIS
 * atteindre un formateur. On suit le flux syntaxiquement, ce qui suffit à fermer la classe.
 */

/** Expressions dont on SAIT qu'elles portent des XOF bruts (jamais converties). */
const SOURCE_XOF = /\b(?:emp|e|record|r|selectedContract)\.(?:salary|baseSalary|bonus|overtime|deductions)\b|\bbonuses\s*\[|\bsalaryXOF\b/

/** Producteurs de montants d'AFFICHAGE : `payrollDisplay` et tout wrapper local qui l'appelle. */
function producteurs(code: string): string[] {
  const noms = ['payrollDisplay']
  // `const empBreakdown = (…) => payrollDisplay(…)` → wrapper local, donc producteur.
  for (const m of code.matchAll(/\b(?:const|function)\s+(\w+)\s*=?[^\n]*\n?[^\n]*payrollDisplay\s*\(/g)) {
    if (m[1] && !noms.includes(m[1])) noms.push(m[1])
  }
  return noms
}

/** Locaux TEINTÉS XOF : assignés depuis une source XOF SANS passer par un producteur. */
function locauxTeintes(code: string): string[] {
  const prod = producteurs(code)
  const out: string[] = []
  for (const m of code.matchAll(/\bconst\s+(\w+)\s*=\s*([^\n]+)/g)) {
    const [, nom, init] = m
    if (!SOURCE_XOF.test(init)) continue
    if (prod.some(p => init.includes(p + '('))) continue  // passe par un producteur → sain
    out.push(nom)
  }
  return out
}

/**
 * Montants XOF qui atteignent un formateur. Rend la liste des appels fautifs.
 * Formateurs reconnus : `fmt(`, `fmtDisplay(`, `f(` — les trois noms employés dans le dépôt.
 */
function xofVersFormateur(code: string): string[] {
  const teintes = locauxTeintes(code)
  const fautifs: string[] = []
  const prod = producteurs(code)
  for (const m of code.matchAll(/\b(?:fmt|fmtDisplay|f)\s*\(\s*([^),]+)/g)) {
    const arg = m[1].trim()
    // ⚠️ Un argument qui APPELLE lui-même un producteur est sain : `fmtDisplay(payrollDisplay(
    // { baseSalary: salaryXOF … }).net)` mentionne `salaryXOF` mais le convertit bien. Sans
    // cette exclusion le verrou criait au loup sur `NewContractModal` — et un verrou qui crie
    // au loup se fait désarmer.
    if (prod.some(pr => arg.includes(pr + '('))) continue
    const racine = (/^[A-Za-z_$][\w$]*/.exec(arg) ?? [''])[0]
    if (SOURCE_XOF.test(arg) || (racine && teintes.includes(racine))) fautifs.push(m[0])
  }
  return fautifs
}

const fichiers = walk(RACINE)
const horsSource = fichiers.filter(f => !f.endsWith(SOURCE))

describe('méta-test — tout montant de paie passe par `payrollDisplay`', () => {
  const surfaces = horsSource.filter(f => CONSOMME_PAIE.test(codeSeul(readFileSync(f, 'utf8'))))

  it('le scan couvre des fichiers ET trouve des surfaces (un walk cassé rendrait VERT)', () => {
    expect(fichiers.length).toBeGreaterThan(50)
    expect(surfaces.length).toBeGreaterThanOrEqual(6)
  })

  it('aucune surface de paie ne CONVERTIT elle-même (conversion = une fois, dans payrollDisplay)', () => {
    const fautifs = surfaces
      .filter(f => CONVERTISSEURS.test(codeSeul(readFileSync(f, 'utf8'))))
      .map(f => f.replace(RACINE, '.'))
    expect(`surfaces de paie qui convertissent hors payrollDisplay :\n${fautifs.join('\n')}`)
      .toBe('surfaces de paie qui convertissent hors payrollDisplay :\n')
  })

  it('`payrollBreakdown` (montants XOF) n’est plus utilisé pour AFFICHER — seul `payrollDisplay` l’est', () => {
    // `payrollBreakdown` reste la brique interne de `payrollShared` et sert aux tests, mais
    // une surface qui l'appelle affiche des XOF bruts dans une devise à décimales.
    const fautifs = horsSource
      .filter(f => /\bpayrollBreakdown\s*\(/.test(codeSeul(readFileSync(f, 'utf8'))))
      .map(f => f.replace(RACINE, '.'))
    expect(`surfaces utilisant payrollBreakdown au lieu de payrollDisplay :\n${fautifs.join('\n')}`)
      .toBe('surfaces utilisant payrollBreakdown au lieu de payrollDisplay :\n')
  })

  it('aucun taux de paie en dur hors de la source unique', () => {
    const fautifs = horsSource
      .filter(f => TAUX_EN_DUR.test(codeSeul(readFileSync(f, 'utf8'))))
      .map(f => f.replace(RACINE, '.'))
    // Le seuil d'écart de caisse du POS (`expectedCash * 0.05`) n'est PAS un taux de paie :
    // il n'apparaît que dans un fichier qui ne consomme pas le détail de paie, donc il n'est
    // pas concerné — mais on le tolère explicitement pour que le verrou ne crie pas au loup.
    const paie = fautifs.filter(f => !f.includes(join('components', 'pos')))
    expect(`taux de paie en dur hors payrollShared :\n${paie.join('\n')}`)
      .toBe('taux de paie en dur hors payrollShared :\n')
  })

  it('UN SEUL générateur de bulletin (le template RH dupliqué est supprimé)', () => {
    // ⚠️ Détecteur RESSERRÉ. Une première version cherchait `NET À PAYER` — elle rougissait
    // sur l'i18n, `POSModals` et `posTicket` (tickets de caisse : autres documents, légitimes).
    // Un verrou qui crie au loup se fait désarmer. Critère précis : un fichier qui CONSOMME le
    // détail de paie ET ouvre un document. Il n'en existe qu'un, et il vit dans la source.
    const generateurs = horsSource
      .filter(f => {
        const c = codeSeul(readFileSync(f, 'utf8'))
        return CONSOMME_PAIE.test(c) && /win\.document\.write|\bopenPDF\s*\(/.test(c)
      })
      .map(f => f.replace(RACINE, '.'))
    expect(`générateurs de bulletin hors payrollShared :\n${generateurs.join('\n')}`)
      .toBe('générateurs de bulletin hors payrollShared :\n')
  })

  it('aucun formateur INJECTÉ PAR PROP dans une surface de paie (R1 était aveugle)', () => {
    // ⚠️ R1 cherche le jeton `useFormatAmount` DANS le fichier. Un composant qui reçoit `fmt`
    // en PROP convertit tout autant, sans jamais nommer le hook — R1 ne le voyait pas. C'est
    // par là que `ContractDetailModal` affichait son brut via un second chemin de conversion.
    // Règle : une surface de paie n'appelle `fmt(` que si elle le définit localement comme
    // alias de `fmtDisplay`.
    const fautifs = surfaces.filter(f => {
      const c = codeSeul(readFileSync(f, 'utf8'))
      if (!/\bfmt\s*\(/.test(c)) return false
      return !/\bconst\s+fmt\s*=[^\n]*fmtDisplay/.test(c)
    }).map(f => f.replace(RACINE, '.'))
    expect(`surfaces de paie appelant un \`fmt\` non-local :\n${fautifs.join('\n')}`)
      .toBe('surfaces de paie appelant un `fmt` non-local :\n')
  })

  it('RÈGLE POSITIVE — aucun montant XOF n’atteint un formateur (ZÉRO conversion interdit)', () => {
    const fautifs: string[] = []
    for (const f of surfaces) {
      const appels = xofVersFormateur(codeSeul(readFileSync(f, 'utf8')))
      for (const a of appels) fautifs.push(`${f.replace(RACINE, '.')} → ${a}`)
    }
    expect(`montants XOF passés à un formateur :\n${fautifs.join('\n')}`)
      .toBe('montants XOF passés à un formateur :\n')
  })

  // ── CONTRE-PREUVE : le détecteur rougit-il vraiment ? ──────────────────────
  const SURFACE = "const d = payrollDisplay(r, currency)\n"

  it('SAIN : surface qui n’utilise que payrollDisplay + fmtDisplay → vert', () => {
    const src = `import { payrollDisplay, fmtDisplay } from './payrollShared'\n${SURFACE}const x = fmtDisplay(d.net, currency)`
    const c = codeSeul(src)
    expect(CONSOMME_PAIE.test(c)).toBe(true)
    expect(CONVERTISSEURS.test(c)).toBe(false)
  })

  it('SABOTAGE 1 — la surface reconvertit via useFormatAmount → rouge', () => {
    const src = `import { payrollDisplay } from './payrollShared'\nimport { useFormatAmount } from '@/stores/appStore'\n${SURFACE}const fmt = useFormatAmount()\nconst x = fmt(d.net)`
    const c = codeSeul(src)
    expect(CONVERTISSEURS.test(c)).toBe(true)
  })

  it('SABOTAGE 2 — la surface reconvertit via formatAmount / convertFromXOF → rouge', () => {
    for (const appel of ['formatAmount(d.net, currency)', 'convertFromXOF(d.net, currency)', 'convertAmount(d.net, "XOF", currency)']) {
      expect(CONVERTISSEURS.test(codeSeul(`${SURFACE}const x = ${appel}`)), appel).toBe(true)
    }
  })

  it('SABOTAGE 3 — un import CONSERVÉ sans appel ne suffit pas à faire rougir (pas de faux positif)', () => {
    // Le scan retire les imports : mentionner `formatAmount` dans un import sans l'appeler
    // n'est pas une conversion. Un verrou qui crie au loup se fait désarmer.
    const src = `import { formatAmount } from '@/stores/appStore'\n${SURFACE}const x = fmtDisplay(d.net, currency)`
    expect(CONVERTISSEURS.test(codeSeul(src))).toBe(false)
  })

  it('SABOTAGE 4 — la garde en COMMENTAIRE seul ne compte pas', () => {
    const src = `// on passe bien par payrollDisplay, promis\nconst fmt = useFormatAmount()\nconst x = fmt(cnssXof)`
    const c = codeSeul(src)
    expect(CONSOMME_PAIE.test(c)).toBe(false)   // le commentaire ne fait pas une surface
    expect(CONVERTISSEURS.test(c)).toBe(true)   // …mais la conversion est bien vue
  })

  it('SABOTAGE 5 — taux recodé en dur → rouge', () => {
    expect(TAUX_EN_DUR.test(codeSeul('const cnss = Math.round(brut * 0.08)'))).toBe(true)
    expect(TAUX_EN_DUR.test(codeSeul('const net = Math.round(brut * 0.87)'))).toBe(true)
    expect(TAUX_EN_DUR.test(codeSeul('const cnss = Math.round(brut * CNSS_RATE)'))).toBe(false)
  })
})

// ── CAS DORÉS : la même valeur sur CHAQUE surface ───────────────────────────
describe('cas doré Marie — 280 000 XOF, boutique EUR', () => {
  const ENTREE = { baseSalary: 280000, bonus: 0, overtime: 0, deductions: 0, absences: 0 }

  it('brut 426,86 · CNSS 34,15 · IR 21,34 · total 55,49 · NET 371,37', () => {
    const d = payrollDisplay(ENTREE, 'EUR')
    expect(d.brut).toBe(426.86)
    expect(d.cnss).toBe(34.15)
    expect(d.ir).toBe(21.34)
    expect(d.totalDeductions).toBe(55.49)
    expect(d.net).toBe(371.37)
  })

  it('les lignes s’additionnent : CNSS + IR == total, et brut − total == net', () => {
    const d = payrollDisplay(ENTREE, 'EUR')
    // ⚠️ On arrondit la somme AVANT de comparer : 34,15 + 21,34 vaut 55,489999999999995 en
    // IEEE754. C'est précisément pour ça que `payrollDisplay` arrondit son total au lieu de
    // laisser l'addition brute — sinon le bulletin afficherait des artefacts flottants.
    const r2 = (x: number) => Math.round(x * 100) / 100
    expect(r2(d.cnss + d.ir)).toBe(d.totalDeductions)
    expect(r2(d.brut - d.totalDeductions)).toBe(d.net)
  })

  it('⚠️ une DOUBLE conversion donnerait 0,57 € — le bug réel du PDF RH', () => {
    const d = payrollDisplay(ENTREE, 'EUR')
    const reconverti = Math.round((d.net / 655.957) * 100) / 100
    expect(reconverti).toBe(0.57)
    expect(reconverti).not.toBe(d.net)
  })

  it('colonne BRUT de la Grille == brut CONVERTI (426,86), jamais le XOF nu', () => {
    const d = payrollDisplay(ENTREE, 'EUR')
    expect(d.baseSalary).toBe(426.86)
    // ⚠️ Contre-exemple figé : la cellule rendait le XOF NU (280 000) formaté en EUR — 656× la
    // valeur réelle. Un salaire de 426,86 € affiché « 280 000,00 € ».
    expect(d.baseSalary).not.toBe(280000)
    expect(Math.round(280000 / d.baseSalary)).toBe(656)
  })

  it('somme de la colonne BRUT == total affiché (une colonne doit sommer à son pied)', () => {
    // Trois employés : la Grille agrège employé par employé, jamais un pourcentage sur la masse.
    const equipe = [280000, 350000, 150000]
    const lignes = equipe.map(sal => payrollDisplay({ baseSalary: sal, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'EUR'))
    const r2 = (x: number) => Math.round(x * 100) / 100
    const totalColonne = lignes.reduce((a, l) => r2(a + l.baseSalary), 0)
    const totalNet     = lignes.reduce((a, l) => r2(a + l.net), 0)
    // Valeurs MESURÉES, pas calculées à la main : 280 000 → 371,37 · 350 000 → 464,20 ·
    // 150 000 → 198,95 (j'avais écrit 198,94 de tête, le test l'a démenti).
    expect(lignes.map(l => l.baseSalary)).toEqual([426.86, 533.57, 228.67])
    expect(lignes.map(l => l.net)).toEqual([371.37, 464.20, 198.95])
    expect(totalColonne).toBe(1189.10)
    expect(totalNet).toBe(1034.52)
  })

  /**
   * ⚠️ ANCRAGE EXPLICITE de 150 000 XOF → 198,95 €.
   *
   * J'avais écrit **198,94** de tête en rédigeant le cas doré ; le test a rendu 198,95 et m'a
   * démenti. Le chiffre est donc figé ICI, seul, avec son contre-exemple — pour qu'une future
   * relecture qui « corrige » 198,95 en 198,94 (le nombre qui circule dans les commits et la
   * doc de ce chantier) casse immédiatement.
   *
   * Détail : brut 228,67 − (CNSS 18,29 + IR 11,43 = 29,72) = 198,95.
   */
  it('ANCRE — 150 000 XOF/EUR donne 198,95 (et NON 198,94, mon calcul de tête était faux)', () => {
    const d = payrollDisplay({ baseSalary: 150000, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'EUR')
    expect(d.brut).toBe(228.67)
    expect(d.cnss).toBe(18.29)
    expect(d.ir).toBe(11.43)
    expect(d.totalDeductions).toBe(29.72)
    expect(d.net).toBe(198.95)
    expect(d.net).not.toBe(198.94)
  })

  it('en XOF le détail reste entier et égal au calcul (aucune conversion)', () => {
    const d = payrollDisplay(ENTREE, 'XOF')
    const bd = payrollBreakdown(ENTREE)
    expect(d.net).toBe(bd.net)
    expect(d.net).toBe(243600)
  })
})

/**
 * ⚠️ CAS DORÉ EN XOF — la devise de BASE, celle de la majorité des boutiques.
 *
 * Le pendant indispensable du cas doré EUR : c'est ici que la plupart des tenants vivent, et
 * c'est justement parce que XOF n'a pas de décimale que tous les défauts de conversion y sont
 * INVISIBLES (0 conversion, 1 conversion, 2 conversions donnent le même affichage à l'unité
 * quand le taux vaut 1). Un jeu de cas EUR seul laisserait donc croire qu'on couvre la paie
 * alors qu'on ne couvre que le cas rare.
 *
 * Valeurs MESURÉES, pas calculées à la main.
 */
describe('cas doré XOF — devise de base, 0 décimale, aucune conversion', () => {
  const EQUIPE = [280000, 350000, 150000]

  it.each([
    [280000, 22400, 14000, 36400, 243600],
    [350000, 28000, 17500, 45500, 304500],
    [150000, 12000, 7500, 19500, 130500],
  ])('base %i → CNSS %i · IR %i · total %i · NET %i', (base, cnss, ir, total, net) => {
    const d = payrollDisplay({ baseSalary: base, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'XOF')
    expect(d.brut).toBe(base)
    expect(d.cnss).toBe(cnss)
    expect(d.ir).toBe(ir)
    expect(d.totalDeductions).toBe(total)
    expect(d.net).toBe(net)
  })

  it('tout est ENTIER — aucune décimale ne doit apparaître en XOF', () => {
    for (const base of EQUIPE) {
      const d = payrollDisplay({ baseSalary: base, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'XOF')
      for (const [k, v] of Object.entries(d)) expect(Number.isInteger(v), `${k}=${v}`).toBe(true)
    }
  })

  it('la colonne somme à son pied : 780 000 brut · 678 600 net', () => {
    const lignes = EQUIPE.map(b => payrollDisplay({ baseSalary: b, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'XOF'))
    expect(lignes.reduce((a, l) => a + l.brut, 0)).toBe(780000)
    expect(lignes.reduce((a, l) => a + l.net, 0)).toBe(678600)
  })

  it('salaire XOF FRACTIONNAIRE → arrondi à l’unité (rend `CURRENCY_DECIMALS` load-bearing)', () => {
    // ⚠️ Ce cas existe parce qu'un sabotage l'a exigé : forcer `dec = 2` au lieu de lire
    // `CURRENCY_DECIMALS` ne cassait AUCUN test — tous mes cas XOF utilisaient des salaires
    // ENTIERS, où arrondir à 2 décimales est un no-op. Or `Employee.salary` est un `Float` en
    // base : un salaire fractionnaire est stockable, et le XOF n'a pas de subdivision.
    const d = payrollDisplay({ baseSalary: 280000.5, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'XOF')
    expect(Number.isInteger(d.brut)).toBe(true)
    expect(d.brut).toBe(280001)
    expect(d.brut).not.toBe(280000.5)   // un centime de franc CFA n'existe pas
    for (const [k, v] of Object.entries(d)) expect(Number.isInteger(v), `${k}=${v}`).toBe(true)
  })

  it('⚠️ XOF est le cas où une erreur de conversion NE SE VOIT PAS — d’où le jumeau EUR', () => {
    // Le taux XOF→XOF vaut 1 : convertir 0, 1 ou 2 fois donne le même nombre. Le bug à 656×
    // de la Grille était donc totalement invisible pour un tenant XOF. C'est la raison d'être
    // du cas doré EUR : sans lui, la suite serait verte en laissant passer le défaut.
    const brutXofNu = 280000
    const d = payrollDisplay({ baseSalary: brutXofNu, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'XOF')
    expect(d.brut).toBe(brutXofNu)          // indistinguable d'un XOF non converti
    const eur = payrollDisplay({ baseSalary: brutXofNu, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'EUR')
    expect(eur.brut).not.toBe(brutXofNu)    // …alors qu'en EUR l'écart saute aux yeux
    expect(eur.brut).toBe(426.86)
  })
})
