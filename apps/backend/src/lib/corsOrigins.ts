/**
 * Origines autorisées par CORS — SOURCE UNIQUE.
 *
 * ⚠️ **Ce module existe pour un défaut MESURÉ, pas par principe.** `FRONTEND_URL` avait
 * **deux lecteurs qui ne normalisaient pas pareil** : `lib/appUrl.ts` retire la barre oblique
 * finale (`.replace(/\/+$/, '')`), `server.ts` poussait la valeur BRUTE dans la liste CORS.
 * Poser `FRONTEND_URL=https://app.exemple.com/` — la forme qu'on copie depuis une barre
 * d'adresse — donnait donc des e-mails corrects ET une application MORTE : le navigateur
 * envoie `Origin: https://app.exemple.com` (jamais de barre finale), la liste contenait
 * `https://app.exemple.com/`, aucune correspondance, **toutes** les requêtes refusées. Écran
 * vide, aucune erreur parlante. C'est le jumeau non traité de `appBaseUrl`, sur le chemin le
 * plus sensible du jour de la migration.
 *
 * ⚠️ **Un rejet se DIT.** Une entrée malformée (schéma oublié, `*`, espace parasite) produit
 * exactement le même écran vide qu'un oubli. Elle n'est donc pas écartée en silence : elle
 * ressort dans `rejected`, que `server.ts` journalise au démarrage. *Une garde qui refuse
 * sans le dire est indistinguable d'une garde absente.*
 *
 * ⚠️ **`CORS_EXTRA_ORIGINS` n'est PAS un second nom pour l'URL de l'app** (cf. l'interdiction
 * d'un `APP_URL` à côté de `FRONTEND_URL`) : c'est une notion DIFFÉRENTE — « quelles autres
 * origines ont le droit d'appeler l'API ». Elle existe pour dissoudre l'ordre contraint de la
 * migration de domaine : on autorise la nouvelle origine AVANT de basculer `FRONTEND_URL`,
 * sans redéploiement, donc sans fenêtre où le front neuf parle à une API qui le refuse.
 *
 * ⚠️ **Aucun joker.** `credentials: true` interdit `*` côté navigateur, et un motif
 * `*.vercel.app` autoriserait le site de n'importe quel utilisateur de Vercel à appeler cette
 * API avec les identifiants du commerçant. Les prévisualisations de PR restent donc hors CORS,
 * et c'est **délibéré** : ce sont des builds de vérification, pas des fronts à brancher.
 */

/** L'hôte qui sert l'application aujourd'hui — reste autorisé après la migration (additif). */
export const LEGACY_APP_ORIGIN = 'https://habashop.vercel.app'

/**
 * Normalise une entrée en ORIGINE au sens du navigateur : `schéma://hôte[:port]`, sans
 * chemin, sans barre finale, en minuscules (l'hôte et le schéma sont insensibles à la casse,
 * et un navigateur envoie toujours la forme minuscule).
 *
 * Rend `null` sur tout ce qui ne peut PAS correspondre à un en-tête `Origin` — plutôt que de
 * laisser entrer une valeur qui ne matchera jamais.
 */
export function normalizeOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().replace(/\/+$/, '').toLowerCase()
  if (!v) return null
  // Un `Origin` n'a ni chemin, ni requête, ni fragment, ni identifiants.
  if (!/^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/.test(v)) return null
  return v
}

/** Vrai pour une origine de développement local, quel que soit le port. */
export function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/.test(origin.trim().toLowerCase())
}

export type AllowedOrigins = {
  /** Les origines retenues, normalisées et dédoublonnées, dans l'ordre de déclaration. */
  origins: string[]
  /** Les entrées NON VIDES écartées faute d'être des origines valides — à journaliser. */
  rejected: string[]
}

/**
 * Construit la liste à partir de l'environnement. Lue **à l'appel**, comme `appBaseUrl` et
 * comme les plafonds de la garde de dépense.
 *
 * Sources, dans cet ordre : l'hôte historique · `FRONTEND_URL` · `CORS_EXTRA_ORIGINS`
 * (séparateurs : virgule, point-virgule ou espace).
 */
export function buildAllowedOrigins(env: NodeJS.ProcessEnv = process.env): AllowedOrigins {
  const origins: string[] = []
  const rejected: string[] = []

  const accepter = (raw: string | undefined) => {
    const brut = (raw ?? '').trim()
    if (!brut) return // absence = rien à dire ; c'est le cas normal
    const o = normalizeOrigin(brut)
    if (!o) { rejected.push(brut); return }
    if (!origins.includes(o)) origins.push(o)
  }

  accepter(LEGACY_APP_ORIGIN)
  accepter(env.FRONTEND_URL)
  for (const part of String(env.CORS_EXTRA_ORIGINS ?? '').split(/[,;\s]+/)) accepter(part)

  return { origins, rejected }
}

/**
 * LA DÉCISION, en une fonction nommée — exercée telle quelle par le verrou.
 *
 * ⚠️ Elle est ici, pas en ligne dans `server.ts`, pour une raison mesurée ailleurs dans ce
 * dépôt : *une règle réécrite dans un test ne prouve rien de ce que le code fait.* Un test qui
 * rejouerait la comparaison resterait vert alors même que le serveur en applique une autre.
 *
 * L'origine REÇUE est normalisée elle aussi : un navigateur envoie la forme canonique, mais un
 * appel serveur-à-serveur ou un outil peut envoyer autre chose — et une origine qui n'est pas
 * une origine n'a rien à faire dans une comparaison d'égalité.
 */
export function isOriginAllowed(origin: string, allowed: readonly string[]): boolean {
  const o = normalizeOrigin(origin)
  if (!o) return false
  return isLocalhostOrigin(o) || allowed.includes(o)
}
