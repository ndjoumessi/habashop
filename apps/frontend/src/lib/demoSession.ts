/**
 * MARQUAGE D'UNE SESSION DE DÉMONSTRATION.
 *
 * ⚠️ Module SÉPARÉ, et c'est structurel : l'intercepteur 401 vit dans `lib/api.ts`, et lui
 * faire importer `stores/authStore` créerait un cycle d'import (le store importe l'API).
 *
 * ⚠️ À quoi il sert : quand une démo jetable est purgée, le backend rend un 401 propre
 * (`authenticate` appelle `isUserActive`, qui ne trouve plus l'utilisateur supprimé). Sans ce
 * drapeau, l'intercepteur enverrait le visiteur sur `/login` — un formulaire qu'un visiteur
 * de démo ne peut pas remplir, puisqu'il n'a jamais eu de compte.
 *
 * ⚠️ Tout accès au stockage est protégé : en navigation privée ou avec les données de site
 * bloquées, `localStorage` peut lever. Une exception ici ne doit jamais empêcher un appel API.
 */

const CLE = 'habashop_demo_session'

/** La session courante est-elle une démo jetable ? */
export function isDemoSession(): boolean {
  try { return localStorage.getItem(CLE) === '1' } catch { return false }
}

export function markDemoSession(): void {
  try { localStorage.setItem(CLE, '1') } catch { /* stockage indisponible : sans effet */ }
}

export function clearDemoSession(): void {
  try { localStorage.removeItem(CLE) } catch { /* stockage indisponible : sans effet */ }
}
