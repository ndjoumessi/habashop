import type { GuideSection } from './types'

/**
 * CLIENTS & FIDÉLITÉ — appuis CDC : `260` (clients, segments, carte de fidélité avec QR ✅),
 * `261` (historique d'achats ✅), `262` (carte géographique ✅), `263` (abonnements ✅).
 *
 * ⚠️ Le « Scanner » du PANIER est le scanner de CARTE DE FIDÉLITÉ, fonction DISTINCTE du scan
 * produit. Le manuel doit le dire : c'est précisément la confusion à prévenir.
 * ⚠️ Abonnements : AUCUN total n'est stocké (le montant suit le tarif du jour) et la fréquence
 * est HEBDOMADAIRE (le modèle ne porte qu'un jour de semaine). Ne rien promettre d'autre.
 * ⚠️ Carte : « Adresse introuvable » peut aussi signifier que le service de localisation est
 * momentanément indisponible — c'est ce que l'écran distingue désormais, ne pas le contredire.
 */
export const clients: GuideSection = {
  id: 'clients',
  titre: {
    fr: 'Clients et fidélité',
    en: 'Customers and loyalty',
    es: 'Clientes y fidelidad',
    it: 'Clienti e fedeltà',
  },
  intro: {
    fr: 'Enregistrer un client vous donne son historique d’achats, sa place sur la carte et, si vous le souhaitez, une carte de fidélité. Rien n’oblige à créer une fiche pour chaque passage : réservez-les aux clients que vous reverrez.',
    en: 'Recording a customer gives you their purchase history, their place on the map and, if you want, a loyalty card. Nothing forces you to create a record for every visit: keep them for customers you will see again.',
    es: 'Registrar a un cliente le da su historial de compras, su lugar en el mapa y, si lo desea, una tarjeta de fidelidad. Nada obliga a crear una ficha en cada visita: resérvelas para los clientes que volverá a ver.',
    it: 'Registrare un cliente ti dà il suo storico di acquisti, la sua posizione sulla mappa e, se vuoi, una carta fedeltà. Nulla obbliga a creare una scheda a ogni passaggio: riservale ai clienti che rivedrai.',
  },
  etapes: [
    {
      titre: { fr: 'Créer un client', en: 'Create a customer', es: 'Crear un cliente', it: 'Creare un cliente' },
      corps: {
        fr: 'Le nom suffit. Le type — détail, demi-gros ou gros — détermine le tarif que la caisse appliquera automatiquement à ses achats, c’est donc le champ qui compte le plus après le nom.',
        en: 'The name is enough. The type — retail, semi-wholesale or wholesale — determines which price the till applies to their purchases automatically, so it is the field that matters most after the name.',
        es: 'El nombre basta. El tipo —minorista, semimayorista o mayorista— determina el precio que la caja aplicará automáticamente a sus compras, así que es el campo más importante después del nombre.',
        it: 'Il nome basta. Il tipo — dettaglio, semi-ingrosso o ingrosso — determina il prezzo che la cassa applicherà automaticamente ai suoi acquisti: è quindi il campo che conta di più dopo il nome.',
      },
    },
    {
      titre: { fr: 'Rattacher une vente à un client', en: 'Attach a sale to a customer', es: 'Vincular una venta a un cliente', it: 'Collegare una vendita a un cliente' },
      corps: {
        fr: 'Depuis le panier, choisissez le client avant d’encaisser. Son historique se remplit, et ses points de fidélité sont crédités au passage. Sans client rattaché, la vente reste anonyme et ne crédite rien.',
        en: 'From the cart, pick the customer before taking payment. Their history fills up, and their loyalty points are credited along the way. With no customer attached, the sale stays anonymous and credits nothing.',
        es: 'Desde el carrito, elija el cliente antes de cobrar. Su historial se rellena y sus puntos de fidelidad se acreditan de paso. Sin cliente vinculado, la venta queda anónima y no acredita nada.',
        it: 'Dal carrello, scegli il cliente prima di incassare. Il suo storico si popola e i punti fedeltà vengono accreditati. Senza cliente collegato, la vendita resta anonima e non accredita nulla.',
      },
    },
    {
      titre: { fr: 'La carte de fidélité et son QR', en: 'The loyalty card and its QR code', es: 'La tarjeta de fidelidad y su QR', it: 'La carta fedeltà e il suo QR' },
      corps: {
        fr: 'Chaque client peut recevoir une carte portant un QR code. ⚠️ Le bouton « Scanner » du panier lit CE QR, celui de la carte de fidélité — ce n’est pas le scan des produits, qui est ailleurs. Scanner la carte sélectionne le client en un geste.',
        en: 'Each customer can get a card bearing a QR code. ⚠️ The cart’s “Scan” button reads THAT QR, the loyalty card one — it is not the product scan, which lives elsewhere. Scanning the card selects the customer in one gesture.',
        es: 'Cada cliente puede recibir una tarjeta con un código QR. ⚠️ El botón «Escanear» del carrito lee ESE QR, el de la tarjeta de fidelidad: no es el escaneo de productos, que está en otro sitio. Escanear la tarjeta selecciona al cliente de un gesto.',
        it: 'Ogni cliente può ricevere una carta con un codice QR. ⚠️ Il pulsante «Scansiona» del carrello legge QUEL QR, quello della carta fedeltà — non è la scansione dei prodotti, che si trova altrove. Scansionare la carta seleziona il cliente con un gesto.',
      },
    },
    {
      titre: { fr: 'La carte des clients', en: 'The customer map', es: 'El mapa de clientes', it: 'La mappa dei clienti' },
      corps: {
        fr: 'Les clients dont vous avez saisi l’adresse apparaissent sur une carte. L’adresse est cherchée en ligne : « Adresse introuvable » signifie que le service n’a rien trouvé, tandis qu’un message de localisation interrompue signifie que le service est momentanément indisponible — dans ce second cas, votre adresse est probablement correcte, réessayez plus tard.',
        en: 'Customers whose address you entered appear on a map. The address is looked up online: “Address not found” means the service found nothing, while an interrupted-lookup message means the service is temporarily unavailable — in that second case your address is probably fine, try again later.',
        es: 'Los clientes cuya dirección ha introducido aparecen en un mapa. La dirección se busca en línea: «Dirección no encontrada» significa que el servicio no halló nada, mientras que un mensaje de localización interrumpida significa que el servicio no está disponible momentáneamente: en ese segundo caso su dirección probablemente sea correcta, inténtelo más tarde.',
        it: 'I clienti di cui hai inserito l’indirizzo compaiono su una mappa. L’indirizzo viene cercato online: «Indirizzo non trovato» significa che il servizio non ha trovato nulla, mentre un messaggio di localizzazione interrotta significa che il servizio è momentaneamente non disponibile — in quel secondo caso il tuo indirizzo è probabilmente corretto, riprova più tardi.',
      },
    },
    {
      titre: { fr: 'Les abonnements', en: 'Subscriptions', es: 'Las suscripciones', it: 'Gli abbonamenti' },
      corps: {
        fr: 'Un abonnement est une livraison récurrente HEBDOMADAIRE : vous choisissez le jour de la semaine et les produits. Le montant n’est pas figé à la souscription — il suit le tarif du jour de vos produits, ce qui évite de facturer un prix devenu faux.',
        en: 'A subscription is a WEEKLY recurring delivery: you pick the day of the week and the products. The amount is not frozen at sign-up — it follows your products’ current price, which avoids billing a price that has gone stale.',
        es: 'Una suscripción es una entrega recurrente SEMANAL: usted elige el día de la semana y los productos. El importe no se fija al suscribirse: sigue el precio actual de sus productos, lo que evita facturar un precio ya desfasado.',
        it: 'Un abbonamento è una consegna ricorrente SETTIMANALE: scegli il giorno della settimana e i prodotti. L’importo non è fissato alla sottoscrizione — segue il prezzo corrente dei tuoi prodotti, così non fatturi un prezzo diventato falso.',
      },
    },
  ],
}
