import { test, expect, type Page } from '@playwright/test'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

/**
 * PARCOURS DE DÉMONSTRATION FILMÉ — une vidéo par langue.
 *
 * ⚠️ IL PART DE LA VITRINE ET IL EST RÉEL. Aucun `addInitScript`, aucun `fetch` remplacé,
 * aucune donnée fabriquée : on choisit la langue, on clique « Essayer la démo », et le serveur
 * crée une vraie boutique peuplée. C'est l'inverse de `e2e/dev/ecrans.ts`, qui stubbe les
 * réponses pour mesurer la mise en page sans backend — un seed déterministe est ce qu'il faut
 * pour MESURER, et exactement ce qu'il ne faut pas pour MONTRER.
 *
 * ⚠️ TOUTE LA NAVIGATION PASSE PAR DES CLICS SUR `a[href=…]`. Deux raisons, toutes deux
 * mesurées : un `page.goto` après connexion provoque un démarrage à froid qui DÉCONNECTE
 * (§ Pièges E2E), et les libellés de la barre latérale sont TRADUITS — un sélecteur de texte
 * tiendrait en français et casserait en espagnol. Un `href` ne se traduit pas.
 *
 * ⚠️ CHAQUE EXÉCUTION LAISSE UN TENANT DERRIÈRE ELLE, et le spec ne peut pas le détruire :
 * Prisma vit dans `apps/backend`, pas ici. Il ÉCRIT donc les identifiants créés dans
 * `e2e/capture/tenants-crees.txt`, que le ménage lit ensuite. Le périmètre du ménage est cette
 * liste — jamais « toutes les démos éphémères de la base », formule qui a déjà détruit deux
 * démonstrations créées par de vrais visiteurs.
 *
 * ⚠️ LES PAUSES SONT L'OBJET, pas un contournement. Une vidéo sans temps d'arrêt est illisible :
 * on attend un élément RÉEL de chaque écran (donc on ne filme pas un squelette de chargement),
 * puis on laisse le regard se poser.
 */

const LANGUES = [
  { code: 'fr', nom: 'francais' },
  { code: 'en', nom: 'english' },
  { code: 'es', nom: 'espanol' },
  { code: 'it', nom: 'italiano' },
] as const

/**
 * ⚠️ `ICI` N'EXISTE PAS ICI. Le workspace front est en ESM (`"type": "module"`), là où
 * les tests backend sont en CJS et l'emploient librement : l'idiome ne se transpose pas d'un
 * workspace à l'autre. Mesuré — le spec ne se CHARGEAIT pas, « 0 tests in 0 files », et c'est
 * un échec qui ne ressemble pas à sa cause.
 */
const ICI = fileURLToPath(new URL('.', import.meta.url))
const JOURNAL = join(ICI, 'tenants-crees.txt')

/** Laisse le regard se poser — une vidéo qui enchaîne sans pause ne se lit pas. */
const POSE = 2_600

/**
 * Ouvre un écran par CLIC et attend qu'il soit rendu.
 * ⚠️ `waitForURL` avant la pause : sans lui on filmerait l'écran PRÉCÉDENT pendant la
 * transition, et la vidéo montrerait des libellés qui ne correspondent pas à la page.
 */
async function ecran(page: Page, href: string, pose = POSE) {
  await page.locator(`a[href="${href}"]`).first().click()
  await page.waitForURL(`**${href}`)
  await page.waitForLoadState('networkidle').catch(() => { /* un sondage en vol ne bloque pas */ })
  await page.waitForTimeout(pose)
}

for (const L of LANGUES) {
  test(`parcours-${L.nom}`, async ({ page }) => {
    // ── 1. La vitrine, et le choix de la langue ──────────────────────────────
    await page.goto('/')
    // ⚠️ Le sélecteur est désigné par ses OPTIONS, pas par son rang : la barre en porte deux
    // (langue et devise) et leur ordre est une décision de mise en page, pas un contrat.
    await page.locator('select:has(option[value="it"])').first().selectOption(L.code)
    await page.waitForTimeout(1_200)

    // ── 2. « Essayer la démo » → une vraie boutique peuplée ──────────────────
    await page.locator('[data-testid="landing-demo"]').click()
    await page.waitForURL('**/app/dashboard', { timeout: 90_000 })

    // L'identifiant du tenant est lu DANS LA SESSION du navigateur — c'est le seul périmètre
    // que le ménage aura le droit de détruire.
    const tenantId = await page.evaluate(() => {
      const a = JSON.parse(localStorage.getItem('habashop-auth') ?? '{}')
      return (a?.state?.activeTenantId ?? '') as string
    })
    expect(tenantId, 'la démo doit avoir créé un tenant').toMatch(/^demo-tmp-/)
    mkdirSync(ICI, { recursive: true })
    appendFileSync(JOURNAL, `${tenantId}\n`, 'utf-8')

    // ── 3. Tableau de bord — les KPI sur 30 jours glissants ─────────────────
    // ⚠️ On attend une CARTE rendue, pas un simple `waitForURL` : sinon on filme le squelette.
    await page.locator('.kpi-card').first().waitFor({ timeout: 60_000 })
    await page.waitForTimeout(POSE + 1_200)

    // ── 4. Caisse — le catalogue, puis deux articles au panier ──────────────
    await ecran(page, '/app/pos', 1_500)
    const vignettes = page.locator('[data-testid="pos-product"]')
    await vignettes.first().waitFor({ timeout: 60_000 })
    expect(await vignettes.count(), 'le catalogue doit être peuplé').toBeGreaterThan(5)
    for (const i of [0, 3]) {
      await vignettes.nth(i).click()
      await page.waitForTimeout(900)
    }
    // ⚠️ ON N'ENCAISSE PAS. Le panier et son total montrent la caisse ; aller jusqu'au paiement
    // ouvrirait un panneau dont les libellés diffèrent par langue, et aucun compte marchand
    // n'est ouvert — on ne filme pas un encaissement qui n'existe pas.
    await page.waitForTimeout(POSE)

    // ── 5. Stock — dont les produits sous le seuil ───────────────────────────
    await ecran(page, '/app/stock')

    // ── 6. Rapports ─────────────────────────────────────────────────────────
    await ecran(page, '/app/reports')

    // ── 7. RH — c'est ICI que la langue se voit : rôles et départements traduits
    //        au-dessus de noms de personnes, qui ne se traduisent pas.
    await ecran(page, '/app/hr', POSE + 1_400)

    // ── 8. Planning ─────────────────────────────────────────────────────────
    await ecran(page, '/app/planning')
  })
}
