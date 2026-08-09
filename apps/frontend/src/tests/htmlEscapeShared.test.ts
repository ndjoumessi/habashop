import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { escHtml } from '@/lib/html'

/**
 * JUMEAU — l'échappement HTML doit être IDENTIQUE sur les trois workspaces.
 *
 * ⚠️ Le fixture est lu à l'EXÉCUTION (`readFileSync`), JAMAIS importé. Le contexte
 * de build Docker du backend est `apps/backend` SEUL : `docs/` n'y est pas, donc un
 * `import` de ce JSON compile en local — où le monorepo entier est présent — puis
 * casse le déploiement Railway en TS2307. C'était déjà la convention des 8 autres
 * fixtures partagées ; ce commentaire est là pour qu'on ne la redécouvre pas.
 *
 * ⚠️ Modifier la règle d'un seul côté fait rougir les deux autres. C'est tout
 * l'intérêt : SEPT copies de cette règle coexistaient, et l'une d'elles avait
 * silencieusement perdu l'apostrophe.
 */

const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/html-escape-cases.json'), 'utf8'),
) as { cas: { nom: string; entree: unknown; attendu: string }[] }

describe('escHtml — cas partagés', () => {
  it('le fixture est lu et non vide', () => {
    // ⚠️ COUVERTURE : un chemin cassé rendrait une liste vide, et « 0 cas passent »
    // se lirait comme un succès. Angle mort n°1.
    expect(Array.isArray(FIXTURE.cas)).toBe(true)
    expect(FIXTURE.cas.length).toBeGreaterThanOrEqual(15)
  })

  for (const c of FIXTURE.cas) {
    it(`cas partagé — ${c.nom}`, () => {
      expect(escHtml(c.entree)).toBe(c.attendu)
    })
  }

  it('undefined rend une chaîne vide (JSON ne peut pas porter ce cas)', () => {
    expect(escHtml(undefined)).toBe('')
  })

  it('⚠️ `0` et `false` ne sont PAS avalés — `?? \'\'` et non `|| \'\'`', () => {
    // Un `|| ''` rendrait la chaîne vide sur un montant de 0, donc un document
    // où la valeur zéro disparaît au lieu de s'afficher.
    expect(escHtml(0)).toBe('0')
    expect(escHtml(false)).toBe('false')
  })

  it('⚠️ l’apostrophe rend `&#39;`, PAS `&apos;`', () => {
    // `&apos;` n'est pas une entité HTML 4. `utils/xlsxWriter.ts` l'émet et c'est
    // correct chez LUI : il produit de l'OOXML. Deux langages, deux règles.
    expect(escHtml("'")).toBe('&#39;')
    expect(escHtml("'")).not.toContain('apos')
  })

  it('l’échappement est IDEMPOTENT au sens où il ne se désamorce jamais', () => {
    // Ré-échapper doit produire davantage d'entités, jamais revenir au texte brut :
    // un échappement qui « détecte » du déjà-encodé rouvre le vecteur.
    const une = escHtml('<a>')
    expect(escHtml(une)).toBe('&amp;lt;a&amp;gt;')
    expect(escHtml(une)).not.toContain('<')
  })
})
