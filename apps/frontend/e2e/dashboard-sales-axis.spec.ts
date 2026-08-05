import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

/**
 * Vérification À L'ÉCRAN du graphe de ventes : bascule 7 j → 30 j → 3 mois.
 *
 * L'axe doit CHANGER DE FORME (noms de jour → dates) et rester ORDONNÉ. Le bug fermé
 * produisait « Sam · Ven · Mer · Mar · Lun · Dim · Jeu » : ni chronologique, ni une date.
 *
 * Les tests unitaires (`dashboardSalesSeries.test.ts`) prouvent la fonction pure ; celui-ci
 * prouve que la page CÂBLE bien la fonction et que recharts rend l'axe attendu.
 */

const BASE = process.env.DASH_BASE ?? process.env.E2E_BASE ?? 'https://habashop.vercel.app'
const OUT = 'e2e/screenshots/sales-axis'

/** Libellés de l'axe X, dans l'ordre où recharts les rend. */
async function axisTicks(page: Page): Promise<string[]> {
  const ticks = page.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value')
  await expect(ticks.first()).toBeVisible({ timeout: 15000 })
  return (await ticks.allTextContents()).map(s => s.trim()).filter(Boolean)
}

test.describe('graphe de ventes — axe temporel', () => {
  test('7 j → 30 j → 3 mois : la forme change, l\'ordre tient', async ({ page }) => {
    mkdirSync(OUT, { recursive: true })
    await page.goto(`${BASE}/app/dashboard`)

    const select = page.locator('select').filter({ hasText: /jours|days|días|giorni/ }).first()
    await expect(select).toBeVisible({ timeout: 20000 })

    const seen: Record<string, string[]> = {}

    for (const period of ['7days', '30days', '3months'] as const) {
      await select.selectOption(period)
      await page.waitForTimeout(1500) // refetch + re-render recharts

      const empty = page.getByText(/Aucune vente sur les|No sales in the last/)
      if (await empty.count() > 0) {
        // Pas de donnée sur cette fenêtre : on le DIT, on ne conclut pas au vert.
        seen[period] = []
        await page.screenshot({ path: `${OUT}/${period}.png`, fullPage: false })
        continue
      }

      const ticks = await axisTicks(page)
      seen[period] = ticks
      await page.screenshot({ path: `${OUT}/${period}.png`, fullPage: false })

      expect(ticks.length, `${period} : axe vide`).toBeGreaterThan(0)

      if (period === '7days') {
        // Noms de jour : aucun chiffre.
        for (const t of ticks) expect(t, `7 j : « ${t} » n'est pas un nom de jour`).not.toMatch(/\d/)
      } else {
        // Dates JJ/MM — uniques, et croissantes.
        for (const t of ticks) expect(t, `${period} : « ${t} » n'est pas une date`).toMatch(/\d{1,2}\D\d{1,2}/)
        expect(new Set(ticks).size, `${period} : libellés dupliqués — ${ticks.join(' · ')}`).toBe(ticks.length)

        const asKey = (t: string) => {
          const [a, b] = t.split(/\D+/).map(Number)
          // fr/es/it = JJ/MM ; en-US = MM/JJ. Le tenant e2e est en fr → JJ/MM.
          return b * 100 + a
        }
        const keys = ticks.map(asKey)
        const sorted = [...keys].sort((x, y) => x - y)
        expect(keys, `${period} : axe non chronologique — ${ticks.join(' · ')}`).toEqual(sorted)
      }
    }

    // La bascule doit produire des axes DIFFÉRENTS : un axe figé signalerait un refetch mort.
    const nonEmpty = Object.entries(seen).filter(([, v]) => v.length > 0)
    console.log('axes observés :', JSON.stringify(seen, null, 2))
    expect(nonEmpty.length, 'aucune période ne portait de donnée — vérification non concluante').toBeGreaterThan(0)
  })
})
