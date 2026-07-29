/**
 * URL publique de l'app web — SOURCE UNIQUE côté MOBILE (#156).
 *
 * Le littéral `habashop.vercel.app` était recopié à trois endroits, dont DEUX imprimés sur des
 * artefacts qui partent chez le CLIENT : le pied du ticket d'impression et le ticket WhatsApp.
 * Le jour d'un domaine propre, ces tickets auraient continué d'annoncer l'ancien hôte à des
 * clients qui n'ont aucun moyen de deviner le nouveau. Le troisième (Réglages → mot de passe)
 * envoie le commerçant sur le web.
 *
 * ⚠️ **Ce n'est PAS `mobile/app.json`.** La version mobile est une piste séparée du produit web
 * (elle pilote `runtimeVersion`/OTA) ; l'URL de l'app web, elle, est bien la même notion que
 * `FRONTEND_URL` côté backend et `VITE_APP_URL` côté front. Trois plateformes, trois lectures,
 * une seule valeur — l'égalité des défauts est verrouillée par les méta-tests de chaque côté.
 *
 * ⚠️ **Expo inline `process.env.EXPO_PUBLIC_*` STATIQUEMENT au bundling** : la substitution est
 * textuelle, donc la variable doit apparaître en toutes lettres. Un accès calculé
 * (`process.env[clef]`) ne serait jamais remplacé. D'où la lecture littérale ci-dessous, et
 * d'où la séparation avec `normalizeAppUrl` : la logique reste exerçable par un test sans
 * dépendre de ce que babel a inliné au moment de la transformation.
 */

/** Repli quand `EXPO_PUBLIC_APP_URL` n'est pas posée — l'hôte servant l'app aujourd'hui. */
export const DEFAULT_APP_URL = 'https://habashop.vercel.app'

/**
 * Normalise une valeur brute d'environnement. Exportée pour être testable : une valeur vide
 * ou blanche est traitée comme absente (`EXPO_PUBLIC_APP_URL=` ne doit pas produire une chaîne
 * vide imprimée sur un ticket client), et la barre oblique finale est retirée pour qu'une
 * concaténation ne fabrique jamais `https://…//privacy`.
 */
export function normalizeAppUrl(raw: string | undefined | null): string {
  return ((raw ?? '').trim() || DEFAULT_APP_URL).replace(/\/+$/, '')
}

/** URL de l'app web, sans barre oblique finale. */
export function appUrl(): string {
  return normalizeAppUrl(process.env.EXPO_PUBLIC_APP_URL)
}

/**
 * Hôte seul, sans protocole — la forme lisible qu'on imprime sur un ticket.
 * Un client lit `habashop.vercel.app`, pas `https://habashop.vercel.app`.
 */
export function appUrlHost(): string {
  return appUrl().replace(/^https?:\/\//, '')
}
