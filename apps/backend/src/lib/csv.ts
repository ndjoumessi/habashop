/**
 * Garde anti-INJECTION CSV — le seul endroit qui décide, côté backend.
 *
 * Une cellule commençant par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot est
 * interprétée comme une FORMULE par Excel, LibreOffice et Google Sheets. Un produit nommé
 * `=cmd|'/c calc'!A1` s'exécute donc sur le poste du commerçant qui ouvre l'export. Les
 * valeurs exportées sont saisies par l'utilisateur — nom de produit, de client, de
 * fournisseur, notes — et un tenant a plusieurs comptes : celui qui saisit n'est pas
 * forcément celui qui exporte.
 *
 * ⚠️ ENTOURER LA CELLULE DE GUILLEMETS NE PROTÈGE PAS. Le tableur retire les guillemets du
 * CSV puis évalue le contenu : `"=1+1"` donne bien 2. C'est ce qui rendait la faille
 * invisible — les trois producteurs échappaient consciencieusement les `"` et se croyaient
 * sûrs. Seul le préfixe apostrophe neutralise.
 *
 * ⚠️ Cette fonction vivait en `const` LOCALE dans `routes/reports.ts` : une convention
 * documentée dans CLAUDE.md, mais applicable nulle part ailleurs. `routes/export.ts` ne
 * l'appelait donc pas (#173). Un garde qu'on ne peut pas importer n'est pas une convention,
 * c'est un vœu.
 *
 * ⚠️ JUMEAU FRONTEND : `apps/frontend/src/lib/csv.ts` doit rester IDENTIQUE. Les deux côtés
 * sont exercés sur `docs/shared-fixtures/csv-injection-cases.json` — modifier la règle d'un
 * seul côté fait rougir l'autre. (Pas de paquet `packages/*` partagé : il faudrait câbler la
 * résolution de modules des deux côtés pour une fonction d'une ligne.)
 */

/** Caractères qui déclenchent l'interprétation en formule. */
const DECLENCHEURS = /^[=+\-@\t\r]/

/**
 * Neutralise une valeur destinée à une cellule CSV.
 * Préfixe d'une apostrophe si la valeur peut être lue comme une formule ; sinon la rend
 * telle quelle. N'échappe PAS les guillemets — c'est le rôle du sérialiseur appelant.
 */
export function sanitizeCsv(value: unknown): string {
  const s = String(value ?? '')
  return DECLENCHEURS.test(s) ? `'${s}` : s
}
