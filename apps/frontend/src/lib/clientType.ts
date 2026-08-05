/**
 * Palier commercial d'un client — RÈGLE CANONIQUE (#215).
 *
 * ⚠️ JUMEAU de `apps/backend/src/lib/clientType.ts` : les deux fichiers portent la MÊME
 * table et sont tenus par `docs/shared-fixtures/client-type-cases.json`, qui ARBITRE.
 * Changer la règle d'un seul côté rougit ce côté-là (vérifié par sabotage) : la fixture
 * force donc à modifier le contrat d'abord, puis les deux implémentations.
 *
 * `Customer.type` contenait deux formats : le défaut de colonne est `'retail'` (anglais),
 * mais les deux chemins d'écriture du front envoyaient le LIBELLÉ français du `<select>`,
 * et le zod (`z.string()`) laissait tout passer. Le lecteur, lui, n'acceptait que l'anglais
 * et repliait le reste sur « Détail » : 3 grossistes et 2 semi-gros affichés « Détail ».
 *
 * Canonique = ANGLAIS (défaut de colonne, attente du mapper, convention « ne pas traduire
 * les enums d'API »). Les libellés français restent acceptés en LECTURE — ensemble CLOS de
 * nos propres anciennes `value`, pas une inférence sur du texte libre.
 */
export const CLIENT_TYPES = ['retail', 'semi-wholesale', 'wholesale', 'loyal'] as const
export type ClientTypeValue = (typeof CLIENT_TYPES)[number]

/** Libellés hérités RÉELLEMENT écrits par nos anciens formulaires. Ensemble clos. */
const LEGACY_LABELS: Record<string, ClientTypeValue> = {
  'detail': 'retail',
  'semi-gros': 'semi-wholesale',
  'grossiste': 'wholesale',
  'fidele': 'loyal',
}

/** Retire les diacritiques pour comparer « Détail » et « detail » sans table à rallonge. */
function fold(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * ⚠️ Rend `null` — JAMAIS un palier par défaut. Un repli implicite sur `retail` est
 * exactement ce qui rend indistinguables « client au détail » et « valeur jamais saisie »,
 * et c'est ce qui a masqué la divergence pendant tout ce temps. L'appelant décide : 400
 * côté écriture, libellé hérité côté lecture.
 */
export function normalizeClientType(raw: unknown): ClientTypeValue | null {
  if (typeof raw !== 'string') return null
  const f = fold(raw)
  if (!f) return null
  const canonical = CLIENT_TYPES.find(t => t === f)
  if (canonical) return canonical
  return LEGACY_LABELS[f] ?? null
}
