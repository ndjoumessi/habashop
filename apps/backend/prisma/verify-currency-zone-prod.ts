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
import { randomBytes } from 'node:crypto'

const API = process.env.VERIFY_API ?? 'https://habashop-production.up.railway.app'
const DEMO_ID = 'demo-tenant-001'
const TMP_ID = 'verif-zone-tmp'
const TMP_MAIL = 'verif-zone-tmp@habashop.invalid'
/**
 * ⚠️ ENGENDRÉ À L'EXÉCUTION, jamais un littéral. Ce script crée un utilisateur `ADMIN`
 * RÉEL dans la base de PRODUCTION, et le dépôt est PUBLIC : un mot de passe écrit ici
 * serait la clé publiée d'un compte qui existe périodiquement sur l'API exposée.
 */
const TMP_PASS = randomBytes(24).toString('base64url')

const prisma = new PrismaClient()

/**
 * ⚠️ CE HELPER ASSERTE, il n'imprime pas un verdict.
 * La version précédente rendait la chaîne « RATE » à `console.log` : si le garde n'était
 * pas déployé, le PATCH passait, `demo-tenant-001` repartait en XAF en production — et le
 * script sortait en **0**, avec une sortie d'apparence normale. C'est la forme du job
 * `notify-failure` qui se déclarait vert sur un run rouge, en pire : ce script est la
 * SEULE chose qui exerce le garde contre le déploiement réel.
 * *Un outil de preuve qui ne peut pas échouer ne prouve rien.*
 */
let echecs = 0
const ok = (c: boolean) => { if (!c) echecs++; return c ? 'OK ' : 'RATE' }

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
  // ⚠️ Les `create` sont DANS le `try`. Dehors, un échec entre eux et le bloc laissait un
  // compte ADMIN vivant en production, jamais nettoyé — et `lib/fixtureTenant.ts` l'aurait
  // classé boutique CLIENTE réelle (isDemo false, pas de préfixe `e2e-`), donc compté dans
  // les agrégats de la console Ops. Le ménage préalable rend le script REJOUABLE après une
  // exécution interrompue au lieu d'échouer sur l'e-mail unique.
  try {
    await nettoyer()
    await prisma.tenant.create({
      data: { id: TMP_ID, name: 'Vérif zone (jetable)', country: 'CM', currency: 'XAF', vatRate: 19.25, plan: 'starter', status: 'active', isActive: true },
    })
    await prisma.user.create({
      data: { id: `${TMP_ID}-u`, tenantId: TMP_ID, email: TMP_MAIL, name: 'Vérif', role: 'ADMIN', passwordHash: await bcrypt.hash(TMP_PASS, 12) },
    })
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
    const reste = await nettoyer()
    console.log(`  [${ok(reste === 0)}] tenant jetable détruit — ${reste} orphelin(s)`)
  }
}

/** Détruit le tenant jetable et rend le nombre d'orphelins restants. Idempotent. */
async function nettoyer(): Promise<number> {
  await prisma.auditLog.deleteMany({ where: { tenantId: TMP_ID } })
  await prisma.user.deleteMany({ where: { OR: [{ tenantId: TMP_ID }, { email: TMP_MAIL }] } })
  await prisma.tenant.deleteMany({ where: { id: TMP_ID } })
  return (
    (await prisma.tenant.count({ where: { id: TMP_ID } })) +
    (await prisma.user.count({ where: { OR: [{ tenantId: TMP_ID }, { email: TMP_MAIL }] } })) +
    (await prisma.auditLog.count({ where: { tenantId: TMP_ID } }))
  )
}

// ⚠️ Ctrl-C sur un script qui paraît figé (Railway free-tier démarre à froid) ne doit pas
// laisser un ADMIN de production derrière lui. Sans ces handlers, le `finally` ne tourne pas.
let enCoursDeSortie = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (enCoursDeSortie) return
    enCoursDeSortie = true
    console.error(`\n  ${signal} reçu — nettoyage du tenant jetable avant de sortir…`)
    void nettoyer()
      .then(r => console.error(`  ${r} orphelin(s) restant(s)`))
      .finally(() => prisma.$disconnect().finally(() => process.exit(130)))
  })
}

main()
  .catch(e => { console.error('  ✖', e.message); echecs++ })
  .finally(async () => {
    await prisma.$disconnect()
    // ⚠️ LE code de sortie EST le verdict. Un shell qui ne lit que `$?` doit voir l'échec.
    if (echecs > 0) {
      console.error(`\n  ✖ ${echecs} vérification(s) en ÉCHEC — le garde ne fait pas ce qu'on affirme.`)
      process.exit(1)
    }
    console.log('\n  ✅ toutes les vérifications passent.')
  })
