import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * UN CHAMP ACCEPTÉ DOIT ÊTRE ATTEIGNABLE — le zod ne décide de rien ici.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `EMPLOYEE_CREATE` et `EMPLOYEE_UPDATE` sont en **`.passthrough()`** : le zod ne
 * STRIPPE aucune clé inconnue. Le seul juge de ce qui atteint la base est la
 * DESTRUCTURATION du handler. Un champ déclaré dans `EMPLOYEE_FIELDS` mais absent
 * du `const { … } = request.body` est donc validé, transporté, puis **jeté en
 * silence** — corps accepté, réponse 200, rien en base.
 *
 * ⚠️ CETTE FAMILLE A FRAPPÉ TROIS FOIS, mesurée en production :
 *   • `photo`  — la photo d'employé ne s'est jamais enregistrée ;
 *   • `endAt`  — le seul CDD de production portait `endAt: null` ;
 *   • `avatar` — accepté et destructuré au POST, **absent du PUT** : renommer
 *     quelqu'un envoyait les nouvelles initiales et gardait les anciennes.
 *
 * ⚠️ LES DEUX PREMIÈRES ONT ÉTÉ DIAGNOSTIQUÉES À TORT comme « le zod strippe ».
 * C'était faux, et la fausse cause a survécu à deux chantiers avant qu'un sabotage
 * ne la démente. Ce fichier garde la VRAIE propriété — et le verrou frontal
 * `hrEmployeeMapping.test.ts`, qui relit `EMPLOYEE_FIELDS`, ne peut PAS la voir :
 * il prouve que la clé est DÉCLARÉE, jamais qu'elle est LUE.
 */

const RACINE = join(__dirname, '../..')

/** Clés déclarées dans la liste blanche zod. */
function champsDeclares(): string[] {
  const src = readFileSync(join(RACINE, 'src/schemas/writesB.ts'), 'utf8')
  const bloc = /const EMPLOYEE_FIELDS = \{([\s\S]*?)\n\}/.exec(src)
  if (!bloc) throw new Error('EMPLOYEE_FIELDS introuvable — nom ou chemin changé')
  return [...bloc[1].matchAll(/^\s{2}(\w+):/gm)].map(m => m[1])
}

/** Identifiants réellement destructurés du corps, par handler. */
function champsLus(): { post: string[]; put: string[] } {
  const src = readFileSync(join(RACINE, 'src/routes/employees.ts'), 'utf8')
  const iPost = src.indexOf('app.post')
  const iPut = src.indexOf('app.put')
  if (iPost < 0 || iPut < 0 || iPut < iPost) throw new Error('handlers POST/PUT introuvables ou inversés')

  const extraire = (portion: string): string[] => {
    // ⚠️ On borne au `const { … } = request.body` du handler, pas au fichier entier :
    // sans ça, une simple MENTION du nom ailleurs (un commentaire, une réponse) suffirait
    // à faire croire que le champ est lu. C'est exactement l'erreur qui a laissé `avatar`
    // passer pour destructuré au PUT lors d'un premier balayage.
    // ⚠️ `[^{}]*` et NON `[\s\S]*?` : le handler destructure d'abord `const { id } =
    // request.params as { id: string }`, et un motif non gourmand partait de CE `const {`
    // pour courir jusqu'au premier `= request.body`, avalant les deux blocs. Il rendait
    // alors `name` comme ABSENT — un faux positif dans le verrou lui-même, attrapé au
    // premier tir nominal. Interdire la traversée d'une accolade ancre sur le bon bloc.
    const m = /const \{([^{}]*)\} = request\.body/.exec(portion)
    if (!m) throw new Error('destructuration du corps introuvable')
    return m[1].split(',').map(s => s.trim()).filter(Boolean)
  }
  return { post: extraire(src.slice(iPost, iPut)), put: extraire(src.slice(iPut)) }
}

describe('champs employé — déclarés ⇒ lus', () => {
  const declares = champsDeclares()
  const { post, put } = champsLus()

  it('⚠️ COUVERTURE — les trois extractions rendent quelque chose', () => {
    // Angle mort n°1 : une regex qui ne matche rien rend une liste VIDE, et
    // « tous les champs sont lus » devient vrai par vacuité.
    expect(declares.length, 'EMPLOYEE_FIELDS').toBeGreaterThanOrEqual(10)
    expect(post.length, 'destructuration POST').toBeGreaterThanOrEqual(10)
    expect(put.length, 'destructuration PUT').toBeGreaterThanOrEqual(10)
    // Témoins positifs et négatif sur ce que les extracteurs voient.
    expect(declares).toContain('photo')
    expect(post).toContain('name')
    expect(put).toContain('endAt')
    expect(declares).not.toContain('photoUrl')
  })

  it('⚠️ tout champ de EMPLOYEE_FIELDS est destructuré par le POST', () => {
    const jetes = declares.filter(c => !post.includes(c))
    expect(
      jetes,
      'ces champs passent la validation puis sont IGNORÉS par le handler de création :\n'
      + 'corps accepté, réponse 200, rien en base. Le zod est en `.passthrough()`, il ne\n'
      + 'protège de rien — soit les lire, soit les retirer de la liste blanche.',
    ).toEqual([])
  })

  it('⚠️ tout champ de EMPLOYEE_FIELDS est destructuré par le PUT', () => {
    // C'est CE cas qui a trouvé `avatar` : déclaré, lu au POST, absent du PUT.
    const jetes = declares.filter(c => !put.includes(c))
    expect(
      jetes,
      'ces champs sont acceptés puis IGNORÉS par le handler de mise à jour.\n'
      + '`avatar` l’était : renommer un employé envoyait les nouvelles initiales et\n'
      + 'conservait les anciennes en base, sans que rien ne le signale.',
    ).toEqual([])
  })

  it('⚠️ CONTRÔLE DISCRIMINANT — un champ absent est bien vu comme absent', () => {
    // Sans ce cas, les deux précédents seraient verts d'un extracteur qui rendrait
    // « tout est présent » quoi qu'il arrive.
    expect(post.includes('zzzChampInexistant')).toBe(false)
    expect(['zzzChampInexistant'].filter(c => !put.includes(c))).toEqual(['zzzChampInexistant'])
  })

  it('les deux handlers lisent le MÊME ensemble — une asymétrie est une dérive', () => {
    // Un champ lu d'un seul côté est un jumeau divergent : la création le persiste,
    // la mise à jour l'oublie. C'est la forme exacte du défaut `avatar`.
    const seulPost = post.filter(c => declares.includes(c) && !put.includes(c))
    const seulPut = put.filter(c => declares.includes(c) && !post.includes(c))
    expect({ seulPost, seulPut }).toEqual({ seulPost: [], seulPut: [] })
  })
})
