import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { sanitizeCsv } from '@/lib/csv'

/**
 * ⚠️ INJECTION CSV — moitié FRONTEND d'un test JUMEAU (#173).
 *
 * L'autre côté exerce le MÊME fichier de cas. Modifier la règle ici sans l'autre fait rougir
 * l'autre — c'est la convention anti-dérive du dépôt (`barcode-cases`, `loyalty-discount-cases`).
 *
 * ⚠️ Le second bloc est un MÉTA-TEST : il rend la convention EXÉCUTOIRE. Avant, `sanitizeCsv`
 * vivait en `const` locale dans un seul fichier ; CLAUDE.md l'annonçait comme une règle
 * backend, mais rien ne l'appliquait — et `export.ts` ne l'appelait pas. Une convention qu'on
 * ne peut pas enfreindre bruyamment n'est pas une convention.
 */

const CAS = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'csv-injection-cases.json'), 'utf-8',
)) as { cas: Array<{ entree: string; attendu: string; pourquoi: string }> }

describe('sanitizeCsv — cas partagés', () => {
  it('le fichier de cas est chargé (sinon les `it.each` seraient vides et VERTS)', () => {
    expect(CAS.cas.length).toBeGreaterThanOrEqual(10)
    // Contre-preuve : le jeu contient bien des cas NEUTRES, pas que des attaques — un garde
    // qui préfixerait tout abîmerait chaque export.
    expect(CAS.cas.some(c => c.entree === c.attendu)).toBe(true)
  })

  it.each(CAS.cas.map(c => [c.pourquoi, c.entree, c.attendu] as const))(
    '%s', (_pourquoi, entree, attendu) => {
      expect(sanitizeCsv(entree)).toBe(attendu)
    },
  )

  it('valeurs non-chaînes : jamais « undefined » ni « null » écrits dans une cellule', () => {
    expect(sanitizeCsv(undefined)).toBe('')
    expect(sanitizeCsv(null)).toBe('')
    expect(sanitizeCsv(0)).toBe('0')
    // ⚠️ Un négatif NU n'est plus préfixé : il ne s'exécute pas, et le préfixe le sortait du
    // domaine numérique du tableur (ni somme ni tri). La frontière est dans les cas partagés.
    expect(sanitizeCsv(-5)).toBe('-5')
    expect(sanitizeCsv('-5+1')).toBe("'-5+1")
  })
})

// ── LE MÉTA-TEST : la convention devient EXÉCUTOIRE ───────────────────────────
//
// ⚠️ Il raisonne par SITE D'ÉCRITURE, pas par FICHIER. La première version raisonnait par
// fichier et c'est MESURÉ qu'elle laissait passer un trou : `utils/export.ts` contient DEUX
// producteurs de CSV — `exportCSV` (gardé) et `exportAccountingExcel` (nu, malgré son nom il
// n'écrit pas de .xlsx). Le fichier mentionnait `sanitizeCsv` pour le premier, donc il
// passait, pendant que le libellé de dépense saisi par le commerçant partait non neutralisé.
// Un verrou à la maille du fichier est aveugle au second producteur.
const RACINE = join(__dirname, '..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '__tests__' || e === 'tests' || e === 'dist') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/**
 * Retire commentaires ET imports : ce qui reste est du code RÉELLEMENT exécuté.
 * ⚠️ Sans ça le verrou se ferait berner deux fois — par un commentaire qui MENTIONNE
 * `sanitizeCsv`, et par un `import` resté en place alors que l'APPEL a disparu (mesuré sur
 * ce dépôt : la suite restait verte). Les deux cas sont exercés en contre-preuve plus bas.
 */
function codeSeul(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')                                 // commentaires de bloc
    .replace(/(^|[^:/])\/\/.*$/gm, '$1')                              // de ligne (épargne `https://`)
    .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '') // imports
}

/**
 * Un site d'ÉCRITURE de CSV — l'octet qui part vers l'utilisateur : `new Blob(…, 'text/csv')`
 * côté front, en-tête `Content-Type: text/csv` côté back. On remonte ensuite le code qui
 * PRÉCÈDE ce site (depuis le site précédent) : c'est là que ses cellules sont assemblées.
 */
const SITE_ECRITURE = /text\/csv/g

/** Rend, pour chaque site d'écriture du source, si ses cellules sont gardées. */
function auditerSource(src: string): boolean[] {
  const code = codeSeul(src)
  const out: boolean[] = []
  let precedent = 0
  for (const m of code.matchAll(SITE_ECRITURE)) {
    out.push(/sanitizeCsv/.test(code.slice(precedent, m.index)))
    precedent = m.index
  }
  return out
}

describe('méta-test — tout producteur de CSV passe par le sanitizer', () => {
  const fichiers = walk(RACINE)
  const sites = fichiers.flatMap(f =>
    auditerSource(readFileSync(f, 'utf8')).map((garde, n) => ({ f: f.replace(RACINE, '.'), n, garde })),
  )

  it('le scan couvre bien des fichiers ET trouve des sites (un walk cassé rendrait VERT)', () => {
    expect(fichiers.length).toBeGreaterThan(20)
    expect(sites.length).toBeGreaterThan(0)
  })

  it('chaque site d’écriture est précédé d’un appel à `sanitizeCsv`', () => {
    const nus = sites.filter(s => !s.garde).map(s => `${s.f} (site #${s.n + 1})`)
    expect(`sites d'écriture CSV non gardés :\n${nus.join('\n')}`)
      .toBe("sites d'écriture CSV non gardés :\n")
  })

  it('`sanitizeCsv` n’est plus DÉFINI ailleurs que dans lib/csv (plus de const locale)', () => {
    const definitions = fichiers
      .filter(f => !f.endsWith(join('lib', 'csv.ts')))
      .filter(f => /const\s+sanitizeCsv\s*=|function\s+sanitizeCsv\s*\(/.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(RACINE, '.'))
    expect(`définitions hors lib/csv :\n${definitions.join('\n')}`)
      .toBe('définitions hors lib/csv :\n')
  })

  // ── CONTRE-PREUVE : le détecteur rougit-il vraiment ? ────────────────────────
  // Un verrou qu'on n'a pas vu échouer ne garde rien. On lui soumet les sabotages exacts qui
  // ont piégé les versions précédentes, plutôt que d'affirmer qu'il les attraperait.
  const ECRITURE = `new Blob([csv], { type: 'text/csv;charset=utf-8;' })`
  const IMPORT = `import { sanitizeCsv } from '../lib/csv'\n`

  it('SAIN : cellules passées au garde → vert', () => {
    expect(auditerSource(`${IMPORT}const csv = rows.map(r => r.map(sanitizeCsv).join(';'))\n${ECRITURE}`))
      .toEqual([true])
  })

  it('SABOTAGE 1 — appel retiré, import CONSERVÉ → rouge', () => {
    expect(auditerSource(`${IMPORT}const csv = rows.map(r => r.join(';'))\n${ECRITURE}`))
      .toEqual([false])
  })

  it('SABOTAGE 2 — la garde n’existe qu’en COMMENTAIRE → rouge', () => {
    expect(auditerSource(`// tout passe par sanitizeCsv, promis\nconst csv = rows.join(';')\n${ECRITURE}`))
      .toEqual([false])
    expect(auditerSource(`/* garde: sanitizeCsv */\nconst csv = rows.join(';')\n${ECRITURE}`))
      .toEqual([false])
  })

  it('SABOTAGE 3 — DEUXIÈME producteur du même fichier laissé nu → rouge (le trou réel)', () => {
    const src = `${IMPORT}const a = rows.map(r => r.map(sanitizeCsv).join(';'))\n${ECRITURE}\n`
      + `const b = rows.map(r => r.join(';'))\n${ECRITURE}`
    expect(auditerSource(src)).toEqual([true, false])
  })
})
