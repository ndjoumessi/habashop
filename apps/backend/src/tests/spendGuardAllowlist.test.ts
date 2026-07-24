import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * MÉTA-TEST — liste blanche des SDK qui coûtent de l'argent.
 *
 * Même principe que le méta-test semver et celui des quiet zones : il échoue si un
 * fichier de `src/` instancie Twilio ou Anthropic ailleurs que dans les clients gardés.
 * Sans ce verrou, le prochain handler court-circuite le goulot et la garde redevient
 * partielle — c'est exactement ainsi que le reçu automatique de vente (`POST /api/sales`)
 * et les crons 20h/8h avaient échappé aux gardes posées route par route.
 *
 * ⚠️ Ce que ce test prouve, et ce qu'il NE prouve PAS : il garantit que le SDK n'est
 * atteignable que par le wrapper. Il ne garantit PAS que le wrapper est appelé avec le
 * bon `tenantId` — un handler qui passerait un tenantId erroné resterait vert. D'où les
 * tests de chemin réel (spendGuardPaths.test.ts) en complément.
 */

const SRC = join(__dirname, '..')

// Seuls modules autorisés à toucher les SDK facturés.
const ALLOWLIST = [
  'lib/spend/twilioClient.ts',
  'lib/spend/anthropicClient.ts',
  'lib/spend/resendClient.ts',
  'lib/spend/smsClient.ts',
]

const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: "import du SDK Twilio",    re: /(^|[^\w])(?:import\s+[\w{},\s*]*\s+from\s+['"]twilio['"]|require\(\s*['"]twilio['"]\s*\))/m },
  { label: "import du SDK Anthropic", re: /(?:import\s+[\w{},\s*]*\s+from\s+['"]@anthropic-ai\/sdk['"]|require\(\s*['"]@anthropic-ai\/sdk['"]\s*\))/m },
  { label: "instanciation Anthropic", re: /new\s+Anthropic\s*\(/ },
  { label: "appel twilio(...)",       re: /(^|[^.\w])twilio\s*\(/m },
  { label: "import du SDK Resend",    re: /(?:import\s+[\w{},\s*]*\s+from\s+['"]resend['"]|require\(\s*['"]resend['"]\s*\))/m },
  { label: "instanciation Resend",    re: /new\s+Resend\s*\(/ },
  { label: "import du SDK Africa's Talking", re: /(?:import\s+[\w{},\s*]*\s+from\s+['"]africastalking['"]|require\(\s*['"]africastalking['"]\s*\))/m },
]

/** `import type` ne tire aucun code à l'exécution → toléré (typage seul). */
const TYPE_ONLY = /import\s+type\s+[\w{},\s*]*\s+from\s+['"]@anthropic-ai\/sdk['"]/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return entry === 'tests' ? [] : walk(full)
    return /\.ts$/.test(full) && !/\.test\.ts$/.test(full) ? [full] : []
  })
}

describe('Méta-test — accès aux SDK facturés confiné aux clients gardés', () => {
  const files = walk(SRC)

  it('trouve bien des fichiers à scanner (le test ne passe pas à vide)', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('aucun accès direct à Twilio ou Anthropic hors de la liste blanche', () => {
    const offenders: string[] = []

    for (const file of files) {
      const rel = relative(SRC, file).split('\\').join('/')
      if (ALLOWLIST.includes(rel)) continue

      let content = readFileSync(file, 'utf8')
      content = content.replace(TYPE_ONLY, '') // les imports de types ne dépensent rien

      for (const { label, re } of FORBIDDEN) {
        if (re.test(content)) offenders.push(`${rel} — ${label}`)
      }
    }

    expect(
      offenders,
      `Accès direct à un SDK facturé hors des clients gardés :\n  ${offenders.join('\n  ')}\n\n` +
      `Toute dépense doit passer par lib/spend/twilioClient.ts ou lib/spend/anthropicClient.ts, ` +
      `qui résolvent démo/statut/quota depuis le tenantId (y compris hors requête HTTP : crons, ` +
      `reçu automatique de vente).`,
    ).toEqual([])
  })

  it('la liste blanche pointe des fichiers qui existent réellement', () => {
    for (const rel of ALLOWLIST) {
      expect(() => statSync(join(SRC, rel)), `${rel} introuvable`).not.toThrow()
    }
  })

  it('le scan détecterait effectivement une violation (contre-preuve)', () => {
    // Sans cette contre-preuve, une regex cassée rendrait le méta-test vert à jamais.
    const sample = "import twilio from 'twilio'\nconst c = twilio(a, b)\n"
    expect(FORBIDDEN.some(f => f.re.test(sample))).toBe(true)
    const sample2 = "import Anthropic from '@anthropic-ai/sdk'\nnew Anthropic({ apiKey })\n"
    expect(FORBIDDEN.some(f => f.re.test(sample2))).toBe(true)
    const sample3 = "import { Resend } from 'resend'\nconst r = new Resend(key)\n"
    expect(FORBIDDEN.some(f => f.re.test(sample3))).toBe(true)
    const sample4 = "import AfricasTalking from 'africastalking'\nconst c = AfricasTalking({ apiKey, username })\n"
    expect(FORBIDDEN.some(f => f.re.test(sample4))).toBe(true)
  })
})
