import { Prisma } from '@prisma/client'

/**
 * SUPPRESSION DURE D'UN TENANT — ordre et clauses DÉRIVÉS du DMMF Prisma.
 *
 * ⚠️ DISTINCT de `services/accountDeletion.ts`, et les deux ne doivent PAS être fondus.
 * `accountDeletion` est un soft delete + anonymisation : il CONSERVE délibérément les données
 * transactionnelles (Sale, SalaryHistory, Expense, AuditLog…) pour les obligations
 * comptables. L'employer pour une démo laisserait un tenant anonymisé par visiteur en base,
 * à vie : la croissance ne serait pas bornée, ce qui est précisément ce que la durée de vie
 * de 7 jours doit garantir. Chacune répond à une obligation que l'autre n'a pas.
 *
 * ⚠️ Les relations `tenant` n'ont presque aucun `onDelete: Cascade` (défaut Prisma =
 * `Restrict`) : `prisma.tenant.delete()` seul ÉCHOUE sur un tenant peuplé. NE PAS poser de
 * `Cascade` par migration — cela changerait le comportement pour un CLIENT RÉEL, dont
 * l'effacement en cascade des écritures comptables serait un dégât, pas une commodité.
 *
 * ⚠️ LE CRITÈRE N'EST PAS « porte un champ `tenantId` ». Mesuré sur le schéma réel, trois
 * modèles contournent ce critère :
 *     StockTransfer      → porte `fromTenantId` / `toTenantId`
 *     SaleItem           → aucun champ tenant, `sale Sale` en Restrict
 *     PurchaseOrderItem  → aucun champ tenant, `order PurchaseOrder` en Restrict
 * C'est l'angle mort « Forme » : le scan serait vert parce qu'il cherche ce qui ne PEUT PAS
 * exister. Le critère est l'ATTEIGNABILITÉ par clé étrangère depuis `Tenant`.
 *
 * ⚠️ Et trier par « profondeur minimale jusqu'à Tenant » est FAUX AUSSI : `UserTenant` et
 * `User` sont tous deux à d=1, mais `UserTenant` détient une FK vers `User`. MESURÉ :
 * l'ordre de déclaration viole 21 arêtes. D'où le tri topologique (Kahn), enfants d'abord.
 *
 * ⚠️ `UserAuditLog` n'a AUCUNE clé étrangère — délibérément : un audit de sécurité survit à
 * la suppression du compte. Il est donc structurellement hors du sous-graphe. Ne pas
 * « compléter » la purge en l'y ajoutant.
 */

export const TENANT_ROOT = 'Tenant'

export interface PurgeStep {
  /** Nom du modèle Prisma (`SaleItem`). */
  model: string
  /** Nom du délégué sur le client (`saleItem`). */
  delegate: string
  /** Clause ciblant les lignes de ce tenant. */
  where(tenantId: string): object
}

/** Le minimum exigé d'un client de transaction — indexable, pour rester mockable. */
export type PurgeTx = Record<string, { deleteMany(a: { where: object }): Promise<{ count: number }> }> & {
  tenant: {
    delete(a: { where: { id: string } }): Promise<unknown>
    /** Lu par la GARDE : ce tenant est-il bien une démo jetable ? */
    findUnique(a: { where: { id: string }; select: { demoExpiresAt: true } }): Promise<{ demoExpiresAt: Date | null } | null>
  }
}

/** Échappatoire explicite et NOMMÉE pour une suppression dure hors démo jetable. */
export interface HardDeleteOptions {
  /**
   * ⚠️ N'employer qu'en connaissance de cause. Une suppression DURE efface les écritures
   * comptables, que `services/accountDeletion.ts` conserve délibérément. Le nom est long
   * exprès : il doit se lire dans la revue de l'appelant.
   */
  jeSaisQueCeNestPasUneDemo?: boolean
}

interface Lien { champ: string; cible: string; fks: string[] }

const delegateDe = (model: string) => model.charAt(0).toLowerCase() + model.slice(1)

/** Arêtes ENFANT → PARENT : ce côté détient la FK (`relationFromFields` non vide). */
function liensParModele(): Map<string, Lien[]> {
  return new Map(Prisma.dmmf.datamodel.models.map(m => [m.name, m.fields
    .filter(f => f.kind === 'object' && (f.relationFromFields ?? []).length > 0)
    .map(f => ({ champ: f.name, cible: f.type, fks: [...(f.relationFromFields ?? [])] }))]))
}

/**
 * Plan de suppression : les modèles atteignables depuis `Tenant`, triés enfants d'abord.
 * @throws si le graphe présente un cycle — échec BRUYANT plutôt qu'une purge partielle muette.
 */
export function purgePlan(): PurgeStep[] {
  const modeles = Prisma.dmmf.datamodel.models
  const liens = liensParModele()

  // ── Atteignabilité depuis Tenant (transitive) ───────────────────────────────
  const atteignable = new Set<string>([TENANT_ROOT])
  for (let bouge = true; bouge;) {
    bouge = false
    for (const m of modeles) {
      if (atteignable.has(m.name)) continue
      if ((liens.get(m.name) ?? []).some(l => atteignable.has(l.cible))) {
        atteignable.add(m.name)
        bouge = true
      }
    }
  }
  const cibles = [...atteignable].filter(n => n !== TENANT_ROOT)

  // ── Profondeur minimale (sert aux clauses imbriquées, PAS au tri) ───────────
  const prof = new Map<string, number>([[TENANT_ROOT, 0]])
  for (let bouge = true; bouge;) {
    bouge = false
    for (const n of cibles) {
      const d = (liens.get(n) ?? [])
        .map(l => prof.get(l.cible))
        .filter((x): x is number => x !== undefined)
      if (!d.length) continue
      const best = Math.min(...d) + 1
      if (prof.get(n) !== best) { prof.set(n, best); bouge = true }
    }
  }

  // ── Tri topologique (Kahn) sur enfant → parent : in-degré = nombre d'enfants ─
  const inDeg = new Map<string, number>(cibles.map(n => [n, 0]))
  for (const n of cibles) {
    for (const l of liens.get(n) ?? []) {
      if (l.cible !== TENANT_ROOT && inDeg.has(l.cible)) inDeg.set(l.cible, (inDeg.get(l.cible) ?? 0) + 1)
    }
  }
  const file = cibles.filter(n => inDeg.get(n) === 0)
  const ordre: string[] = []
  while (file.length) {
    const n = file.shift()
    if (n === undefined) break
    ordre.push(n)
    for (const l of liens.get(n) ?? []) {
      if (l.cible === TENANT_ROOT || !inDeg.has(l.cible)) continue
      const reste = (inDeg.get(l.cible) ?? 0) - 1
      inDeg.set(l.cible, reste)
      if (reste === 0) file.push(l.cible)
    }
  }
  if (ordre.length !== cibles.length) {
    throw new Error(`[tenantPurge] cycle de clés étrangères — non triés : ${cibles.filter(n => !ordre.includes(n)).join(', ')}`)
  }

  /**
   * Clause ciblant les lignes du tenant. Récursion sur les parents de profondeur MINIMALE
   * → strictement décroissante, donc terminaison garantie.
   */
  const clause = (nom: string, id: string): object => {
    const directs = (liens.get(nom) ?? []).filter(l => l.cible === TENANT_ROOT).flatMap(l => l.fks)
    if (directs.length === 1) return { [directs[0]]: id }
    if (directs.length > 1) return { OR: directs.map(f => ({ [f]: id })) }
    const d = prof.get(nom) ?? 0
    const via = (liens.get(nom) ?? []).filter(l => prof.get(l.cible) === d - 1)
    if (via.length === 1) return { [via[0].champ]: clause(via[0].cible, id) }
    return { OR: via.map(l => ({ [l.champ]: clause(l.cible, id) })) }
  }

  return ordre.map(model => ({
    model,
    delegate: delegateDe(model),
    where: (id: string) => clause(model, id),
  }))
}

/**
 * Supprime DUREMENT toutes les lignes d'un tenant, puis le tenant.
 *
 * ⚠️ GARDE AU POINT DE DESTRUCTION : refuse tout tenant qui ne porte pas `demoExpiresAt`.
 * Cette fonction est exportée et générique ; sans garde ici, sa seule protection vivrait dans
 * le `where` de son appelant, et un futur endpoint admin « supprimer une boutique » effacerait
 * irréversiblement les ventes, la paie, les écritures et le journal d'audit d'un commerçant
 * payant. C'est la règle que ce dépôt a déjà payée deux fois : *la garde vit au point de
 * dépense, jamais sur la route*.
 *
 * ⚠️ Un tenant INTROUVABLE est refusé, pas supposé absent : une lecture qui ne rend rien
 * pendant un incident ne doit pas autoriser une destruction.
 *
 * @returns le nombre de lignes supprimées par modèle — un ménage se MESURE, il ne s'affirme pas.
 */
export async function hardDeleteTenant(
  tx: PurgeTx,
  tenantId: string,
  options: HardDeleteOptions = {},
): Promise<Record<string, number>> {
  if (!options.jeSaisQueCeNestPasUneDemo) {
    const cible = await tx.tenant.findUnique({ where: { id: tenantId }, select: { demoExpiresAt: true } })
    if (!cible) {
      throw new Error(`[tenantPurge] tenant introuvable : ${tenantId} — on ne détruit pas sur une lecture vide`)
    }
    if (cible.demoExpiresAt === null) {
      throw new Error(
        `[tenantPurge] ${tenantId} n'est pas une démo jetable (aucune \`demoExpiresAt\`) — suppression dure refusée. ` +
        `Pour un compte client, c'est \`services/accountDeletion.ts\` qui s'applique : il CONSERVE les écritures comptables.`,
      )
    }
  }

  const compte: Record<string, number> = {}
  for (const etape of purgePlan()) {
    const delegue = tx[etape.delegate]
    if (!delegue) throw new Error(`[tenantPurge] délégué Prisma absent : ${etape.delegate}`)
    const { count } = await delegue.deleteMany({ where: etape.where(tenantId) })
    compte[etape.model] = count
  }
  await tx.tenant.delete({ where: { id: tenantId } })
  return compte
}
