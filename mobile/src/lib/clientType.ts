// Palier commercial d'un client — helper PUR d'AFFICHAGE (#215).
//
// ⚠️ La RÈGLE de normalisation vit dans les jumeaux `apps/backend/src/lib/clientType.ts` et
// `apps/frontend/src/lib/clientType.ts`, arbitrés par `docs/shared-fixtures/client-type-cases.json`.
// Ici on ne DÉCIDE rien : on traduit pour l'écran une valeur déjà écrite par le serveur.
//
// Pourquoi ce fichier existe : le panier POS affichait `customer.type` BRUT, donc
// « wholesale » à un commerçant francophone (`POSCart.tsx`). La base porte l'enum canonique
// ANGLAIS depuis la migration ; l'écran, lui, doit parler la langue de l'utilisateur.
//
// ⚠️ Les libellés HÉRITÉS français ('Grossiste', 'Semi-gros'…) restent acceptés en lecture :
// une app mobile installée peut lire une réponse servie avant la migration, ou un cache
// local antérieur. Ne pas les gérer afficherait la valeur brute — le défaut qu'on corrige.

export type ClientTypeValue = 'retail' | 'semi-wholesale' | 'wholesale' | 'loyal'

/** Retire les diacritiques : compare « Détail » et « detail » sans table à rallonge. */
function fold(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Canoniques + libellés hérités RÉELLEMENT écrits par nos anciens formulaires (ensemble CLOS). */
const CANON: Record<string, ClientTypeValue> = {
  retail: 'retail', 'semi-wholesale': 'semi-wholesale', wholesale: 'wholesale', loyal: 'loyal',
  detail: 'retail', 'semi-gros': 'semi-wholesale', grossiste: 'wholesale', fidele: 'loyal',
}

const LABELS: Record<ClientTypeValue, [fr: string, en: string, es: string, it: string]> = {
  retail:           ['Détail',    'Retail',     'Minorista',  'Dettaglio'],
  'semi-wholesale': ['Semi-gros', 'Semi-whsl.', 'Semi-mayor', 'Semi-ingr.'],
  wholesale:        ['Grossiste', 'Wholesaler', 'Mayorista',  'Grossista'],
  loyal:            ['Fidèle',    'Loyal',      'Fiel',       'Fedele'],
}

/**
 * Libellé affichable d'un type client. Rend `null` si la valeur est vide ou inconnue —
 * ⚠️ JAMAIS un repli sur « Détail » : un défaut implicite rend indistinguables « client au
 * détail » et « type jamais saisi », ce qui est exactement ce qui a masqué la divergence
 * côté web pendant des mois. L'appelant décide de ne rien afficher.
 */
export function clientTypeLabel(
  raw: string | null | undefined,
  i: (fr: string, en: string, es: string, it: string) => string,
): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const canon = CANON[fold(raw)]
  if (!canon) return null
  const [fr, en, es, it] = LABELS[canon]
  return i(fr, en, es, it)
}
