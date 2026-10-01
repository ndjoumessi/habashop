import { create } from 'zustand'
import { billingApi } from '@/lib/api'

/**
 * ÉTAT DE FACTURATION — SOURCE UNIQUE, LUE DU SERVEUR, PARTAGÉE PAR TOUTES LES SURFACES.
 *
 * ⚠️ MESURÉ À L'ÉCRAN le 2026-10-01 : l'en-tête affichait « ESSAI · 14J » et, deux lignes
 * plus bas, le bandeau « 7 jour(s) d'essai restant(s) ». Le bandeau lisait `trialDaysLeft`
 * du serveur ; la pastille recalculait `createdAt + 14 jours` côté client.
 *
 * Un premier correctif a aligné les deux FORMULES sur `trialEnds`, jumelées par des cas
 * partagés. Ce store va plus loin, et c'est la décision de Nelson : il n'y a plus de
 * seconde formule du tout. *Deux calculs d'une même grandeur n'ont aucune raison de rester
 * d'accord* — un jumeau rend la divergence BRUYANTE, une source unique la rend IMPOSSIBLE.
 *
 * ⚠️ TROIS ÉTATS DE CHARGEMENT, PAS DEUX. « pas encore lu » n'est pas « lu et sans essai » :
 * tant que la réponse n'est pas là, ou si elle a échoué, aucune surface n'annonce de durée
 * d'essai. Un écran muet vaut mieux qu'un écran rassurant ou alarmant sur une donnée qu'il
 * n'a pas pu lire — c'est la règle des sondes de la console Ops.
 *
 * ⚠️ LA VALIDATION DE FORME VIT ICI, UNE FOIS. Le bandeau la portait en ligne (« backend
 * billing pas déployé → `{}` »), l'en-tête ne l'avait pas. Une réponse malformée est un
 * ÉCHEC, jamais un état à moitié lu qui afficherait « undefined jour(s) d'essai restant(s) ».
 */
export interface EtatFacturation {
  plan: string
  status: string
  /** ⚠️ Le compte du SERVEUR (`routes/billing.ts`, dérivé de `Tenant.trialEnds`). */
  trialDaysLeft: number
  isTrialExpired: boolean
  hasPendingRequest: boolean
  canContinue: boolean
}

export type ChargementFacturation = 'jamais' | 'en-cours' | 'ok' | 'echec'

function estBienForme(r: unknown): r is EtatFacturation {
  const o = r as Partial<EtatFacturation> | null
  return !!o && typeof o.status === 'string' && typeof o.trialDaysLeft === 'number'
}

interface BillingStore {
  etat: EtatFacturation | null
  chargement: ChargementFacturation
  /** Idempotent : plusieurs surfaces peuvent l'appeler au montage, un seul appel part. */
  charger: () => Promise<void>
  /** Session ou boutique changée → l'essai de la précédente ne vaut plus. */
  invalider: () => void
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  etat: null,
  chargement: 'jamais',

  charger: async () => {
    const { chargement } = get()
    if (chargement === 'en-cours' || chargement === 'ok') return
    set({ chargement: 'en-cours' })
    try {
      const r = await billingApi.status()
      if (!estBienForme(r)) { set({ etat: null, chargement: 'echec' }); return }
      set({ etat: r, chargement: 'ok' })
    } catch {
      // ⚠️ Silencieux à l'écran, pas en mémoire : l'état reste `null` et les surfaces se
      // taisent. Journaliser ici n'apporterait rien — l'appel a déjà échoué visiblement.
      set({ etat: null, chargement: 'echec' })
    }
  },

  invalider: () => set({ etat: null, chargement: 'jamais' }),
}))

/** Appelée par `authStore` aux quatre transitions de session. */
export const invaliderFacturation = () => useBillingStore.getState().invalider()
