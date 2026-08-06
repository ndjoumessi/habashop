import type { Lang, Currency } from '@/stores/appStore'
import { planAmountXOF, YEARLY_MONTHS } from '@/lib/plans'

export type { Lang, Currency }

/**
 * ─── PRIX : DÉRIVÉS DU CATALOGUE, JAMAIS ÉCRITS ICI ──────────────────────────
 *
 * ⚠️ La réponse FAQ « nos tarifs » recopiait les montants à la main dans les quatre
 * langues. Le verrou tarifaire ne l'a jamais vu : il cherchait `\b8000\b` quand la copie
 * écrit « 8 000 » — un séparateur de milliers, donc **zéro correspondance possible**. Le
 * verrou était vert sur un motif que personne n'emploie, et la version anglaise employait
 * en plus une virgule (« 8,000 CFA »), une deuxième forme qu'il n'aurait pas vue non plus.
 *
 * Les montants descendent maintenant de `lib/plans.ts`. Le rendu reste identique au
 * caractère près (espace nue, pas l'espace fine de `toLocaleString`).
 */
const groupe = (xof: number, lang: Lang): string =>
  xof.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR').replace(/[\u202f\u00a0]/g, ' ')

/** « 8 000 F CFA » (fr/es/it) · « 8,000 CFA » (en) — la forme employée par chaque langue. */
const cfa = (xof: number, lang: Lang): string =>
  lang === 'en' ? `${groupe(xof, lang)} CFA` : `${groupe(xof, lang)} F CFA`

const tarifs = (lang: Lang) => ({
  starterM:  cfa(planAmountXOF('starter', 'monthly')!, lang),
  starterY:  groupe(planAmountXOF('starter', 'yearly')!, lang),
  businessM: cfa(planAmountXOF('business', 'monthly')!, lang),
  businessY: groupe(planAmountXOF('business', 'yearly')!, lang),
  /** Mois payés sur douze, et mois offerts — la règle vit dans le catalogue. */
  moisPayes:   YEARLY_MONTHS,
  moisOfferts: 12 - YEARLY_MONTHS,
})
const pFR = tarifs('fr'), pEN = tarifs('en'), pES = tarifs('es'), pIT = tarifs('it')

/**
 * Traductions de la vitrine.
 *
 * ⚠️ RÈGLE DU CHANTIER — une affirmation ne va sur une page publique QUE si l'on peut
 * pointer le fichier qui l'implémente. Ce fichier a porté, jusqu'au 2026-08-06 :
 * « N°1 en Afrique francophone », « 500+ Boutiques », « 4,9/5 », « SLA garanti 99,9 % »,
 * six compteurs de pays qui se contredisaient (12 / 8+ / 15+ / 140 / 150+ / 10 drapeaux),
 * et trois témoignages attribués à des personnes NOMMÉES. La production ne contenait
 * alors aucune vente de marchand réel : 1 926 des 1 983 ventes venaient des deux tenants
 * de démonstration, 57 de fixtures E2E.
 *
 * Deux affirmations retirées méritent d'être nommées, parce qu'elles se lisaient comme
 * des faits techniques et pas comme du marketing :
 *  • « la caisse POS fonctionne offline grâce à la PWA, les ventes sont stockées
 *    localement » — FAUX sur le web. `pages/POS.tsx` avorte la vente hors-ligne (« il n'y
 *    a pas de persistance locale des ventes ») et `OfflineBanner` annonce lui-même que
 *    « certaines fonctionnalités sont indisponibles ». La file d'attente existe, mais
 *    dans `mobile/src/services/offlineQueue.ts` UNIQUEMENT. D'où l'attribution explicite
 *    à l'application mobile partout où le hors-ligne est promis ;
 *  • « import de produits via fichier CSV ou Excel » — aucun importeur n'existe.
 *
 * Verrou : `src/tests/landingClaims.test.ts` échoue si un superlatif, un compteur de
 * boutiques ou de pays, une note sur 5 ou un « SLA garanti » réapparaît ici.
 */
export const LANDING_TRANSLATIONS = {
  fr: {
    nav_features: 'Fonctionnalités',
    nav_pricing: 'Tarifs',
    nav_faq: 'FAQ',
    nav_login: 'Connexion',

    // ── Hero ──
    h1a: 'La caisse qui continue quand le ',
    h1_accent: "réseau s'arrête",
    hero_sub: "Encaisser, facturer, suivre le stock. HabaShop s'utilise aujourd'hui depuis le navigateur ; l'application mobile — celle qui enregistre la vente sans réseau — n'est pas encore publiée.",
    cta1: 'Créer ma boutique',
    cta2: 'Voir les tarifs',
    hero_note: "Sans carte bancaire · 14 jours d'essai",
    demo_caption: 'Application mobile HabaShop — Android, publication en préparation',
    demo_offline: 'Mode hors-ligne',
    demo_pending: '3 ventes en attente de synchro',
    demo_total: 'Total à payer',
    demo_recorded: "Vente enregistrée sur l'appareil",

    // ── Trois piliers ──
    features_label: 'CE QUI CHANGE EN BOUTIQUE',
    features_title: 'Trois choses qui comptent au comptoir',
    pillar1_title: 'Mobile Money intégré',
    pillar1_desc: "MTN MoMo, Orange Money et carte bancaire via Campay, PayDunya pour l'UEMOA. Le caissier lance la demande depuis la caisse, la vente se confirme au paiement.",
    pillar1_status: "Aucun paiement réel ne transite encore : les intégrations sont livrées, les comptes marchands ne sont pas ouverts",
    pillar2_title: 'XOF et XAF, au format local',
    pillar2_desc: "Les montants vivent en franc CFA, sans décimale et avec le séparateur de milliers attendu. EUR, USD, CAD et GBP restent disponibles à l'affichage.",
    pillar3_title: 'Ticket 80 mm — le hors-ligne arrive avec l’application',
    pillar3_desc: "Le ticket s'imprime en 80 mm depuis le navigateur. La mise en file des ventes hors réseau est développée et testée dans l'application mobile — qui n'est pas encore publiée. Depuis un navigateur, la caisse a besoin de la connexion pour enregistrer une vente.",

    // ── Comment ça marche ──
    how_label: 'COMMENT ÇA MARCHE',
    how_title: 'Démarrez en 4 étapes',
    step1_title: 'Créez votre boutique',
    step1_desc: "Inscription en quelques minutes. Devise, langue et TVA se règlent à l'onboarding.",
    step2_title: 'Ajoutez vos produits',
    step2_desc: 'Prix détail, demi-gros et gros par produit. Code-barres EAN saisi, scanné à la douchette ou à la caméra.',
    step3_title: 'Encaissez',
    step3_desc: 'Espèces, Mobile Money, paiement mixte. Ticket imprimé, envoyé en WhatsApp ou exporté en PDF.',
    step4_title: 'Suivez',
    step4_desc: 'Chiffre d’affaires, marges, top produits, écarts de caisse. Exports CSV et PDF.',

    // ── Devises & langues ──
    cur_title: 'Multi-devises & multi-langues',
    cur_sub: 'Adapté à votre marché, dans votre langue',

    // ── Tarifs ──
    pricing_label: 'TARIFS',
    pricing_title: 'Des prix en Franc CFA',
    pricing_sub: "14 jours d'essai sur tous les plans. Aucune carte bancaire demandée.",
    per_month: 'par mois',
    per_year: 'par an',
    period_label: 'Périodicité de facturation',
    period_monthly: 'Mensuel',
    period_yearly: 'Annuel',
    months_free: '2 mois offerts',
    on_estimate: 'Sur devis',
    recommended: 'Recommandé',
    try_free: 'Essayer 14 jours',
    contact_us: 'Nous contacter',
    starter_name: 'Starter',
    starter_sub: 'Pour les petits commerces',
    business_name: 'Business',
    business_sub: 'Pour les commerces en croissance',
    enterprise_name: 'Enterprise',
    enterprise_sub: 'Pour les réseaux de boutiques',
    feat_pos_1: 'Caisse POS · 1 poste',
    feat_stock_500: 'Stock · 500 produits',
    feat_reports: 'Rapports de base',
    feat_support: 'Support par e-mail',
    feat_pos_3: 'Caisse POS · 3 postes',
    feat_stock_inf: 'Stock · illimité',
    feat_crm: 'Clients & fidélité',
    feat_hr_full: 'RH, planning, paie',
    feat_5users: 'Équipe · 5 utilisateurs',
    feat_priority: 'Support prioritaire',
    feat_pos_inf: 'Caisse POS · postes illimités',
    feat_multi_shop: 'Multi-boutiques',
    feat_users_inf: 'Équipe · utilisateurs illimités',
    feat_api: 'API dédiée',
    feat_onboarding: 'Onboarding sur site',
    feat_support_start: 'Accompagnement au démarrage',
    pay_note: "Le paiement en ligne n'est pas encore actif : vous ne pourrez pas régler votre abonnement depuis le site. L'essai de 14 jours, lui, est complet et sans carte. Pour continuer ensuite, écrivez-nous — nous convenons du règlement (Mobile Money ou virement) et activons votre plan. Sans engagement, résiliable à tout moment.",

    // ── FAQ ──
    faq_label: 'FAQ',
    faq_title: 'Questions fréquentes',
    faq1_q: 'La caisse fonctionne-t-elle sans internet ?',
    faq1_a: "Pas encore. Le mode hors-ligne existe dans l'application mobile — la vente est enregistrée sur l'appareil puis rejouée au retour du réseau — mais cette application n'est pas encore publiée. Aujourd'hui HabaShop s'utilise depuis un navigateur, et la caisse y a besoin de la connexion pour enregistrer une vente.",
    faq2_q: "Comment se passe le paiement de l'abonnement ?",
    faq2_a: "Les 14 premiers jours sont gratuits et ne demandent aucune carte bancaire. Ensuite, le paiement en ligne n'étant pas encore actif, le règlement se convient directement avec notre équipe (Mobile Money ou virement) et nous activons votre plan. Les intégrations de paiement sont développées, elles attendent l'ouverture des comptes marchands.",
    faq3_q: 'Combien coûte HabaShop ?',
    faq3_a: `Starter ${pFR.starterM} par mois (${pFR.starterY} par an), Business ${pFR.businessM} par mois (${pFR.businessY} par an), Enterprise sur devis. L’abonnement annuel se paie ${pFR.moisPayes} mois : ${pFR.moisOfferts} mois offerts. Les 14 jours d’essai valent pour tous les plans.`,
    faq4_q: 'Puis-je gérer plusieurs boutiques ?',
    faq4_a: "Oui. Un même compte peut être rattaché à plusieurs boutiques — chacune avec ses produits, ses ventes et son équipe. Le sélecteur de boutique apparaît à la connexion.",
    faq5_q: 'Comment ajouter mes produits ?',
    faq5_a: "Un par un depuis l'écran Stock, avec le code-barres saisi, scanné à la douchette ou lu à la caméra. L'import en masse par fichier n'est pas encore disponible.",

    // ── CTA final ──
    cta_title: 'Prêt à essayer ?',
    cta_sub: 'Créez votre boutique et encaissez votre première vente aujourd’hui.',
    cta_btn: 'Créer ma boutique',
    cta_foot: "14 jours d'essai · sans carte bancaire · résiliable à tout moment",

    // ── Pied de page (l'année est CALCULÉE, cf. lib/publicYear.ts) ──
    footer_tagline: 'Logiciel de gestion commerciale pour les boutiques d’Afrique',
    footer_links: ['Confidentialité', 'CGU', 'Contact'],
  },

  en: {
    nav_features: 'Features',
    nav_pricing: 'Pricing',
    nav_faq: 'FAQ',
    nav_login: 'Sign in',

    h1a: 'The till that keeps going when the ',
    h1_accent: 'network stops',
    hero_sub: 'Take payments, invoice, track stock. HabaShop runs in the browser today; the mobile app — the one that records sales with no network — is not published yet.',
    cta1: 'Create my shop',
    cta2: 'See pricing',
    hero_note: 'No card required · 14-day trial',
    demo_caption: 'HabaShop mobile app — Android, release in preparation',
    demo_offline: 'Offline mode',
    demo_pending: '3 sales waiting to sync',
    demo_total: 'Total due',
    demo_recorded: 'Sale recorded on the device',

    features_label: 'WHAT CHANGES AT THE COUNTER',
    features_title: 'Three things that matter in a shop',
    pillar1_title: 'Mobile Money built in',
    pillar1_desc: 'MTN MoMo, Orange Money and card via Campay, PayDunya for the WAEMU zone. The cashier starts the request from the till; the sale confirms on payment.',
    pillar1_status: 'No real payment goes through yet: the integrations ship, the merchant accounts are not open',
    pillar2_title: 'XOF and XAF, formatted locally',
    pillar2_desc: 'Amounts live in CFA francs, with no decimals and the expected thousands separator. EUR, USD, CAD and GBP remain available for display.',
    pillar3_title: '80 mm receipt — offline comes with the app',
    pillar3_desc: 'The receipt prints at 80 mm from the browser. Queueing sales while off-network is built and tested in the mobile app — which is not published yet. From a browser, the till needs the connection to record a sale.',

    how_label: 'HOW IT WORKS',
    how_title: 'Get started in 4 steps',
    step1_title: 'Create your shop',
    step1_desc: 'Sign up in a few minutes. Currency, language and VAT are set during onboarding.',
    step2_title: 'Add your products',
    step2_desc: 'Retail, semi-wholesale and wholesale price per product. EAN barcode typed, scanned with a gun or read by camera.',
    step3_title: 'Take payments',
    step3_desc: 'Cash, Mobile Money, split payment. Receipt printed, sent over WhatsApp or exported to PDF.',
    step4_title: 'Follow along',
    step4_desc: 'Revenue, margins, top products, till discrepancies. CSV and PDF exports.',

    cur_title: 'Multi-currency & multi-language',
    cur_sub: 'Tailored to your market, in your language',

    pricing_label: 'PRICING',
    pricing_title: 'Prices in CFA francs',
    pricing_sub: '14-day trial on every plan. No card required.',
    per_month: 'per month',
    per_year: 'per year',
    period_label: 'Billing period',
    period_monthly: 'Monthly',
    period_yearly: 'Yearly',
    months_free: '2 months free',
    on_estimate: 'Custom quote',
    recommended: 'Recommended',
    try_free: 'Try 14 days',
    contact_us: 'Contact us',
    starter_name: 'Starter',
    starter_sub: 'For small businesses',
    business_name: 'Business',
    business_sub: 'For growing businesses',
    enterprise_name: 'Enterprise',
    enterprise_sub: 'For store networks',
    feat_pos_1: 'POS · 1 register',
    feat_stock_500: 'Stock · 500 products',
    feat_reports: 'Basic reports',
    feat_support: 'Email support',
    feat_pos_3: 'POS · 3 registers',
    feat_stock_inf: 'Stock · unlimited',
    feat_crm: 'Customers & loyalty',
    feat_hr_full: 'HR, scheduling, payroll',
    feat_5users: 'Team · 5 users',
    feat_priority: 'Priority support',
    feat_pos_inf: 'POS · unlimited registers',
    feat_multi_shop: 'Multi-store',
    feat_users_inf: 'Team · unlimited users',
    feat_api: 'Dedicated API',
    feat_onboarding: 'On-site onboarding',
    feat_support_start: 'Guided setup',
    pay_note: 'Online payment is not live yet: you will not be able to pay for your plan on this site. The 14-day trial is complete and needs no card. To continue afterwards, write to us — we agree on the payment (Mobile Money or transfer) and activate your plan. No commitment, cancel at any time.',

    faq_label: 'FAQ',
    faq_title: 'Frequently asked questions',
    faq1_q: 'Does the till work without internet?',
    faq1_a: 'Not yet. Offline mode exists in the mobile app — the sale is recorded on the device then replayed when the network returns — but that app is not published yet. Today HabaShop runs in a browser, where the till needs the connection to record a sale.',
    faq2_q: 'How does subscription payment work?',
    faq2_a: 'The first 14 days are free and require no card. After that, since online payment is not live yet, the payment is agreed directly with our team (Mobile Money or transfer) and we activate your plan. The payment integrations are built; they are waiting on the merchant accounts.',
    faq3_q: 'How much does HabaShop cost?',
    faq3_a: `Starter ${pEN.starterM} per month (${pEN.starterY} per year), Business ${pEN.businessM} per month (${pEN.businessY} per year), Enterprise on a custom quote. The yearly plan is billed as ${pEN.moisPayes} months: ${pEN.moisOfferts} months free. The 14-day trial applies to every plan.`,
    faq4_q: 'Can I manage several shops?',
    faq4_a: 'Yes. One account can be linked to several shops — each with its own products, sales and team. The shop picker appears at sign-in.',
    faq5_q: 'How do I add my products?',
    faq5_a: 'One at a time from the Stock screen, with the barcode typed, scanned with a gun or read by camera. Bulk file import is not available yet.',

    cta_title: 'Ready to try?',
    cta_sub: 'Create your shop and take your first sale today.',
    cta_btn: 'Create my shop',
    cta_foot: '14-day trial · no card required · cancel any time',

    footer_tagline: 'Business management software for African shops',
    footer_links: ['Privacy', 'Terms', 'Contact'],
  },

  es: {
    nav_features: 'Funciones',
    nav_pricing: 'Precios',
    nav_faq: 'FAQ',
    nav_login: 'Iniciar sesión',

    h1a: 'La caja que sigue cuando la ',
    h1_accent: 'red se cae',
    hero_sub: 'Cobrar, facturar, controlar el stock. HabaShop se usa hoy desde el navegador; la aplicación móvil — la que registra la venta sin red — aún no está publicada.',
    cta1: 'Crear mi tienda',
    cta2: 'Ver precios',
    hero_note: 'Sin tarjeta · 14 días de prueba',
    demo_caption: 'Aplicación móvil HabaShop — Android, publicación en preparación',
    demo_offline: 'Modo sin conexión',
    demo_pending: '3 ventas pendientes de sincronizar',
    demo_total: 'Total a pagar',
    demo_recorded: 'Venta registrada en el dispositivo',

    features_label: 'LO QUE CAMBIA EN EL MOSTRADOR',
    features_title: 'Tres cosas que importan en la tienda',
    pillar1_title: 'Mobile Money integrado',
    pillar1_desc: 'MTN MoMo, Orange Money y tarjeta mediante Campay, PayDunya para la UEMOA. El cajero lanza la solicitud desde la caja y la venta se confirma con el pago.',
    pillar1_status: 'Ningún pago real circula aún: las integraciones están listas, las cuentas de comercio no están abiertas',
    pillar2_title: 'XOF y XAF, con formato local',
    pillar2_desc: 'Los importes viven en francos CFA, sin decimales y con el separador de miles esperado. EUR, USD, CAD y GBP siguen disponibles para mostrar.',
    pillar3_title: 'Ticket de 80 mm — el modo sin conexión llega con la app',
    pillar3_desc: 'El ticket se imprime a 80 mm desde el navegador. La cola de ventas sin red está desarrollada y probada en la aplicación móvil — que aún no está publicada. Desde un navegador, la caja necesita conexión para registrar una venta.',

    how_label: 'CÓMO FUNCIONA',
    how_title: 'Empieza en 4 pasos',
    step1_title: 'Crea tu tienda',
    step1_desc: 'Registro en unos minutos. Divisa, idioma e IVA se configuran en el onboarding.',
    step2_title: 'Añade tus productos',
    step2_desc: 'Precio minorista, semimayorista y mayorista por producto. Código de barras EAN escrito, escaneado con pistola o leído por cámara.',
    step3_title: 'Cobra',
    step3_desc: 'Efectivo, Mobile Money, pago mixto. Ticket impreso, enviado por WhatsApp o exportado a PDF.',
    step4_title: 'Haz seguimiento',
    step4_desc: 'Ingresos, márgenes, top productos, descuadres de caja. Exportaciones CSV y PDF.',

    cur_title: 'Multidivisa y multiidioma',
    cur_sub: 'Adaptado a tu mercado, en tu idioma',

    pricing_label: 'PRECIOS',
    pricing_title: 'Precios en francos CFA',
    pricing_sub: '14 días de prueba en todos los planes. Sin tarjeta.',
    per_month: 'al mes',
    per_year: 'al año',
    period_label: 'Periodicidad de facturación',
    period_monthly: 'Mensual',
    period_yearly: 'Anual',
    months_free: '2 meses gratis',
    on_estimate: 'Presupuesto',
    recommended: 'Recomendado',
    try_free: 'Probar 14 días',
    contact_us: 'Contáctanos',
    starter_name: 'Starter',
    starter_sub: 'Para pequeños negocios',
    business_name: 'Business',
    business_sub: 'Para negocios en crecimiento',
    enterprise_name: 'Enterprise',
    enterprise_sub: 'Para redes de tiendas',
    feat_pos_1: 'POS · 1 caja',
    feat_stock_500: 'Stock · 500 productos',
    feat_reports: 'Informes básicos',
    feat_support: 'Soporte por email',
    feat_pos_3: 'POS · 3 cajas',
    feat_stock_inf: 'Stock · ilimitado',
    feat_crm: 'Clientes y fidelidad',
    feat_hr_full: 'RRHH, horarios, nóminas',
    feat_5users: 'Equipo · 5 usuarios',
    feat_priority: 'Soporte prioritario',
    feat_pos_inf: 'POS · cajas ilimitadas',
    feat_multi_shop: 'Multitienda',
    feat_users_inf: 'Equipo · usuarios ilimitados',
    feat_api: 'API dedicada',
    feat_onboarding: 'Onboarding en sitio',
    feat_support_start: 'Acompañamiento inicial',
    pay_note: 'El pago en línea aún no está activo: no podrá pagar su plan desde el sitio. La prueba de 14 días es completa y sin tarjeta. Para continuar después, escríbanos — acordamos el pago (Mobile Money o transferencia) y activamos su plan. Sin compromiso, cancele cuando quiera.',

    faq_label: 'FAQ',
    faq_title: 'Preguntas frecuentes',
    faq1_q: '¿La caja funciona sin internet?',
    faq1_a: 'Todavía no. El modo sin conexión existe en la aplicación móvil — la venta se registra en el dispositivo y se reenvía al volver la red — pero esa aplicación aún no está publicada. Hoy HabaShop se usa desde un navegador, donde la caja necesita conexión para registrar una venta.',
    faq2_q: '¿Cómo se paga la suscripción?',
    faq2_a: 'Los primeros 14 días son gratis y no piden tarjeta. Después, como el pago en línea aún no está activo, el pago se acuerda directamente con nuestro equipo (Mobile Money o transferencia) y activamos su plan. Las integraciones de pago están hechas; esperan la apertura de las cuentas de comercio.',
    faq3_q: '¿Cuánto cuesta HabaShop?',
    faq3_a: `Starter ${pES.starterM} al mes (${pES.starterY} al año), Business ${pES.businessM} al mes (${pES.businessY} al año), Enterprise bajo presupuesto. El plan anual se factura ${pES.moisPayes} meses: ${pES.moisOfferts} meses gratis. La prueba de 14 días vale para todos los planes.`,
    faq4_q: '¿Puedo gestionar varias tiendas?',
    faq4_a: 'Sí. Una misma cuenta puede estar vinculada a varias tiendas — cada una con sus productos, sus ventas y su equipo. El selector de tienda aparece al iniciar sesión.',
    faq5_q: '¿Cómo añado mis productos?',
    faq5_a: 'Uno a uno desde la pantalla Stock, con el código de barras escrito, escaneado con pistola o leído por cámara. La importación masiva por archivo aún no está disponible.',

    cta_title: '¿Listo para probar?',
    cta_sub: 'Crea tu tienda y cobra tu primera venta hoy.',
    cta_btn: 'Crear mi tienda',
    cta_foot: '14 días de prueba · sin tarjeta · cancela cuando quieras',

    footer_tagline: 'Software de gestión comercial para comercios africanos',
    footer_links: ['Privacidad', 'Términos', 'Contacto'],
  },

  it: {
    nav_features: 'Funzioni',
    nav_pricing: 'Prezzi',
    nav_faq: 'FAQ',
    nav_login: 'Accedi',

    h1a: 'La cassa che continua quando la ',
    h1_accent: 'rete si ferma',
    hero_sub: "Incassare, fatturare, seguire il magazzino. HabaShop si usa oggi dal browser; l'app mobile — quella che registra la vendita senza rete — non è ancora pubblicata.",
    cta1: 'Crea il mio negozio',
    cta2: 'Vedi i prezzi',
    hero_note: 'Nessuna carta · 14 giorni di prova',
    demo_caption: 'App mobile HabaShop — Android, pubblicazione in preparazione',
    demo_offline: 'Modalità offline',
    demo_pending: '3 vendite in attesa di sincronizzazione',
    demo_total: 'Totale da pagare',
    demo_recorded: 'Vendita registrata sul dispositivo',

    features_label: 'COSA CAMBIA AL BANCONE',
    features_title: 'Tre cose che contano in negozio',
    pillar1_title: 'Mobile Money integrato',
    pillar1_desc: "MTN MoMo, Orange Money e carta tramite Campay, PayDunya per l'UEMOA. Il cassiere avvia la richiesta dalla cassa e la vendita si conferma al pagamento.",
    pillar1_status: 'Nessun pagamento reale transita ancora: le integrazioni ci sono, gli account commerciante non sono aperti',
    pillar2_title: 'XOF e XAF, in formato locale',
    pillar2_desc: 'Gli importi vivono in franchi CFA, senza decimali e con il separatore delle migliaia atteso. EUR, USD, CAD e GBP restano disponibili per la visualizzazione.',
    pillar3_title: 'Scontrino 80 mm — l’offline arriva con l’app',
    pillar3_desc: "Lo scontrino si stampa a 80 mm dal browser. La coda delle vendite senza rete è sviluppata e testata nell'app mobile — non ancora pubblicata. Da browser, la cassa ha bisogno della connessione per registrare una vendita.",

    how_label: 'COME FUNZIONA',
    how_title: 'Inizia in 4 passi',
    step1_title: 'Crea il tuo negozio',
    step1_desc: "Registrazione in pochi minuti. Valuta, lingua e IVA si impostano nell'onboarding.",
    step2_title: 'Aggiungi i prodotti',
    step2_desc: 'Prezzo al dettaglio, semi-ingrosso e ingrosso per prodotto. Codice a barre EAN digitato, scansionato con la pistola o letto dalla fotocamera.',
    step3_title: 'Incassa',
    step3_desc: 'Contanti, Mobile Money, pagamento misto. Scontrino stampato, inviato su WhatsApp o esportato in PDF.',
    step4_title: 'Tieni traccia',
    step4_desc: 'Fatturato, margini, top prodotti, scostamenti di cassa. Export CSV e PDF.',

    cur_title: 'Multi-valuta e multi-lingua',
    cur_sub: 'Adattato al tuo mercato, nella tua lingua',

    pricing_label: 'PREZZI',
    pricing_title: 'Prezzi in franchi CFA',
    pricing_sub: '14 giorni di prova su tutti i piani. Nessuna carta richiesta.',
    per_month: 'al mese',
    per_year: "all'anno",
    period_label: 'Periodicità di fatturazione',
    period_monthly: 'Mensile',
    period_yearly: 'Annuale',
    months_free: '2 mesi gratis',
    on_estimate: 'Su preventivo',
    recommended: 'Consigliato',
    try_free: 'Prova 14 giorni',
    contact_us: 'Contattaci',
    starter_name: 'Starter',
    starter_sub: 'Per le piccole attività',
    business_name: 'Business',
    business_sub: 'Per le attività in crescita',
    enterprise_name: 'Enterprise',
    enterprise_sub: 'Per le reti di negozi',
    feat_pos_1: 'POS · 1 cassa',
    feat_stock_500: 'Magazzino · 500 prodotti',
    feat_reports: 'Report di base',
    feat_support: 'Supporto via email',
    feat_pos_3: 'POS · 3 casse',
    feat_stock_inf: 'Magazzino · illimitato',
    feat_crm: 'Clienti e fedeltà',
    feat_hr_full: 'HR, turni, paghe',
    feat_5users: 'Team · 5 utenti',
    feat_priority: 'Supporto prioritario',
    feat_pos_inf: 'POS · casse illimitate',
    feat_multi_shop: 'Multi-negozio',
    feat_users_inf: 'Team · utenti illimitati',
    feat_api: 'API dedicata',
    feat_onboarding: 'Onboarding in loco',
    feat_support_start: 'Accompagnamento iniziale',
    pay_note: "Il pagamento online non è ancora attivo: non potrai pagare il piano dal sito. La prova di 14 giorni è completa e senza carta. Per continuare dopo, scrivici — concordiamo il pagamento (Mobile Money o bonifico) e attiviamo il piano. Nessun vincolo, disdici quando vuoi.",

    faq_label: 'FAQ',
    faq_title: 'Domande frequenti',
    faq1_q: 'La cassa funziona senza internet?',
    faq1_a: "Non ancora. La modalità offline esiste nell'app mobile — la vendita è registrata sul dispositivo e rigiocata al ritorno della rete — ma quell'app non è ancora pubblicata. Oggi HabaShop si usa da browser, dove la cassa ha bisogno della connessione per registrare una vendita.",
    faq2_q: "Come funziona il pagamento dell'abbonamento?",
    faq2_a: 'I primi 14 giorni sono gratuiti e non richiedono carta. Poi, non essendo ancora attivo il pagamento online, il pagamento si concorda direttamente con il nostro team (Mobile Money o bonifico) e attiviamo il piano. Le integrazioni di pagamento ci sono; attendono l’apertura degli account commerciante.',
    faq3_q: 'Quanto costa HabaShop?',
    faq3_a: `Starter ${pIT.starterM} al mese (${pIT.starterY} all'anno), Business ${pIT.businessM} al mese (${pIT.businessY} all'anno), Enterprise su preventivo. Il piano annuale è fatturato ${pIT.moisPayes} mesi: ${pIT.moisOfferts} mesi gratis. I 14 giorni di prova valgono per tutti i piani.`,
    faq4_q: 'Posso gestire più negozi?',
    faq4_a: "Sì. Uno stesso account può essere collegato a più negozi — ciascuno con i propri prodotti, vendite e team. Il selettore di negozio appare all'accesso.",
    faq5_q: 'Come aggiungo i miei prodotti?',
    faq5_a: "Uno alla volta dalla schermata Magazzino, con il codice a barre digitato, scansionato con la pistola o letto dalla fotocamera. L'import massivo da file non è ancora disponibile.",

    cta_title: 'Pronto a provare?',
    cta_sub: 'Crea il tuo negozio e incassa la prima vendita oggi.',
    cta_btn: 'Crea il mio negozio',
    cta_foot: '14 giorni di prova · nessuna carta · disdici quando vuoi',

    footer_tagline: 'Software gestionale per i negozi africani',
    footer_links: ['Privacy', 'Termini', 'Contatto'],
  },
}

// ─── TARIFS ───────────────────────────────────────────────────────────────────
//
// ⚠️ La grille NE VIT PLUS ICI. Elle est dans `src/lib/plans.ts`, jumeau à l'identique
// d'`apps/backend/src/lib/plans.ts`, tous deux exercés contre
// `docs/shared-fixtures/plan-catalog.json`. Il y a eu QUATRE grilles pour deux formules
// (payments.ts, billing.ts, UpgradePlan.tsx, AdminDashboard.tsx) plus celle-ci et le
// JSON-LD : six sources, jusqu'à faire afficher 8 000 pendant que 9 900 aurait été
// prélevé, et un `starter` inachetable alors que chaque inscription l'attribue.
//
// La contrepartie euro est calculée DEPUIS le FCFA à la parité FIXE (655,957), jamais
// l'inverse et jamais avec « ≈ » : ce n'est pas une approximation de change mais un
// arrondi au centime.

// ─── DARK PALETTE ─────────────────────────────────────────────────────────────

export const D = {
  bg:      '#0A0C14',
  bg2:     '#0D1019',
  bg3:     '#11151F',
  bg4:     '#161C2B',
  p:       '#6C47FF',
  p2:      '#8B6FFF',
  p3:      '#A991FF',
  gold:    '#FFB020',
  gold2:   '#FFC53D',
  text:    '#EAEEF6',
  text2:   'rgba(234,238,246,.66)',
  text3:   'rgba(234,238,246,.65)',
  text4:   'rgba(234,238,246,.55)',
  border:  'rgba(255,255,255,.06)',
  border2: 'rgba(255,255,255,.11)',
  acc:     '#22C77A',
  acc2:    '#4F86F0',
  acc3:    '#FFB020',
  acc4:    '#FF5C72',
}

export const FONT = "'Geist Variable', 'Geist', system-ui, -apple-system, sans-serif"
export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

export const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export type LandingT = typeof LANDING_TRANSLATIONS['fr']
