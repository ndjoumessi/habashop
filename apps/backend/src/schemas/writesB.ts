import { z } from 'zod'

// Schémas de validation (item 6, lot 4B) — employees / expenses / goals /
// subscriptions / stockTransfers. Les règles métier (champs requis avec message
// dédié, gardes RBAC) restent dans les handlers ; ici on valide types + structure
// et on ferme le mass-assignment là où le body brut atteignait Prisma.

export const ID_PARAMS = z.object({ id: z.string().min(1) })

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
  hiredAt:  z.any().optional(),
  // ⚠️ DATE DE FIN DE CONTRAT — absente de cette liste jusqu'au 2026-08-11, donc jetée.
  // `z.any()` comme `hiredAt` : le serveur accepte une chaîne ISO, et **`null` doit passer**
  // (vider le champ est une intention légitime — un CDD requalifié en CDI n'a plus d'échéance).
  // Un `z.string().optional()` refuserait ce `null` et rendrait la date ineffaçable.
  endAt:    z.any().optional(),
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
  date:      z.any().optional(),
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
