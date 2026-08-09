import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * CONVENTION EXÉCUTOIRE — une seule règle d'échappement HTML, dans `lib/html.ts`.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * La convention était ÉCRITE (`CLAUDE.md` § Facture PDF : « toute donnée dynamique
 * par escHtml() ») et applicable NULLE PART : `escHtml` vivait en `function` locale
 * dans deux fichiers, non exportée. MESURÉ le 2026-08-09 : **SEPT** implémentations
 * indépendantes sur les trois workspaces, dont une DIVERGENTE — `CustomerMap.tsx`
 * couvrait `& < > "` mais pas l'apostrophe, celle qui sort d'un attribut en
 * guillemets simples. Et `routes/export.ts` n'échappait rien du tout.
 *
 * Exactement `sanitizeCsv` avant #173. *Un garde qu'on ne peut ni importer ni
 * enfreindre bruyamment est un vœu* — c'est ce fichier qui en fait une règle.
 *
 * ⚠️ CE MÉTA-TEST PROUVE LA SOURCE, PAS L'APPLICATION. Il vérifie qu'aucun fichier
 * ne réécrit la règle ; il ne dit rien de qui l'APPELLE. La preuve comportementale
 * est ailleurs (`exportHtmlEscape.test.ts` côté backend, sur les octets rendus).
 */

const RACINE = join(__dirname, '../../../..')

/** ⚠️ Périmètre DÉRIVÉ de l'arborescence, jamais une liste écrite à la main. */
const CIBLES = [
  'apps/backend/src',
  'apps/frontend/src',
  'mobile/src',
  'mobile/app',
]

/**
 * Exemptions NOMMÉES, une par une, avec leur raison.
 *
 * ⚠️ `xlsxWriter.ts` n'est PAS un oubli : il produit de l'**OOXML**, pas du HTML, et
 * émet `&apos;` là où le HTML veut `&#39;`. Deux langages de balisage, deux règles —
 * le fondre dans `escHtml` ferait perdre ce que chacun distingue, et c'est le motif
 * « un goulot ne doit pas être un entonnoir ». Son échappement est déjà couvert par
 * `xlsxWriter.test.ts`.
 */
const EXEMPTS: Record<string, string> = {
  'apps/backend/src/lib/html.ts':          'la règle canonique elle-même',
  'apps/frontend/src/lib/html.ts':         'la règle canonique elle-même (jumeau)',
  'mobile/src/lib/html.ts':                'la règle canonique elle-même (jumeau)',
  'apps/frontend/src/utils/xlsxWriter.ts': 'OOXML et non HTML — émet &apos;, cf. xlsxWriter.test.ts',
}

function fichiers(base: string): string[] {
  const abs = join(RACINE, base)
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '__tests__' || e === 'tests') continue
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e) && !e.includes('.test.')) out.push(p)
    }
  }
  try { walk(abs) } catch { /* cible absente : la couverture ci-dessous le dira */ }
  return out
}

/**
 * ⚠️ On retire commentaires ET chaînes de documentation AVANT de conclure. Sans ça,
 * ce fichier-ci et tout commentaire qui MENTIONNE `&amp;` déclencheraient la règle —
 * un scanner qui interdit d'expliquer ce qu'il interdit se fait désarmer.
 */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Un fichier réécrit-il la règle ? Signature : il produit lui-même une entité HTML. */
function reecritLaRegle(src: string): boolean {
  const net = sansCommentaires(src)
  return /['"`]&(amp|lt|gt|quot|#39);['"`]/.test(net)
}

describe('échappement HTML — une seule règle', () => {
  const tous = CIBLES.flatMap(fichiers)

  it('⚠️ COUVERTURE — le balayage lit réellement des fichiers', () => {
    // Angle mort n°1 : un `walk()` cassé rend une liste vide, donc un vert qui ne
    // garde rien. On épingle un plancher ET la présence de chaque cible.
    expect(tous.length).toBeGreaterThan(300)
    for (const cible of CIBLES) {
      expect(fichiers(cible).length, cible).toBeGreaterThan(0)
    }
  })

  it('⚠️ CONTRÔLE DISCRIMINANT — la règle détecte une violation et épargne un fichier sain', () => {
    // Forme COPIÉE depuis `CustomerMap.tsx` avant migration, pas retapée de mémoire.
    const violation = `const esc = (s: any): string => String(s ?? '')\n  .replace(/&/g, '&amp;').replace(/</g, '&lt;')`
    expect(reecritLaRegle(violation)).toBe(true)

    // Un fichier qui IMPORTE la règle ne doit PAS être signalé.
    expect(reecritLaRegle(`import { escHtml } from '@/lib/html'\nconst x = escHtml(v)`)).toBe(false)

    // Un COMMENTAIRE qui cite une entité ne doit pas déclencher — sinon on ne peut
    // plus documenter la règle qu'on applique.
    expect(reecritLaRegle(`// remplace & par '&amp;'\nconst x = escHtml(v)`)).toBe(false)
    expect(reecritLaRegle(`/* rend '&lt;' */\nconst x = 1`)).toBe(false)
  })

  it('aucun fichier ne réécrit l’échappement hors de lib/html.ts', () => {
    const coupables = tous
      .filter(f => reecritLaRegle(readFileSync(f, 'utf8')))
      .map(f => f.slice(RACINE.length + 1))
      .filter(rel => !(rel in EXEMPTS))

    expect(
      coupables,
      `${coupables.length} fichier(s) portent leur PROPRE échappement HTML au lieu d’importer\n`
      + '`lib/html.ts`. Sept copies coexistaient et l’une avait perdu l’apostrophe sans que\n'
      + 'rien ne le dise. Importer la règle, ou l’exempter ICI avec sa raison.',
    ).toEqual([])
  })

  it('chaque exemption nommée existe encore — une exemption morte cache un trou', () => {
    // Un chemin exempté qui n'existe plus laisse croire à une décision toujours
    // valide, et masquerait un fichier réintroduit sous le même nom.
    for (const [rel, raison] of Object.entries(EXEMPTS)) {
      expect(() => statSync(join(RACINE, rel)), `${rel} (${raison})`).not.toThrow()
    }
  })
})
