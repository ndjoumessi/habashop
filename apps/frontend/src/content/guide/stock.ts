import type { GuideSection } from './types'

/**
 * STOCK & PRODUITS — appui CDC : `253` (Stock & produits ✅).
 *
 * ⚠️ NE PAS mentionner l'import de produits par fichier : `CDC:254` le donne ⬜ et précise
 * qu'il avait été « annoncé par erreur sur la vitrine jusqu'au 6 août, retiré ». Le remettre
 * dans un manuel serait réintroduire exactement l'affirmation qui a été retirée.
 * ⚠️ `StockForm.image` est l'ÉMOJI, `Product.image` est la PHOTO — deux champs homonymes de
 * sens OPPOSÉS. Aucune phrase ici ne doit les confondre.
 */
export const stock: GuideSection = {
  id: 'stock',
  titre: {
    fr: 'Tenir son stock',
    en: 'Keeping stock',
    es: 'Gestionar el stock',
    it: 'Gestire le scorte',
  },
  intro: {
    fr: 'Chaque article vendu en caisse vient d’une fiche produit. C’est là que vous réglez ses prix, son seuil d’alerte et sa quantité. Un produit bien renseigné se scanne, s’étiquette et se retrouve dans les rapports sans autre travail.',
    en: 'Every item sold at the till comes from a product record. That is where you set its prices, its alert threshold and its quantity. A well-filled product scans, labels and shows up in reports with no further work.',
    es: 'Cada artículo vendido en caja proviene de una ficha de producto. Ahí se definen sus precios, su umbral de alerta y su cantidad. Un producto bien rellenado se escanea, se etiqueta y aparece en los informes sin más trabajo.',
    it: 'Ogni articolo venduto in cassa proviene da una scheda prodotto. È lì che imposti i prezzi, la soglia di allerta e la quantità. Un prodotto compilato bene si scansiona, si etichetta e compare nei report senza altro lavoro.',
  },
  etapes: [
    {
      titre: { fr: 'Créer une fiche produit', en: 'Create a product record', es: 'Crear una ficha de producto', it: 'Creare una scheda prodotto' },
      corps: {
        fr: 'Un nom, une catégorie, un prix d’achat et un prix de vente suffisent pour commencer. La catégorie sert aux rapports : deux produits de la même famille doivent porter la même, sinon vos analyses se dispersent.',
        en: 'A name, a category, a purchase price and a sale price are enough to start. The category feeds the reports: two products of the same family must carry the same one, otherwise your analysis scatters.',
        es: 'Un nombre, una categoría, un precio de compra y un precio de venta bastan para empezar. La categoría alimenta los informes: dos productos de la misma familia deben llevar la misma, o su análisis se dispersa.',
        it: 'Un nome, una categoria, un prezzo d’acquisto e un prezzo di vendita bastano per iniziare. La categoria alimenta i report: due prodotti della stessa famiglia devono portare la stessa, altrimenti le analisi si disperdono.',
      },
    },
    {
      titre: { fr: 'Régler les tarifs par palier', en: 'Set tiered pricing', es: 'Configurar precios por tramo', it: 'Impostare i prezzi a scaglioni' },
      corps: {
        fr: 'Un produit peut porter trois tarifs : détail, demi-gros et gros. La caisse applique celui qui correspond au type du client, ligne par ligne — vous n’avez rien à calculer au moment d’encaisser.',
        en: 'A product can carry three prices: retail, semi-wholesale and wholesale. The till applies the one matching the customer type, line by line — you have nothing to work out at payment time.',
        es: 'Un producto puede tener tres precios: minorista, semimayorista y mayorista. La caja aplica el que corresponde al tipo de cliente, línea por línea: no tiene que calcular nada al cobrar.',
        it: 'Un prodotto può avere tre prezzi: dettaglio, semi-ingrosso e ingrosso. La cassa applica quello corrispondente al tipo di cliente, riga per riga — non devi calcolare nulla al momento dell’incasso.',
      },
    },
    {
      titre: { fr: 'Poser un seuil d’alerte', en: 'Set an alert threshold', es: 'Definir un umbral de alerta', it: 'Impostare una soglia di allerta' },
      corps: {
        fr: 'Le seuil est la quantité en dessous de laquelle le produit vous est signalé. Réglez-le sur ce qu’il vous faut pour tenir le temps d’un réapprovisionnement, pas sur zéro : à zéro, l’alerte arrive quand il est déjà trop tard.',
        en: 'The threshold is the quantity below which the product is flagged to you. Set it to what you need to last until a restock, not to zero: at zero, the alert arrives when it is already too late.',
        es: 'El umbral es la cantidad por debajo de la cual el producto se le señala. Fíjelo en lo que necesita para aguantar hasta un reabastecimiento, no en cero: en cero, la alerta llega cuando ya es tarde.',
        it: 'La soglia è la quantità sotto la quale il prodotto ti viene segnalato. Impostala su ciò che ti serve per arrivare al rifornimento, non su zero: a zero, l’avviso arriva quando è già tardi.',
      },
    },
    {
      titre: { fr: 'Enregistrer une entrée de stock', en: 'Record a stock intake', es: 'Registrar una entrada de stock', it: 'Registrare un carico di magazzino' },
      corps: {
        fr: 'À la réception d’une livraison, ajustez la quantité du produit. Les ventes la décrémentent ensuite toutes seules : votre seul geste régulier est l’entrée, pas la sortie.',
        en: 'When a delivery arrives, adjust the product quantity. Sales then decrement it on their own: your only regular action is the intake, not the outflow.',
        es: 'Al recibir una entrega, ajuste la cantidad del producto. Las ventas la descuentan solas: su único gesto habitual es la entrada, no la salida.',
        it: 'All’arrivo di una consegna, aggiorna la quantità del prodotto. Le vendite la scalano da sole: il tuo unico gesto regolare è il carico, non lo scarico.',
      },
    },
  ],
}
