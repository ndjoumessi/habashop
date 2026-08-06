import { useAppStore } from '@/stores/appStore'
import { dialCodeFor, DEFAULT_MARKET } from '@/lib/defaultMarket'

/**
 * INDICATIF PROPOSÉ AU CAISSIER — dérivé du pays de la BOUTIQUE ACTIVE.
 *
 * ⚠️ POURQUOI CE HOOK PLUTÔT QU'UNE CONSTANTE.
 * `POS.tsx` ouvrait le champ du reçu WhatsApp sur `useState('+221')`. Le basculement du
 * marché par défaut vers le Cameroun aurait pu se solder par `useState('+237')` — ce qui
 * aurait créé une SEPTIÈME valeur en dur et déplacé le défaut au lieu de le supprimer.
 * Une boutique de Dakar ne doit pas plus recevoir +237 qu'une boutique de Douala ne
 * devait recevoir +221.
 *
 * L'indicatif descend donc de `tenant.country`, choisi à l'inscription. `DEFAULT_MARKET`
 * n'intervient que si ce pays est absent (compte sans boutique, cold start) ou hors des
 * marchés servis.
 *
 * ⚠️ CE N'EST PAS UNE INFÉRENCE DE PAYS. On part d'un pays DÉCLARÉ pour proposer un
 * préfixe ; on ne devine pas le pays d'un numéro. C'est la distinction qui a coûté trois
 * fuites au chantier téléphonique (cf. `docs/lessons/normalisation-telephonique.md`), et
 * `resolveRecipient` reste seul juge, côté serveur, de ce qui part réellement. Ce hook
 * corrige la CAUSE — un préfixe faux proposé au caissier — pas le symptôme.
 */
export function useTenantCountry(): string {
  const country = useAppStore(s => s.tenant?.country)
  return typeof country === 'string' && country ? country : DEFAULT_MARKET.country
}

/** Indicatif à pré-sélectionner, dérivé de la boutique active. */
export function useTenantDialCode(): string {
  return dialCodeFor(useAppStore(s => s.tenant?.country))
}
