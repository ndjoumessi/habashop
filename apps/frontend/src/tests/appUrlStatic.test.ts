import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render, appUrl, DEFAULT_APP_URL } from '../../scripts/gen-seo.mjs'
import { DEFAULT_APP_URL as DEFAULT_APP_URL_SRC } from '../lib/appUrl'

// ⚠️ URL PUBLIQUE — SURFACE STATIQUE DU FRONT (#156).
//
// 13 occurrences y étaient codées en dur : `canonical`, `og:url`, `og:image`, le JSON-LD
// (index.html, 9), les `<loc>` et `hreflang` du sitemap (6), et le `Sitemap:` de robots.txt.
// Sur un domaine propre, le canonical aurait désigné l'ANCIEN hôte — Google indexe alors la
// mauvaise origine, et les partages sociaux servent une image d'ailleurs.
//
// DEUX mécanismes, parce que les fichiers ne sont pas produits pareil (mesuré) :
//   · index.html traverse le pipeline Vite → substitution native `%VITE_APP_URL%` ;
//   · public/ est copié OCTET POUR OCTET (`diff public/X dist/X` vide) → aucune substitution
//     possible, d'où des gabarits hors de public/ et `scripts/gen-seo.mjs`.
//
// Ce fichier est le pendant frontend du méta-test backend `appUrlSource.test.ts`.

const FRONT = join(__dirname, '..', '..')
const LITERAL = /(?<!@)\bhttps?:\/\/habashop\.vercel\.app/

describe('gen-seo — la substitution', () => {
  it('sans env → repli sur l’URL servant l’app (additif, artefact inchangé)', () => {
    expect(appUrl({})).toBe(DEFAULT_APP_URL)
  })

  it('avec env → tout suit', () => {
    expect(appUrl({ VITE_APP_URL: 'https://app.habashop.com' })).toBe('https://app.habashop.com')
  })

  it('barre oblique finale normalisée, env vide traitée comme absente', () => {
    expect(appUrl({ VITE_APP_URL: 'https://app.habashop.com//' })).toBe('https://app.habashop.com')
    for (const v of ['', '   ']) expect(appUrl({ VITE_APP_URL: v })).toBe(DEFAULT_APP_URL)
  })

  it('render remplace TOUTES les occurrences du marqueur, pas seulement la première', () => {
    // Un `replace` non global ne substituerait que le premier `<loc>` : le sitemap partirait
    // moitié bon, moitié périmé — le pire des deux mondes, et invisible à l'œil.
    expect(render('a {{APP_URL}} b {{APP_URL}} c', 'X')).toBe('a X b X c')
  })

  it('le défaut du script et celui de `.env` ne divergent PAS', () => {
    // Deux points de repli existent par contrainte : `.env` (lu par Vite pour index.html) et
    // le script (hors pipeline Vite, sans accès à import.meta.env). Ils doivent coïncider,
    // sinon index.html et le sitemap annonceraient deux origines différentes.
    const env = readFileSync(join(FRONT, '.env'), 'utf-8')
    const m = env.match(/^VITE_APP_URL=(.+)$/m)
    expect(m, '`VITE_APP_URL` DOIT être défini dans .env : sans lui, Vite livre le littéral « %VITE_APP_URL% » dans le canonical (mesuré)').not.toBeNull()
    expect(m![1].trim()).toBe(DEFAULT_APP_URL)
  })
})

describe('méta-test — l’URL ne se recopie plus en dur dans la surface statique', () => {
  const cibles = [
    join(FRONT, 'index.html'),
    ...readdirSync(join(FRONT, 'scripts', 'seo')).map(f => join(FRONT, 'scripts', 'seo', f)),
    ...readdirSync(join(FRONT, 'public')).filter(f => /\.(txt|xml|json|webmanifest)$/.test(f)).map(f => join(FRONT, 'public', f)),
  ]

  it('le scan couvre bien les fichiers attendus (un scan vide passerait au vert pour rien)', () => {
    expect(cibles.length).toBeGreaterThanOrEqual(3)
    expect(cibles.some(f => f.endsWith('index.html'))).toBe(true)
    expect(cibles.some(f => f.endsWith('sitemap.xml.tmpl'))).toBe(true)
    expect(cibles.some(f => f.endsWith('robots.txt.tmpl'))).toBe(true)
  })

  it('aucune URL en dur dans index.html, les gabarits SEO ni les fichiers servis de public/', () => {
    const fautifs: string[] = []
    for (const f of cibles) {
      readFileSync(f, 'utf-8').split('\n').forEach((ligne, i) => {
        if (LITERAL.test(ligne)) fautifs.push(`${f.replace(FRONT, '.')}:${i + 1}  ${ligne.trim().slice(0, 90)}`)
      })
    }
    expect(fautifs, `URL codée en dur — utiliser %VITE_APP_URL% (index.html) ou {{APP_URL}} (gabarits) :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('index.html porte bien le marqueur sur toutes ses balises d’origine', () => {
    const html = readFileSync(join(FRONT, 'index.html'), 'utf-8')
    // 9 = canonical + og:url + og:image ×2 + JSON-LD (url ×3, logo, screenshot).
    expect((html.match(/%VITE_APP_URL%/g) ?? []).length).toBe(9)
  })
})

describe('méta-test — l’URL ne se recopie plus en dur dans les liens du front applicatif (#156)', () => {
  // Pendant src/ du scan statique : Privacy et PublicCatalog codaient l'URL dans un `href`.
  // Sur un domaine propre, ils auraient pointé l'ANCIEN hôte. Ils lisent désormais `appUrl()`
  // (VITE_APP_URL, injectée au build). On interdit le RETOUR d'un `href` en dur — PAS toute
  // mention du littéral : les fixtures (Integrations) et les replis `window.location.origin`
  // (SectionCatalog) restent légitimes. C'est le vecteur précis du bug qu'on verrouille.
  const SRC = join(FRONT, 'src')
  const HREF_LITERAL = /href=\{?[`'"]?https?:\/\/habashop\.vercel\.app/

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name)
      if (e.isDirectory()) return walk(p)
      return /\.tsx?$/.test(e.name) ? [p] : []
    })
  }
  const fichiers = walk(SRC)

  it('le scan couvre l’arbre src/ (un walk cassé rendrait une liste vide, verte pour rien)', () => {
    expect(fichiers.length).toBeGreaterThan(50)
    expect(fichiers.some((f) => f.endsWith('pages/Privacy.tsx'))).toBe(true)
    expect(fichiers.some((f) => f.endsWith('pages/PublicCatalog.tsx'))).toBe(true)
  })

  it('aucun href codant l’URL en dur dans src/', () => {
    const fautifs: string[] = []
    for (const f of fichiers) {
      readFileSync(f, 'utf-8').split('\n').forEach((ligne, i) => {
        if (HREF_LITERAL.test(ligne)) fautifs.push(`${f.replace(FRONT, '.')}:${i + 1}  ${ligne.trim().slice(0, 90)}`)
      })
    }
    expect(fautifs, `href codé en dur — utiliser appUrl() de src/lib/appUrl :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('le défaut de src/lib/appUrl coïncide avec celui de gen-seo (une valeur, pas trois)', () => {
    // .env, gen-seo.mjs ET src/lib/appUrl portent chacun le défaut, par contrainte de
    // plateforme (build statique vs bundle). Ils doivent coïncider, sinon index.html, le
    // sitemap et les liens applicatifs annonceraient trois origines — la divergence que la
    // leçon versionnage interdit.
    expect(DEFAULT_APP_URL_SRC).toBe(DEFAULT_APP_URL)
  })
})
