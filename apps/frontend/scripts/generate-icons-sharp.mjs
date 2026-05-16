import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const out = join(__dir, '../public')

// Purple gradient SVG with "H" letter
function makeSvg(size) {
  const fontSize = Math.round(size * 0.55)
  const r = Math.round(size * 0.18)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <text x="50%" y="52%" font-family="Arial,Helvetica,sans-serif" font-weight="800"
    font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">H</text>
</svg>`
}

async function generate(size, filename) {
  const svg = Buffer.from(makeSvg(size))
  await sharp(svg).png().toFile(join(out, filename))
  console.log(`✓ ${filename} (${size}x${size})`)
}

await generate(192, 'pwa-192x192.png')
await generate(512, 'pwa-512x512.png')
await generate(180, 'apple-touch-icon.png')
console.log('Icons generated successfully.')
