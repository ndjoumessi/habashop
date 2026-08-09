/**
 * ÉCHAPPEMENT HTML — RÈGLE CANONIQUE UNIQUE, jumeaux backend / frontend / mobile.
 *
 * ─── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────
 * La règle était recopiée dans **SEPT** fichiers sur les trois workspaces, aucune
 * exportée, aucune testée — et elles avaient DIVERGÉ : `CustomerMap.tsx` couvrait
 * `& < > "` mais **pas l'apostrophe**, celle qui permet de sortir d'un attribut en
 * guillemets simples.
 *
 * C'est exactement `sanitizeCsv` avant #173 : une convention écrite dans la
 * documentation, applicable nulle part, donc pas une convention. *Un garde qu'on
 * ne peut ni importer ni enfreindre bruyamment est un vœu.*
 *
 * Et pendant ce temps `routes/export.ts` — le rapport mensuel téléchargeable —
 * n'échappait RIEN : le nom de la boutique et le mode de paiement partaient nus
 * dans le HTML.
 *
 * ⚠️ `&#39;` ET NON `&apos;`. `&apos;` n'est pas une entité HTML 4 ; `&#39;` est
 * valide partout. `utils/xlsxWriter.ts` émet `&apos;` et c'est CORRECT chez lui :
 * il produit de l'OOXML, pas du HTML. **Il est exempté par raison nommée du
 * méta-test** — deux langages de balisage, deux règles, les fondre ferait perdre
 * ce que chacun distingue.
 *
 * ⚠️ CE N'EST PAS UNE PROTECTION CONTRE TOUT. Échapper ces cinq caractères
 * protège le contenu textuel et les valeurs d'attribut entre guillemets. Cela ne
 * protège PAS une interpolation dans une URL (`href="${x}"` accepte encore
 * `javascript:`), dans un `<script>`, ni dans un nom de propriété CSS. Ces
 * contextes demandent leur propre traitement — ne pas lire ce module comme un
 * blanc-seing.
 *
 * ⚠️ Anti-dérive : cas partagés `docs/shared-fixtures/html-escape-cases.json`,
 * lus à l'EXÉCUTION par les tests jumeaux des trois côtés. Modifier la règle d'un
 * seul côté fait rougir les autres.
 */

const ENTITES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Échappe une valeur destinée à du HTML.
 *
 * ⚠️ `unknown`, pas `string` : les appelants passent des champs d'API, des
 * montants formatés et des valeurs de store persisté. Les typer `string` serait
 * une AFFIRMATION, pas une garantie — un objet y est déjà arrivé ailleurs dans ce
 * dépôt et a fait lever `.toUpperCase()`.
 *
 * ⚠️ `null` et `undefined` rendent une chaîne VIDE, jamais « null » ou
 * « undefined » imprimé dans le document. Mais `0` et `false` rendent bien « 0 »
 * et « false » — d'où `?? ''` et non `|| ''`.
 */
export function escHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ENTITES[c])
}
