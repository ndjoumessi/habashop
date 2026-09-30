import type { GuideSection } from './types'

/**
 * RAPPORTS — appuis CDC : `281` (rapports ventes/stock/clients/finance/RH ✅),
 * `282` (prévisions, objectifs & KPI ✅), `284` (export CSV/XLSX/PDF ✅, « voir la réserve
 * §9.1 »).
 *
 * ⚠️ La réserve §9.1 est la TRONCATURE des exports : un export volumineux ne rend que les N
 * lignes les plus récentes, et le NOM DU FICHIER le dit. Le manuel DOIT l'écrire — un
 * commerçant qui somme un export tronqué sans le savoir obtient un chiffre faux, et le taire
 * ferait du manuel un complice.
 * ⚠️ Dire que « Autres » porte son EFFECTIF : sans lui, le lecteur ne sait pas s'il regarde
 * une catégorie ou quatorze.
 */
export const rapports: GuideSection = {
  id: 'rapports',
  titre: {
    fr: 'Lire ses rapports',
    en: 'Reading your reports',
    es: 'Leer los informes',
    it: 'Leggere i report',
  },
  intro: {
    fr: 'Les rapports transforment vos ventes en décisions : ce qui part, ce qui dort, comment vos clients paient. Tous se lisent sur une période que vous choisissez, et tous s’exportent.',
    en: 'Reports turn your sales into decisions: what moves, what sits, how your customers pay. All of them read over a period you choose, and all of them export.',
    es: 'Los informes convierten sus ventas en decisiones: qué sale, qué se queda, cómo pagan sus clientes. Todos se leen sobre un periodo que usted elige y todos se exportan.',
    it: 'I report trasformano le vendite in decisioni: cosa esce, cosa resta, come pagano i clienti. Tutti si leggono su un periodo che scegli tu, e tutti si esportano.',
  },
  etapes: [
    {
      titre: { fr: 'Le rapport de ventes', en: 'The sales report', es: 'El informe de ventas', it: 'Il report delle vendite' },
      corps: {
        fr: 'Il donne le chiffre d’affaires de la période, le nombre de ventes et le panier moyen. Les ventes remboursées en sont exclues : le chiffre affiché est ce que vous avez réellement encaissé, pas ce qui est passé en caisse.',
        en: 'It gives the period’s revenue, the number of sales and the average basket. Refunded sales are excluded: the figure shown is what you actually took in, not what went through the till.',
        es: 'Da la facturación del periodo, el número de ventas y el ticket medio. Las ventas reembolsadas quedan excluidas: la cifra mostrada es lo que realmente ingresó, no lo que pasó por caja.',
        it: 'Dà il fatturato del periodo, il numero di vendite e lo scontrino medio. Le vendite rimborsate sono escluse: la cifra mostrata è ciò che hai davvero incassato, non ciò che è passato in cassa.',
      },
    },
    {
      titre: { fr: 'La répartition des modes de paiement', en: 'The payment method breakdown', es: 'El desglose por método de pago', it: 'La ripartizione dei metodi di pagamento' },
      corps: {
        fr: 'Le camembert montre la part de chaque mode sur la période. Les parts somment toujours à 100 %, et une part inférieure à un demi pour cent s’annonce « < 1 % » plutôt que d’être arrondie à zéro — une vente réelle ne disparaît pas du graphique.',
        en: 'The pie chart shows each method’s share over the period. Shares always add up to 100%, and a share under half a percent is announced as “< 1%” rather than rounded to zero — a real sale does not vanish from the chart.',
        es: 'El gráfico circular muestra la cuota de cada método en el periodo. Las cuotas siempre suman 100 % y una cuota inferior a medio punto se anuncia como «< 1 %» en vez de redondearse a cero: una venta real no desaparece del gráfico.',
        it: 'Il grafico a torta mostra la quota di ogni metodo nel periodo. Le quote sommano sempre a 100 % e una quota sotto il mezzo punto viene annunciata come «< 1 %» invece di essere arrotondata a zero: una vendita reale non scompare dal grafico.',
      },
    },
    {
      titre: { fr: 'Le chiffre d’affaires par catégorie', en: 'Revenue by category', es: 'La facturación por categoría', it: 'Il fatturato per categoria' },
      corps: {
        fr: 'Les plus grosses catégories sont affichées, le reste est regroupé sous « Autres » — et « Autres » porte son effectif, par exemple « Autres — 4 catégories », pour que vous sachiez si vous regardez une catégorie ou quatorze. La somme des parts est bien votre chiffre d’affaires de la période, reliquat compris.',
        en: 'The biggest categories are shown, the rest is grouped under “Other” — and “Other” carries its count, for example “Other — 4 categories”, so you know whether you are looking at one category or fourteen. The shares do add up to your period revenue, remainder included.',
        es: 'Se muestran las categorías mayores y el resto se agrupa en «Otras» —y «Otras» lleva su recuento, por ejemplo «Otras — 4 categorías»—, para que sepa si mira una categoría o catorce. La suma de las partes sí es su facturación del periodo, resto incluido.',
        it: 'Sono mostrate le categorie più grandi, il resto è raggruppato sotto «Altre» — e «Altre» riporta il suo conteggio, per esempio «Altre — 4 categorie», così sai se stai guardando una categoria o quattordici. La somma delle quote è davvero il tuo fatturato del periodo, resto incluso.',
      },
    },
    {
      titre: { fr: 'Exporter — et la limite à connaître', en: 'Exporting — and the limit to know about', es: 'Exportar — y el límite que debe conocer', it: 'Esportare — e il limite da conoscere' },
      corps: {
        fr: '⚠️ Un export très volumineux ne contient que les lignes les plus récentes, et le NOM DU FICHIER vous le dit : un fichier nommé « ventes-…-10000-sur-42130 » contient dix mille lignes sur quarante-deux mille. Lisez le nom du fichier avant d’additionner une colonne — un total calculé sur un export tronqué est un chiffre faux, et rien dans le tableur ne vous le signalera.',
        en: '⚠️ A very large export contains only the most recent rows, and the FILE NAME tells you so: a file named “sales-…-10000-of-42130” holds ten thousand rows out of forty-two thousand. Read the file name before summing a column — a total computed on a truncated export is a wrong figure, and nothing in the spreadsheet will warn you.',
        es: '⚠️ Una exportación muy grande solo contiene las filas más recientes, y el NOMBRE DEL ARCHIVO se lo dice: un archivo llamado «ventas-…-10000-de-42130» contiene diez mil filas de cuarenta y dos mil. Lea el nombre del archivo antes de sumar una columna: un total calculado sobre una exportación truncada es una cifra falsa, y nada en la hoja de cálculo se lo advertirá.',
        it: '⚠️ Un export molto grande contiene solo le righe più recenti, e il NOME DEL FILE te lo dice: un file chiamato «vendite-…-10000-su-42130» contiene diecimila righe su quarantaduemila. Leggi il nome del file prima di sommare una colonna — un totale calcolato su un export troncato è una cifra falsa, e nulla nel foglio di calcolo te lo segnalerà.',
      },
    },
  ],
}
