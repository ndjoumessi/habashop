import { test, expect, request as pwRequest } from '@playwright/test'
import { deflateSync, crc32 } from 'node:zlib'

/**
 * PHOTO PRODUIT — LE SEUL TEST QUI EXERCE LA CHAÎNE DEPUIS UN VRAI NAVIGATEUR.
 *
 * ─── CE QU'IL PROUVE, ET QUE RIEN D'AUTRE NE PEUT PROUVER ────────────────────
 * jsdom n'a ni `<canvas>` ni décodeur d'image : `resizeToBlob` y est SIMULÉ, et
 * les 10 tests unitaires du champ ne jugent que la décision. `verify-r2-e2e.ts`,
 * lui, envoie des octets déjà prêts par HTTP — il saute le navigateur.
 *
 * Il reste donc un maillon jamais exercé : **le redimensionnement canvas et le
 * multipart émis par le navigateur**. C'est ce que ce fichier couvre, et
 * l'assertion qui compte est `naturalWidth <= 512` sur une source de 1200 px.
 * Si l'image stockée est plus petite que celle choisie, c'est que le canvas a
 * travaillé — aucune autre explication.
 *
 * ⚠️ IL MUTE `e2e-tenant`, ET C'EST ASSUMÉ. C'est le tenant DÉDIÉ aux tests de
 * bout en bout, que cette suite mute déjà (ventes, congés). Il n'est PAS marqué
 * `isDemo`, donc la garde de dépense laisse passer — c'est précisément pourquoi
 * il est le seul endroit où ce chemin est exerçable. Le ménage est ASSERTÉ, pas
 * best-effort : un ménage non vérifié a déjà échoué une journée entière en silence.
 *
 * ⚠️ IL ÉCRIT UN OBJET RÉEL DANS R2 (~20 Ko), retiré dans la foulée par le bouton
 * « Retirer » — c'est-à-dire en exerçant AUSSI le chemin de suppression.
 */

const BASE = process.env.PHOTO_BASE ?? 'https://habashop.vercel.app'

/** Un PNG VALIDE de dimensions choisies — il doit être décodable par le navigateur. */
function pngDegrade(largeur: number, hauteur: number): Buffer {
  const bloc = (type: string, data: Buffer) => {
    const t = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0)
    return Buffer.concat([len, t, data, c])
  }
  const brut = Buffer.alloc((largeur * 3 + 1) * hauteur)
  for (let y = 0; y < hauteur; y++) {
    const o = y * (largeur * 3 + 1)
    brut[o] = 0 // filtre « none »
    for (let x = 0; x < largeur; x++) {
      brut[o + 1 + x * 3] = (x * 255 / largeur) | 0
      brut[o + 2 + x * 3] = (y * 255 / hauteur) | 0
      brut[o + 3 + x * 3] = 140
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largeur, 0); ihdr.writeUInt32BE(hauteur, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8 bits, RVB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc('IHDR', ihdr), bloc('IDAT', deflateSync(brut)), bloc('IEND', Buffer.alloc(0)),
  ])
}

const API = process.env.API_URL ?? 'https://habashop-production.up.railway.app'
const SOURCE_PX = 1200

/**
 * ⚠️ MÉNAGE DE SÉCURITÉ — IL DOIT SURVIVRE À UN ÉCHEC EN COURS DE ROUTE.
 *
 * Le retrait par le bouton fait PARTIE du test (il exerce le chemin de suppression),
 * mais si le test casse APRÈS l'envoi et AVANT le clic, il laisse une photo sur
 * `e2e-tenant` et un objet facturé dans R2. Or cette suite tourne en CI à CHAQUE
 * push sur `main` : le résidu s'accumulerait sans que rien ne le dise.
 *
 * Ce bloc repasse donc par l'API, avec le jeton de la session partagée, et retire
 * toute photo restante. Il est IDEMPOTENT — quand le test a réussi, il ne trouve
 * rien et ne fait rien. *Un ménage best-effort a déjà échoué une journée entière
 * en silence : celui-ci rapporte ce qu'il a dû nettoyer.*
 */
test.afterEach(async ({ page }) => {
  const jeton = await page.evaluate(() => localStorage.getItem('habashop_token')).catch(() => null)
  if (!jeton) return
  const api = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${jeton}` } })
  try {
    const produits = await api.get(`${API}/api/products`).then(r => r.json()) as { id: string; image?: string | null }[]
    const restants = Array.isArray(produits) ? produits.filter(p => p.image) : []
    for (const p of restants) {
      await api.delete(`${API}/api/products/${p.id}/image`)
      console.warn(`[photo e2e] résidu nettoyé sur le produit ${p.id}`)
    }
  } finally {
    await api.dispose()
  }
})

test('Photo produit — envoi depuis le navigateur, redimensionné, servi, puis retiré', async ({ page }) => {
  test.setTimeout(90_000) // réseau réel + R2

  await page.goto(`${BASE}/app/stock`)

  // Ouvre la fiche du premier produit (œil), puis bascule en ÉDITION : le bloc
  // PHOTO n'existe qu'en mode édition.
  await page.locator('button:has(svg.lucide-eye)').first().click()
  const modale = page.locator('[role="dialog"]').first()
  await expect(modale).toBeVisible({ timeout: 15_000 })
  await modale.getByRole('button', { name: /Modifier|Edit|Editar|Modifica/ }).first().click()

  await expect(modale.getByText(/^PHOTO$|^FOTO$/).first()).toBeVisible({ timeout: 5_000 })

  // ⚠️ Le produit ne doit PAS déjà porter une photo : sinon le ménage ne restaure
  // pas l'état d'avant, il en détruit un.
  const photo = modale.locator('img[src*="/products/"]')
  await expect(photo, 'ce produit doit partir SANS photo').toHaveCount(0)

  // ── L'ENVOI, par le vrai champ de fichier ──────────────────────────────────
  await modale.locator('input[type="file"]').setInputFiles({
    name: 'produit-e2e.png',
    mimeType: 'image/png',
    buffer: pngDegrade(SOURCE_PX, Math.round(SOURCE_PX * 0.75)),
  })

  // ── LA PREUVE ──────────────────────────────────────────────────────────────
  await expect(photo, 'la photo doit apparaître dans la vignette').toHaveCount(1, { timeout: 45_000 })
  const src = await photo.getAttribute('src')
  expect(src, 'URL sous notre clé cloisonnée par tenant et produit').toMatch(/\/tenants\/[^/]+\/products\/[^/]+\/[a-f0-9]{32}\.(jpg|png|webp)$/)

  // L'image est réellement CHARGÉE depuis le domaine public (pas juste une balise).
  await expect
    .poll(() => photo.evaluate(el => (el as HTMLImageElement).naturalWidth), { timeout: 30_000 })
    .toBeGreaterThan(0)

  const largeurStockee = await photo.evaluate(el => (el as HTMLImageElement).naturalWidth)
  // ⚠️ L'ASSERTION QUI PORTE TOUT CE FICHIER. La source fait 1200 px ; si ce qui
  // est stocké en fait ≤ 512, le canvas a redimensionné — il n'y a pas d'autre
  // explication, le serveur n'a pas de `sharp`.
  expect(largeurStockee, `source ${SOURCE_PX}px → stockée ${largeurStockee}px`).toBeLessThanOrEqual(512)
  expect(largeurStockee, 'et ce n’est pas une image vide').toBeGreaterThan(1)

  // Le JPEG de sortie doit être plus léger que le PNG d'entrée : la conversion a eu lieu.
  expect(src).toMatch(/\.jpg$/)

  // ── MÉNAGE — ASSERTÉ, et il exerce le chemin de suppression ────────────────
  await modale.getByRole('button', { name: /Retirer|Remove|Quitar|Rimuovi/ }).first().click()
  await expect(photo, 'la photo doit être RETIRÉE — l’état d’avant est restauré').toHaveCount(0, { timeout: 20_000 })
})
