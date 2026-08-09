/**
 * SUPPRESSION D'UN TENANT ORPHELIN — mutation de PRODUCTION, sous garde.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `Boutique 2` (créé le 2026-08-07 à 23:58, jamais retouché depuis) n'a AUCUN
 * utilisateur, AUCUNE vente, aucune ligne sur les 26 relations du modèle Tenant.
 * Il est donc inatteignable — personne ne peut s'y connecter. Mais la console Ops
 * le compte comme « 1 boutique cliente », parce que `fixtureTenant.ts` décide par
 * PROPRIÉTÉ (isPlatform · isDemo · préfixe `e2e-`) et qu'il n'en porte aucune.
 * Le seul chiffre que la console doit rendre juste — combien de commerçants
 * réels ? — était donc faux, et il valait 1 au lieu de 0.
 *
 * ⚠️ ON NE SUPPRIME PAS UN TENANT PARCE QU'UN ÉCRAN LE DIT VIDE. Le tiroir a déjà
 * menti : l'interface affichait « Aucun achat » sur un client qui portait un
 * abonnement actif, et c'est le COMPTAGE des références qui avait tranché. Ce
 * script recompte tout, à l'exécution, et refuse dès la première référence.
 *
 * ⚠️ PÉRIMÈTRE EN DUR, jamais en argument. Un identifiant passé en ligne de
 * commande est un identifiant qu'on peut se tromper de coller.
 *
 * Usage :  CONFIRM=1 npx tsx prisma/delete-orphan-tenant.ts
 * Sans CONFIRM : mesure seule, aucune écriture.
 */
import { basePrisma as prisma } from '../src/db'
import { createHash } from 'node:crypto'

/** ⚠️ En dur, et vérifié par son NOM autant que par son id — les deux doivent concorder. */
const CIBLE_ID = 'cmsjlvd0d0005qq25pqe0a841'
const CIBLE_NOM = 'Boutique 2'

/**
 * Les 26 relations inverses déclarées sur `model Tenant` — DÉRIVÉES du schéma, pas
 * de la liste des champs nommés `tenantId`.
 *
 * ⚠️ CETTE DISTINCTION A ÉTÉ PAYÉE : un premier comptage dérivé des champs
 * `tenantId` déclarait « 0 référence » en ayant MANQUÉ `StockTransfer`, qui pointe
 * vers Tenant par `fromTenantId`/`toTenantId`. Un périmètre dérivé de la mauvaise
 * propriété est un périmètre faux, et il rend un zéro qui a l'air d'une preuve.
 */
const RELATIONS_TENANT_ID = [
  'attendance', 'auditLog', 'campaign', 'customer', 'employee', 'employeeBonus',
  'expense', 'expenseBudget', 'goal', 'leaveRequest', 'loyaltyTransaction', 'payroll',
  'planRequest', 'product', 'purchaseOrder', 'pushToken', 'salaryHistory', 'sale',
  'shift', 'subscription', 'supplier', 'ticketZ', 'user', 'userTenant',
] as const

async function empreinte(): Promise<string> {
  const t = await prisma.tenant.findMany({ orderBy: { id: 'asc' } })
  const src = t.map(x => `${x.id}|${x.country}|${x.currency}|${x.vatRate}|${x.updatedAt.toISOString()}`).join('\n')
  return `${t.length} tenants — sha256 ${createHash('sha256').update(src).digest('hex')}`
}

async function compterReferences(id: string) {
  const detail: Record<string, number> = {}
  for (const m of RELATIONS_TENANT_ID) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await (prisma as any)[m].count({ where: { tenantId: id } })
    if (n > 0) detail[m] = n
  }
  // ⚠️ Les deux relations qui ne s'appellent pas `tenantId` — celles du premier oubli.
  const [stFrom, stTo] = await Promise.all([
    prisma.stockTransfer.count({ where: { fromTenantId: id } }),
    prisma.stockTransfer.count({ where: { toTenantId: id } }),
  ])
  if (stFrom > 0) detail['stockTransfer(from)'] = stFrom
  if (stTo > 0) detail['stockTransfer(to)'] = stTo

  return { detail, total: Object.values(detail).reduce((a, b) => a + b, 0) }
}

async function main() {
  const confirme = process.env.CONFIRM === '1'

  const avant = await prisma.tenant.findUnique({ where: { id: CIBLE_ID } })
  if (!avant) {
    console.log(`Aucun tenant ${CIBLE_ID} — déjà supprimé, ou mauvais identifiant. Rien à faire.`)
    return
  }

  console.log('═══ INSTANTANÉ AVANT — objet ENTIER ═══')
  console.log(JSON.stringify(avant, null, 2))
  console.log(`\nempreinte AVANT : ${await empreinte()}`)

  // ─── GARDES ────────────────────────────────────────────────────────────────
  if (avant.name !== CIBLE_NOM) throw new Error(`REFUS : nom attendu ${JSON.stringify(CIBLE_NOM)}, trouvé ${JSON.stringify(avant.name)}`)
  if (avant.isDemo) throw new Error('REFUS : tenant de démonstration')
  if ((avant as unknown as { isPlatform?: boolean }).isPlatform) throw new Error('REFUS : tenant plateforme')

  const { detail, total } = await compterReferences(CIBLE_ID)
  console.log('\n═══ RÉFÉRENCES (26 relations) ═══')
  console.log(total === 0 ? '  aucune' : JSON.stringify(detail, null, 2))
  if (total !== 0) throw new Error(`REFUS : ${total} référence(s) — ce tenant n'est PAS orphelin`)

  if (!confirme) {
    console.log('\n⚠️ CONFIRM=1 absent — MESURE SEULE, aucune écriture. Rien n\'a été supprimé.')
    return
  }

  // ─── MUTATION ──────────────────────────────────────────────────────────────
  await prisma.tenant.delete({ where: { id: CIBLE_ID } })

  console.log('\n═══ ÉTAT APRÈS ═══')
  const apres = await prisma.tenant.findUnique({ where: { id: CIBLE_ID } })
  console.log(`relecture de ${CIBLE_ID} : ${apres === null ? 'null ✅ supprimé' : '❌ TOUJOURS PRÉSENT'}`)
  if (apres !== null) throw new Error('ÉCHEC : le tenant existe encore après suppression')

  console.log(`empreinte APRÈS : ${await empreinte()}`)
  console.log('\n⚠️ L\'objet supprimé est imprimé EN ENTIER ci-dessus : c\'est la seule copie.')
  console.log('   Pour le recréer à l\'identique, repartir de ce JSON.')
}

main()
  .catch(e => { console.error('\n❌', e instanceof Error ? e.message : e); process.exit(1) })
  .finally(() => prisma.$disconnect())
