import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANS, YEARLY_MONTHS } from '@/lib/plans'

/**
 * LES DEUX CGU DISENT LA MÊME CHOSE — `legal/terms.html` ↔ `pages/Terms.tsx`.
 *
 * ── Pourquoi ce jumeau existe ────────────────────────────────────────────────────────
 * `legal/` est le domicile public des documents légaux, servi par GitHub Pages et
 * atteignable SANS l'application. Il proposait la politique de confidentialité mais pas les
 * conditions générales : asymétrie mesurée le 2026-08-15 (`legal/index.html` ne les citait
 * nulle part). La page statique a donc été créée — et un jumeau non gardé est une dette.
 *
 * ── Pourquoi ce verrou est OBLIGATOIRE ───────────────────────────────────────────────
 * Deux documents qui disent la même chose divergent. Ce n'est pas une crainte théorique :
 * ça a DÉJÀ eu lieu dans ce dossier — `privacy-policy.html` déclarait « Éditeur : HabaShop »
 * quand la page in-app déclarait « Nelson Djoumessi », et personne ne l'a vu pendant des
 * mois. Aucun test de rendu, aucune vérification d'artefact ne couvre `legal/` : ces pages
 * sortent du bundle React et sont publiées par un workflow séparé.
 *
 * ⚠️ CE QUI EST COMPARÉ, ET POURQUOI CES TROIS AXES :
 *   1. les INTITULÉS d'articles — un article ajouté d'un seul côté crée deux contrats ;
 *   2. les TARIFS — la version React les LIT dans `lib/plans.ts`, la version HTML ne peut
 *      pas ; c'est le point qui dérivera en premier, donc on le confronte à la SOURCE ;
 *   3. les LIMITES annoncées (art. 3.1) — ce sont elles qui protègent d'une réclamation,
 *      et ce sont les premières qu'on est tenté d'alléger sur la page vitrine.
 *
 * ⚠️ On ne compare PAS le texte mot à mot : le HTML et le JSX n'ont ni la même ponctuation
 * d'échappement ni les mêmes retours à la ligne, et un verrou qui rougit sur un
 * reformatage se fait désarmer. On compare ce qui ENGAGE.
 */

const RACINE = join(__dirname, '..', '..', '..', '..')
const HTML = readFileSync(join(RACINE, 'legal', 'terms.html'), 'utf8')
const TSX = readFileSync(join(RACINE, 'apps', 'frontend', 'src', 'pages', 'Terms.tsx'), 'utf8')

/** Texte débarrassé des commentaires — sinon le verrou lit ses propres explications. */
const nu = (t: string) =>
  t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const HTML_NU = nu(HTML)
const TSX_NU = nu(TSX)

/** Intitulés d'articles, dans l'ordre. */
const titresHtml = [...HTML_NU.matchAll(/<h2>([^<]+)<\/h2>/g)].map(m => m[1].trim())
const titresTsx = [...TSX_NU.matchAll(/<h2>([^<]+)<\/h2>/g)].map(m => m[1].trim())

describe('CGU — les deux versions engagent la même chose', () => {
  it('COUVERTURE — les deux documents ont bien été lus', () => {
    // Un chemin renommé rendrait des listes vides, et « les listes sont égales » serait
    // vrai sur le néant : c'est la vérité vacante.
    expect(HTML.length).toBeGreaterThan(4000)
    expect(TSX.length).toBeGreaterThan(4000)
    expect(titresHtml.length).toBeGreaterThanOrEqual(15)
  })

  it('les MÊMES articles, dans le MÊME ordre', () => {
    expect(titresHtml).toEqual(titresTsx)
  })

  it('⚠️ les tarifs de la page statique sont ceux de `lib/plans.ts`', () => {
    // C'est le point qui dérivera en premier : la version React LIT la source unique, la
    // page HTML ne peut pas. On confronte donc la copie à l'original, pas les deux copies.
    const fr = (n: number) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')
    const manquants: string[] = []
    for (const p of PLANS) {
      if (p.monthly === null) {
        if (!new RegExp(`${p.label}[^<]*</strong>[^<]*devis`, 'i').test(HTML_NU)) manquants.push(`${p.label} (devis)`)
        continue
      }
      for (const v of [p.monthly, p.yearly as number]) {
        if (!HTML_NU.includes(`${fr(v)} FCFA`)) manquants.push(`${p.label} ${fr(v)} FCFA`)
      }
    }
    expect(manquants).toEqual([])
    expect(HTML_NU).toContain(`facturé ${YEARLY_MONTHS} mois`)
  })

  it('⚠️ les LIMITES de l’article 3.1 sont dans les deux versions', () => {
    // Ce sont elles qui protègent d'une réclamation. Ce sont aussi les premières qu'on est
    // tenté d'alléger « pour la vitrine ».
    const LIMITES = [
      'Aucun encaissement en ligne n',      // …'est opérationnel
      'La caisse web exige une connexion',
      'application mobile n',                // …'est pas publiée
    ]
    for (const l of LIMITES) {
      expect({ l, html: HTML_NU.includes(l), tsx: TSX_NU.includes(l) })
        .toEqual({ l, html: true, tsx: true })
    }
  })

  it('l’avis de validation juridique figure des deux côtés', () => {
    // Retirer l'avis d'un seul côté ferait passer un brouillon pour un document abouti.
    for (const [nomDoc, src] of [['html', HTML_NU], ['tsx', TSX_NU]] as const) {
      expect({ nomDoc, avis: /validation juridique/i.test(src) }).toEqual({ nomDoc, avis: true })
    }
  })

  it('les mentions À COMPLÉTER sont en même NOMBRE des deux côtés', () => {
    // Une mention comblée d'un seul côté ferait croire le document plus avancé qu'il ne
    // l'est sur l'autre surface.
    //
    // ⚠️ ON COMPTE LES MARQUEURS RENDUS, PAS LE LITTÉRAL. Première version fausse, et le
    // test l'a dit : côté React le texte « À COMPLÉTER » est écrit UNE fois — dans le
    // composant `AC` — et rendu SEPT. Compter la chaîne dans la source donnait 1 contre 7.
    // C'est le même travers que les scanneurs de cet audit : présumer que ce qu'on lit dans
    // le fichier est ce que le lecteur voit.
    const marqueursHtml = (HTML_NU.match(/class="ac"/g) || []).length
    const marqueursTsx = (TSX_NU.match(/<AC>/g) || []).length
    expect({ html: marqueursHtml, tsx: marqueursTsx })
      .toEqual({ html: marqueursTsx, tsx: marqueursTsx })
    expect(marqueursTsx).toBeGreaterThan(4)
  })

  it('`legal/index.html` propose bien les trois documents', () => {
    // L'asymétrie d'origine était là : l'index ne citait pas les CGU.
    const idx = nu(readFileSync(join(RACINE, 'legal', 'index.html'), 'utf8'))
    for (const f of ['privacy-policy.html', 'terms.html', 'account-deletion.html']) {
      expect({ f, cite: idx.includes(`href="${f}"`) }).toEqual({ f, cite: true })
    }
  })

  it('DISCRIMINANT — le lecteur d’intitulés sait vraiment lire', () => {
    // Sans ce cas, une regex cassée rendrait deux listes VIDES, donc « égales ».
    expect(titresTsx).toContain('14. Droit applicable et litiges')
    expect([...nu('<h2>A</h2><h2>B</h2>').matchAll(/<h2>([^<]+)<\/h2>/g)].map(m => m[1]))
      .toEqual(['A', 'B'])
  })
})
