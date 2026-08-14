import { z } from 'zod'

// Schémas de validation (item 6, lot 4B) — employees / expenses / goals /
// subscriptions / stockTransfers. Les règles métier (champs requis avec message
// dédié, gardes RBAC) restent dans les handlers ; ici on valide types + structure
// et on ferme le mass-assignment là où le body brut atteignait Prisma.

export const ID_PARAMS = z.object({ id: z.string().min(1) })

/* ══════════════════════════════════════════════════════════════════════════════
   LES DATES — la NULLABILITÉ DE LA COLONNE décide, pas l'humeur du champ
   ══════════════════════════════════════════════════════════════════════════════

   Les trois champs date de ce fichier étaient en `z.any()`. Conséquence MESURÉE le
   2026-08-14 sur un tenant jetable : `POST /api/expenses` avec `date: '2026-08-14'`
   — une date SEULE, exactement ce que rend un champ de saisie — passe la validation
   et se fait refuser par Prisma (« premature end of input. Expected ISO-8601
   DateTime »). L'appelant reçoit **500, pas 400** : une erreur de saisie déguisée en
   panne serveur, dont le message part dans Sentry au lieu de revenir à l'écran.

   ⚠️ POURQUOI LES DÉPENSES ET PAS LES EMPLOYÉS : `routes/expenses.ts` passe le corps
   ENTIER à Prisma, tandis que `routes/employees.ts` fait `new Date(hiredAt)` avant
   d'écrire. Le même `z.any()` est donc inoffensif d'un côté et fautif de l'autre —
   vérifié, pas supposé : j'avais d'abord conclu que la création d'employé était
   cassée elle aussi, et la lecture du handler l'a démenti. Les employés gardent
   quand même une coercition : `new Date('pas une date')` rend `Invalid Date`, que
   Prisma refuse — 500 par un autre chemin.

   ⚠️ LA COERCITION EST PORTANTE, et ça se vérifie : `validatorCompiler` REMPLACE
   `request.body` par la valeur analysée (c'est d'ailleurs ce qui fait fonctionner le
   strip anti-mass-assignment). S'il se contentait de valider, le handler recevrait
   encore la chaîne et rien ne serait corrigé. Mesuré avant d'écrire ces lignes.
*/

/**
 * Colonne NOT NULL, aucun repli côté handler : une valeur VIDE est un refus PROPRE.
 *
 * ⚠️ `null` DOIT ÊTRE ÉCARTÉ AVANT LA COERCITION. `new Date(null)` vaut **epoch 0** —
 * une date parfaitement valide, au 1er janvier 1970. Sans ce filtre, `date: null` sur
 * une colonne NOT NULL n'échouerait pas : il enregistrerait 1970, en silence. Même
 * famille que `Number(null) === 0` qui avait fait naître des notes de zéro sur une
 * échelle de 1 à 5. `NaN` donne `Invalid Date`, que zod refuse — donc un 400.
 */
const DATE_REQUISE = z.preprocess(v => (v === null || v === '' ? NaN : v), z.coerce.date().optional())

/** Colonne NOT NULL, mais le handler a un repli (`hiredAt ? … : new Date()`).
 *  ⚠️ `''` et `null` doivent rester ACCEPTÉS et devenir une ABSENCE : sinon une
 *  embauche sans date saisie — qui retombe aujourd'hui sur la date du jour —
 *  deviendrait un 400. On resserre contre le n'importe-quoi, jamais contre un chemin
 *  qui marche. Sans ce filtre, `null` s'enregistrerait en 1970 au lieu d'aujourd'hui. */
const DATE_AVEC_REPLI = z.preprocess(v => (v === '' || v === null ? undefined : v), z.coerce.date().optional())

/** Colonne NULLABLE : vider le champ est une INTENTION (un CDD requalifié en CDI n'a
 *  plus d'échéance), donc `''` et `null` valent tous deux « efface ».
 *  ⚠️ Ici aussi `null` doit court-circuiter la coercition : sans ça, effacer une
 *  échéance la fixerait au 1er janvier 1970 au lieu de la retirer. */
const DATE_EFFACABLE = z.preprocess(v => (v === '' || v === null ? null : v), z.coerce.date().nullish())

// ── Employees ── (handler mappe explicitement → passthrough, non vulnérable) ──
const EMPLOYEE_FIELDS = {
  name:     z.string().optional(),          // « Nom requis » reste géré par le handler
  role:     z.string().optional(),
  dept:     z.string().optional(),
  type:     z.string().optional(),
  salary:   z.coerce.number().optional(),
  phone:    z.string().nullish(),
  email:    z.string().nullish(),
  address:  z.string().nullish(),
  photo:    z.string().nullish(),
  isActive: z.boolean().optional(),
  color:    z.string().optional(),
  hiredAt:  DATE_AVEC_REPLI,
  // ⚠️ DATE DE FIN DE CONTRAT — absente de cette liste jusqu'au 2026-08-11, donc jetée.
  // **`null` doit passer** : vider le champ est une intention légitime (un CDD requalifié
  // en CDI n'a plus d'échéance), et un `z.string().optional()` la rendrait ineffaçable.
  // C'est ce que `DATE_EFFACABLE` préserve, en refusant en plus ce qui n'est pas une date.
  endAt:    DATE_EFFACABLE,
  // ⚠️ `.nullable()` AVANT toute coercition, et jamais `z.coerce.number()` seul :
  // `Number(null)` vaut **0**, une note impossible (l'échelle est 1..5) qui se serait
  // affichée « 0/5 » — un jugement là où il n'y a pas d'évaluation. `ZodNullable`
  // intercepte `null` sans appeler le schéma interne.
  perf:     z.coerce.number().nullable().optional(),
  avatar:   z.string().optional(),
}
export const EMPLOYEE_CREATE = z.object(EMPLOYEE_FIELDS).passthrough()
export const EMPLOYEE_UPDATE = z.object(EMPLOYEE_FIELDS).passthrough()

// ── Expenses ── (create/update passaient le body BRUT à Prisma → mass-assignment) ──
// Liste blanche STRICTE (strip) : tenantId/id/timestamps injectés sont supprimés.
const EXPENSE_FIELDS = {
  // ⚠️ LE CHAMP QUI RENDAIT 500 : `routes/expenses.ts` passe le corps ENTIER à Prisma,
  // donc c'est ce schéma — et lui seul — qui décide de ce qui atteint la base.
  date:      DATE_REQUISE,
  label:     z.string().optional(),
  category:  z.string().optional(),
  amountHT:  z.coerce.number().optional(),
  vat:       z.coerce.number().optional(),
  amountTTC: z.coerce.number().optional(),
  mode:      z.string().optional(),
  recurrent: z.boolean().optional(),
  status:    z.string().optional(),
  notes:     z.string().nullish(),
}
export const EXPENSE_CREATE = z.object({ ...EXPENSE_FIELDS, label: z.string().min(1) })
export const EXPENSE_UPDATE = z.object(EXPENSE_FIELDS)

// ── Goals ── (handler mappe explicitement ; label/target requis restent au handler) ──
const GOAL_FIELDS = {
  label:        z.string().optional(),
  target:       z.coerce.number().optional(),
  current:      z.coerce.number().optional(),
  unit:         z.string().optional(),
  period:       z.string().optional(),
  color:        z.string().optional(),
  icon:         z.string().optional(),
  category:     z.string().optional(),
  linkedMetric: z.string().nullish(),
}
export const GOAL_CREATE = z.object(GOAL_FIELDS).passthrough()
export const GOAL_UPDATE = z.object(GOAL_FIELDS).passthrough()

// ── Budgets de dépense ──
// ⚠️ `strict()`, PAS `passthrough()`. Le corps est un dictionnaire catégorie → montant
// et il alimente un `upsert` : une clé inconnue écrirait une ligne de budget qu'AUCUN
// écran ne rend (l'UI itère sur la liste connue), donc invisible et jamais corrigeable.
// Le handler revalide chaque clé contre la liste blanche `EXPENSE_CATEGORIES` — le zod
// ferme la structure, la liste blanche ferme le domaine.
export const EXPENSE_BUDGETS_PUT = z.object({
  budgets: z.record(z.string(), z.coerce.number().finite().nonnegative()),
}).strict()

// ── Subscriptions ── (handler mappe explicitement) ──
const SUB_ITEM = z.object({}).passthrough()
export const SUB_CREATE = z.object({
  customerId: z.string().min(1),
  name:       z.string().min(1),
  dayOfWeek:  z.coerce.number(),
  // Première livraison. Absente/null = pas de date de début (comportement historique).
  startDate:  z.coerce.date().nullish(),
  note:       z.string().nullish(),
  items:      z.array(SUB_ITEM).min(1),
}).passthrough()
export const SUB_UPDATE = z.object({
  name:      z.string().optional(),
  dayOfWeek: z.coerce.number().optional(),
  startDate: z.coerce.date().nullish(),
  status:    z.string().optional(),
  note:      z.string().nullish(),
  items:     z.array(SUB_ITEM).optional(),
}).passthrough()

// ── StockTransfers create ── (toTenantId/productId requis restent aussi au handler) ──
export const TRANSFER_CREATE = z.object({
  toTenantId: z.string().min(1),
  productId:  z.string().min(1),
  quantity:   z.coerce.number(),
  note:       z.string().nullish(),
}).passthrough()
