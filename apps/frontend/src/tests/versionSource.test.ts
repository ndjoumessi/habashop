import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ⚠️ MÉTA-TEST « source unique de version » (même principe que le méta-test des quiet
// zones du code-barres). La version PRODUIT vit dans UN SEUL endroit : le package.json
// RACINE du monorepo, injectée au build (`__APP_VERSION__`). Ce test échoue si un numéro
// de version en dur (semver entre guillemets) réapparaît dans src/ → empêche la dérive
// « six versions différentes » de revenir. Pour afficher la version : utiliser
// `__APP_VERSION__` (brut) ou `__BUILD_SHORT__` (v<version> · JJ/MM), jamais un littéral.

const SRC = join(process.cwd(), 'src')
const ROOT_PKG = JSON.parse(readFileSync(join(process.cwd(), '../../package.json'), 'utf8'))

// Semver entre guillemets simples/doubles/backtick (ex. '2.6.0', "v1.0.0", `2.0.0`).
// Un tiret/suffixe après (ex. '0.0.0-unknown') ne matche pas → replis non-semver tolérés.
const SEMVER_LITERAL = /(['"`])v?\d+\.\d+\.\d+\1/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === 'tests') continue // exclut ce méta-test lui-même (contient des exemples)
      out.push(...walk(p))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

describe('source unique de version (frontend)', () => {
  it('aucun numéro de version en dur dans src/ (hors injection __APP_VERSION__)', () => {
    const offenders = walk(SRC)
      .filter(f => SEMVER_LITERAL.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(process.cwd(), '.'))
    expect(offenders, `Version en dur détectée — utiliser __APP_VERSION__ / __BUILD_SHORT__ :\n${offenders.join('\n')}`).toEqual([])
  })

  it('__APP_VERSION__ (injectée au build) = version du package.json racine', () => {
    // Prouve que l'injection pointe bien vers la SOURCE UNIQUE (racine), pas apps/frontend.
    expect(__APP_VERSION__).toBe(ROOT_PKG.version)
  })
})
