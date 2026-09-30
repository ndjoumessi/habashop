import type { GuideSection } from './types'

/**
 * CODES-BARRES & ÉTIQUETTES — appui CDC : `253` (codes-barres EAN, scan douchette ou
 * caméra, étiquettes Avery et thermiques ✅).
 *
 * ⚠️ EAN-13 / EAN-8 UNIQUEMENT sur une étiquette. Ne jamais suggérer d'imprimer un code à
 * partir d'un SKU : un code non standard est un piège en caisse.
 * ⚠️ AUCUNE photo produit sur un document (facture, devis, étiquette) — décision assumée.
 */
export const codesBarres: GuideSection = {
  id: 'codes-barres',
  titre: {
    fr: 'Codes-barres et étiquettes',
    en: 'Barcodes and labels',
    es: 'Códigos de barras y etiquetas',
    it: 'Codici a barre ed etichette',
  },
  intro: {
    fr: 'Un code-barres remplace la recherche d’un article par un geste d’une seconde. Si vos produits en portent déjà un, saisissez-le dans la fiche ; sinon, HabaShop peut en générer et vous les imprimez vous-même.',
    en: 'A barcode replaces searching for an item with a one-second gesture. If your products already carry one, enter it in the record; if not, HabaShop can generate them and you print them yourself.',
    es: 'Un código de barras sustituye la búsqueda de un artículo por un gesto de un segundo. Si sus productos ya tienen uno, introdúzcalo en la ficha; si no, HabaShop puede generarlos y usted los imprime.',
    it: 'Un codice a barre sostituisce la ricerca di un articolo con un gesto di un secondo. Se i tuoi prodotti ne hanno già uno, inseriscilo nella scheda; altrimenti HabaShop può generarli e li stampi tu.',
  },
  etapes: [
    {
      titre: { fr: 'Scanner avec une douchette', en: 'Scan with a handheld scanner', es: 'Escanear con un lector de mano', it: 'Scansionare con un lettore' },
      corps: {
        fr: 'C’est le chemin le plus rapide en boutique, et celui que nous recommandons. La douchette se branche comme un clavier : placez le curseur dans le champ de recherche de la caisse et scannez, l’article entre au panier.',
        en: 'This is the fastest route in-store, and the one we recommend. The scanner plugs in like a keyboard: put the cursor in the till search field and scan — the item drops into the cart.',
        es: 'Es la vía más rápida en tienda, y la que recomendamos. El lector se conecta como un teclado: ponga el cursor en el campo de búsqueda de la caja y escanee, el artículo entra en el carrito.',
        it: 'È la via più rapida in negozio, e quella che consigliamo. Il lettore si collega come una tastiera: metti il cursore nel campo di ricerca della cassa e scansiona, l’articolo entra nel carrello.',
      },
    },
    {
      titre: { fr: 'Scanner avec la caméra', en: 'Scan with the camera', es: 'Escanear con la cámara', it: 'Scansionare con la fotocamera' },
      corps: {
        fr: 'Sans douchette, la caméra de l’appareil fait le travail. Autorisez l’accès à la caméra la première fois, puis cadrez le code. C’est plus lent qu’une douchette, mais cela ne demande aucun matériel.',
        en: 'With no handheld scanner, the device camera does the job. Allow camera access the first time, then frame the code. It is slower than a scanner, but it needs no hardware.',
        es: 'Sin lector, la cámara del dispositivo hace el trabajo. Autorice el acceso a la cámara la primera vez y luego enfoque el código. Es más lento que un lector, pero no exige equipo.',
        it: 'Senza lettore, la fotocamera del dispositivo fa il lavoro. Autorizza l’accesso alla fotocamera la prima volta, poi inquadra il codice. È più lento di un lettore, ma non richiede attrezzatura.',
      },
    },
    {
      titre: { fr: 'Imprimer des étiquettes sur feuille', en: 'Print labels on a sheet', es: 'Imprimir etiquetas en hoja', it: 'Stampare etichette su foglio' },
      corps: {
        fr: 'Le format planche A4 imprime plusieurs dizaines d’étiquettes sur une feuille d’étiquettes autocollantes ordinaire. Choisissez les produits, vérifiez l’aperçu, imprimez.',
        en: 'The A4 sheet format prints several dozen labels on an ordinary sheet of self-adhesive labels. Pick the products, check the preview, print.',
        es: 'El formato de hoja A4 imprime varias docenas de etiquetas en una hoja de etiquetas adhesivas corriente. Elija los productos, revise la vista previa e imprima.',
        it: 'Il formato foglio A4 stampa diverse decine di etichette su un normale foglio di etichette adesive. Scegli i prodotti, controlla l’anteprima, stampa.',
      },
    },
    {
      titre: { fr: 'Imprimer sur une étiqueteuse thermique', en: 'Print on a thermal label printer', es: 'Imprimir en una etiquetadora térmica', it: 'Stampare con un’etichettatrice termica' },
      corps: {
        fr: 'Le format 40 × 30 mm s’imprime à l’unité sur une étiqueteuse thermique, sans encre. Pratique pour réétiqueter quelques articles au fil de l’eau plutôt qu’une planche entière.',
        en: 'The 40 × 30 mm format prints one at a time on a thermal label printer, with no ink. Handy for relabelling a few items as you go rather than a whole sheet.',
        es: 'El formato 40 × 30 mm se imprime de uno en uno en una etiquetadora térmica, sin tinta. Práctico para reetiquetar unos pocos artículos sobre la marcha en vez de una hoja entera.',
        it: 'Il formato 40 × 30 mm si stampa uno alla volta con un’etichettatrice termica, senza inchiostro. Comodo per rietichettare pochi articoli man mano invece di un foglio intero.',
      },
    },
    {
      titre: { fr: 'Ce qu’une étiquette porte', en: 'What a label carries', es: 'Qué lleva una etiqueta', it: 'Cosa riporta un’etichetta' },
      corps: {
        fr: 'Le nom, le prix et le code-barres, dans un format standard que toutes les caisses lisent. Les étiquettes ne portent pas de photo : un document imprimé doit rester lisible et rapide à produire.',
        en: 'The name, the price and the barcode, in a standard format every till reads. Labels carry no photo: a printed document must stay legible and quick to produce.',
        es: 'El nombre, el precio y el código de barras, en un formato estándar que toda caja lee. Las etiquetas no llevan foto: un documento impreso debe seguir siendo legible y rápido de producir.',
        it: 'Il nome, il prezzo e il codice a barre, in un formato standard che ogni cassa legge. Le etichette non riportano foto: un documento stampato deve restare leggibile e rapido da produrre.',
      },
    },
  ],
}
