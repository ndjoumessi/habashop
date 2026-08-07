import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'https://habashop.vercel.app'

// Phase 6 : les congés passent désormais par l'API (/api/leave-requests). Soumettre = POST,
// Approuver = POST /:id/approve (le BACKEND crée le Shift Congé + l'Attendance LEAVE via
// eachDateInclusive). Le frontend n'écrit plus dans le localStorage planning → ce test vérifie
// le flux UI création + approbation (statut → Approuvé) et les appels API correspondants.
// ⚠️ CE SCÉNARIO NETTOIE DERRIÈRE LUI. Le commentaire précédent disait « pas de route
// DELETE leave → accumulation assumée » : l'accumulation était assumée sans avoir jamais
// été comptée. MESURÉ le 2026-08-06 — **295 demandes en base pour 2 combinaisons
// distinctes**, dont 289 sur `e2e-tenant`, depuis le 2026-07-16. Une fixture qui écrit
// dans la base de PRODUCTION à chaque exécution de CI doit se retirer, sinon elle finit
// par être ce que l'écran montre. `DELETE /api/leave-requests/:id` existe désormais.
// NOTE : /api/auth/login rate-limité (10 / 15 min / IP) → un seul login.
/** Base de l'API — même repli que les autres scénarios. */
const API = process.env.E2E_API ?? 'https://habashop-production.up.railway.app'

/**
 * Jeton de la session Playwright (`storageState`), pour les appels de ménage.
 *
 * ⚠️ LISAIT `auth-storage` — UNE CLÉ QUI N'EXISTE NULLE PART. Le store persiste sous
 * **`habashop-auth`** (`authStore.ts:187`), et les quatre autres scénarios lisent
 * **`habashop_token`**. `localStorage.getItem('auth-storage')` rendait donc `null`, le
 * jeton `''`, et le `DELETE` partait en `Bearer ` → 401. **Le ménage n'a jamais supprimé
 * une seule ligne** : 289 → 306 demandes entre le 06/08 et le 07/08, croissance monotone
 * APRÈS le correctif censé la stopper.
 *
 * ⚠️ Et l'échec était INVISIBLE : le `console.warn` du repli n'est imprimé par le
 * rapporteur Playwright que si le test ÉCHOUE. Un test vert n'imprime rien. C'est
 * « l'absence n'est pas une preuve » sur un troisième support — après la coche verte du
 * job de notification et le `exit 0` d'un scan cassé. D'où l'ASSERTION ci-dessous : un
 * avertissement qu'on espère lire ne vaut rien, un rouge se voit.
 */
const jeton = (page: import('@playwright/test').Page) =>
  page.evaluate(() => localStorage.getItem('habashop_token') ?? '')

/** Nombre de demandes du tenant — la mesure qui encadre le scénario. */
async function compterDemandes(page: import('@playwright/test').Page): Promise<number> {
  const res = await page.request.get(`${API}/api/leave-requests`, {
    headers: { authorization: `Bearer ${await jeton(page)}` },
  })
  if (!res.ok()) throw new Error(`GET /api/leave-requests → ${res.status()} (jeton absent ou invalide ?)`)
  return (await res.json() as unknown[]).length
}

test('Congé : création + approbation via API → statut Approuvé', async ({ page }) => {
  let creee: string | null = null
  // Auth via storageState (projet `setup`).

  // HR → onglet Congés
  await page.goto(`${BASE}/app/hr`)
  // Compte AVANT — il encadre le scénario et rend le ménage vérifiable par la MESURE.
  // ⚠️ Après le `goto` : `page.request` a besoin du `storageState` chargé pour le jeton.
  const avant = await compterDemandes(page)
  await expect(page.getByRole('heading', { name: /Ressources Humaines|Human Resources/ })).toBeVisible({ timeout: 15000 })
  await page.getByText(/^Congés$|^Leaves$/).first().click()

  // Nouvelle demande → remplir → Soumettre (POST /api/leave-requests)
  await page.getByText(/Nouvelle demande|New request/).first().click()
  const empSelect = page.locator('select[aria-label="EMPLOYÉ"], select[aria-label="EMPLOYEE"]').first()
  await expect(empSelect).toBeVisible({ timeout: 5000 })
  await empSelect.selectOption({ label: 'Fatoumata Ndiaye' })
  await page.locator('input[aria-label="DU"], input[aria-label="FROM"]').first().fill('2026-06-01')
  await page.locator('input[aria-label="AU"], input[aria-label="TO"]').first().fill('2026-06-03')
  // ⚠️ On CAPTURE l'identifiant renvoyé : sans lui, impossible de nettoyer. La réponse
  // était jusqu'ici jetée — même motif que la réponse de `POST /api/sales` (§ Réconciliation).
  const [reponse] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/leave-requests') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: /Soumettre|Submit/ }).click(),
  ])
  creee = await reponse.json().then((j: { id?: string }) => j?.id ?? null).catch(() => null)

  // La demande créée (en attente, en tête de liste) → Approuver (POST /:id/approve)
  const approveBtn = page.getByRole('button', { name: /Approuver|Approve/ }).first()
  await expect(approveBtn).toBeVisible({ timeout: 8000 })
  await Promise.all([
    page.waitForResponse(r => /\/api\/leave-requests\/[^/]+\/approve/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 }),
    approveBtn.click(),
  ])

  // Statut → Approuvé (le backend a aussi créé Shift Congé + Attendance LEAVE côté serveur).
  await expect(page.getByText(/Approuvé|Approved/).first()).toBeVisible({ timeout: 8000 })

  // ── NETTOYAGE — ASSERTÉ, PLUS « best-effort » ────────────────────────────────
  // ⚠️ RENVERSEMENT DÉLIBÉRÉ. Le ménage était non bloquant « pour ne pas rougir sur du
  // ménage ». Résultat : il a échoué à CHAQUE exécution pendant un jour entier sans que
  // rien ne le dise, et la fuite qu'il devait fermer a continué (289 → 306). Un ménage
  // silencieux qui ne marche pas est pire que pas de ménage : il fait croire que c'est
  // réglé. On préfère un rouge franc.
  expect(creee, 'identifiant de la demande non capturé — le ménage serait impossible').toBeTruthy()
  const res = await page.request.delete(`${API}/api/leave-requests/${creee}`, {
    headers: { authorization: `Bearer ${await jeton(page)}` },
  })
  expect(res.ok(), `DELETE /api/leave-requests/${creee} → ${res.status()}`).toBe(true)

  // ⚠️ LA MESURE, PAS LE CODE DE RETOUR. Un 200 dit que l'appel a abouti, pas que la base
  // est revenue à son état d'avant — c'est le motif du smoke de version, qui restait vert
  // quand le déploiement n'avait pas eu lieu. On COMPTE.
  expect(await compterDemandes(page),
    'le scénario doit laisser la base exactement comme il l’a trouvée').toBe(avant)
  // ⚠️ LIMITE ASSUMÉE : sur un RETRY, la tentative précédente a créé une ligne qu'elle n'a
  // pas pu supprimer (elle s'est interrompue avant ce bloc). Le `avant` de la nouvelle
  // tentative l'inclut, donc l'égalité tient et l'orpheline survit. Les retries rejouant le
  // test entier sont d'ailleurs mesurés : le 07/08, l'exécution 31137759378 a créé DEUX
  // demandes (01:24:40 et 01:25:37). Ce test ne purge pas le passé — la séquence est
  // fermer, prouver fermé, puis vider (§ Dette ouverte).
})
