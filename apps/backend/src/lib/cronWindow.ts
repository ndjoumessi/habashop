/**
 * FENÊTRE D'EXÉCUTION DES CRONS — décision de planification, isolée pour être TESTABLE.
 *
 * ⚠️ LE DÉFAUT QUE CE MODULE CORRIGE, MESURÉ le 2026-10-01. Les crons du dépôt se gardaient
 * par `if (now.getHours() !== H || now.getMinutes() > 5) return` tout en étant enregistrés
 * avec un `setInterval` d'UNE HEURE. Or un `setInterval` horaire déclenche toujours à la MÊME
 * minute que son enregistrement — la minute de démarrage du conteneur. Démarré à la minute 37,
 * chaque tick voyait `getMinutes() === 37`, donc `> 5`, donc la garde retournait TOUJOURS :
 * **54 minutes de démarrage sur 60 rendaient la tâche inexécutable à vie.** Le rapport
 * hebdomadaire, le balayage PII des démos, les alertes de stock et le récap de paie ne
 * tournaient jamais, et rien ne le signalait — « l'alarme qui ne peut pas sonner ».
 *
 * ⚠️ DEUX pièces, et il faut les deux :
 *
 * 1. **Un pas de 5 minutes** (`PAS_MS`), plus petit que la fenêtre. Comme 5 divise 60, les
 *    minutes atteintes forment une classe de résidus qui rencontre forcément `[0, 5]` ; et
 *    comme le pas est plus petit que la fenêtre, la garantie survit à la dérive de
 *    `setInterval`. C'est l'invariant `PAS_MS <= (FENETRE_MINUTES + 1) * 60_000`, verrouillé
 *    par `cronWindow.test.ts` : l'enfreindre fait revenir le défaut mesuré ci-dessus.
 *
 * 2. **Un marqueur idempotent** — la pièce que la convention du dépôt réclame
 *    (« `setInterval` + garde fenêtre-temps + marqueur idempotent ») et qu'aucun cron n'avait.
 *    Sans lui, une fenêtre de 6 minutes parcourue par un pas de 5 peut porter DEUX ticks
 *    (minutes 0 et 5) : les alertes de stock et le rapport hebdomadaire partiraient en double
 *    chez le commerçant. Le marqueur borne à UNE exécution par heure cible.
 *
 * ⚠️ MARQUEUR EN MÉMOIRE, délibérément, et sa limite est écrite : il ne survit pas à un
 * redémarrage (sans effet — un redémarrage dans la fenêtre est un cas de bord bénin), et il
 * est LOCAL AU PROCESSUS. Deux replicas exécuteraient donc chacun leur passe. Ce n'est pas une
 * régression : c'était déjà vrai avant ce module, et Railway ne sert qu'un replica ici. Le
 * jour où l'on passe à deux, c'est un marqueur EN BASE qu'il faudra — ne pas croire que
 * celui-ci protège de la concurrence entre conteneurs.
 */

/** Dernière minute de la fenêtre, incluse. Fenêtre = minutes 0 à 5 (six minutes). */
export const FENETRE_MINUTES = 5

/** Pas du `setInterval`. ⚠️ Doit rester ≤ la largeur de la fenêtre (cf. en-tête). */
export const PAS_MS = 5 * 60 * 1000

export interface CibleCron {
  /** Heure visée, 0-23. */
  heure: number
  /** Jour de la semaine visé (0 = dimanche, 1 = lundi). Omis = tous les jours. */
  jourDeSemaine?: number
  /** Jour du mois visé. Omis = tous les jours. */
  dateDuMois?: number
}

/** `nom` → dernière heure exécutée, en clé locale `AAAA-MM-JJ-HH`. */
const marqueurs = new Map<string, string>()

/** Clé d'heure LOCALE — les cibles sont exprimées dans le fuseau du conteneur, comme avant. */
const cleHeure = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`

/**
 * Ce cron doit-il s'exécuter maintenant ?
 *
 * ⚠️ APPELER UNE SEULE FOIS PAR TICK : un appel qui rend `true` POSE le marqueur, donc un
 * second appel pour le même tick rendrait `false`. La fonction décide et enregistre d'un seul
 * geste, précisément pour qu'on ne puisse pas oublier d'enregistrer.
 */
export function doitTourner(nom: string, now: Date, cible: CibleCron): boolean {
  if (now.getHours() !== cible.heure) return false
  if (now.getMinutes() > FENETRE_MINUTES) return false
  if (cible.jourDeSemaine !== undefined && now.getDay() !== cible.jourDeSemaine) return false
  if (cible.dateDuMois !== undefined && now.getDate() !== cible.dateDuMois) return false

  const cle = cleHeure(now)
  if (marqueurs.get(nom) === cle) return false
  marqueurs.set(nom, cle)
  return true
}

/** Remise à zéro — tests uniquement. */
export function _viderMarqueurs(): void {
  marqueurs.clear()
}
