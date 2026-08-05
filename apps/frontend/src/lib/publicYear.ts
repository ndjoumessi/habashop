/**
 * Année de copyright des surfaces PUBLIQUES — SOURCE UNIQUE.
 *
 * Il y avait six littéraux (`landingShared` ×4 langues, `LoginPage`, `Privacy`). Un
 * littéral d'année est une donnée qui se périme SEULE, sans que rien ne la contredise :
 * personne ne voit le bug avant le 1ᵉʳ janvier, et alors il est sur toutes les pages
 * publiques à la fois. Même famille que les versions figées à 1.0.0.
 *
 * `now` est injectable (convention du dépôt : jamais de `new Date('…')` littéral dans
 * un test, jamais d'horloge non maîtrisée dans une assertion).
 */
export function copyrightYear(now: Date = new Date()): number {
  return now.getFullYear()
}

/** Pied de page court : « © 2026 HabaShop ». */
export function copyrightLine(now?: Date): string {
  return `© ${copyrightYear(now)} HabaShop`
}
