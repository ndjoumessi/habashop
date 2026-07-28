/**
 * URL de l'application web — SOURCE UNIQUE côté backend.
 *
 * Le littéral `https://habashop.vercel.app` était recopié à **17 endroits** : logo et pied de
 * page de chaque e-mail transactionnel, liens `login`/`upgrade`/`stock`/`dashboard`, redirections
 * de paiement Campay et PayDunya. Le jour d'un domaine propre, il aurait fallu tous les retrouver
 * — et ceux qu'on aurait manqués auraient continué d'envoyer les commerçants vers l'ancien hôte,
 * depuis des e-mails déjà partis. Même principe que la version produit : une seule lecture.
 *
 * ⚠️ On réutilise **`FRONTEND_URL`**, la variable qui EXISTE déjà (`payments.ts`,
 * `paydunyaPayment.ts`, liste CORS de `server.ts`, `.env.example`, `SETUP.md`). Introduire un
 * second nom pour le même concept recréerait la divergence que le versionnage a coûté cher à
 * fermer — six valeurs pour une seule vérité.
 *
 * Lu **À L'APPEL**, jamais figé au chargement du module : même convention que les plafonds de
 * la garde de dépense (ajustable sans redéploiement), et surtout indispensable pour qu'un test
 * puisse poser l'env avant d'exercer une route.
 */

/** Repli quand `FRONTEND_URL` n'est pas posée — l'hôte servant l'app aujourd'hui. */
export const DEFAULT_APP_URL = 'https://habashop.vercel.app'

/**
 * Base de l'application, sans barre oblique finale.
 * Une valeur d'env vide ou blanche est traitée comme absente : `FRONTEND_URL=` dans un
 * fichier `.env` ne doit pas produire des liens `"/login"` sans hôte, qui seraient morts
 * dans un e-mail (un client de messagerie n'a aucune origine à laquelle les rattacher).
 */
export function appBaseUrl(): string {
  const raw = (process.env.FRONTEND_URL ?? '').trim()
  return (raw || DEFAULT_APP_URL).replace(/\/+$/, '')
}

/**
 * URL absolue vers un chemin de l'app : `appUrl('/login')` → `https://…/login`.
 * Le chemin est normalisé pour rester correct que l'appelant écrive `'/login'` ou `'login'`.
 */
export function appUrl(path = ''): string {
  const p = String(path).trim()
  if (!p) return appBaseUrl()
  return `${appBaseUrl()}/${p.replace(/^\/+/, '')}`
}

/** Hôte seul (`habashop.vercel.app`) — pour les libellés de lien affichés dans les e-mails. */
export function appHost(): string {
  return appBaseUrl().replace(/^https?:\/\//, '')
}
