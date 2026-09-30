import type { GuideSection } from './types'

/**
 * RÉGLAGES — réglages de boutique (identité, devise, pays, TVA, langue, thème) et
 * notifications par e-mail.
 *
 * ⚠️ NOTIFICATIONS : E-MAIL SEULEMENT. `CDC:295-297` donne le push web ⚠️ (clés VAPID
 * absentes de l'environnement), le push mobile ⚠️ (application non publiée) et les alertes
 * SMS ⚠️ (clé absente). Les trois sont inertes — le verrou `guideClaims` les refuse, et c'est
 * voulu : annoncer un canal qui ne partira jamais est pire qu'un canal absent.
 *
 * ⚠️ LA TVA SE DÉRIVE DU PAYS : ne jamais écrire de taux en dur dans le texte. Un taux écrit
 * dans une phrase redevient faux, dans quatre langues, au premier changement de loi.
 */
export const reglages: GuideSection = {
  id: 'reglages',
  titre: {
    fr: 'Régler sa boutique',
    en: 'Setting up your shop',
    es: 'Configurar la tienda',
    it: 'Configurare il negozio',
  },
  intro: {
    fr: 'Les réglages décident de ce qui s’imprime sur vos documents et de la manière dont vos montants s’affichent. Ils se remplissent une fois, au début, puis on n’y revient qu’en cas de changement réel.',
    en: 'Settings decide what gets printed on your documents and how your amounts are displayed. You fill them in once, at the start, and only come back on a real change.',
    es: 'Los ajustes deciden qué se imprime en sus documentos y cómo se muestran sus importes. Se rellenan una vez, al principio, y solo se vuelve a ellos si hay un cambio real.',
    it: 'Le impostazioni decidono cosa viene stampato sui tuoi documenti e come sono mostrati gli importi. Si compilano una volta, all’inizio, e ci si ritorna solo per un cambiamento reale.',
  },
  etapes: [
    {
      titre: { fr: 'L’identité de la boutique', en: 'Your shop identity', es: 'La identidad de la tienda', it: 'L’identità del negozio' },
      corps: {
        fr: 'Nom, téléphone, adresse et logo : ce sont eux qui apparaissent en tête de vos factures et de vos tickets. Un logo net à cet endroit vaut mieux qu’un logo absent — c’est le seul endroit où votre client vous lit après être sorti.',
        en: 'Name, phone, address and logo: these are what appear at the top of your invoices and receipts. A crisp logo here beats a missing one — it is the only place your customer reads you after leaving.',
        es: 'Nombre, teléfono, dirección y logotipo: son los que aparecen en la cabecera de sus facturas y recibos. Un logotipo nítido aquí vale más que uno ausente: es el único lugar donde su cliente le lee después de salir.',
        it: 'Nome, telefono, indirizzo e logo: sono ciò che compare in testa a fatture e ricevute. Un logo nitido qui vale più di un logo assente — è l’unico posto dove il cliente ti legge dopo essere uscito.',
      },
    },
    {
      titre: { fr: 'Pays, devise et TVA', en: 'Country, currency and VAT', es: 'País, moneda e IVA', it: 'Paese, valuta e IVA' },
      corps: {
        fr: 'Le pays est le réglage qui en commande deux autres : la devise et le taux de TVA en découlent, parce qu’ils dépendent de la réglementation locale et non d’une préférence. Si vous changez de pays, vérifiez que la devise affichée vous convient toujours.',
        en: 'The country is the setting that drives two others: the currency and the VAT rate follow from it, because they depend on local regulation rather than on a preference. If you change country, check that the displayed currency still suits you.',
        es: 'El país es el ajuste que manda sobre otros dos: la moneda y el tipo de IVA se derivan de él, porque dependen de la normativa local y no de una preferencia. Si cambia de país, compruebe que la moneda mostrada le sigue conviniendo.',
        it: 'Il paese è l’impostazione che ne comanda altre due: la valuta e l’aliquota IVA ne derivano, perché dipendono dalla normativa locale e non da una preferenza. Se cambi paese, verifica che la valuta mostrata ti vada ancora bene.',
      },
    },
    {
      titre: { fr: 'Langue et thème', en: 'Language and theme', es: 'Idioma y tema', it: 'Lingua e tema' },
      corps: {
        fr: 'L’interface existe en français, anglais, espagnol et italien, et le thème se règle en sombre, clair ou « système » — ce dernier suit le réglage de l’appareil. Ces deux choix sont propres à l’appareil : votre caissier peut travailler en clair pendant que vous êtes en sombre.',
        en: 'The interface comes in French, English, Spanish and Italian, and the theme can be dark, light or “system” — the last follows the device setting. Both choices belong to the device: your cashier can work in light mode while you are in dark.',
        es: 'La interfaz existe en francés, inglés, español e italiano, y el tema se ajusta en oscuro, claro o «sistema», que sigue la configuración del dispositivo. Ambas opciones son propias del dispositivo: su cajero puede trabajar en claro mientras usted está en oscuro.',
        it: 'L’interfaccia esiste in francese, inglese, spagnolo e italiano, e il tema si imposta su scuro, chiaro o «sistema», che segue l’impostazione del dispositivo. Entrambe le scelte sono proprie del dispositivo: il tuo cassiere può lavorare in chiaro mentre tu sei in scuro.',
      },
    },
    {
      titre: { fr: 'Les alertes par e-mail', en: 'Email alerts', es: 'Los avisos por correo', it: 'Gli avvisi via e-mail' },
      corps: {
        fr: 'Vous pouvez recevoir par e-mail l’alerte de stock bas et le récapitulatif de la semaine. C’est aujourd’hui le seul canal d’alerte disponible — l’adresse utilisée est celle de l’administrateur de la boutique, vérifiez qu’elle est à jour.',
        en: 'You can receive the low-stock alert and the weekly summary by email. That is currently the only alert channel available — the address used is the shop administrator’s, so check it is up to date.',
        es: 'Puede recibir por correo el aviso de stock bajo y el resumen de la semana. Es hoy el único canal de avisos disponible: la dirección usada es la del administrador de la tienda, compruebe que esté actualizada.',
        it: 'Puoi ricevere via e-mail l’avviso di scorte basse e il riepilogo della settimana. È oggi l’unico canale di avviso disponibile — l’indirizzo usato è quello dell’amministratore del negozio, verifica che sia aggiornato.',
      },
    },
  ],
}
