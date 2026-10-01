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

/**
 * ⚠️ LE CODE EST LE SEUL IDENTIFIANT, et le titre du test en dérive. Le dossier de sortie de
 * Playwright porte le titre (`test-results/parcours-demo-parcours-fr/`) : c'est lui que lit
 * l'encodeur pour écrire `public/guide/apercu-fr.webm`. Un nom lisible en plus du code
 * (« francais ») aurait créé une table de correspondance à tenir des deux côtés — un jumeau
 * pour rien, là où `GuideLang` donne déjà le domaine.
 */
const LANGUES = ['fr', 'en', 'es', 'it'] as const

/**
 * ⚠️ `ICI` N'EXISTE PAS ICI. Le workspace front est en ESM (`"type": "module"`), là où
 * les tests backend sont en CJS et l'emploient librement : l'idiome ne se transpose pas d'un
 * workspace à l'autre. Mesuré — le spec ne se CHARGEAIT pas, « 0 tests in 0 files », et c'est
 * un échec qui ne ressemble pas à sa cause.
 */
const ICI = fileURLToPath(new URL('.', import.meta.url))
const JOURNAL = join(ICI, 'tenants-crees.txt')

/**
 * SOUS-TITRES INCRUSTÉS — ce que la vidéo seule ne disait pas.
 *
 * ⚠️ LA CAPTURE N'A PAS DE SON, et sans légende elle montre des écrans sans dire ce qu'on
 * regarde. Un manuel qui s'ouvre là-dessus demande au lecteur de deviner. Les cartons sont
 * donc INJECTÉS DANS LA PAGE au moment de la navigation : le calage est exact par
 * construction, là où une incrustation ffmpeg a posteriori devrait deviner des horodatages
 * qui varient d'une langue à l'autre (la création de la boutique ne dure pas le même temps).
 *
 * ⚠️ FORME DE SOUS-TITRE, PAS D'INTERFACE. Bande sombre en bas, hors du flux : un carton qui
 * ressemblerait à un élément du produit ferait croire à une fonctionnalité qui n'existe pas.
 * `pointer-events: none` pour ne jamais intercepter un clic du parcours.
 *
 * ⚠️ `Record<(typeof LANGUES)[number], string>` : `tsc` refuse une langue non traduite. Un
 * sous-titre manquant tomberait en `undefined` à l'écran, dans la vidéo livrée.
 */
type Soustitre = Record<(typeof LANGUES)[number], string>

const ST = {
  demarrage: {
    fr: 'Depuis la vitrine, « Essayer la démo » ouvre une boutique complète en un clic.',
    en: 'From the site, “Try the demo” opens a fully stocked shop in one click.',
    es: 'Desde la web, «Probar la demo» abre una tienda completa con un clic.',
    it: 'Dal sito, «Prova la demo» apre un negozio completo con un clic.',
  },
  dashboard: {
    fr: 'Tableau de bord — ventes du jour, stock, équipe, chiffre d’affaires sur 30 jours glissants.',
    en: 'Dashboard — today’s sales, stock, team, revenue over a rolling 30 days.',
    es: 'Panel — ventas del día, stock, equipo, ingresos de los últimos 30 días.',
    it: 'Pannello — vendite di oggi, magazzino, squadra, ricavi su 30 giorni.',
  },
  caisse: {
    fr: 'Caisse — on touche un produit, il entre au panier. Total et TVA se calculent seuls.',
    en: 'Register — tap a product, it joins the cart. Total and VAT compute themselves.',
    es: 'Caja — toca un producto y entra en el carrito. Total e IVA se calculan solos.',
    it: 'Cassa — tocchi un prodotto ed entra nel carrello. Totale e IVA si calcolano da soli.',
  },
  stock: {
    fr: 'Stock — 36 articles, et les produits sous le seuil sont signalés en haut.',
    en: 'Stock — 36 items, with products below their threshold flagged at the top.',
    es: 'Stock — 36 artículos, con los productos bajo mínimo señalados arriba.',
    it: 'Magazzino — 36 articoli, con i prodotti sotto soglia segnalati in alto.',
  },
  rapports: {
    fr: 'Rapports — chiffre d’affaires, marges, répartition des paiements, export CSV et PDF.',
    en: 'Reports — revenue, margins, payment split, CSV and PDF export.',
    es: 'Informes — ingresos, márgenes, reparto de pagos, exportación CSV y PDF.',
    it: 'Report — ricavi, margini, ripartizione dei pagamenti, esportazione CSV e PDF.',
  },
  equipe: {
    fr: 'Équipe — postes et départements s’affichent dans votre langue ; les noms, eux, ne se traduisent pas.',
    en: 'Team — roles and departments show in your language; names, of course, do not translate.',
    es: 'Equipo — puestos y departamentos en su idioma; los nombres, claro, no se traducen.',
    it: 'Squadra — ruoli e reparti nella vostra lingua; i nomi, invece, non si traducono.',
  },
  planning: {
    fr: 'Planning — trois semaines de rotation, et les heures de chacun s’additionnent.',
    en: 'Schedule — three weeks of rotation, with everyone’s hours adding up.',
    es: 'Planificación — tres semanas de rotación, con las horas de cada uno sumadas.',
    it: 'Pianificazione — tre settimane di turni, con le ore di ciascuno sommate.',
  },
} satisfies Record<string, Soustitre>

/** Pose le sous-titre dans la page. Il reste jusqu'au suivant — jamais de vide entre deux. */
async function soustitre(page: Page, texte: string) {
  await page.evaluate((t) => {
    const ID = '__capture_soustitre__'
    let el = document.getElementById(ID)
    if (!el) {
      el = document.createElement('div')
      el.id = ID
      el.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
        'pointer-events:none', 'padding:14px 28px',
        'background:linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.72) 70%, rgba(0,0,0,0))',
        'color:#fff', 'font: 600 17px/1.45 system-ui, -apple-system, Segoe UI, sans-serif',
        'text-align:center', 'text-shadow:0 1px 3px rgba(0,0,0,.9)',
      ].join(';')
      document.body.appendChild(el)
    }
    el.textContent = t
  }, texte)
}

/** Laisse le regard se poser — une vidéo qui enchaîne sans pause ne se lit pas. */
const POSE = 2_600

/**
 * Ouvre un écran par CLIC et attend qu'il soit rendu.
 * ⚠️ `waitForURL` avant la pause : sans lui on filmerait l'écran PRÉCÉDENT pendant la
 * transition, et la vidéo montrerait des libellés qui ne correspondent pas à la page.
 */
async function ecran(page: Page, href: string, pose = POSE, texte?: string) {
  await page.locator(`a[href="${href}"]`).first().click()
  await page.waitForURL(`**${href}`)
  await page.waitForLoadState('networkidle').catch(() => { /* un sondage en vol ne bloque pas */ })
  // ⚠️ APRÈS la navigation : posé avant, il serait effacé par le rendu de la page suivante.
  if (texte) await soustitre(page, texte)
  await page.waitForTimeout(pose)
}

for (const L of LANGUES) {
  test(`parcours-${L}`, async ({ page }) => {
    // ── 1. La vitrine, et le choix de la langue ──────────────────────────────
    await page.goto('/')
    // ⚠️ Le sélecteur est désigné par ses OPTIONS, pas par son rang : la barre en porte deux
    // (langue et devise) et leur ordre est une décision de mise en page, pas un contrat.
    await page.locator('select:has(option[value="it"])').first().selectOption(L)
    await soustitre(page, ST.demarrage[L])
    await page.waitForTimeout(2_000)

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
    await soustitre(page, ST.dashboard[L])
    await page.waitForTimeout(POSE + 1_200)

    // ── 4. Caisse — le catalogue, puis deux articles au panier ──────────────
    await ecran(page, '/app/pos', 1_500, ST.caisse[L])
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
    await ecran(page, '/app/stock', POSE, ST.stock[L])

    // ── 6. Rapports ─────────────────────────────────────────────────────────
    await ecran(page, '/app/reports', POSE, ST.rapports[L])

    // ── 7. RH — c'est ICI que la langue se voit : rôles et départements traduits
    //        au-dessus de noms de personnes, qui ne se traduisent pas.
    await ecran(page, '/app/hr', POSE + 1_400, ST.equipe[L])

    // ── 8. Planning ─────────────────────────────────────────────────────────
    await ecran(page, '/app/planning', POSE + 1_000, ST.planning[L])
  })
}
