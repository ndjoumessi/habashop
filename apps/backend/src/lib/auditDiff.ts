/**
 * LE DIFF D'AUDIT — ce qui a changé, sur une liste blanche NOMMÉE.
 *
 * ─── POURQUOI UN MODULE, ET PAS UN `JSON.stringify(body)` À CHAQUE SITE ──────
 * Trois raisons, toutes apprises ailleurs dans ce dépôt :
 *
 * 1. **LISTE BLANCHE, JAMAIS LE CORPS.** Écrire le corps de la requête ferait
 *    entrer dans la table d'audit tout ce qu'un futur appelant y mettrait —
 *    données personnelles comprises. C'est exactement la règle posée pour
 *    `TENANT_LOCALE_CHANGE` (« codes et nombres, aucun champ personnel »), et
 *    l'écran la redouble en refusant de rendre un JSON quelconque. Ici la liste
 *    est un paramètre OBLIGATOIRE : le compilateur force chaque appelant à
 *    choisir ce qu'il consigne, comme `owner` sur `sendWhatsApp`.
 *
 * 2. **RIEN N'A CHANGÉ ⇒ AUCUNE ÉCRITURE.** Un `PUT` qui renvoie l'objet tel
 *    quel — le cas normal quand l'écran renvoie tout son formulaire — écrirait
 *    une entrée par enregistrement. Le journal plafonne à 100 lignes : du bruit
 *    y chasse littéralement le signal. `diffAudite` rend `null`, l'appelant
 *    n'écrit pas.
 *
 * 3. **LA FORME EST CELLE QUE L'ÉCRAN SAIT RENDRE** — `{ champ: { avant, apres } }`.
 *    Une quatrième forme de description aurait rejoint les trois qui coexistent
 *    déjà, et l'écran en jette silencieusement ce qu'il ne reconnaît pas : c'est
 *    précisément le défaut corrigé le 2026-08-13, où cinq lignes « Tenant Locale
 *    Change » étaient rigoureusement indistinguables alors que la base savait tout.
 */

export type ChangementAudite = { avant: unknown; apres: unknown }
export type DiffAudite = Record<string, ChangementAudite>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]|$)/

/**
 * Forme comparable d'une valeur. ⚠️ SANS CETTE NORMALISATION, LE DIFF EST DU BRUIT :
 * les deux côtés ne viennent pas de la même source. `avant` sort de Prisma (nombre,
 * `Date`, `null`) ; `apres` sort du corps de la requête après zod (souvent une
 * chaîne, une date ISO, `''`). Comparer brut ferait consigner « taxRate 18 → 18 »
 * à chaque enregistrement — une entrée d'audit qui affirme un changement qui n'a
 * pas eu lieu est pire qu'une entrée absente.
 */
function norme(v: unknown): string {
  // ⚠️ `null`, `undefined` et `''` sont le MÊME état : « pas de valeur ». Les
  // distinguer ferait consigner un changement au premier enregistrement d'un
  // formulaire qui envoie `''` là où la base porte `null`. Vider un champ qui
  // avait une valeur reste consigné (`note → —`), ce qui est le cas utile.
  if (v === null || v === undefined || v === '') return ''
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString()
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  const s = String(v)
  // Les dates AVANT les nombres : « 2026 » est un nombre fini, pas « 2026-08-14 ».
  if (ISO_DATE.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) ? String(n) : s
}

/**
 * Ce qui a changé entre `avant` et `apres`, LIMITÉ à `champs`.
 *
 * ⚠️ Un champ ABSENT d'`apres` n'a pas changé : il n'a pas été soumis. Le confondre
 * avec « mis à `undefined` » ferait consigner la disparition de tout ce qu'un `PATCH`
 * partiel ne mentionne pas.
 *
 * Rend `null` — jamais un objet vide — quand rien n'a bougé : l'appelant a alors une
 * valeur qu'il ne peut pas confondre avec « un changement sans détail ».
 */
export function diffAudite(
  avant: Record<string, unknown> | null | undefined,
  apres: Record<string, unknown>,
  champs: readonly string[],
): DiffAudite | null {
  const diff: DiffAudite = {}
  for (const champ of champs) {
    if (!(champ in apres)) continue
    const a = avant?.[champ]
    const b = apres[champ]
    if (norme(a) === norme(b)) continue
    diff[champ] = { avant: a ?? null, apres: b ?? null }
  }
  return Object.keys(diff).length ? diff : null
}

/**
 * Le corps d'une description d'audit : le SUJET plus ce qui a changé.
 *
 * ⚠️ UN CHANGEMENT SANS SON SUJET NE DIT RIEN. `AuditLog` ne porte aucune colonne
 * désignant la cible — « sellPrice 1000 → 1200 » ne dit pas de QUEL produit il
 * s'agit, et l'ajout d'une colonne imposerait une migration DDL sur la base de
 * PRODUCTION pour un besoin que la description couvre déjà.
 *
 * ⚠️ RÈGLE DU SUJET : il doit désigner une donnée que le lecteur du journal voit
 * DÉJÀ dans la même boutique — un nom de produit, un libellé de dépense, une
 * référence de commande. `AuditLog` est tenant-scopé et n'est lu que par les
 * administrateurs de cette boutique, qui ont accès au catalogue et aux dépenses :
 * y consigner un libellé n'expose rien de plus. C'est d'ailleurs déjà la pratique
 * (`DELETE_CUSTOMER` y écrit le nom du client).
 *
 * ⚠️ CE QUI RESTE INTERDIT est ce que le tenant ne détient PAS ou ne devrait pas
 * relire ici : un numéro de téléphone, une adresse, un secret, une donnée d'une
 * AUTRE boutique. Et cette règle ne vaut que pour la table d'audit — la journalisation
 * applicative (Railway) reste soumise à `redactPhone`, qui est un autre chemin.
 */
export function descriptionAudit(sujet: string | null | undefined, diff: DiffAudite | null): string {
  const corps: Record<string, unknown> = {}
  if (sujet) corps.name = sujet
  if (diff) Object.assign(corps, diff)
  return JSON.stringify(corps)
}
