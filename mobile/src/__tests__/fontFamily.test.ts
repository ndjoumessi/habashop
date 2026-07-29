import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ⚠️ POLICE UI — une seule famille dans toute l'app (#13).
//
// Historique qui justifie ce verrou : la refonte NKONI a posé Geist, mais les `.ttf`
// `@expo-google-fonts` ne sont PAS livrables par OTA (bundlées au build natif seulement).
// L'OTA vers Geist a donc rendu la police SYSTÈME sur un device en 1.4.3, et le swap a été
// ANNULÉ (`11b9aa20`) — puis refait ici pour le build natif 1.5.0. Trois passages sur les
// mêmes 265 occurrences, réparties sur 35 fichiers : exactement le terrain où l'on oublie
// un fichier, et où l'app rend alors DEUX polices sans que rien n'échoue.
//
// Deux propriétés gardées, parce que deux façons distinctes de casser le rendu :
//   1. plus aucune référence à l'ancienne famille — un fichier oublié = seconde police ;
//   2. toute graisse UTILISÉE est aussi CHARGÉE par `useFonts` — une graisse non chargée
//      retombe silencieusement sur la police système, sans erreur ni avertissement.
//
// ⚠️ Le scan couvre `app/` ET `src/`. `versionSource.test.ts` s'arrête à `src/`, or le
// chargement des polices vit dans `app/_layout.tsx` et la majorité des écrans dans `app/`.

const MOBILE = join(__dirname, '..', '..')
const LAYOUT = join(MOBILE, 'app', '_layout.tsx')

/** La famille en place. Changer de police = changer cette constante, sciemment. */
const FAMILLE = 'Geist'
/** Les familles bannies du code : y revenir par accident rend deux polices. */
const FAMILLES_BANNIES = ['Outfit']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      out.push(...walk(p))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

const fichiers = [...walk(join(MOBILE, 'app')), ...walk(join(MOBILE, 'src'))]

describe('police UI — une seule famille dans toute l’app', () => {
  it('le scan couvre app/ ET src/ (un walk cassé rendrait une liste vide, verte pour rien)', () => {
    expect(fichiers.length).toBeGreaterThan(30)
    expect(fichiers.some(f => f.endsWith(join('app', '_layout.tsx')))).toBe(true)
    // La porte d'à côté : un scan limité à src/ raterait tous les écrans d'app/.
    expect(fichiers.filter(f => f.includes(`${join('', 'app')}`)).length).toBeGreaterThan(10)
  })

  it.each(FAMILLES_BANNIES)('aucune référence résiduelle à %s dans app/ ni src/', (bannie) => {
    const fautifs: string[] = []
    for (const f of fichiers) {
      readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
        if (ligne.includes(bannie)) fautifs.push(`${f.replace(MOBILE, '.')}:${i + 1}  ${ligne.trim().slice(0, 80)}`)
      })
    }
    expect(`références résiduelles:\n${fautifs.join('\n')}`).toBe('références résiduelles:\n')
  })

  it('toute graisse UTILISÉE est aussi CHARGÉE par useFonts (sinon : police système, en silence)', () => {
    const layout = readFileSync(LAYOUT, 'utf8')
    // Les graisses réellement passées à `useFonts({...})` — pas les imports, qui pourraient
    // exister sans être enregistrés.
    const bloc = layout.slice(layout.indexOf('useFonts({'), layout.indexOf('})', layout.indexOf('useFonts({')))
    const chargees = new Set((bloc.match(new RegExp(`${FAMILLE}_[A-Za-z0-9]+`, 'g')) ?? []))

    const utilisees = new Set<string>()
    for (const f of fichiers) {
      for (const m of readFileSync(f, 'utf8').match(new RegExp(`${FAMILLE}_[A-Za-z0-9]+`, 'g')) ?? []) {
        utilisees.add(m)
      }
    }

    // ⚠️ jest n'accepte pas `expect(valeur, message)` — c'est un idiome vitest, et il lève
    // « Expect takes at most one argument ». Le contexte passe donc par la valeur asserée.
    // Contre-preuves : sans elles, un bloc `useFonts` renommé ou un scan vide rendrait
    // `manquantes` vide, donc VERT, en ne prouvant rien.
    expect(`graisses chargées: ${chargees.size}`).not.toBe('graisses chargées: 0')
    expect(`graisses utilisées: ${utilisees.size}`).not.toBe('graisses utilisées: 0')

    const manquantes = [...utilisees].filter(g => !chargees.has(g))
    expect(`utilisées mais NON chargées → ${manquantes.join(', ')}`).toBe('utilisées mais NON chargées → ')
  })

  it('les imports pointent bien le paquet de la famille en place', () => {
    const layout = readFileSync(LAYOUT, 'utf8')
    expect(layout).toContain(`@expo-google-fonts/${FAMILLE.toLowerCase()}/useFonts`)
    for (const bannie of FAMILLES_BANNIES) {
      expect(layout).not.toContain(`@expo-google-fonts/${bannie.toLowerCase()}/`)
    }
  })
})
