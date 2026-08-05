#!/usr/bin/env node
/**
 * Régénère les icônes PNG depuis `public/favicon.svg` — lui-même miroir exact de
 * `src/components/ui/LogoMark.tsx` (cf. #178).
 *
 * ⚠️ Les PNG sont OPAQUES et VIOLET PLEIN BORD : la tuile arrondie du SVG est aplatie sur
 * `#6C47FF`, donc les coins ressortent violets et non transparents. Ce n'est pas un détail
 * esthétique — c'est la convention des icônes déjà livrées (mesurée : coin (0,0) = 108,71,255,
 * `hasAlpha: no` sur les trois). iOS et les lanceurs Android appliquent LEUR propre masque
 * arrondi ; livrer des coins transparents donne un liseré noir sur certains lanceurs, et
 * livrer des coins déjà arrondis produit un double arrondi.
 *
 * Lancer après TOUTE modification de LogoMark.tsx / favicon.svg :
 *   node scripts/gen-icons.mjs
 * Verrou : `src/tests/faviconMatchesMark.test.ts` compare les PNG au rendu du SVG.
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const TILE = '#6C47FF'
export const ICONS = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

/** Rendu partagé avec le test : une seule définition de « ce que le PNG doit contenir ». */
export async function renderIcon(svg, size) {
  return sharp(Buffer.from(svg), { density: 512 })
    .resize(size, size, { fit: 'contain', background: TILE })
    .flatten({ background: TILE })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const svg = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf-8')
  for (const { file, size } of ICONS) {
    const out = await renderIcon(svg, size)
    const { writeFileSync } = await import('node:fs')
    writeFileSync(join(PUBLIC, file), out)
    console.log(`[gen-icons] ${file} — ${size}×${size}, ${out.length} o`)
  }
}
