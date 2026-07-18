import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ⚠️ MÉTA-TEST « source unique de version » côté MOBILE (jumeau des versionSource.test.ts
// front + back). La version mobile vit dans UN SEUL endroit : `mobile/app.json` (`version`),
// exposée via `Constants.expoConfig.version`. Aucun numéro en dur dans src/ — sinon on
// re-dérive (le repli '1.0.0' du payload notifications affirmait une fausse version).
// ⚠️ Rappel : mobile/app.json est une piste SÉPARÉE du produit web/back (pilote runtimeVersion
// /OTA) — cf. CLAUDE.md ; ce test garde seulement l'absence de littéral, pas l'alignement.

const SRC = join(__dirname, '..') // mobile/src

// Semver entre guillemets ; un suffixe (ex. '0.0.0-unknown') ne matche pas.
const SEMVER_LITERAL = /(['"`])v?\d+\.\d+\.\d+\1/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__') continue // exclut ce méta-test lui-même
      out.push(...walk(p))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

describe('source unique de version (mobile)', () => {
  it('aucun numéro de version en dur dans mobile/src (version = app.json via expoConfig)', () => {
    const offenders = walk(SRC)
      .filter(f => SEMVER_LITERAL.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(SRC, 'src'))
    expect(offenders).toEqual([])
  })

  it('mobile/app.json porte bien un semver (la source mobile est valide)', () => {
    const app = JSON.parse(readFileSync(join(SRC, '../app.json'), 'utf8'))
    expect(app?.expo?.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
