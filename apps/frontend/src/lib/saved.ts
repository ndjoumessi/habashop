import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'

/**
 * SIGNALE un échec d'enregistrement au lieu de l'avaler.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * Sept sites du front écrivaient `xxxApi.update(...).catch(() => {})` juste après
 * avoir mis à jour le store local et affiché un toast de SUCCÈS. Quand le serveur
 * refuse, l'écran affirme que c'est enregistré et la donnée n'existe nulle part —
 * elle disparaît au prochain `/me` ou sur un autre appareil.
 *
 * Mesuré le 2026-08-08 : l'Onboarding envoyait tout son payload (nom, téléphone,
 * adresse, pays, TVA) dans un `PATCH /api/tenant` unique, puis `.catch(() => {})`,
 * puis marquait l'onboarding terminé. Un seul champ refusé par le serveur perdait
 * les cinq autres, en silence, avec l'écran de succès affiché par-dessus.
 *
 * ⚠️ CE HELPER NE DÉCIDE RIEN. Il rapporte et rend un booléen ; c'est l'appelant
 * qui choisit de revenir en arrière, de rester sur l'écran ou de continuer. Un
 * goulot ne doit pas être un entonnoir : centraliser la DÉCISION ferait perdre ce
 * que chaque appelant distingue (bloquant vs accessoire, revert possible ou non).
 *
 * ⚠️ Le message du SERVEUR est préféré au nôtre quand il existe : c'est lui qui
 * nomme ce qui manque. Un « Échec de l'enregistrement » générique redonne au
 * commerçant exactement l'information qu'on vient d'arrêter de perdre.
 *
 * @param promesse l'appel d'API à surveiller
 * @param quoi     ce qu'on tentait d'enregistrer, déjà traduit (« les réglages de la boutique »)
 * @returns `true` si l'enregistrement a abouti, `false` sinon
 */
export async function saved(promesse: Promise<unknown>, quoi: string): Promise<boolean> {
  try {
    await promesse
    return true
  } catch (e: unknown) {
    const duServeur = (e as { message?: string } | null)?.message
    const message = duServeur && duServeur.trim() ? duServeur : `Échec de l'enregistrement : ${quoi}`
    toast.error(message)
    announce(message)
    return false
  }
}
