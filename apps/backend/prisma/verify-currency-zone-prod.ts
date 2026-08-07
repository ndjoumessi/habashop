/**
 * VÉRIFICATION EN PRODUCTION du garde de zone franc CFA — les trois formes autorisées :
 *
 *   (1) LECTURE SEULE       — l'état de `demo-tenant-001` avant/après, jamais muté ici.
 *   (2) REJEU DE L'ÉCRITURE RÉELLE — `PATCH /api/tenant {currency:'XAF'}` sur un tenant `SN`.
 *       ⚠️ C'est une requête MUTANTE, et c'est assumé : elle doit être REFUSÉE. Un 400
 *       n'écrit rien, et `updatedAt` est relu pour le PROUVER plutôt que le déduire.
 *       ⚠️ À lancer AVANT la correction de valeur : tant que le tenant porte `XAF`, un garde
 *       défaillant écrirait `XAF` sur `XAF` — sans effet. Après correction, le même échec
 *       recasserait ce qu'on vient de réparer. L'ordre n'est pas cosmétique.
 *   (3) TENANT JETABLE      — pour le chemin ACCEPTÉ, qui lui écrit vraiment. Créé, exercé,
 *       DÉTRUIT, orphelins vérifiés. Jamais la démo.
 *
 * Aucun envoi facturé, aucun SDK payant : uniquement l'API et Prisma en lecture.
 *
 *   npx tsx --env-file=.env prisma/verify-currency-zone-prod.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const API = process.env.VERIFY_API ?? 'https://habashop-production.up.railway.app'
const DEMO_ID = 'demo-tenant-001'
const TMP_ID = 'verif-zone-tmp'
const TMP_MAIL = 'verif-zone-tmp@habashop.invalid'
const TMP_PASS = 'Verif-Zone-2026!'

const prisma = new PrismaClient()
const ok = (c: boolean) => (c ? 'OK ' : 'RATE')

async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json() as { token?: string; error?: string }
  if (!j.token) throw new Error(`login ${email} : ${r.status} ${j.error ?? ''}`)
  return j.token
}

async function patchTenant(token: string, body: unknown) {
  const r = await fetch(`${API}/api/tenant`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> }
}

async function main() {
  // ── (2) REJEU DE L'ÉCRITURE QUI A EU LIEU ──────────────────────────────────────
  console.log('\n── rejeu de l’écriture réelle du 2026-08-07 ──')
  const avant = await prisma.tenant.findUniqueOrThrow({
    where: { id: DEMO_ID }, select: { country: true, currency: true, updatedAt: true },
  })
  console.log(`  état avant : ${avant.country}/${avant.currency}  updatedAt=${avant.updatedAt.toISOString()}`)

  // ⚠️ `admin@` est MULTI-BOUTIQUES : le jeton de login n'a pas de boutique active, et le
  // PATCH rendait `400 NO_ACTIVE_TENANT` — un 400 pour la MAUVAISE raison, qui n'exerce pas
  // le garde. Il faut sélectionner la boutique, comme le fait l'interface.
  let token = await login('admin@habashop.com', 'demo1234')
  const sw = await fetch(`${API}/api/auth/switch-tenant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenantId: DEMO_ID }),
  })
  const swj = await sw.json() as { token?: string; error?: string }
  if (!swj.token) throw new Error(`switch-tenant : ${sw.status} ${swj.error ?? ''}`)
  token = swj.token
  console.log(`  boutique active sélectionnée : ${DEMO_ID}`)

  const res = await patchTenant(token, { currency: 'XAF' })
  console.log(`  PATCH {currency:'XAF'} → ${res.status} ${res.body.code ?? ''}`)
  console.log(`  message : ${res.body.error ?? ''}`)

  const apres = await prisma.tenant.findUniqueOrThrow({
    where: { id: DEMO_ID }, select: { country: true, currency: true, updatedAt: true },
  })
  console.log(`  [${ok(res.status === 400)}] refusé en 400`)
  console.log(`  [${ok(res.body.code === 'CURRENCY_ZONE_MISMATCH')}] code CURRENCY_ZONE_MISMATCH`)
  console.log(`  [${ok(+apres.updatedAt === +avant.updatedAt)}] AUCUNE écriture — updatedAt inchangé`)
  console.log(`  [${ok(apres.currency === avant.currency)}] devise inchangée (${apres.currency})`)

  // ── (3) TENANT JETABLE : le chemin ACCEPTÉ, qui écrit ─────────────────────────
  console.log('\n── tenant JETABLE : le PATCH accepté doit laisser une trace ──')
  await prisma.tenant.create({
    data: { id: TMP_ID, name: 'Vérif zone (jetable)', country: 'CM', currency: 'XAF', vatRate: 19.25, plan: 'starter', status: 'active', isActive: true },
  })
  await prisma.user.create({
    data: { id: `${TMP_ID}-u`, tenantId: TMP_ID, email: TMP_MAIL, name: 'Vérif', role: 'ADMIN', passwordHash: await bcrypt.hash(TMP_PASS, 12) },
  })
  try {
    const t2 = await login(TMP_MAIL, TMP_PASS)

    const refuse = await patchTenant(t2, { currency: 'XOF' })   // CM en XOF = l'autre sens
    console.log(`  [${ok(refuse.status === 400)}] CM + XOF refusé aussi (${refuse.status} ${refuse.body.code ?? ''})`)

    const accepte = await patchTenant(t2, { currency: 'EUR' })  // hors franc CFA = légitime
    console.log(`  [${ok(accepte.status === 200)}] CM + EUR accepté (${accepte.status})`)

    const traces = await prisma.auditLog.findMany({
      where: { tenantId: TMP_ID }, orderBy: { createdAt: 'asc' },
      select: { action: true, module: true, description: true, severity: true, createdAt: true },
    })
    console.log(`  [${ok(traces.length === 1)}] ${traces.length} trace(s) — le refus n’en écrit pas`)
    for (const t of traces) {
      console.log(`     ${t.createdAt.toISOString()}  ${t.module}/${t.action}  sev=${t.severity}`)
      console.log(`     description : ${t.description}`)
      const d = JSON.parse(t.description) as Record<string, { avant: unknown; apres: unknown }>
      console.log(`  [${ok(d.currency?.avant === 'XAF' && d.currency?.apres === 'EUR')}] la trace porte AVANT et APRÈS`)
      console.log(`  [${ok(!/@|\+\d{6,}/.test(t.description))}] aucune donnée personnelle dans la trace`)
    }
  } finally {
    // ── DESTRUCTION, et on vérifie qu'il ne reste rien ──
    await prisma.auditLog.deleteMany({ where: { tenantId: TMP_ID } })
    await prisma.user.deleteMany({ where: { tenantId: TMP_ID } })
    await prisma.tenant.deleteMany({ where: { id: TMP_ID } })
    const reste =
      (await prisma.tenant.count({ where: { id: TMP_ID } })) +
      (await prisma.user.count({ where: { tenantId: TMP_ID } })) +
      (await prisma.auditLog.count({ where: { tenantId: TMP_ID } }))
    console.log(`  [${ok(reste === 0)}] tenant jetable détruit — ${reste} orphelin(s)`)
  }
}

main()
  .catch(e => { console.error('  ✖', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
