#!/usr/bin/env node
/**
 * Génère `dist/sitemap.xml` et `dist/robots.txt` depuis les gabarits de `scripts/seo/`.
 *
 * POURQUOI un script et pas la substitution Vite. Mesuré : les fichiers de `public/` sont
 * copiés **octet pour octet** dans `dist/` — `diff public/robots.txt dist/robots.txt` est
 * vide. Vite ne les transforme pas, donc `%VITE_APP_URL%` y resterait littéral. Seul
 * `index.html` traverse le pipeline HTML et bénéficie de la substitution native.
 *
 * Les gabarits vivent HORS de `public/` : s'ils y étaient, Vite les copierait tels quels et
 * `dist/` contiendrait un `sitemap.xml.tmpl` non substitué, servi publiquement.
 *
 * ⚠️ `robots.txt` et `sitemap.xml` ne sont donc plus servis par `vite dev` — sans effet, ils
 * n'ont d'utilité que sur le site déployé, et `vite preview` sert `dist/`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TPL = join(ROOT, 'scripts', 'seo')
const DIST = join(ROOT, 'dist')

/**
 * Même défaut que `.env` et que le backend (`lib/appUrl.ts`). Le répéter ici est délibéré :
 * ce script tourne hors du pipeline Vite, donc sans accès à `import.meta.env`. Le méta-test
 * `appUrlSource.test.ts` vérifie que les deux défauts ne divergent pas.
 */
export const DEFAULT_APP_URL = 'https://habashop.vercel.app'

export function appUrl(env = process.env) {
  return ((env.VITE_APP_URL ?? '').trim() || DEFAULT_APP_URL).replace(/\/+$/, '')
}

export function render(template, url) {
  return template.replaceAll('{{APP_URL}}', url)
}

function main() {
  const url = appUrl()
  if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true })

  for (const nom of ['sitemap.xml', 'robots.txt']) {
    const tpl = join(TPL, `${nom}.tmpl`)
    if (!existsSync(tpl)) {
      console.error(`[gen-seo] gabarit introuvable : ${tpl}`)
      process.exit(1)
    }
    const out = render(readFileSync(tpl, 'utf-8'), url)
    // Un gabarit dont le marqueur a été renommé produirait un fichier SANS URL, donc un
    // sitemap muet — échec bruyant plutôt qu'un artefact vide livré en silence.
    if (!out.includes(url)) {
      console.error(`[gen-seo] ${nom} : aucune URL substituée — le marqueur {{APP_URL}} a-t-il disparu du gabarit ?`)
      process.exit(1)
    }
    writeFileSync(join(DIST, nom), out)
    console.log(`[gen-seo] dist/${nom} ← ${nom}.tmpl  (${url})`)
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main()
