/**
 * CODE DE REFUS DU PORTEUR — source unique.
 *
 * ⚠️ Un 401 n'a pas un seul sens dans cette API. TROIS routes l'emploient pour dire
 * « le mot de passe que vous venez de taper est mauvais » (`/api/auth/login`,
 * `PATCH /api/auth/password`, `DELETE /api/account/me`) et deux pour « cette signature
 * de webhook ne correspond pas ». Aucune de ces cinq ne veut dire « reconnectez-vous ».
 *
 * Ce code identifie POSITIVEMENT le seul cas qui l'exige : le jeton porté est
 * illisible, expiré, ou rattaché à un compte qui n'existe plus. Il n'est posé que par
 * `authenticate` et `authenticateAdmin` — les deux seules gardes qui jugent le PORTEUR
 * plutôt qu'une preuve fournie dans la requête.
 *
 * ⚠️ Un client NE DOIT PAS déduire l'expiration d'une liste d'URL exemptées : une liste
 * est fausse dès qu'une route s'ajoute, et personne ne pense à la mettre à jour. Le
 * client exige ce code ; son absence le laisse dans son comportement d'erreur normal.
 *
 * Verrou : `codeJetonInvalide.test.ts` (périmètre dérivé de `src/` — tout `code(401)`
 * y est classé garde ou refus d'identifiants).
 */
export const TOKEN_INVALID = 'TOKEN_INVALID'
