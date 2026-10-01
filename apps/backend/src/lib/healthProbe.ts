/**
 * SONDES DE SANTÉ — mesurer, ou DIRE qu'on ne mesure pas.
 *
 * ⚠️ `GET /api/health-extended` rendait `services.redis = { status: 'configured' }`. Ce champ
 * reflétait la seule présence de `REDIS_URL` : il ne pouvait pas être faux, donc il ne
 * prouvait rien — et il coûtait plus cher qu'un champ absent, parce qu'on s'y fie. C'est le
 * motif « le CHAMP DÉCLARÉ QUI SE FAIT PASSER POUR UNE MESURE ».
 *
 * ⚠️ L'enjeu a monté le 2026-10-01 : `POST /api/demo/start` est FAIL-CLOSED sur Redis. Si
 * Redis tombe, le bouton « Essayer la démo » de la vitrine cesse de fonctionner. Un exploitant
 * doit pouvoir le voir, et « configured » ne le lui aurait jamais dit.
 *
 * ⚠️ DEUX vocabulaires, délibérément distincts, parce que c'est le NOM qui porte la moitié de
 * la correction :
 *   • `sonderRedis()` rend un `etat` MESURÉ — `absent` | `up` | `down`, avec une latence ;
 *   • `declarer()` rend un `declared` — et son champ ne s'appelle PAS `status`, n'emploie ni
 *     « ok » ni « up », précisément pour qu'on ne puisse pas le lire comme une mesure.
 *
 * ⚠️ TROIS états, jamais deux. `absent` n'est pas `down` : une variable non posée est une
 * CONFIGURATION, pas une panne, et les confondre ferait rougir un déploiement volontairement
 * sans cache.
 */

export type EtatSonde = 'absent' | 'up' | 'down'

export interface ResultatSonde {
  etat: EtatSonde
  /** Millisecondes, uniquement si la sonde a répondu. */
  latence?: number
  /** Pourquoi c'est `down`. Jamais une valeur secrète — un message d'erreur, tronqué. */
  raison?: string
}

/** Le minimum exigé d'un client Redis : savoir répondre à un PING. */
export interface ClientPingable {
  ping(): Promise<string> | string
}

/** Longueur maximale conservée d'un message d'erreur — on rapporte, on ne déverse pas. */
const RAISON_MAX = 120

/**
 * Sonde RÉELLE de Redis, bornée en temps.
 *
 * ⚠️ NE LÈVE JAMAIS. L'endpoint de santé doit RAPPORTER la panne, pas la propager : un
 * `/api/health-extended` qui tombe parce que Redis est tombé ne dit plus rien du reste.
 *
 * ⚠️ Bornée par `timeoutMs` : un Redis qui accepte la connexion sans jamais répondre ferait
 * sinon pendre l'endpoint, et une sonde qui pend est un signal absent déguisé en attente.
 */
export async function sonderRedis(client: ClientPingable | null, timeoutMs = 1_500): Promise<ResultatSonde> {
  if (!client) return { etat: 'absent' }
  const t0 = Date.now()
  try {
    const reponse = await Promise.race([
      Promise.resolve().then(() => client.ping()),
      new Promise<never>((_, rejeter) =>
        setTimeout(() => rejeter(new Error(`délai de ${timeoutMs} ms dépassé`)), timeoutMs)),
    ])
    // ⚠️ On vérifie la RÉPONSE, pas seulement l'absence d'erreur : un client qui rend autre
    // chose que PONG ne parle pas à un Redis sain.
    if (String(reponse).toUpperCase() !== 'PONG') {
      return { etat: 'down', latence: Date.now() - t0, raison: `réponse inattendue au PING` }
    }
    return { etat: 'up', latence: Date.now() - t0 }
  } catch (e) {
    const raison = (e instanceof Error ? e.message : String(e)).slice(0, RAISON_MAX)
    return { etat: 'down', latence: Date.now() - t0, raison }
  }
}

/**
 * CONFIGURATION DÉCLARÉE — pour ce qu'on ne sonde pas.
 *
 * ⚠️ Le champ s'appelle `declared` et pas `status`, et sa valeur n'emploie ni « ok » ni
 * « up » : le nom doit empêcher de le lire comme une mesure. C'est la convention déjà retenue
 * par `lib/integrationStatus.ts` et par la console Ops côté front.
 */
export function declarer(present: boolean): { declared: 'configured' | 'absent' } {
  return { declared: present ? 'configured' : 'absent' }
}
