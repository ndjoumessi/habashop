/**
 * Borne BASSE de la fenêtre de `/api/reports/sales` — SOURCE UNIQUE.
 *
 * ⚠️ Le front en a un MIROIR (`components/dashboard/dashboardShared.ts`) : il remplit à 0 les
 * jours sans vente, et pour cela il doit connaître exactement la fenêtre que le serveur a
 * appliquée. Deux définitions divergentes produiraient un graphe dont l'axe n'est pas la
 * période annoncée — des zéros inventés avant le début réel, ou une amputation silencieuse.
 * Les cas partagés `docs/shared-fixtures/sales-window-cases.json` sont rejoués par les deux
 * côtés : changer la règle ici sans changer le miroir fait ROUGIR le test d'en face.
 *
 * ⚠️ Arithmétique en heure LOCALE, et l'heure du jour est CONSERVÉE (sauf `today`) — la
 * fenêtre est glissante, pas alignée sur minuit. Le premier jour couvert n'est donc que
 * PARTIEL : c'est pourquoi l'affichage démarre au premier jour plein (cf. le miroir front).
 *
 * ⚠️ `setMonth` déborde : le 31 mai moins 3 mois donne le **3 mars** (un 31 février retombe
 * au 3). Comportement JS d'origine, conservé volontairement et figé par les cas partagés.
 */
export function salesWindowStart(period: string, now: Date): Date {
  const from = new Date(now)
  if (period === 'today') from.setHours(0, 0, 0, 0)
  else if (period === '7days') from.setDate(now.getDate() - 7)
  else if (period === '30days') from.setDate(now.getDate() - 30)
  else if (period === '3months') from.setMonth(now.getMonth() - 3)
  else from.setFullYear(now.getFullYear(), 0, 1)
  return from
}
