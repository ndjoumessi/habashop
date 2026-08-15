import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * AUCUN LIEN MORT — `href="#"` ou `href=""` sur une surface publique.
 *
 * ── Ce qui a été mesuré le 2026-08-15 ────────────────────────────────────────────────
 * CINQ liens ne menaient nulle part, et un clic remontait simplement en haut de page :
 *   · pied de page de la vitrine : `Confidentialité`, `CGU`, `Contact` ;
 *   · consentement d'inscription : `Conditions Générales` ET `Politique de confidentialité`.
 *
 * Le second est le plus grave : le commerçant cochait « j'accepte » DEUX documents dont
 * AUCUN n'était atteignable. Un consentement à des conditions illisibles.
 *
 * ── Ce qui a été corrigé, et ce qui ne l'est PAS ─────────────────────────────────────
 * `/privacy` EXISTE (route publique d'`App.tsx`, 247 lignes) → les deux renvois à la
 * politique de confidentialité y pointent. `Contact` part sur `mailto:contact@habashop.com`,
 * l'adresse que la grille tarifaire utilise déjà — pas une seconde inventée.
 *
 * ⚠️ LES CONDITIONS GÉNÉRALES N'EXISTAIENT NULLE PART le matin du 2026-08-15 : ni route,
 * ni fichier dans `legal/`. Elles ont donc d'abord été RETIRÉES du pied de page et rendues
 * en TEXTE dans le consentement, jamais recâblées vers `/privacy` — présenter une politique
 * de confidentialité comme des conditions de service aurait caché au lecteur qu'il lui
 * manque un document. Puis `/terms` a été RÉDIGÉE le même jour, et les deux liens sont
 * revenus. **C'est l'ordre qui compte : on écrit le document, PUIS le lien.**
 * ⚠️ `/terms` porte encore des mentions À COMPLÉTER (identité légale, droit applicable) et
 * n'a pas été relue par un juriste — c'est annoncé en tête du document lui-même, pas masqué.
 *
 * ⚠️ LES COMMENTAIRES SONT RETIRÉS AVANT DE CONCLURE. Sans ça ce verrou s'attrape
 * lui-même : les deux fichiers corrigés CITENT `href="#"` pour expliquer ce qu'ils ont
 * réparé. Un scanneur qui ne retire pas les commentaires s'interdit d'expliquer ce qu'il
 * interdit — la leçon est déjà écrite ailleurs dans ce dépôt, et je m'y suis repris.
 */

const SRC = join(__dirname, '..')

function fichiersTsx(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests') fichiersTsx(p, acc) }
    else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/** Source débarrassée des commentaires de bloc et de ligne. */
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const FICHIERS = fichiersTsx(SRC)

describe('liens morts', () => {
  it('COUVERTURE — le balayage lit bien src/', () => {
    expect(FICHIERS.length).toBeGreaterThan(150)
  })

  it('aucun `href="#"` ni `href=""` dans src/', () => {
    const fautifs: string[] = []
    for (const f of FICHIERS) {
      sansCommentaires(readFileSync(f, 'utf8')).split('\n').forEach((l, i) => {
        if (/href=(""|"#"|\{['"]#?['"]\})/.test(l)) fautifs.push(`${f.replace(SRC, 'src')}:${i + 1}`)
      })
    }
    expect(fautifs).toEqual([])
  })

  it('DISCRIMINANT — le motif SAIT reconnaître un lien mort', () => {
    // Sans ce cas, une regex cassée rendrait « 0 fautif » et se lirait comme une victoire.
    for (const l of ['<a href="#">x</a>', '<a href="">x</a>', "<a href={'#'}>x</a>"]) {
      expect({ l, mort: /href=(""|"#"|\{['"]#?['"]\})/.test(l) }).toEqual({ l, mort: true })
    }
    // …et qu'il ne crie PAS au loup sur un lien légitime
    for (const l of ['<a href="/privacy">x</a>', '<a href="#section-faq">x</a>', '<a href="mailto:a@b.c">x</a>']) {
      expect({ l, mort: /href=(""|"#"|\{['"]#?['"]\})/.test(l) }).toEqual({ l, mort: false })
    }
  })

  it('DISCRIMINANT — le retrait des commentaires est bien load-bearing', () => {
    // Les deux fichiers corrigés citent `href="#"` en commentaire pour l'expliquer. Si le
    // retrait cessait de fonctionner, la règle ci-dessus rougirait sur ses propres notes.
    const cites = FICHIERS.filter(f => readFileSync(f, 'utf8').includes('href="#"'))
    expect(cites.length).toBeGreaterThan(0)
    for (const f of cites) {
      expect({ f: f.replace(SRC, 'src'), reste: sansCommentaires(readFileSync(f, 'utf8')).includes('href="#"') })
        .toEqual({ f: f.replace(SRC, 'src'), reste: false })
    }
  })

  it('les cibles du pied de page existent VRAIMENT', () => {
    // ⚠️ Un lien peut être « non mort » et pointer sur une route inexistante — c'est le
    // même défaut sous une autre forme. On confronte donc la cible aux routes déclarées.
    const routes = readFileSync(join(SRC, 'App.tsx'), 'utf8')
    const footer = readFileSync(join(SRC, 'components', 'landing', 'LandingFooter.tsx'), 'utf8')
    const nu = sansCommentaires(footer)
    expect(nu).toContain("to: '/privacy'")
    expect(routes).toContain('path="/privacy"')
    // Contact : une vraie adresse, et celle que la grille tarifaire emploie déjà.
    expect(nu).toMatch(/mailto:[\w.-]+@[\w.-]+/)
    const pricing = readFileSync(join(SRC, 'components', 'landing', 'LandingPricing.tsx'), 'utf8')
    const adr = (s: string) => s.match(/mailto:([\w.-]+@[\w.-]+)/)?.[1]
    expect({ footer: adr(nu) }).toEqual({ footer: adr(pricing) })
  })

  it('⚠️ « CGU » n’est annoncée QUE parce que le document existe', () => {
    // ⚠️ CE CAS A ÉTÉ INVERSÉ le 2026-08-15. Il exigeait l'ABSENCE de « CGU » tant qu'aucun
    // document n'existait, et il a rougi le jour où `/terms` a été rédigée — c'était le
    // signal prévu. Il garde maintenant l'invariant DURABLE, qui est le même dans les deux
    // sens : on n'annonce un document institutionnel que s'il est servi.
    const shared = sansCommentaires(readFileSync(join(SRC, 'components', 'landing', 'landingShared.ts'), 'utf8'))
    const routes = readFileSync(join(SRC, 'App.tsx'), 'utf8')
    const annonce = /footer_links[^\n]*terms:/.test(shared)
    const servi = routes.includes('path="/terms"')
    expect({ annonce, servi }).toEqual({ annonce: true, servi: true })

    // …et les QUATRE langues l'annoncent, pas seulement le français : une entrée manquante
    // ferait disparaître le lien pour un lecteur anglophone sans que rien ne le dise.
    const n = [...shared.matchAll(/footer_links[^\n]*terms:/g)].length
    expect({ langues: n }).toEqual({ langues: 4 })
  })

  it('le consentement d’inscription pointe sur les DEUX documents', () => {
    // C'était le défaut le plus grave : le commerçant cochait « j'accepte » deux documents
    // dont aucun n'était atteignable.
    const nu = sansCommentaires(readFileSync(join(SRC, 'components', 'signup', 'SignupStep2.tsx'), 'utf8'))
    for (const cible of ['/terms', '/privacy']) {
      expect({ cible, lie: nu.includes(`href="${cible}"`) }).toEqual({ cible, lie: true })
    }
    // ⚠️ Ouverts dans un NOUVEL onglet : sans ça, aller lire ce qu'on accepte fait perdre
    // le formulaire — et le lecteur renonce à lire.
    expect((nu.match(/target="_blank"/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})
