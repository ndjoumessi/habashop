import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * MÉTA-TEST — verrouille la convention d'écriture d'audit.
 *
 * Le défaut d'origine n'était pas un site isolé mais une CONVENTION : 19 écritures
 * sur 22 avalaient l'échec par `.catch(() => {})`. Un audit qui rate en silence
 * est pire que pas d'audit — on croit la trace complète alors que le trou est
 * invisible. Ce test empêche la convention de revenir.
 *
 * Trois règles, et la distinction qui les sépare :
 *   `prisma.auditLog.create` → hors transaction → DOIT passer par `writeAudit()`
 *                              (fail-open mais tracé : l'action utilisateur réussit)
 *   `tx.auditLog.create`     → DANS une transaction → NE DOIT PAS être enveloppé
 *                              (l'échec doit faire échouer la transaction — atomicité)
 *
 * ⚠️ Comme tout verrou du repo, il doit être vérifié DANS LES DEUX SENS : remettre
 * un `.catch(() => {})` sur un site hors transaction, ou envelopper un site
 * transactionnel, doit le faire tomber.
 */

const SRC = join(__dirname, '..')

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry !== 'tests' && entry !== 'node_modules') sourceFiles(p, acc)
    } else if (entry.endsWith('.ts')) {
      acc.push(p)
    }
  }
  return acc
}

interface Site { file: string; line: number; text: string; ctx: string }

function collect(pattern: RegExp): Site[] {
  const out: Site[] = []
  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((text, i) => {
      if (pattern.test(text)) {
        // `ctx` = l'INSTRUCTION d'audit seule, bornée à sa ligne de fermeture
        // (`})` en tête de ligne). Une fenêtre de N lignes attraperait le
        // `.catch(() => {})` d'un appel voisin sans rapport (invalidateTenantCache,
        // envoi d'e-mail…) et rendrait le verrou faussement rouge.
        let end = i
        while (end < lines.length - 1 && !/^\s*\}\)/.test(lines[end + 1])) end++
        out.push({
          file: file.slice(SRC.length + 1),
          line: i + 1,
          text: text.trim(),
          ctx: lines.slice(i, end + 2).join('\n'),
        })
      }
    })
  }
  return out
}

describe('Convention d’écriture d’audit (méta-test)', () => {
  // ── Règle 1 : hors transaction, l'échec ne doit JAMAIS être avalé ──
  it('aucune écriture AuditLog hors transaction n’avale son échec', () => {
    const swallowed = collect(/prisma\.auditLog\.create/)
      .filter(s => /\.catch\(\(\) => \{\}\)/.test(s.ctx))
      .map(s => `${s.file}:${s.line}`)

    expect(swallowed, `Écriture(s) d'audit dont l'échec est silencieux — utiliser writeAudit() :\n  ${swallowed.join('\n  ')}`)
      .toEqual([])
  })

  it('toute écriture AuditLog hors transaction passe par writeAudit()', () => {
    const unwrapped = collect(/prisma\.auditLog\.create/)
      .filter(s => !s.text.includes('writeAudit('))
      .map(s => `${s.file}:${s.line} → ${s.text.slice(0, 60)}`)

    expect(unwrapped, `Écriture(s) d'audit non enveloppée(s) par writeAudit() :\n  ${unwrapped.join('\n  ')}`)
      .toEqual([])
  })

  // ── Règle 2 : les sites transactionnels restent intacts ──
  it('les 3 sites en $transaction ne sont PAS enveloppés (atomicité)', () => {
    const txSites = collect(/tx\.auditLog\.create/)

    // Le compte et les fichiers sont figés : ajouter un site transactionnel sans y
    // penser doit forcer une relecture de cette règle, pas passer inaperçu.
    // On pin le FICHIER, pas le numéro de ligne — un test qui casse au moindre
    // décalage de lignes finit par être neutralisé plutôt que lu.
    expect(txSites.map(s => s.file).sort()).toEqual([
      'routes/sales.ts',
      'services/accountDeletion.ts',
      'services/accountDeletion.ts',
    ])

    const wrapped = txSites.filter(s => s.text.includes('writeAudit(')).map(s => `${s.file}:${s.line}`)
    expect(wrapped, `Site(s) transactionnel(s) enveloppé(s) par writeAudit() — l'échec doit rester ATOMIQUE :\n  ${wrapped.join('\n  ')}`)
      .toEqual([])
  })

  // ── Règle 3 : la lecture ne ment pas ──
  it('GET /api/audit-logs ne renvoie plus [] sur erreur', () => {
    const src = readFileSync(join(SRC, 'routes/analytics.ts'), 'utf8')
    const start = src.indexOf("app.get('/api/audit-logs'")
    expect(start, 'route /api/audit-logs introuvable').toBeGreaterThan(-1)
    const handler = src.slice(start, start + 900)

    expect(
      /catch[\s\S]{0,200}?return \[\]/.test(handler),
      'Le handler renvoie [] sur erreur : un journal d’audit qui affiche « rien » AFFIRME qu’il ne s’est rien passé.',
    ).toBe(false)
  })
})
