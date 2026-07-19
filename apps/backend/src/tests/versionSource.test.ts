import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getAppVersion } from '../lib/version'

// ⚠️ MÉTA-TEST « source unique de version » (même principe que le méta-test des quiet
// zones). La version PRODUIT vit dans UN SEUL endroit : le package.json RACINE, lue au
// boot par `getAppVersion()`. Ce test échoue si un numéro en dur (semver entre guillemets)
// réapparaît dans src/ → empêche le retour des « /health 2.1.0 · /docs 2.0.0 » divergents.
// Pour renvoyer une version : `getAppVersion()`, jamais un littéral.

const SRC = join(process.cwd(), 'src')
const ROOT_PKG = JSON.parse(readFileSync(join(process.cwd(), '../../package.json'), 'utf8'))

// Semver entre guillemets ; un suffixe (ex. '0.0.0-unknown', repli de version.ts) ne matche pas.
const SEMVER_LITERAL = /(['"`])v?\d+\.\d+\.\d+\1/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === 'tests') continue // exclut ce méta-test lui-même
      out.push(...walk(p))
    } else if (/\.ts$/.test(entry) && entry !== 'version.generated.ts') {
      // version.generated.ts = version BAKÉE au build (source légitime) → hors scan.
      out.push(p)
    }
  }
  return out
}

describe('source unique de version (backend)', () => {
  it('aucun numéro de version en dur dans src/ (hors getAppVersion)', () => {
    const offenders = walk(SRC)
      .filter(f => SEMVER_LITERAL.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(process.cwd(), '.'))
    expect(offenders, `Version en dur détectée — utiliser getAppVersion() :\n${offenders.join('\n')}`).toEqual([])
  })

  it('getAppVersion() = version du package.json racine (source unique)', () => {
    expect(getAppVersion()).toBe(ROOT_PKG.version)
  })
})
