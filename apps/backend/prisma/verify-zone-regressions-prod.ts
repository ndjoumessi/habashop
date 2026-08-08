/**
 * VÉRIFICATION EN PRODUCTION des deux régressions corrigées par `43730f0d`.
 *
 * Les tests prouvent le CODE ; ils ne prouvent pas le DÉPLOIEMENT. Ce script exerce le
 * backend réellement en service.
 *
 *   ③ Le 400 rejoué contre le déploiement COURANT. ⚠️ On lit le CODE d'erreur, pas le
 *     statut : `400 NO_ACTIVE_TENANT` a déjà donné le bon statut par un chemin qui
 *     n'atteignait pas le garde. Un statut attendu obtenu autrement ne prouve rien.
 *   ④a Créer une boutique SANS champ pays doit ABOUTIR avec une devise cohérente.
 *     Sur `af5aacd8` cette requête rendait 400 : elle sert donc aussi de DISCRIMINANT
 *     DE VERSION — si elle 400 encore, le déploiement courant n'a pas la correction.
 *
 * Tenant jetable créé, exercé, DÉTRUIT — ainsi que la 2ᵉ boutique créée par ④a. Le
 * ménage est idempotent et couvre les signaux ; le code de sortie porte le verdict.
 *
 *   npx tsx --env-file=.env prisma/verify-zone-regressions-prod.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

const API = process.env.VERIFY_API ?? 'https://habashop-production.up.railway.app'
const DEMO_ID = 'demo-tenant-001'
const TMP_ID = 'verif-reg-tmp'
const TMP_MAIL = 'verif-reg-tmp@habashop.invalid'
const TMP_PASS = randomBytes(24).toString('base64url')

const prisma = new PrismaClient()
let echecs = 0
const ok = (c: boolean) => { if (!c) echecs++; return c ? 'OK ' : 'RATE' }

/** Ids de boutiques créées PAR le test — détruites même en cas d'échec. */
const creesParLeTest = new Set<string>([TMP_ID])

async function jeton(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json() as { token?: string; error?: string }
  if (!j.token) throw new Error(`login ${email} : ${r.status} ${j.error ?? ''}`)
  return j.token
}

async function appel(token: string, methode: string, url: string, body?: unknown) {
  const r = await fetch(`${API}${url}`, {
    method: methode,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> }
}

async function nettoyer(): Promise<number> {
  const ids = [...creesParLeTest]
  await prisma.auditLog.deleteMany({ where: { tenantId: { in: ids } } })
  await prisma.userTenant.deleteMany({ where: { tenantId: { in: ids } } })
  await prisma.user.deleteMany({ where: { OR: [{ tenantId: { in: ids } }, { email: TMP_MAIL }] } })
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } })
  return (
    (await prisma.tenant.count({ where: { id: { in: ids } } })) +
    (await prisma.user.count({ where: { OR: [{ tenantId: { in: ids } }, { email: TMP_MAIL }] } })) +
    (await prisma.auditLog.count({ where: { tenantId: { in: ids } } }))
  )
}

let sortieEnCours = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (sortieEnCours) return
    sortieEnCours = true
    console.error(`\n  ${signal} — nettoyage avant sortie…`)
    void nettoyer().then(r => console.error(`  ${r} orphelin(s)`))
      .finally(() => prisma.$disconnect().finally(() => process.exit(130)))
  })
}

async function main() {
  // ── ③ Le 400 rejoué contre le déploiement COURANT ──────────────────────────
  console.log('\n── ③ rejeu du 400 sur demo-tenant-001 (SN) ──')
  const avant = await prisma.tenant.findUniqueOrThrow({
    where: { id: DEMO_ID }, select: { country: true, currency: true, updatedAt: true },
  })
  console.log(`  état avant : ${avant.country}/${avant.currency}  updatedAt=${avant.updatedAt.toISOString()}`)

  let tk = await jeton('admin@habashop.com', 'demo1234')
  const sw = await appel(tk, 'POST', '/api/auth/switch-tenant', { tenantId: DEMO_ID })
  if (typeof sw.body.token !== 'string') throw new Error(`switch-tenant : ${sw.status}`)
  tk = sw.body.token

  const refus = await appel(tk, 'PATCH', '/api/tenant', { currency: 'XAF' })
  console.log(`  PATCH {currency:'XAF'} → ${refus.status} ${refus.body.code ?? '(sans code)'}`)
  console.log(`  message : ${refus.body.error ?? ''}`)
  console.log(`  [${ok(refus.status === 400)}] statut 400`)
  // ⚠️ LE CODE, pas le statut. `NO_ACTIVE_TENANT` rendait déjà 400 sans atteindre le garde.
  console.log(`  [${ok(refus.body.code === 'CURRENCY_ZONE_MISMATCH')}] code CURRENCY_ZONE_MISMATCH (et pas NO_ACTIVE_TENANT)`)

  const apres = await prisma.tenant.findUniqueOrThrow({
    where: { id: DEMO_ID }, select: { currency: true, updatedAt: true },
  })
  console.log(`  [${ok(+apres.updatedAt === +avant.updatedAt)}] AUCUNE écriture — updatedAt inchangé`)
  console.log(`  [${ok(apres.currency === 'XOF')}] devise toujours XOF`)

  // ── ④a Créer une boutique SANS champ pays ─────────────────────────────────
  console.log('\n── ④a création d’une boutique sans champ pays (tenant JETABLE) ──')
  try {
    await nettoyer()
    await prisma.tenant.create({
      data: { id: TMP_ID, name: 'Vérif régressions (jetable)', country: 'SN', currency: 'XOF', vatRate: 18, plan: 'starter', status: 'active', isActive: true },
    })
    const u = await prisma.user.create({
      data: { id: `${TMP_ID}-u`, tenantId: TMP_ID, email: TMP_MAIL, name: 'Vérif', role: 'ADMIN', passwordHash: await bcrypt.hash(TMP_PASS, 12) },
    })
    await prisma.userTenant.create({ data: { userId: u.id, tenantId: TMP_ID, role: 'ADMIN' } })

    const t2 = await jeton(TMP_MAIL, TMP_PASS)
    // Exactement ce que `SectionShops.tsx` envoie : PAS de champ pays.
    const cree = await appel(t2, 'POST', '/api/tenants', { name: 'Boutique 2', currency: 'XOF', lang: 'fr' })
    console.log(`  POST /api/tenants {name, currency:'XOF', lang} → ${cree.status} ${cree.body.code ?? ''}`)
    // La route répond `{ tenant }`, pas le tenant à plat.
    const idCree = (cree.body.tenant as { id?: string } | undefined)?.id
    if (typeof idCree === 'string') creesParLeTest.add(idCree)

    // ⚠️ DISCRIMINANT DE VERSION : sur `af5aacd8` cette requête rendait 400.
    console.log(`  [${ok(cree.status === 201)}] la création ABOUTIT (400 = déploiement sans la correction)`)

    // ⚠️ On juge la LIGNE ÉCRITE, pas le corps de la réponse : c'est la donnée qui
    // compte, et un corps de réponse peut la refléter mal sans que la base soit fausse.
    const enBase = idCree
      ? await prisma.tenant.findUnique({ where: { id: idCree }, select: { country: true, currency: true, vatRate: true } })
      : null
    console.log(`  ligne écrite : ${enBase?.country}/${enBase?.currency}  tva=${enBase?.vatRate}`)
    console.log(`  [${ok(enBase?.currency === 'XOF')}] devise servie, pas écrasée`)
    console.log(`  [${ok(enBase?.country === 'SN')}] pays HÉRITÉ de la boutique d’origine`)

    // ③ bis — le `trim` du 43730f0d, sur le jetable plutôt que sur la démo
    const espace = await appel(t2, 'PATCH', '/api/tenant', { currency: 'XAF ' })
    console.log(`  PATCH {currency:'XAF '} (espace) → ${espace.status} ${espace.body.code ?? '(sans code)'}`)
    console.log(`  [${ok(espace.body.code === 'CURRENCY_ZONE_MISMATCH')}] l’espace ne contourne plus le garde`)
  } finally {
    const reste = await nettoyer()
    console.log(`\n  [${ok(reste === 0)}] tout détruit — ${reste} orphelin(s)`)
  }
}

main()
  .catch(e => { console.error('  ✖', e.message); echecs++ })
  .finally(async () => {
    await prisma.$disconnect()
    if (echecs > 0) { console.error(`\n  ✖ ${echecs} vérification(s) en ÉCHEC.`); process.exit(1) }
    console.log('\n  ✅ toutes les vérifications passent.')
  })
