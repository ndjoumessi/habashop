/**
 * VÉRIFICATION EN PRODUCTION — budgets de dépense et MULTI-BOUTIQUES.
 *
 * ─── CE QUI EST EN JEU ───────────────────────────────────────────────────────
 * Les budgets sont scopés par `getActiveTenantId` : la boutique REGARDÉE, pas celle
 * du JWT. C'est testé en unitaire avec un Prisma simulé, et sur UNE boutique jetable
 * contre la production. Aucun de ces deux niveaux ne dit ce qui se passe quand un
 * gérant BASCULE réellement de boutique — le cas où une fuite se verrait en argent.
 *
 * ⚠️ DEUX boutiques jetables, jamais les démos. Écrire les budgets de `demo-tenant-002`
 * pour « voir si ça marche » serait une mutation d'un tenant existant : interdit.
 *
 * ⚠️ Le test le plus important n'est pas la bascule, c'est le REFUS : un utilisateur
 * NON MEMBRE ne doit pas pouvoir sélectionner la boutique d'un autre. Une isolation
 * qui ne tient que parce que l'interface ne propose pas le bouton n'est pas une
 * isolation — c'est la leçon de « la garde du navigateur n'est pas une garde ».
 *
 *   npx tsx --env-file=.env prisma/verify-expense-budgets-multishop-prod.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

const API = process.env.VERIFY_API ?? 'https://habashop-production.up.railway.app'
const A = 'verif-multi-a-tmp'
const B = 'verif-multi-b-tmp'
const MAIL_DUO = 'verif-multi-duo@habashop.invalid'   // membre de A ET B
const MAIL_SOLO = 'verif-multi-solo@habashop.invalid' // membre de A SEULEMENT
/** ⚠️ Engendré à l'exécution — dépôt PUBLIC, comptes RÉELS en production. */
const PASS = randomBytes(24).toString('base64url')

const prisma = new PrismaClient()
let echecs = 0
const ok = (c: boolean) => { if (!c) echecs++; return c ? 'OK  ' : 'RATÉ' }

const IDS = [A, B]
const MAILS = [MAIL_DUO, MAIL_SOLO]

async function nettoyer(): Promise<number> {
  await prisma.expenseBudget.deleteMany({ where: { tenantId: { in: IDS } } })
  await prisma.auditLog.deleteMany({ where: { tenantId: { in: IDS } } })
  await prisma.userTenant.deleteMany({ where: { tenantId: { in: IDS } } })
  await prisma.user.deleteMany({ where: { OR: [{ tenantId: { in: IDS } }, { email: { in: MAILS } }] } })
  await prisma.tenant.deleteMany({ where: { id: { in: IDS } } })
  return (
    (await prisma.tenant.count({ where: { id: { in: IDS } } })) +
    (await prisma.user.count({ where: { OR: [{ tenantId: { in: IDS } }, { email: { in: MAILS } }] } })) +
    (await prisma.expenseBudget.count({ where: { tenantId: { in: IDS } } })) +
    (await prisma.auditLog.count({ where: { tenantId: { in: IDS } } }))
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

async function appel(token: string, methode: string, url: string, body?: unknown) {
  const r = await fetch(`${API}${url}`, {
    method: methode,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, any> }
}

async function login(email: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  })
  const j = await r.json() as { token?: string; error?: string }
  if (!j.token) throw new Error(`login ${email} : ${r.status} ${j.error ?? ''}`)
  return j.token
}

/** Sélectionne une boutique et rend le nouveau jeton, ou `null` si REFUSÉ. */
async function basculer(token: string, tenantId: string): Promise<{ token: string | null; status: number }> {
  const r = await appel(token, 'POST', '/api/auth/switch-tenant', { tenantId })
  return { token: typeof r.body.token === 'string' ? r.body.token : null, status: r.status }
}

async function creerBoutique(id: string, nom: string) {
  await prisma.tenant.create({
    data: {
      id, name: nom, country: 'CM', currency: 'XAF', vatRate: 19.25,
      plan: 'starter', status: 'active', isActive: true,
    },
  })
}

async function main() {
  const avantAilleurs = await prisma.expenseBudget.count({ where: { NOT: { tenantId: { in: IDS } } } })
  console.log(`\n── état AVANT (lecture seule) : ${avantAilleurs} ligne(s) de budget hors périmètre du test ──`)

  try {
    await nettoyer()
    await creerBoutique(A, 'Vérif multi A (jetable)')
    await creerBoutique(B, 'Vérif multi B (jetable)')

    const hash = await bcrypt.hash(PASS, 12)
    const duo = await prisma.user.create({
      data: { id: `${A}-duo`, tenantId: A, email: MAIL_DUO, name: 'Duo', role: 'ADMIN', passwordHash: hash },
    })
    await prisma.userTenant.create({ data: { userId: duo.id, tenantId: A, role: 'ADMIN' } })
    await prisma.userTenant.create({ data: { userId: duo.id, tenantId: B, role: 'ADMIN' } })

    const solo = await prisma.user.create({
      data: { id: `${A}-solo`, tenantId: A, email: MAIL_SOLO, name: 'Solo', role: 'ADMIN', passwordHash: hash },
    })
    await prisma.userTenant.create({ data: { userId: solo.id, tenantId: A, role: 'ADMIN' } })
    console.log('  deux boutiques jetables + un gérant MULTI + un gérant MONO')

    // ── ① Écrire dans A, puis basculer vers B ────────────────────────────────
    console.log('\n── ① le gérant multi-boutiques bascule ──')
    let tk = await login(MAIL_DUO)
    const swA = await basculer(tk, A)
    if (!swA.token) throw new Error(`bascule vers A refusée : ${swA.status}`)
    tk = swA.token

    const pA = await appel(tk, 'PUT', '/api/expense-budgets', { budgets: { Loyer: 111_000, Énergie: 22_000 } })
    console.log(`  A ← PUT {Loyer:111 000, Énergie:22 000} → ${pA.status}`)
    console.log(`  [${ok(pA.status === 200)}] écriture dans A acceptée`)

    const swB = await basculer(tk, B)
    if (!swB.token) throw new Error(`bascule vers B refusée : ${swB.status}`)
    tk = swB.token
    const gB = await appel(tk, 'GET', '/api/expense-budgets')
    console.log(`  B → GET : Loyer=${gB.body.budgets?.Loyer} Énergie=${gB.body.budgets?.Énergie}`)
    console.log(`  [${ok(gB.body.budgets?.Loyer === 0 && gB.body.budgets?.Énergie === 0)}] B ne voit RIEN de A — pas de fuite`)

    // ── ② Écrire dans B, revenir dans A ──────────────────────────────────────
    const pB = await appel(tk, 'PUT', '/api/expense-budgets', { budgets: { Loyer: 999_000 } })
    console.log(`\n  B ← PUT {Loyer:999 000} → ${pB.status}`)
    const swA2 = await basculer(tk, A)
    tk = swA2.token!
    const gA = await appel(tk, 'GET', '/api/expense-budgets')
    console.log(`  A → GET : Loyer=${gA.body.budgets?.Loyer}`)
    console.log(`  [${ok(gA.body.budgets?.Loyer === 111_000)}] A a GARDÉ ses montants — B ne les a pas écrasés`)
    console.log(`  [${ok(gA.body.budgets?.Énergie === 22_000)}] et sa seconde catégorie aussi`)

    // ── ③ La base confirme deux jeux distincts ───────────────────────────────
    const enA = await prisma.expenseBudget.findMany({ where: { tenantId: A, amount: { gt: 0 } }, select: { category: true, amount: true } })
    const enB = await prisma.expenseBudget.findMany({ where: { tenantId: B, amount: { gt: 0 } }, select: { category: true, amount: true } })
    console.log(`\n  en base — A : ${JSON.stringify(enA)}`)
    console.log(`  en base — B : ${JSON.stringify(enB)}`)
    console.log(`  [${ok(enA.length === 2 && enB.length === 1)}] deux jeux DISTINCTS (A:${enA.length}, B:${enB.length})`)

    // ── ④ LE CAS QUI COMPTE : un NON-MEMBRE ne peut pas viser B ──────────────
    console.log('\n── ④ refus : un gérant MONO tente de viser la boutique B ──')
    const tkSolo = await login(MAIL_SOLO)
    const vol = await basculer(tkSolo, B)
    console.log(`  switch-tenant vers B → ${vol.status}, jeton ${vol.token ? 'DÉLIVRÉ' : 'refusé'}`)
    console.log(`  [${ok(vol.token === null)}] la bascule est REFUSÉE`)

    // Même avec son jeton d'origine, il ne doit lire que SA boutique.
    const swSoloA = await basculer(tkSolo, A)
    const tkS = swSoloA.token ?? tkSolo
    const gSolo = await appel(tkS, 'GET', '/api/expense-budgets')
    console.log(`  ses budgets : Loyer=${gSolo.body.budgets?.Loyer}`)
    console.log(`  [${ok(gSolo.body.budgets?.Loyer === 111_000)}] il lit bien A, sa boutique`)
    const nbB = await prisma.expenseBudget.count({ where: { tenantId: B, category: 'Loyer', amount: 999_000 } })
    console.log(`  [${ok(nbB === 1)}] et B n'a pas été touchée (${nbB} ligne intacte)`)

    // ── ⑤ Les audits sont scopés eux aussi ───────────────────────────────────
    const auditA = await prisma.auditLog.count({ where: { tenantId: A, action: 'EXPENSE_BUDGET_CHANGE' } })
    const auditB = await prisma.auditLog.count({ where: { tenantId: B, action: 'EXPENSE_BUDGET_CHANGE' } })
    console.log(`\n  [${ok(auditA >= 1 && auditB >= 1)}] chaque boutique a SA trace (A:${auditA}, B:${auditB})`)

    // ── ⑥ Rien d'autre n'a bougé ─────────────────────────────────────────────
    const apresAilleurs = await prisma.expenseBudget.count({ where: { NOT: { tenantId: { in: IDS } } } })
    console.log(`  [${ok(apresAilleurs === avantAilleurs)}] ISOLATION — ${apresAilleurs} ligne(s) hors test (${avantAilleurs} avant)`)
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
