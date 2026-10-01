import type { GuideSection } from './types'

/**
 * CAISSE — appuis CDC : `248` (point de vente ✅), `249` (ticket 80 mm ✅),
 * `250` (ticket par WhatsApp ✅, Twilio configuré).
 *
 * ⚠️ NE PAS mentionner la vente hors-ligne : `CDC:251` la donne ⚠️ « mobile uniquement, et
 * l'application n'est publiée nulle part ».
 * ⚠️ NE PAS présenter les paiements mobiles comme un encaissement réel : MTN, Campay et
 * PayDunya sont 🧪 en bac à sable, Wave et Orange Money ⚠️ sans clés (`CDC:208-212`).
 */
export const caisse: GuideSection = {
  id: 'caisse',
  titre: {
    fr: 'Encaisser une vente',
    en: 'Taking a sale',
    es: 'Cobrar una venta',
    it: 'Incassare una vendita',
  },
  intro: {
    // ⚠️ CETTE INTRO A PORTÉ UNE AFFIRMATION FAUSSE, dans les quatre langues : « le serveur
    // recalcule le total, même si la caisse a travaillé un moment sans réseau ». La caisse
    // web ne travaille PAS sans réseau — elle avorte la vente. Un commerçant qui l'avait cru
    // aurait encaissé une journée dans le vide. Ce que le serveur garantit est autre chose,
    // et c'est ce qui est écrit maintenant : le prix appliqué est celui du catalogue, pas
    // celui que la caisse croyait.
    fr: 'L’écran Caisse sert à encaisser. Vous ajoutez des articles, vous choisissez le mode de paiement, vous imprimez ou envoyez le ticket. Le prix facturé est toujours celui du catalogue : c’est le serveur qui recalcule le total, de sorte qu’un changement de tarif s’applique immédiatement, même si l’écran affichait encore l’ancien prix.',
    en: 'The POS screen is where you take payment. You add items, pick a payment method, then print or send the receipt. The price charged is always the catalogue price: the server recalculates the total, so a price change applies at once even if the screen was still showing the old one.',
    es: 'La pantalla TPV sirve para cobrar. Añade artículos, elige el método de pago e imprime o envía el recibo. El precio cobrado es siempre el del catálogo: el servidor recalcula el total, de modo que un cambio de precio se aplica de inmediato aunque la pantalla siguiera mostrando el anterior.',
    it: 'La schermata Cassa serve a incassare. Aggiungi gli articoli, scegli il metodo di pagamento, poi stampi o invii la ricevuta. Il prezzo applicato è sempre quello del catalogo: è il server a ricalcolare il totale, così una variazione di prezzo si applica subito anche se la schermata mostrava ancora il vecchio.',
  },
  etapes: [
    {
      titre: { fr: 'Ouvrir la caisse', en: 'Open the till', es: 'Abrir la caja', it: 'Aprire la cassa' },
      corps: {
        fr: 'Avant la première vente de la journée, ouvrez la caisse en saisissant le fond de caisse — l’argent déjà présent dans le tiroir. C’est ce montant qui servira au calcul de l’écart à la clôture.',
        en: 'Before the day’s first sale, open the till by entering the opening float — the cash already in the drawer. That amount is what the closing variance is measured against.',
        es: 'Antes de la primera venta del día, abra la caja indicando el fondo inicial: el dinero que ya está en el cajón. Ese importe es la base del cálculo de la diferencia al cierre.',
        it: 'Prima della prima vendita del giorno, apri la cassa inserendo il fondo cassa — il denaro già presente nel cassetto. È su quell’importo che si calcola lo scostamento alla chiusura.',
      },
    },
    {
      titre: { fr: 'Ajouter les articles', en: 'Add the items', es: 'Añadir los artículos', it: 'Aggiungere gli articoli' },
      corps: {
        fr: 'Trois manières, au choix : scanner le code-barres avec la douchette — la plus rapide en boutique —, le scanner avec la caméra, ou toucher l’article dans la grille. Le tarif détail, demi-gros ou gros s’applique par ligne selon le type de client.',
        en: 'Three ways: scan the barcode with a handheld scanner — the fastest in-store —, scan it with the camera, or tap the item in the grid. Retail, semi-wholesale or wholesale pricing applies per line according to the customer type.',
        es: 'Tres formas: escanear el código de barras con el lector de mano —lo más rápido en tienda—, escanearlo con la cámara, o tocar el artículo en la cuadrícula. El precio minorista, semimayorista o mayorista se aplica por línea según el tipo de cliente.',
        it: 'Tre modi: scansionare il codice a barre con il lettore — il più rapido in negozio —, scansionarlo con la fotocamera, oppure toccare l’articolo nella griglia. Il prezzo al dettaglio, semi-ingrosso o ingrosso si applica per riga secondo il tipo di cliente.',
      },
    },
    {
      titre: { fr: 'Encaisser', en: 'Take payment', es: 'Cobrar', it: 'Incassare' },
      corps: {
        fr: 'Choisissez le mode de paiement. Un paiement mixte est possible : répartissez le total entre espèces, mobile et carte, et la somme des parts doit correspondre au total. Toute remise manuelle est enregistrée avec son motif.',
        en: 'Pick the payment method. Split payments are supported: spread the total across cash, mobile and card — the parts must add up to the total. Any manual discount is recorded along with its reason.',
        es: 'Elija el método de pago. Se admite el pago mixto: reparta el total entre efectivo, móvil y tarjeta; las partes deben sumar el total. Todo descuento manual se registra con su motivo.',
        it: 'Scegli il metodo di pagamento. È possibile il pagamento misto: ripartisci il totale tra contanti, mobile e carta — le parti devono sommare al totale. Ogni sconto manuale viene registrato con la sua motivazione.',
      },
    },
    {
      titre: { fr: 'Remettre le ticket', en: 'Hand over the receipt', es: 'Entregar el recibo', it: 'Consegnare la ricevuta' },
      corps: {
        fr: 'Imprimez le ticket 80 mm, ou envoyez-le au client par WhatsApp si vous avez son numéro. Sur téléphone, l’impression passe par le service d’impression du système.',
        en: 'Print the 80 mm receipt, or send it to the customer over WhatsApp if you have their number. On a phone, printing goes through the system print service.',
        es: 'Imprima el recibo de 80 mm, o envíelo al cliente por WhatsApp si tiene su número. En el teléfono, la impresión pasa por el servicio de impresión del sistema.',
        it: 'Stampa la ricevuta da 80 mm, o inviala al cliente via WhatsApp se hai il suo numero. Su telefono, la stampa passa dal servizio di stampa del sistema.',
      },
    },
    {
      titre: { fr: 'Clôturer la caisse', en: 'Close the till', es: 'Cerrar la caja', it: 'Chiudere la cassa' },
      corps: {
        fr: 'En fin de journée, comptez le tiroir et saisissez le montant. L’écart se calcule sur les espèces attendues — le fond de caisse plus les ventes encaissées en espèces, et non le chiffre d’affaires tous modes confondus. Un surplus est signalé comme un manque : les deux méritent un regard.',
        en: 'At the end of the day, count the drawer and enter the amount. The variance is measured against expected cash — the opening float plus cash sales, not total revenue across all methods. A surplus is flagged just like a shortfall: both deserve a look.',
        es: 'Al final del día, cuente el cajón e introduzca el importe. La diferencia se calcula sobre el efectivo esperado: el fondo inicial más las ventas en efectivo, no la facturación de todos los métodos. Un excedente se señala igual que un faltante: ambos merecen atención.',
        it: 'A fine giornata, conta il cassetto e inserisci l’importo. Lo scostamento si calcola sul contante atteso — il fondo cassa più le vendite in contanti, non il fatturato di tutti i metodi. Un’eccedenza viene segnalata come una mancanza: entrambe meritano uno sguardo.',
      },
    },
  ],
}
