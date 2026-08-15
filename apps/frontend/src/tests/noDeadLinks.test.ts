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
 * ⚠️ LES CONDITIONS GÉNÉRALES N'EXISTENT NULLE PART : ni route, ni fichier dans `legal/`
 * (qui ne contient que `privacy-policy.html`, `account-deletion.html` et son index). Elles
 * ont donc été RETIRÉES du pied de page et rendues en TEXTE dans le consentement, jamais
 * recâblées vers `/privacy` — présenter une politique de confidentialité comme des
 * conditions de service aurait caché au lecteur qu'il lui manque un document.
 * ⚠️ Ce n'est PAS une correction complète : la phrase d'inscription demande toujours
 * d'accepter des CGU inexistantes. Le correctif réel est de les RÉDIGER — acte juridique.
 * Le lien mort masquait le trou ; le texte nu le laisse voir. C'est tout ce qu'un correctif
 * d'interface pouvait faire honnêtement.
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

  it('⚠️ « CGU » n’est plus annoncée nulle part tant qu’elle n’existe pas', () => {
    // Le jour où le document est écrit, ce cas rougit — et c'est le signal de remettre le
    // lien, au pied de page comme dans le consentement.
    const shared = readFileSync(join(SRC, 'components', 'landing', 'landingShared.ts'), 'utf8')
    const nu = sansCommentaires(shared)
    for (const mot of ['CGU', 'Terms', 'Términos', 'Termini']) {
      expect({ mot, dansFooter: new RegExp(`footer_links[^\\n]*${mot}`).test(nu) })
        .toEqual({ mot, dansFooter: false })
    }
  })
})
