/**
 * VÉRIFICATION EN PRODUCTION des budgets de dépense persistés (`ExpenseBudget`).
 *
 * ─── LES TROIS FORMES AUTORISÉES ─────────────────────────────────────────────
 *   (1) LECTURE SEULE  — l'état des boutiques existantes, jamais muté ici.
 *   (2) TENANT JETABLE — pour tout ce qui ÉCRIT. Créé, exercé, DÉTRUIT, orphelins
 *       vérifiés. Jamais une démo, jamais `e2e-tenant`.
 *   (3) Aucun envoi facturé : ni Twilio, ni Anthropic, ni Resend n'est atteint.
 *
 * ⚠️ CE SCRIPT ASSERTE, il n'imprime pas un verdict. S'il se contentait d'afficher
 * « RATÉ », un déploiement cassé le laisserait sortir en 0 avec une sortie
 * d'apparence normale — la forme exacte du job `notify-failure` qui se déclarait
 * vert sur un run rouge.
 *
 *   npx tsx --env-file=.env prisma/verify-expense-budgets-prod.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

const API = process.env.VERIFY_API ?? 'https://habashop-production.up.railway.app'
const TMP_ID = 'verif-budget-tmp'
const TMP_MAIL = 'verif-budget-tmp@habashop.invalid'
/**
 * ⚠️ ENGENDRÉ À L'EXÉCUTION, jamais un littéral. Ce script crée un utilisateur ADMIN
 * RÉEL dans la base de PRODUCTION et le dépôt est PUBLIC : un mot de passe écrit ici
 * serait la clé publiée d'un compte qui existe périodiquement sur l'API exposée.
 */
const TMP_PASS = randomBytes(24).toString('base64url')

const prisma = new PrismaClient()

let echecs = 0
const ok = (c: boolean) => { if (!c) echecs++; return c ? 'OK  ' : 'RATÉ' }

/** Ids créés PAR le test — détruits même en cas d'échec. */
const creesParLeTest = new Set<string>([TMP_ID])

async function nettoyer(): Promise<number> {
  const ids = [...creesParLeTest]
  await prisma.expenseBudget.deleteMany({ where: { tenantId: { in: ids } } })
  await prisma.auditLog.deleteMany({ where: { tenantId: { in: ids } } })
  await prisma.userTenant.deleteMany({ where: { tenantId: { in: ids } } })
  await prisma.user.deleteMany({ where: { OR: [{ tenantId: { in: ids } }, { email: TMP_MAIL }] } })
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } })
  return (
    (await prisma.tenant.count({ where: { id: { in: ids } } })) +
    (await prisma.user.count({ where: { OR: [{ tenantId: { in: ids } }, { email: TMP_MAIL }] } })) +
    (await prisma.expenseBudget.count({ where: { tenantId: { in: ids } } })) +
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

async function appel(token: string, methode: string, url: string, body?: unknown) {
  const r = await fetch(`${API}${url}`, {
    method: methode,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, any> }
}

async function main() {
  // ── (1) LECTURE SEULE : état des boutiques existantes ───────────────────────
  console.log('\n── état AVANT, en lecture seule ──')
  const lignesAvant = await prisma.expenseBudget.count()
  const tenantsAvant = await prisma.tenant.count()
  console.log(`  ExpenseBudget : ${lignesAvant} ligne(s) · tenants : ${tenantsAvant}`)

  try {
    await nettoyer()

    // ── (2) TENANT JETABLE ────────────────────────────────────────────────────
    await prisma.tenant.create({
      data: {
        id: TMP_ID, name: 'Vérif budgets (jetable)',
        country: 'CM', currency: 'XAF', vatRate: 19.25,
        plan: 'starter', status: 'active', isActive: true,
      },
    })
    const u = await prisma.user.create({
      data: {
        id: `${TMP_ID}-u`, tenantId: TMP_ID, email: TMP_MAIL,
        name: 'Vérif', role: 'ADMIN', passwordHash: await bcrypt.hash(TMP_PASS, 12),
      },
    })
    await prisma.userTenant.create({ data: { userId: u.id, tenantId: TMP_ID, role: 'ADMIN' } })
    console.log(`  boutique jetable créée : ${TMP_ID}`)

    const rl = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TMP_MAIL, password: TMP_PASS }),
    })
    const jl = await rl.json() as { token?: string; error?: string }
    if (!jl.token) throw new Error(`login : ${rl.status} ${jl.error ?? ''}`)
    let tk = jl.token
    // Mono-boutique : le jeton porte déjà la boutique active. On sélectionne quand
    // même, comme le fait l'interface, pour ne pas dépendre de cette hypothèse.
    const sw = await appel(tk, 'POST', '/api/auth/switch-tenant', { tenantId: TMP_ID })
    if (typeof sw.body.token === 'string') tk = sw.body.token

    // ── GET initial : les 8 catégories, à zéro ────────────────────────────────
    console.log('\n── GET initial ──')
    const g0 = await appel(tk, 'GET', '/api/expense-budgets')
    const cles = Object.keys(g0.body.budgets ?? {})
    console.log(`  ${g0.status} · ${cles.length} catégorie(s)`)
    console.log(`  [${ok(g0.status === 200)}] 200`)
    console.log(`  [${ok(cles.length === 8)}] les HUIT catégories sont rendues`)
    console.log(`  [${ok(cles.every(c => g0.body.budgets[c] === 0))}] toutes à zéro — aucun montant inventé`)

    // ── PUT : écriture réelle ─────────────────────────────────────────────────
    console.log('\n── PUT puis RELECTURE (le vrai test de persistance) ──')
    const envoye = { Loyer: 250_000, Énergie: 40_000, Marketing: 15_000 }
    const p1 = await appel(tk, 'PUT', '/api/expense-budgets', { budgets: envoye })
    console.log(`  PUT → ${p1.status}`)
    console.log(`  [${ok(p1.status === 200)}] 200`)

    // ⚠️ On RELIT par une requête NEUVE. Se fier à l'écho du PUT prouverait que le
    // serveur sait répéter ce qu'on lui a dit, pas qu'il l'a écrit.
    const g1 = await appel(tk, 'GET', '/api/expense-budgets')
    console.log(`  relu : Loyer=${g1.body.budgets?.Loyer} Énergie=${g1.body.budgets?.Énergie} Marketing=${g1.body.budgets?.Marketing}`)
    console.log(`  [${ok(g1.body.budgets?.Loyer === 250_000)}] Loyer persisté`)
    console.log(`  [${ok(g1.body.budgets?.Énergie === 40_000)}] Énergie persistée (clé accentuée intacte)`)
    console.log(`  [${ok(g1.body.budgets?.Transport === 0)}] catégorie non envoyée → reste à zéro`)

    // ── Idempotence ───────────────────────────────────────────────────────────
    await appel(tk, 'PUT', '/api/expense-budgets', { budgets: envoye })
    const nbLoyer = await prisma.expenseBudget.count({ where: { tenantId: TMP_ID, category: 'Loyer' } })
    console.log(`\n  [${ok(nbLoyer === 1)}] IDEMPOTENT — deux envois, ${nbLoyer} ligne « Loyer »`)

    // ── Refus du domaine ──────────────────────────────────────────────────────
    console.log('\n── refus ──')
    const bad = await appel(tk, 'PUT', '/api/expense-budgets', { budgets: { Crypto: 1000 } })
    console.log(`  catégorie inconnue → ${bad.status} ${bad.body.code ?? ''}`)
    console.log(`  [${ok(bad.status === 400 && bad.body.code === 'UNKNOWN_EXPENSE_CATEGORY')}] refusée, pas filtrée en silence`)
    console.log(`  [${ok((await prisma.expenseBudget.count({ where: { tenantId: TMP_ID, category: 'Crypto' } })) === 0)}] rien d'écrit`)

    const neg = await appel(tk, 'PUT', '/api/expense-budgets', { budgets: { Loyer: -5 } })
    console.log(`  [${ok(neg.status === 400)}] montant négatif refusé (${neg.status})`)

    const extra = await appel(tk, 'PUT', '/api/expense-budgets', { budgets: { Loyer: 1 }, tenantId: 'pirate' })
    console.log(`  [${ok(extra.status === 400)}] clé hors « budgets » refusée — anti mass-assignment (${extra.status})`)

    // ── Trace d'audit ─────────────────────────────────────────────────────────
    const traces = await prisma.auditLog.findMany({
      where: { tenantId: TMP_ID, action: 'EXPENSE_BUDGET_CHANGE' },
      orderBy: { createdAt: 'asc' }, select: { description: true },
    })
    console.log(`\n── audit ──`)
    console.log(`  [${ok(traces.length >= 1)}] au moins une trace (${traces.length})`)
    if (traces.length) {
      const d = JSON.parse(traces[0].description) as Record<string, { avant: number; apres: number }>
      console.log(`  première trace : ${JSON.stringify(d).slice(0, 120)}`)
      console.log(`  [${ok(d.Loyer?.avant === 0 && d.Loyer?.apres === 250_000)}] AVANT → APRÈS reconstituable`)
    }
    // ⚠️ Deuxième PUT identique : aucune trace de plus (un journal noyé ne se lit plus).
    const avantTrace = await prisma.auditLog.count({ where: { tenantId: TMP_ID, action: 'EXPENSE_BUDGET_CHANGE' } })
    await appel(tk, 'PUT', '/api/expense-budgets', { budgets: envoye })
    const apresTrace = await prisma.auditLog.count({ where: { tenantId: TMP_ID, action: 'EXPENSE_BUDGET_CHANGE' } })
    console.log(`  [${ok(avantTrace === apresTrace)}] aucune trace quand rien ne change`)

    // ── Isolation : aucune autre boutique n'a été touchée ─────────────────────
    const ailleurs = await prisma.expenseBudget.count({ where: { NOT: { tenantId: TMP_ID } } })
    console.log(`\n  [${ok(ailleurs === lignesAvant)}] ISOLATION — ${ailleurs} ligne(s) hors boutique jetable (${lignesAvant} avant)`)
  } finally {
    const reste = await nettoyer()
    const tenantsApres = await prisma.tenant.count()
    console.log(`\n  [${ok(reste === 0)}] tout détruit — ${reste} orphelin(s)`)
    console.log(`  [${ok(tenantsApres === tenantsAvant)}] ${tenantsApres} tenants, comme avant`)
  }
}

main()
  .catch(e => { console.error('  ✖', e.message); echecs++ })
  .finally(async () => {
    await prisma.$disconnect()
    if (echecs > 0) { console.error(`\n  ✖ ${echecs} vérification(s) en ÉCHEC.`); process.exit(1) }
    console.log('\n  ✅ toutes les vérifications passent.')
  })
