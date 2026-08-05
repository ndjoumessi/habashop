import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ⚠️ Le FAVICON doit être le MÊME mark que l'écran et le PDF (#178).
 *
 * Il ne l'était pas : `public/favicon.svg` portait un tracé REDESSINÉ À LA MAIN en
 * viewBox 1024 — rx de tuile 230 au lieu de 245,76 (−6,4 %), rx des barres du H 10 au lieu
 * de 14,34 (−30 %), barres 2 % trop hautes. Assez proche pour passer inaperçu à 16 px, assez
 * différent pour ne pas être le même logo. Personne ne pouvait le voir : rien ne reliait les
 * deux fichiers, et le commentaire de `LogoMark.tsx` renvoyait à une « source de vérité »
 * (`../habashop-brand/habashop-mark.svg`) qui N'EXISTE PAS — la dérive vient de là.
 *
 * ⚠️ Ce test compare les GÉOMÉTRIES, pas les fichiers : le favicon garde ses attributs
 * `width`/`height` (1024) et son `xmlns`, mais doit porter la même `viewBox` et exactement
 * les mêmes primitives. Comparer les fichiers octet à octet rougirait sur un commentaire.
 */

const ROOT = join(__dirname, '..', '..')
const mark = readFileSync(join(ROOT, 'src', 'components', 'ui', 'LogoMark.tsx'), 'utf-8')
const favicon = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf-8')

/** Extrait les primitives géométriques (rect/path) sous une forme comparable. */
function shapes(src: string): string[] {
  const out: string[] = []
  // JSX (`strokeWidth`, `strokeLinecap`) et SVG (`stroke-width`) : on normalise en kebab-case.
  const norm = (s: string) =>
    s.replace(/strokeWidth/g, 'stroke-width')
      .replace(/strokeLinecap/g, 'stroke-linecap')
      .replace(/["']/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/\s*\/?>$/, '')
      .trim()
  for (const m of src.matchAll(/<(rect|path)\b([^>]*?)\/?>/g)) {
    // Les commentaires SVG ne matchent pas (<!-- … --> n'est pas <rect|path>), donc rien à filtrer.
    out.push(`${m[1]} ${norm(m[2])}`)
  }
  return out
}

describe('favicon.svg — miroir exact du mark LogoMark (#178)', () => {
  const markShapes = shapes(mark)
  const favShapes = shapes(favicon)

  it('les deux fichiers contiennent bien des primitives (garde anti-scan-vide)', () => {
    // Sans cette assertion, un sélecteur cassé rendrait deux tableaux VIDES — donc égaux,
    // donc verts, en ne comparant rien. C'est le « vert qui garde le vide ».
    expect(markShapes.length).toBeGreaterThanOrEqual(6)
    expect(favShapes.length).toBeGreaterThanOrEqual(6)
  })

  it('même viewBox — sinon les mêmes nombres ne décrivent pas la même forme', () => {
    const vb = (s: string) => s.match(/viewBox="([^"]+)"/)?.[1]
    expect(vb(favicon)).toBe(vb(mark))
  })

  it('mêmes primitives, dans le même ordre', () => {
    expect(favShapes).toEqual(markShapes)
  })

  it('la « source de vérité » citée en commentaire doit exister — ou ne pas être citée', () => {
    // Le commentaire de LogoMark pointait vers un fichier absent : une référence morte est
    // pire qu'aucune référence, elle envoie éditer un fichier qui n'existe pas.
    const cited = mark.match(/Source de vérité éditable\s*:\s*(\S+)/)?.[1]
    if (cited) {
      const exists = (() => {
        try { readFileSync(join(ROOT, 'src', 'components', 'ui', cited)); return true } catch { return false }
      })()
      expect(exists, `LogoMark.tsx cite « ${cited} » comme source de vérité, mais ce fichier n'existe pas.`).toBe(true)
    }
  })
})

/**
 * ⚠️ Les PNG livrés doivent être le rendu du MÊME SVG.
 *
 * Sans ce bloc, la chaîne restait ouverte au dernier maillon : `LogoMark.tsx` ↔ `favicon.svg`
 * était gardé, mais les trois PNG (PWA 192/512, apple-touch-icon) portaient toujours l'ancien
 * tracé — c'est-à-dire que l'icône de l'app installée et celle de l'onglet montraient deux
 * logos différents. Un verrou qui s'arrête un cran avant la sortie ne garde pas la sortie.
 *
 * ⚠️ Comparaison en TOLÉRANCE, pas à l'octet : le PNG dépend de la version de librsvg
 * embarquée par sharp, donc une égalité stricte rougirait à la première mise à jour de
 * dépendance — un verrou qui crie au loup finit désarmé. L'écart moyen mesuré entre l'ANCIEN
 * tracé et le nouveau était de 0,85/255 ; le seuil à 0,30 est donc bien en dessous de la
 * dérive réelle qu'on veut attraper, tout en absorbant le bruit d'antialiasing.
 */
describe('icônes PNG — rendu du même favicon.svg (#178)', () => {
  it('les 3 PNG correspondent au rendu du SVG', async () => {
    const sharp = (await import('sharp')).default
    const { ICONS, renderIcon } = await import('../../scripts/gen-icons.mjs')
    const svg = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf-8')

    expect(ICONS.length, 'garde anti-scan-vide : aucune icône décrite').toBe(3)

    for (const { file, size } of ICONS) {
      const livre = await sharp(join(ROOT, 'public', file)).raw().toBuffer()
      const attendu = await sharp(await renderIcon(svg, size)).raw().toBuffer()

      expect(livre.length, `${file} : dimensions différentes du rendu attendu`).toBe(attendu.length)
      let somme = 0
      for (let i = 0; i < livre.length; i++) somme += Math.abs(livre[i] - attendu[i])
      const ecart = somme / livre.length
      expect(ecart, `${file} : écart moyen ${ecart.toFixed(2)}/255 — le PNG ne vient pas de ce SVG. Lancer \`node scripts/gen-icons.mjs\`.`)
        .toBeLessThan(0.3)
    }
  }, 20000)

  it('les PNG restent OPAQUES et violet plein bord', async () => {
    // Convention mesurée sur les icônes déjà livrées : coin (0,0) = #6C47FF, aucun canal alpha.
    // iOS et les lanceurs Android appliquent leur PROPRE masque — des coins transparents
    // donnent un liseré noir, des coins déjà arrondis un double arrondi.
    const sharp = (await import('sharp')).default
    for (const file of ['pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png']) {
      const img = sharp(join(ROOT, 'public', file))
      const meta = await img.metadata()
      expect(meta.hasAlpha, `${file} porte un canal alpha`).toBe(false)
      const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
      expect([data[0], data[1], data[2]], `${file} : coin non violet`).toEqual([108, 71, 255])
      const c = ((info.height >> 1) * info.width + (info.width >> 1)) * info.channels
      expect([data[c], data[c + 1], data[c + 2]], `${file} : centre non blanc`).toEqual([255, 255, 255])
    }
  }, 20000)
})
