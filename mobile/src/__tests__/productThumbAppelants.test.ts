import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/* ══════════════════════════════════════════════════════════════════════════════
   LES APPELANTS — la règle de FORME, jumelle de celle du web
   ══════════════════════════════════════════════════════════════════════════════
   Le style de l'appelant est fusionné APRÈS celui du composant : un `style={{ width }}`
   écrase donc la largeur et laisse la hauteur — le bandeau exact du 2026-08-12 côté
   web. Aucune mesure jest ne peut l'attraper dans les écrans ; la forme, si.        */

const RACINES = ['src', 'app'].map(d => join(__dirname, '..', '..', d))

function fichiers(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') out.push(...fichiers(p)) }
    else if (/\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

describe('appelants de la vignette native', () => {
  const tous = RACINES.flatMap(fichiers)

  it('COUVERTURE — le balayage lit bien `src/` ET `app/`', () => {
    // ⚠️ `versionSource.test.ts` s'était arrêté à `src/` alors qu'un site vivait dans
    // `app/` : ici les DEUX racines sont lues, et le compte le prouve.
    expect(tous.length).toBeGreaterThan(50)
    expect(tous.some(f => f.includes('/app/'))).toBe(true)
    // Aucun appelant trouvé = un scan qui ne garde rien.
    expect(tous.filter(f => readFileSync(f, 'utf8').includes('<ProductThumb')).length).toBeGreaterThanOrEqual(5)
  })

  it('personne n’ÉTIRE la vignette : aucun `style` d’appel ne porte width/height', () => {
    const fautifs: string[] = []
    for (const f of tous) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const m of src.matchAll(/<ProductThumb[^>]*style=\{\{([^}]*)\}\}/g)) {
        if (/\bwidth\s*:/.test(m[1]) || /\bheight\s*:/.test(m[1])) {
          fautifs.push(`${f.split('/mobile/')[1]} :: ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`)
        }
      }
    }
    // Ces appels déformeraient la vignette : la centrer, jamais l'étirer.
    expect(fautifs).toEqual([])
  })

  it('⚠️ le détecteur voit la forme fautive et IGNORE la forme saine', () => {
    // Sabotage COPIÉ de la ligne réellement commise côté web, pas retapée de mémoire.
    const juge = (s: string) => {
      const m = /<ProductThumb[^>]*style=\{\{([^}]*)\}\}/.exec(s)
      return !!m && (/\bwidth\s*:/.test(m[1]) || /\bheight\s*:/.test(m[1]))
    }
    expect(juge(`<ProductThumb p={p} size={38} style={{ width: '100%' }} />`)).toBe(true)   // vue
    expect(juge(`<ProductThumb p={p} size={42} style={{ marginBottom: 4 }} />`)).toBe(false) // ignorée
  })

  it('⚠️ `size` reste un NOMBRE — le web, lui, accepte une chaîne, donc « 100% »', () => {
    // Divergence RÉELLE entre les jumeaux, et elle est en faveur du natif : ici le
    // compilateur interdit une taille relative. Ce test fige cette protection — la
    // perdre rouvrirait côté mobile un trou que le web a dû fermer par une règle.
    const src = readFileSync(join(__dirname, '..', 'components', 'ui', 'ProductThumb.tsx'), 'utf8')
    // `size` doit rester `number`, jamais `number | string`.
    expect(/size\?:\s*number\b/.test(src)).toBe(true)
  })
})
