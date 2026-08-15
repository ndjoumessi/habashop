import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * PAS DE GLYPHE-FLÈCHE EN GUISE D'ICÔNE — Lucide, et rien d'autre.
 *
 * ── Ce que le glyphe coûtait, MESURÉ le 2026-08-15 sur /signup (page publique) ──────────
 * Le texte ACCESSIBLE du bouton pays valait « 🇨🇲Cameroun▼ ». Un lecteur d'écran annonçait
 * donc « Cameroun, black down-pointing triangle » : le caractère fait partie du contenu
 * textuel du bouton, il n'est pas décoratif. Après conversion en `<ChevronDown aria-hidden>`,
 * le texte accessible vaut « 🇨🇲Cameroun ». Hauteur du bouton inchangée (50 px), décentrage
 * du chevron 0 avant comme après — la correction ne déplace rien.
 *
 * ── Les quatre sites corrigés ──────────────────────────────────────────────────────────
 *   `PhoneInput` · `POSModals` · `SignupStep1`  → chevrons de menu déroulant (`▼`)
 *   `MarkdownRenderer`                          → puce de liste (`▶`), annoncée sur CHAQUE
 *                                                 ligne d'une réponse de l'assistant
 *
 * ⚠️ CE VERROU NE VISE QUE LES GLYPHES EMPLOYÉS COMME ICÔNES. Les émojis produit
 * (`StockForm.image`), les drapeaux de pays et les émojis de données ne sont PAS concernés :
 * ce sont des DONNÉES saisies ou affichées, pas des affordances d'interface. Élargir ferait
 * crier le garde sur du contenu légitime, et un garde qui crie au loup se fait désarmer.
 */

const SRC = join(__dirname, '..')

/** Triangles et flèches pleines employés comme icônes d'interface. */
const GLYPHES = ['▼', '▲', '►', '◄', '▶', '◀', '△', '▽', '➤', '⯆', '⌄', '⌃']

/**
 * EXEMPTIONS NOMMÉES, une par une, avec leur raison — jamais un motif.
 *
 * `ExpensesBudget` : `prefix: budgetLeft >= 0 ? '▲ +' : '▼ -'` est un PRÉFIXE DE DONNÉE
 * concaténé dans une chaîne affichée (le sens d'un écart budgétaire), pas une icône
 * d'interface. Le convertir demanderait de restructurer le rendu de la ligne, et c'est une
 * décision distincte : faut-il exprimer une direction par une icône ? Non tranchée ici.
 */
const EXEMPTS: Record<string, string> = {
  'components/expenses/ExpensesBudget.tsx': 'préfixe de donnée (sens d’un écart), pas une icône',
}

function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests') fichiersTsx(p, acc) }
    else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

const FICHIERS = fichiersTsx(SRC)

describe('glyphes-flèches — Lucide, et rien d’autre', () => {
  it('COUVERTURE — le balayage lit bien src/', () => {
    // Un walk() cassé rendrait une liste vide, donc « 0 fautif » sur du néant.
    expect(FICHIERS.length).toBeGreaterThan(150)
  })

  it('aucun glyphe-flèche hors exemption nommée', () => {
    const fautifs: string[] = []
    for (const f of FICHIERS) {
      const rel = f.replace(SRC + '/', '')
      if (rel in EXEMPTS) continue
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        for (const g of GLYPHES) if (l.includes(g)) fautifs.push(`${rel}:${i + 1} → ${g}`)
      })
    }
    expect([...new Set(fautifs)]).toEqual([])
  })

  it('DISCRIMINANT — le scan SAIT trouver un glyphe là où il en reste un', () => {
    // Sans ce cas, un tableau `GLYPHES` vidé ou une comparaison cassée rendrait « 0 fautif »
    // et se lirait comme une victoire. On exige que l'exempté soit RÉELLEMENT détectable.
    const exempt = Object.keys(EXEMPTS)[0]
    const txt = readFileSync(join(SRC, exempt), 'utf8')
    expect(GLYPHES.some(g => txt.includes(g))).toBe(true)
  })

  it('chaque exemption porte une raison, et le fichier existe', () => {
    // Une exemption sur un fichier disparu est un trou qui ne se voit plus.
    for (const [f, raison] of Object.entries(EXEMPTS)) {
      expect({ f, existe: FICHIERS.some(x => x.endsWith(f)) }).toEqual({ f, existe: true })
      expect(raison.length).toBeGreaterThan(20)
    }
  })

  it('les quatre sites corrigés utilisent bien Lucide, et le chevron est DÉCORATIF', () => {
    // ⚠️ Sans `aria-hidden`, on remplacerait un glyphe annoncé par une image annoncée : le
    // défaut d'origine — du bruit dans le nom accessible du bouton — survivrait au correctif.
    const attendus: [string, string][] = [
      ['components/ui/PhoneInput.tsx', 'ChevronDown'],
      ['components/pos/POSModals.tsx', 'ChevronDown'],
      ['components/signup/SignupStep1.tsx', 'ChevronDown'],
      ['components/ui/MarkdownRenderer.tsx', 'ChevronRight'],
    ]
    for (const [f, icone] of attendus) {
      const txt = readFileSync(join(SRC, f), 'utf8')
      const ok = new RegExp(`<${icone}[^>]*aria-hidden`).test(txt)
      expect({ f, lucideDecoratif: ok }).toEqual({ f, lucideDecoratif: true })
      expect({ f, importe: new RegExp(`\\b${icone}\\b[^\\n]*lucide-react|lucide-react[^\\n]*\\b${icone}\\b`).test(txt) })
        .toEqual({ f, importe: true })
    }
  })
})
