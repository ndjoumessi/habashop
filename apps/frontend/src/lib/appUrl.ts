// URL publique de l'app côté NAVIGATEUR (#156). Source unique : VITE_APP_URL, injectée au
// build par Vite depuis .env. Le pendant statique (index.html, sitemap) passe par
// scripts/gen-seo.mjs — inimportable ici (script node, hors bundle). Les DEUX défauts
// doivent coïncider ; appUrlStatic.test.ts le verrouille.
export const DEFAULT_APP_URL = 'https://habashop.vercel.app'

/** URL de l'app, sans barre oblique finale. Repli sur le défaut si VITE_APP_URL absente/vide. */
export function appUrl(): string {
  const v = ((import.meta.env.VITE_APP_URL as string | undefined) ?? '').trim()
  return (v || DEFAULT_APP_URL).replace(/\/+$/, '')
}

/** Hôte seul (sans protocole), pour afficher un lien sous forme lisible. */
export function appUrlHost(): string {
  return appUrl().replace(/^https?:\/\//, '')
}
