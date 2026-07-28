import type { SalePayload } from '@/types'
import { recordFailedSale } from './failedSales'

/**
 * REJEU d'une vente de la file hors-ligne — la vente a DÉJÀ été encaissée au comptoir.
 *
 * Extrait de `useOfflineSync` pour avoir une couture testable : la réponse serveur était
 * JETÉE (`await salesApi.create(...)` sans affectation), et le seul moyen de verrouiller
 * qu'elle ne le soit plus est d'exercer le code qui la consomme. Un test-miroir réécrivant
 * la boucle à la main resterait vert le jour où le hook cesserait de lire la réponse.
 *
 * Deux responsabilités, et rien d'autre :
 *   1. poser `offlineReplay: true` — ICI et nulle part ailleurs. Une vente en ligne directe
 *      ne doit jamais le porter : le serveur re-tarifierait moins, alors que le client est
 *      encore au comptoir et que `reconcileSaleTotal` peut encore lui réclamer la différence.
 *   2. comparer le montant FACTURÉ au montant ENCAISSÉ. Le serveur reste autoritaire sur le
 *      prix : hors bornes (changement > 48 h, deux changements pendant la coupure, tarif non
 *      qualifié, vente mixte partielle) il re-tarife, et l'écart part dans le tiroir. Le rejeu
 *      ayant lieu hors de la présence du client, l'avertissement ne peut pas être un toast :
 *      il faut une entrée DURABLE.
 */

/** Tolérance d'arrondi, alignée sur le paiement mixte et sur `reconcileSaleTotal` côté web. */
export const REPLAY_TOTAL_TOLERANCE = 1

export interface ReplayDeps {
  /** Injecté pour le test ; en production `salesApi.create`. */
  create: (payload: SalePayload) => Promise<{ total?: number } | null | undefined>
  record?: typeof recordFailedSale
}

export interface ReplayOutcome {
  /** Montant facturé par le serveur, `null` si la réponse ne le porte pas. */
  serverTotal: number | null
  /** Une entrée durable « à vérifier » a-t-elle été écrite ? */
  repriced: boolean
}

/**
 * Rejoue UNE vente. Laisse remonter l'erreur : la file (retries, registre `rejected` /
 * `exhausted`) reste seule responsable de la gestion d'échec — ne pas la dupliquer ici.
 */
export async function replayQueuedSale(
  action: { id: string; payload: SalePayload },
  deps: ReplayDeps,
): Promise<ReplayOutcome> {
  const record = deps.record ?? recordFailedSale
  const sale = await deps.create({ ...action.payload, offlineReplay: true })

  const encaisse = Number(action.payload.total)
  const brut = sale?.total
  // ⚠️ `Number(null) === 0` : sans filtre d'absence explicite, une réponse sans total
  // déclencherait « facturé 0 » sur une vente saine. Une absence doit rester une absence.
  const facture = brut == null ? NaN : Number(brut)
  if (!Number.isFinite(facture) || !Number.isFinite(encaisse)) return { serverTotal: null, repriced: false }
  if (Math.abs(facture - encaisse) <= REPLAY_TOTAL_TOLERANCE) return { serverTotal: facture, repriced: false }

  // `repriced` ≠ `rejected` : la vente EXISTE. Le geste attendu est de vérifier la caisse,
  // pas de ressaisir — ressaisir la compterait deux fois.
  await record({
    id: action.id, payload: action.payload, reason: 'repriced',
    failedAt: new Date().toISOString(), total: encaisse, serverTotal: facture,
  })
  return { serverTotal: facture, repriced: true }
}
