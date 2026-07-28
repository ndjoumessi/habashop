import { logger } from '@/lib/logger'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SalePayload } from '@/types'

/**
 * Ventes ENCAISSÉES mais JAMAIS ENREGISTRÉES — registre durable et visible.
 *
 * Le rejeu de la file offline retirait purement et simplement une action qu'il ne
 * pouvait pas rejouer (`removeAction` + `logger.error`). En build release ce log part
 * dans logcat, que personne ne lit : de l'argent était dans le tiroir et aucune vente
 * n'existait nulle part. Pire encore depuis le durcissement d'intégrité prix, où un
 * produit absent du catalogue renvoie 400 `UNKNOWN_PRODUCT` — donc non rejouable.
 *
 * Ce registre est le contraire d'un log : il SURVIT, il se voit, et il faut un geste
 * humain pour le solder. Il ne réenregistre RIEN tout seul — une ligne orpheline créée
 * automatiquement serait une invention comptable. Il dit seulement ce qui a été encaissé
 * sans être enregistré, pour que quelqu'un ressaisisse.
 */

const KEY = 'habashop_failed_sales'

/** Pourquoi la vente demande une intervention humaine. */
export type FailedSaleReason =
  | 'rejected'   // 4xx définitive (produit inconnu, validation) — rejouer n'y changera rien
  | 'exhausted'  // réseau/5xx persistant après MAX_QUEUE_RETRIES
  // ⚠️ `repriced` n'est PAS un échec : la vente EXISTE côté serveur. C'est le MONTANT qui
  // diffère de ce qui a été encaissé — rejeu hors bornes (changement de prix > 48 h, deux
  // changements pendant la coupure, tarif non qualifié, ou vente mixte partiellement
  // qualifiée). Le geste attendu est de VÉRIFIER LA CAISSE, pas de ressaisir la vente :
  // fusionner ce motif avec `rejected` ferait ressaisir une vente déjà enregistrée, donc
  // la compterait deux fois. Les deux libellés doivent rester distincts.
  | 'repriced'

export interface FailedSale {
  id: string
  payload: SalePayload
  reason: FailedSaleReason
  /** Code applicatif du serveur s'il en a donné un (ex. UNKNOWN_PRODUCT). */
  code?: string
  /** Message serveur, tel quel — jamais réinterprété. Absent si le serveur n'a rien dit. */
  message?: string
  /** Horodatage de l'abandon (device). Indicatif : sert à ordonner, pas à décider. */
  failedAt: string
  /** Montant ENCAISSÉ au comptoir — c'est lui qui doit être ressaisi (ou vérifié). */
  total: number
  /** `repriced` seulement : montant réellement FACTURÉ par le serveur. L'écart avec `total`
   *  est ce qui manque (ou ce qui est en trop) dans le tiroir. */
  serverTotal?: number
}

/** La vente existe-t-elle côté serveur ? `repriced` = oui (à vérifier), les autres = non (à ressaisir). */
export const isRecorded = (reason: FailedSaleReason): boolean => reason === 'repriced'

export async function getFailedSales(): Promise<FailedSale[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FailedSale[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Consigne une vente abandonnée. Idempotent sur `id` : un même abandon rejoué (relance
 * de l'app, double cycle de sync) ne crée pas deux lignes — sinon le registre gonflerait
 * et le commerçant ne saurait plus combien de ventes il doit réellement ressaisir.
 */
export async function recordFailedSale(entry: FailedSale): Promise<void> {
  try {
    const list = await getFailedSales()
    if (list.some(e => e.id === entry.id)) return
    await AsyncStorage.setItem(KEY, JSON.stringify([...list, entry]))
  } catch (err) {
    logger.error('recordFailedSale error:', err)
  }
}

/** Solde une entrée — geste HUMAIN uniquement (la vente a été ressaisie, ou écartée). */
export async function dismissFailedSale(id: string): Promise<void> {
  try {
    const list = await getFailedSales()
    await AsyncStorage.setItem(KEY, JSON.stringify(list.filter(e => e.id !== id)))
  } catch (err) {
    logger.error('dismissFailedSale error:', err)
  }
}

export async function getFailedCount(): Promise<number> {
  return (await getFailedSales()).length
}
