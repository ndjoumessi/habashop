import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ⚠️ EXPORT CSV — les colonnes doivent porter des champs QUI EXISTENT (#170).
 *
 * `export.ts` déclarait `let data: any[]`, ce qui laissait passer quatre lectures de champs
 * absents du schéma. Une seule produisait un mauvais résultat, mais la pire : `item.specialty`
 * était la lecture PRIMAIRE de la colonne « Spécialité » du CSV fournisseurs, qui sortait donc
 * **toujours vide** chez le commerçant. Les trois autres (`buy_price`, `sell_price`, `totalCA`)
 * n'étaient que des replis morts derrière un champ réel : sans effet visible, mais ils
 * affirmaient un modèle qui n'existe pas.
 *
 * Le vrai garde est le TYPAGE : chaque `case` construit ses lignes là où Prisma a typé sa
 * requête, donc un champ absent est un **TS2339**. Ce fichier verrouille ce qu'un type ne peut
 * pas dire — que le champ EXISTE VRAIMENT dans `schema.prisma` — et que le `any` n'est pas
 * revenu par la porte de derrière.
 */

const ROUTE = join(__dirname, '..', 'routes', 'export.ts')
const SCHEMA = join(__dirname, '..', '..', 'prisma', 'schema.prisma')

/**
 * ⚠️ On scanne le CODE, pas la prose. Les commentaires de `export.ts` CITENT les champs
 * fantômes pour expliquer pourquoi ils ont sauté — un scan brut rougirait donc sur sa propre
 * documentation, et on serait tenté de censurer le commentaire au lieu de garder le code.
 * (Même piège que le méta-test codes-barres, qui a déjà fait reformuler un commentaire.)
 */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const source = sansCommentaires(readFileSync(ROUTE, 'utf-8'))
const schema = readFileSync(SCHEMA, 'utf-8')

/** Champs scalaires déclarés par un modèle Prisma. */
function champsDe(modele: string): Set<string> {
  const debut = schema.indexOf(`model ${modele} {`)
  const bloc = schema.slice(debut, schema.indexOf('\n}', debut))
  return new Set([...bloc.matchAll(/^ {2}(\w+)\s+\S/gm)].map(m => m[1]))
}

describe('export CSV — aucun champ fantôme', () => {
  it('la source lue est bien la route d’export, commentaires ôtés (sinon rien n’est prouvé)', () => {
    expect(source).toContain("app.get('/api/export/:resource'")
    expect(source).toContain("case 'suppliers'")
    // Contre-preuve : le retrait des commentaires ne doit pas avoir vidé le fichier…
    expect(source.length).toBeGreaterThan(1500)
    // …et il doit VRAIMENT retirer les commentaires, sinon tout ce bloc se scanne lui-même.
    expect(sansCommentaires('const a = 1 // specialty\n/* specialty */')).not.toContain('specialty')
  })

  it('⚠️ `data: any[]` n’est pas revenu — c’est lui qui laissait passer les fantômes', () => {
    expect(source).not.toMatch(/let\s+data\s*:\s*any\[\]/)
  })

  it.each([
    ['Supplier', ['name', 'categories', 'phone', 'email', 'rating', 'leadTime']],
    ['Product',  ['name', 'category', 'stockQty', 'stockMin', 'buyPrice', 'sellPrice']],
    ['Customer', ['name', 'phone', 'email', 'type', 'totalRevenue', 'loyaltyPoints']],
    ['Employee', ['name', 'role', 'dept', 'salary', 'type']],
  ])('%s — chaque champ exporté existe dans schema.prisma', (modele, champs) => {
    const reels = champsDe(modele)
    const absents = (champs as string[]).filter(c => !reels.has(c))
    expect(`${modele} — champs absents du modèle : ${absents.join(', ')}`)
      .toBe(`${modele} — champs absents du modèle : `)
  })

  it('les champs fantômes ne sont plus LUS comme propriétés', () => {
    // `specialty` : le bug de #170. Les trois autres : des replis snake_case/legacy morts.
    // ⚠️ On cherche l'ACCÈS DE PROPRIÉTÉ (`.totalCA`), pas le simple mot : la route PDF
    // mensuelle déclare légitimement `const totalCA = sales.reduce(...)`, une VARIABLE locale.
    // Un scan par sous-chaîne rougissait dessus — une fausse alerte permanente.
    for (const fantome of ['specialty', 'buy_price', 'sell_price', 'totalCA']) {
      const acces = new RegExp(`\\.\\s*${fantome}\\b`)
      expect(`.${fantome} lu: ${acces.test(source)}`).toBe(`.${fantome} lu: false`)
    }
    // Contre-preuve : le motif détecte bien un accès de propriété quand il y en a un.
    expect(/\.\s*specialty\b/.test('const x = item.specialty ?? ""')).toBe(true)
  })

  it('l’en-tête fournisseurs annonce « Catégorie », le champ réellement exporté', () => {
    // Avant : « Spécialité » pour une colonne vide. Le vocabulaire suit désormais celui de
    // l'export CSV frontend (`t('col_category')`), qui exporte déjà `categories`.
    const bloc = source.slice(source.indexOf("case 'suppliers'"), source.indexOf("case 'sales'"))
    expect(bloc).toContain("'Catégorie'")
    expect(bloc).toContain("'Category'")
    expect(bloc).not.toContain('Spécialité')
    expect(bloc).toContain('s.categories')
  })

  it('le modèle Supplier n’a toujours PAS de `specialty` (sinon la correction serait à revoir)', () => {
    // Le jour où le champ existerait vraiment, ce test rougit et signale qu'il faut trancher
    // entre `specialty` et `categories` au lieu de garder la correction telle quelle.
    expect(`specialty dans Supplier: ${champsDe('Supplier').has('specialty')}`)
      .toBe('specialty dans Supplier: false')
  })
})
