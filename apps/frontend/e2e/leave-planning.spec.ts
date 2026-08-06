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

/** Jeton de la session Playwright (`storageState`), pour l'appel de nettoyage. */
const jeton = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const brut = localStorage.getItem('auth-storage')
    try { return brut ? (JSON.parse(brut).state?.token ?? '') : '' } catch { return '' }
  })

test('Congé : création + approbation via API → statut Approuvé', async ({ page }) => {
  let creee: string | null = null
  // Auth via storageState (projet `setup`).

  // HR → onglet Congés
  await page.goto(`${BASE}/app/hr`)
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

  // ── NETTOYAGE ────────────────────────────────────────────────────────────────
  // ⚠️ Best-effort et NON bloquant : si la suppression échoue, le scénario a déjà prouvé
  // ce qu'il devait prouver et ne doit pas rougir pour un ménage. Mais l'échec est DIT,
  // sinon la fuite reprendrait en silence — ce qui est exactement ce qui s'est passé.
  if (creee) {
    const res = await page.request.delete(`${API}/api/leave-requests/${creee}`, {
      headers: { authorization: `Bearer ${await jeton(page)}` },
    })
    if (!res.ok()) console.warn(`[leave-planning] ménage impossible (${res.status()}) — demande ${creee} laissée en base`)
  } else {
    console.warn('[leave-planning] identifiant de la demande non capturé — rien à nettoyer')
  }
})
