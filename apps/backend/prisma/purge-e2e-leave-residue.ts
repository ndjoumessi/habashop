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
  const avant = {
    conges: conges.length,
    shifts: await p.shift.count({ where: { tenantId: TENANT } }),
    presences: await p.attendance.count({ where: { tenantId: TENANT } }),
  }
  console.log('[purge] AVANT :', JSON.stringify(avant))
  for (const c of conges) console.log(`[purge]   congé ${c.id} · ${c.employeeId} · ${c.startDate} → ${c.endDate} · ${c.status}`)
  if (conges.length === 0) { console.log('[purge] rien à purger.'); await p.$disconnect(); return }

  // ── PÉRIMÈTRE DÉRIVÉ : les couples (employé, jour) réellement couverts ────
  const couples = new Set<string>()
  for (const c of conges) {
    for (let d = new Date(`${c.startDate}T00:00:00Z`); d <= new Date(`${c.endDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      couples.add(`${c.employeeId}|${d.toISOString().slice(0, 10)}`)
    }
  }
  console.log(`[purge] ${couples.size} couple(s) (employé, jour) couvert(s) par ces congés`)

  // ── SUPPRESSION ──────────────────────────────────────────────────────────
  let shifts = 0, presences = 0
  for (const cle of couples) {
    const [employeeId, date] = cle.split('|')
    // ⚠️ Le TYPE fait partie du filtre : un shift ordinaire ce jour-là n'est pas un
    // effet de bord de congé, et n'a rien à faire dans cette purge.
    shifts += (await p.shift.deleteMany({ where: { tenantId: TENANT, employeeId, date, shiftTypeKey: 'leave' } })).count
    presences += (await p.attendance.deleteMany({ where: { tenantId: TENANT, employeeId, date, status: 'LEAVE' } })).count
  }
  const supprimes = (await p.leaveRequest.deleteMany({ where: { tenantId: TENANT } })).count
  console.log(`[purge] SUPPRIMÉ : congés=${supprimes} shifts=${shifts} presences=${presences}`)

  // ── ÉTAT FINAL : le COMPTE, jamais le code de retour ─────────────────────
  const apres = {
    conges: await p.leaveRequest.count({ where: { tenantId: TENANT } }),
    shifts: await p.shift.count({ where: { tenantId: TENANT } }),
    presences: await p.attendance.count({ where: { tenantId: TENANT } }),
  }
  console.log('[purge] APRÈS :', JSON.stringify(apres))
  if (apres.conges !== 0) stop(`${apres.conges} congé(s) subsistent.`)

  // ⚠️ EFFETS DE BORD VÉRIFIÉS INTACTS : rien d'autre que le résidu n'a bougé.
  const attenduShifts = avant.shifts - shifts
  const attenduPresences = avant.presences - presences
  if (apres.shifts !== attenduShifts) stop(`shifts : ${apres.shifts} restants, ${attenduShifts} attendus — la purge a débordé.`)
  if (apres.presences !== attenduPresences) stop(`presences : ${apres.presences} restantes, ${attenduPresences} attendues — la purge a débordé.`)

  console.log('[purge] OK — résidu retiré, rien d’autre touché.')
  await p.$disconnect()
}

main()
