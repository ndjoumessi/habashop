/**
 * PURGE PONCTUELLE — le résidu de congés laissé sur `e2e-tenant` avant la fermeture
 * de la fuite du 2026-08-06/07.
 *
 * ─── CE QU'ON SUPPRIME, ET POURQUOI PLUS QUE LES DEMANDES ─────────────────────
 * Deux `LeaveRequest` approuvées le 2026-08-07 (22:41 et 22:46), identiques : même
 * employée, mêmes dates. Elles PRÉCÈDENT le correctif — la suite E2E d'aujourd'hui n'en
 * crée plus (vérifié : l'audit le plus récent datait d'une minute, ces congés de 8 900).
 *
 * ⚠️ ON NE PEUT PAS S'ARRÊTER AUX DEMANDES. L'approbation déclenche
 * `applyApprovedLeaveSideEffects`, qui `upsert` un `Shift` (`shiftTypeKey: 'leave'`) et
 * une `Attendance` (`status: 'LEAVE'`) par jour couvert. `DELETE /api/leave-requests/:id`
 * ne les défait PAS. Retirer les demandes seules laisserait le planning afficher un
 * congé sans demande derrière : un état incohérent, issu du même incident. Les deux
 * demandes portant les mêmes 3 jours, les `upsert` sont idempotents — d'où 3 + 3.
 *
 * ─── LE PÉRIMÈTRE SE DÉRIVE DES DEMANDES, IL N'EST PAS RECOPIÉ ────────────────
 * Le tenant est en dur (garde), mais les couples (employé, date) sont CALCULÉS à partir
 * des congés qu'on supprime. Des dates recopiées à la main pourraient viser un jour que
 * ces congés ne couvrent pas — et effacer une donnée de planning légitime.
 *
 * Usage : CONFIRM=1 npx tsx prisma/purge-e2e-leave-residue.ts
 */
import { PrismaClient } from '@prisma/client'

const TENANT = 'e2e-tenant'

const stop = (msg: string): never => { console.error(`[purge] ARRÊT : ${msg}`); process.exit(1) }

async function main() {
  const p = new PrismaClient()

  // ── GARDES ───────────────────────────────────────────────────────────────
  if (process.env.CONFIRM !== '1') stop('relancer avec CONFIRM=1. Rien n’a été touché.')

  const t = await p.tenant.findUnique({ where: { id: TENANT }, select: { id: true, name: true, isDemo: true, isPlatform: true } })
  if (!t) stop(`le tenant ${TENANT} n’existe pas.`)
  // ⚠️ Une démo porte de la donnée qu'on montre ; un tenant plateforme est interne.
  // Ni l'un ni l'autre ne se purge par ce script, qui vise le tenant de TEST.
  if (t!.isDemo || t!.isPlatform) stop(`${TENANT} est isDemo=${t!.isDemo} isPlatform=${t!.isPlatform} — hors périmètre.`)

  // ── INSTANTANÉ AVANT ─────────────────────────────────────────────────────
  const conges = await p.leaveRequest.findMany({ where: { tenantId: TENANT } })
  const shiftsHorsConge = await p.shift.count({ where: { tenantId: TENANT, shiftTypeKey: { not: 'leave' } } })
  const presencesHorsConge = await p.attendance.count({ where: { tenantId: TENANT, status: { not: 'LEAVE' } } })
  const avant = {
    conges: conges.length,
    shifts: await p.shift.count({ where: { tenantId: TENANT } }),
    presences: await p.attendance.count({ where: { tenantId: TENANT } }),
  }
  console.log('[purge] AVANT :', JSON.stringify(avant))
  for (const c of conges) console.log(`[purge]   congé ${c.id} · ${c.employeeId} · ${c.startDate} → ${c.endDate} · ${c.status}`)

  /**
   * ⚠️ AUCUNE SORTIE ANTICIPÉE. La version d'origine s'arrêtait sur « zéro congé », et
   * ratait donc EXACTEMENT le cas pour lequel on l'aurait rappelée : des marques de
   * congé ORPHELINES, sans demande derrière — la situation d'avant la révocation
   * automatique (33181635), où `DELETE` retirait la demande et laissait le planning.
   *
   * ⚠️ ET LE PÉRIMÈTRE NE PEUT PLUS ÊTRE DÉRIVÉ DES CONGÉS : à zéro congé il ne viserait
   * rien. Retirer la sortie sans changer la règle n'aurait donc rien corrigé — c'est le
   * genre de demi-correctif qui donne l'illusion d'avoir traité le sujet.
   *
   * LA RÈGLE EST DONC L'INVARIANT LUI-MÊME : une marque de congé qu'AUCUNE demande
   * APPROUVÉE ne justifie n'a pas lieu d'être. On part des marques, pas des demandes.
   */
  const supprimes = (await p.leaveRequest.deleteMany({ where: { tenantId: TENANT } })).count

  // Les demandes du tenant de TEST viennent d'être retirées : toute marque restante est
  // orpheline par construction. On le vérifie quand même demande par demande — ainsi la
  // règle reste juste si ce script est un jour pointé sur un tenant qu'on ne vide pas.
  const marquesShift = await p.shift.findMany({ where: { tenantId: TENANT, shiftTypeKey: 'leave' } })
  const marquesPresence = await p.attendance.findMany({ where: { tenantId: TENANT, status: 'LEAVE' } })
  console.log(`[purge] marques de congé trouvées : ${marquesShift.length} shift(s), ${marquesPresence.length} présence(s)`)

  const justifiee = async (employeeId: string, date: string) => !!(await p.leaveRequest.findFirst({
    // Comparaison de CHAÎNES : colonnes `String` au format `YYYY-MM-DD`, dont l'ordre
    // lexicographique EST l'ordre chronologique.
    where: { tenantId: TENANT, employeeId, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } },
    select: { id: true },
  }))

  let shifts = 0, presences = 0
  for (const s of marquesShift) {
    if (await justifiee(s.employeeId, s.date)) continue
    shifts += (await p.shift.deleteMany({ where: { id: s.id } })).count
  }
  for (const a of marquesPresence) {
    if (await justifiee(a.employeeId, a.date)) continue
    presences += (await p.attendance.deleteMany({ where: { id: a.id } })).count
  }
  console.log(`[purge] SUPPRIMÉ : congés=${supprimes} shifts=${shifts} presences=${presences}`)

  // ── ÉTAT FINAL : le COMPTE, jamais le code de retour ─────────────────────
  const apres = {
    conges: await p.leaveRequest.count({ where: { tenantId: TENANT } }),
    shifts: await p.shift.count({ where: { tenantId: TENANT } }),
    presences: await p.attendance.count({ where: { tenantId: TENANT } }),
  }
  console.log('[purge] APRÈS :', JSON.stringify(apres))
  if (apres.conges !== 0) stop(`${apres.conges} congé(s) subsistent.`)

  // ── L'INVARIANT EST ATTEINT : plus aucune marque orpheline ───────────────
  const marquesRestantes = await p.shift.count({ where: { tenantId: TENANT, shiftTypeKey: 'leave' } })
    + await p.attendance.count({ where: { tenantId: TENANT, status: 'LEAVE' } })
  if (marquesRestantes !== 0) stop(`${marquesRestantes} marque(s) de congé subsistent sans demande.`)

  /**
   * ⚠️ LA PURGE N'A PAS DÉBORDÉ — et c'est mesuré sur ce qu'elle ne devait PAS toucher,
   * pas sur un total dont on soustrait ce qu'on a supprimé. Cette seconde forme est
   * arithmétiquement vraie quoi qu'il arrive : elle prouve qu'on sait compter, pas qu'on
   * a visé juste. Un shift ORDINAIRE effacé par erreur y passerait inaperçu.
   */
  const shiftsHorsCongeApres = await p.shift.count({ where: { tenantId: TENANT, shiftTypeKey: { not: 'leave' } } })
  const presencesHorsCongeApres = await p.attendance.count({ where: { tenantId: TENANT, status: { not: 'LEAVE' } } })
  if (shiftsHorsCongeApres !== shiftsHorsConge) {
    stop(`shifts HORS congé : ${shiftsHorsConge} → ${shiftsHorsCongeApres}. La purge a mordu sur du planning légitime.`)
  }
  if (presencesHorsCongeApres !== presencesHorsConge) {
    stop(`présences HORS congé : ${presencesHorsConge} → ${presencesHorsCongeApres}. La purge a mordu sur des présences réelles.`)
  }

  console.log(`[purge] OK — résidu retiré ; hors congé intact (${shiftsHorsConge} shift(s), ${presencesHorsConge} présence(s)).`)
  await p.$disconnect()
}

main()
