import { describe, it, expect } from 'vitest'
import { t } from '@/i18n'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CHART_PERIODS, isChartPeriod, periodOptionLabel, salesChartTitle,
  noSalesInPeriodLabel, noSalesIn30dLabel, type ChartPeriod,
} from '@/components/dashboard/dashboardShared'
import type { Lang } from '@/stores/appStore'

/**
 * VERROU — un message d'état vide doit NOMMER SA FENÊTRE.
 *
 * Le bug fermé : « Aucune vente pour le moment » sur un graphe à 7 jours, chez un commerçant
 * dont les dernières ventes dataient de 12 jours. Le message affirmait « jamais » là où la
 * requête ne savait dire que « pas dans cette fenêtre ».
 *
 * ⚠️ PORTÉE ASSUMÉE — ce verrou ne scanne PAS le dépôt. Deux raisons mesurées :
 *   1. « Pour le moment » est CORRECT quand la requête n'a pas de borne. Le fil d'activité
 *      (`analytics.ts` : `prisma.sale.findMany({ where: { tenantId }, take: 5 })`) n'a aucun
 *      `createdAt` — son « Aucune activité pour le moment » dit vrai. Idem pour la liste des
 *      tenants d'`AdminDashboard` et les révisions salariales de `PayrollHistory`.
 *   2. Un scan textuel produit des faux positifs : `Marketing.tsx` contient « Max 1 campagna
 *      per ora », où `per ora` est « par heure » en italien, pas « pour le moment ».
 * Un verrou qui crie au loup se fait désarmer. Il porte donc sur les surfaces réellement
 * fenêtrées — celles dont le module est la source unique.
 */

const LANGS: Lang[] = ['fr', 'en', 'es', 'it']

/** Ce que chaque fenêtre doit dire d'elle-même : son NOMBRE et son UNITÉ, dans chaque langue. */
const WINDOW_TOKENS: Record<ChartPeriod, { count: string; unit: Record<Lang, RegExp> }> = {
  '7days':   { count: '7',  unit: { fr: /jours/i, en: /days/i,   es: /días/i,  it: /giorni/i } },
  '30days':  { count: '30', unit: { fr: /jours/i, en: /days/i,   es: /días/i,  it: /giorni/i } },
  '3months': { count: '3',  unit: { fr: /mois/i,  en: /months/i, es: /meses/i, it: /mesi/i } },
}

/** Formules qui affirment « jamais » — interdites sur une surface bornée dans le temps. */
const UNBOUNDED = [
  /pour le moment/i, /pour l'instant/i, /encore/i,
  /\byet\b/i, /\bfor now\b/i,
  /por ahora/i, /todav[íi]a/i,
  /per ora/i, /ancora/i,
]

/** Le nombre doit être un TOKEN, pas une sous-chaîne : « 30 » ne prouve pas « 3 ». */
const hasCount = (s: string, count: string) => new RegExp(`(?<!\\d)${count}(?!\\d)`).test(s)

describe('états vides du dashboard — le vide nomme sa fenêtre', () => {
  it('couvre les 3 périodes du sélecteur', () => {
    // Garde anti-scan-vide : un tableau vide rendrait tous les `for` ci-dessous verts à vide.
    expect(CHART_PERIODS).toEqual(['7days', '30days', '3months'])
  })

  for (const period of CHART_PERIODS) {
    for (const lang of LANGS) {
      it(`graphe ${period}/${lang} : nomme sa fenêtre et n'affirme pas « jamais »`, () => {
        const msg = noSalesInPeriodLabel(period, lang)
        const { count, unit } = WINDOW_TOKENS[period]

        expect(msg.trim().length).toBeGreaterThan(0)
        expect(hasCount(msg, count), `« ${msg} » ne porte pas le nombre ${count}`).toBe(true)
        expect(unit[lang].test(msg), `« ${msg} » ne porte pas son unité de durée`).toBe(true)
        for (const banned of UNBOUNDED) {
          expect(banned.test(msg), `« ${msg} » affirme « jamais » (${banned})`).toBe(false)
        }
      })
    }
  }

  /**
   * ⚠️ CE BLOC A ÉTÉ RETOURNÉ LE 2026-10-01, ET C'EST LE POINT DE LA MODIFICATION.
   *
   * Il exigeait que le message NOMME LE MOIS, parce que les deux panneaux étaient scopés
   * `createdAt >= monthStart`. La fenêtre est devenue GLISSANTE sur 30 jours : la même
   * exigence, appliquée telle quelle, ferait annoncer « ce mois-ci » sur une période qui
   * n'est pas un mois. Un libellé qui survit au changement de ce qu'il décrit est un
   * libellé qui mentira.
   *
   * L'exigence inverse n'est donc pas un relâchement : nommer sa fenêtre reste obligatoire,
   * c'est la FENÊTRE qui a changé. Le mot « mois » devient INTERDIT ici.
   */
  for (const lang of LANGS) {
    it(`top produits / CA par catégorie (${lang}) : nomme les 30 JOURS, jamais le mois`, () => {
      const msg = noSalesIn30dLabel(lang)
      const monthWord: Record<Lang, RegExp> = { fr: /mois/i, en: /month/i, es: /mes\b/i, it: /mes[ei]/i }
      const dayWord: Record<Lang, RegExp> = { fr: /jours/i, en: /days/i, es: /días/i, it: /giorni/i }

      expect(msg).toMatch(/\b30\b/)
      expect(dayWord[lang].test(msg), `« ${msg} » ne nomme pas son unité`).toBe(true)
      expect(monthWord[lang].test(msg), `« ${msg} » annonce un MOIS sur une fenêtre de 30 jours`).toBe(false)
      for (const banned of UNBOUNDED) {
        expect(banned.test(msg), `« ${msg} » affirme « jamais » (${banned})`).toBe(false)
      }
    })
  }

  /**
   * ⚠️ ET IL DOIT RESTER DISTINCT DE CELUI DU GRAPHE. `NO_SALES_IN_PERIOD['30days']` dit
   * DÉJÀ « Aucune vente sur les 30 derniers jours » : maintenant que les deux panneaux
   * couvrent la même fenêtre, le réflexe est d'y mettre la même phrase. Trois panneaux qui
   * disent la même chose deviennent indistinguables — y compris pour un test de rendu. Le
   * message du camembert et du top produits nomme donc son SUJET, pas seulement sa fenêtre.
   */
  for (const lang of LANGS) {
    it(`le vide des produits (${lang}) se distingue du vide du GRAPHE sur la même fenêtre`, () => {
      expect(noSalesIn30dLabel(lang)).not.toBe(noSalesInPeriodLabel('30days', lang))
    })
  }

  /**
   * ⚠️ LE KPI LUI-MÊME, dans les quatre langues. C'est le plus gros chiffre du premier écran
   * de l'application : il portait « CA mensuel » / « Monthly Revenue » / « Ingresos
   * mensuales » / « Fatturato mensile » au-dessus d'une valeur qui ne mesure plus un mois.
   */
  for (const lang of LANGS) {
    it(`le KPI de période (${lang}) : nomme les 30 jours, jamais le mois`, () => {
      const libelle = t('kpi_revenue_30d', lang)
      const monthWord: Record<Lang, RegExp> = { fr: /mensuel|mois/i, en: /month/i, es: /mensual|mes\b/i, it: /mensile|mes[ei]/i }
      expect(libelle, `clé i18n absente en ${lang}`).not.toBe('kpi_revenue_30d')
      expect(libelle).toMatch(/\b30\b/)
      expect(monthWord[lang].test(libelle), `« ${libelle} » annonce un MOIS`).toBe(false)
    })
  }

  /**
   * ⚠️ PÉRIMÈTRE DÉRIVÉ, parce que le mien écrit à la main était FAUX.
   *
   * Après la bascule en 30 jours glissants, j'ai balayé les cinq fichiers qui LISENT le
   * nombre et conclu « zéro occurrence ». Le DOM rendu en production affichait
   * « Top produits du mois · 30 jours » : la chaîne ne vit pas dans ces fichiers, elle vit
   * dans `i18n/index.ts` sous la clé `top_products`, qui n'était pas dans mon périmètre.
   * Un périmètre listé à la main est faux dès qu'on ajoute quelque chose, et son assertion
   * de couverture ne le dira pas : elle prouve qu'on a lu N fichiers, jamais que N était
   * le bon N.
   *
   * Ce test DÉRIVE donc ses clés des appels `t('…')` de `Dashboard.tsx` et les confronte
   * aux quatre blocs de traduction. Il n'y a rien à maintenir : une clé ajoutée à l'écran
   * entre dans le périmètre d'elle-même.
   */
  it('⚠️ aucune clé i18n du tableau de bord n’annonce un MOIS — périmètre dérivé de la page', () => {
    const page = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf-8')
    const cles = [...new Set([...page.matchAll(/t\('([a-z0-9_]+)'\)/g)].map(m => m[1]))]
    expect(cles.length, 'extraction des clés cassée → verrou qui ne garde rien').toBeGreaterThan(5)

    const moisDit = /mensuel|mensual|mensile|monthly|du mois|ce mois|this month|questo mese|este mes|del mes|del mese/i
    const fautifs: string[] = []
    for (const cle of cles) {
      for (const lang of LANGS) {
        const valeur = t(cle, lang)
        if (valeur !== cle && moisDit.test(valeur)) fautifs.push(`${cle}/${lang} = « ${valeur} »`)
      }
    }
    expect(fautifs, 'le tableau de bord mesure 30 jours glissants').toEqual([])
  })

  it('les 3 fenêtres ont des messages DISTINCTS dans chaque langue', () => {
    // Un copier-coller qui laisserait « 7 derniers jours » sur la période 30 jours nommerait
    // une fenêtre — la MAUVAISE. Nommer ne suffit pas, il faut nommer la sienne.
    for (const lang of LANGS) {
      const msgs = CHART_PERIODS.map(p => noSalesInPeriodLabel(p, lang))
      expect(new Set(msgs).size, `messages dupliqués en ${lang} : ${msgs.join(' | ')}`).toBe(msgs.length)
    }
  })

  it('le TITRE du panneau suit la période, comme l\'état vide', () => {
    // Le titre était figé sur « 7 derniers jours » : à 30 jours, il contredisait le message
    // de vide juste en dessous. Deux fenêtres nommées à l'écran, une seule vraie.
    for (const lang of LANGS) {
      const titles = CHART_PERIODS.map(p => salesChartTitle(p, lang))
      expect(new Set(titles).size).toBe(titles.length)
      for (const period of CHART_PERIODS) {
        const { count, unit } = WINDOW_TOKENS[period]
        const title = salesChartTitle(period, lang)
        expect(hasCount(title, count), `titre « ${title} » : mauvaise fenêtre`).toBe(true)
        expect(unit[lang].test(title), `titre « ${title} » : unité absente`).toBe(true)
      }
    }
  })

  it('le sélecteur ne peut pas offrir une période inconnue du module', () => {
    // `Dashboard.tsx` rend ses `<option>` depuis CHART_PERIODS et filtre par `isChartPeriod`,
    // au lieu d'un `as ChartPeriod` qui aurait laissé passer n'importe quelle valeur.
    for (const period of CHART_PERIODS) {
      expect(isChartPeriod(period)).toBe(true)
      for (const lang of LANGS) expect(periodOptionLabel(period, lang).trim().length).toBeGreaterThan(0)
    }
    expect(isChartPeriod('6months')).toBe(false)
    expect(isChartPeriod('')).toBe(false)
    // Piège prototype : `hasOwnProperty` et non `in`, sinon 'toString' passerait pour une période.
    expect(isChartPeriod('toString')).toBe(false)
  })
})
