/**
 * Décide l'identité d'une connexion WebSocket à partir du token (query ou header).
 * Pur & testable : AUCUN accès DB/Redis ici. Le check « compte actif » (parité
 * avec l'auth HTTP) se fait ensuite dans le handler, après ce verdict.
 *
 * @param token   le JWT extrait de `?token=` ou de l'en-tête Authorization
 * @param verify  fonction de vérification (ex. `app.jwt.verify`) — throw si invalide
 * @returns       identité validée, ou échec avec une raison (fail-closed)
 */
export type WsAuthResult =
  | { ok: true; tenantId: string; userId: string }
  | { ok: false; reason: 'no-token' | 'invalid-token' | 'no-tenant' }

export function decideWsAuth(
  token: string | undefined | null,
  verify: (t: string) => any,
): WsAuthResult {
  if (!token) return { ok: false, reason: 'no-token' }
  let payload: any
  try {
    payload = verify(token)
  } catch {
    return { ok: false, reason: 'invalid-token' }
  }
  const tenantId = payload?.tenantId
  const userId = payload?.userId
  // Un JWT valide émis par /auth contient toujours tenantId ; sans lui on refuse
  // (évite d'indexer un socket sous une clé `undefined` dans tenantSockets).
  if (!tenantId || typeof tenantId !== 'string') return { ok: false, reason: 'no-tenant' }
  return { ok: true, tenantId, userId: String(userId ?? '') }
}
