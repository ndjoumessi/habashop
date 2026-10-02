import axios from 'axios'

/**
 * JETON MORT ≠ MAUVAIS MOT DE PASSE — et l'écran doit distinguer les deux.
 *
 * Mesuré le 2026-10-02 sur l'émulateur : le jeton de l'appareil avait dépassé son TTL
 * de 7 jours. Faute de traitement du 401 en cours de session, le commerçant restait
 * VISUELLEMENT connecté — Réglages affichait sa boutique, sa version, son backend —
 * pendant que tous les écrans rendaient « Erreur — toucher pour réessayer ». Ce message
 * nomme une panne RÉSEAU et invite à un réessai qui ne peut jamais aboutir : la seule
 * sortie était de tuer l'application, ce que personne ne devine.
 *
 * ⚠️ « 401 ⇒ déconnecter » serait FAUX. Trois routes rendent 401 pour dire « le mot de
 * passe que vous venez de taper est mauvais » : `/api/auth/login`,
 * `PATCH /api/auth/password` (écran Réglages → Changer le mot de passe) et
 * `DELETE /api/account/me`. Sur celles-là, déconnecter éjecterait un commerçant pour une
 * faute de frappe — et l'alerte « Mot de passe incorrect » s'afficherait par-dessus un
 * écran de connexion.
 *
 * ⚠️ Et une liste d'URL exemptées serait fausse au prochain ajout de route : personne ne
 * pense à la mettre à jour. On exige donc une identification POSITIVE, posée par les
 * deux seules gardes qui jugent le PORTEUR (`authenticate`, `authenticateAdmin`).
 * Son absence laisse l'erreur suivre son cours normal — le défaut de prudence va vers
 * « je ne déconnecte pas », jamais vers une déconnexion surprise.
 *
 * Code partagé avec le backend : `docs/shared-fixtures/auth-refusal.json`.
 */
export const CODE_JETON_INVALIDE = 'TOKEN_INVALID'

/** Cette erreur signifie-t-elle « votre session a expiré, reconnectez-vous » ? */
export function estSessionExpiree(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const reponse = err.response
  if (!reponse || reponse.status !== 401) return false
  return (reponse.data as { code?: string } | undefined)?.code === CODE_JETON_INVALIDE
}
