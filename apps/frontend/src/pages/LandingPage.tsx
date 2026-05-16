import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, convertAmount } from '@/stores/appStore'
import type { Lang, Currency } from '@/stores/appStore'

// ─── TRADUCTIONS LANDING ──────────────────────────────────────────────────────

const LANDING_TRANSLATIONS = {
  fr: {
    nav: ['Fonctionnalités', 'Tarifs', 'FAQ'],
    nav_features: 'Fonctionnalités',
    nav_pricing: 'Tarifs',
    nav_faq: 'FAQ',
    nav_login: 'Connexion →',
    badge: "Conçu pour l'Afrique francophone",
    h1a: 'Gérez votre commerce',
    h1b: 'simplement et efficacement',
    hero_sub: "HabaShop centralise votre caisse, vos stocks, vos équipes et vos finances dans un seul outil — simple, rapide, et disponible même sans internet.",
    cta1: '🚀 Démarrer gratuitement',
    cta2: '▶ Voir la démo',
    stat1_l: 'Modules intégrés',
    stat2_l: 'Offline-ready',
    stat3_l: 'Devises supportées',
    stat4_l: 'Pays cibles',
    features_label: 'FONCTIONNALITÉS',
    features_title: 'Tout ce dont vous avez besoin',
    features_sub: '16 modules intégrés pour gérer chaque aspect de votre commerce',
    feature1_title: 'Caisse (POS)',
    feature1_desc: 'Encaissement rapide, catalogue filtrable, multi-modes de paiement, ticket imprimé ou WhatsApp, mode offline.',
    feature2_title: 'Stock & Inventaire',
    feature2_desc: 'Alertes rupture en temps réel, CRUD produits, bon de commande automatique depuis la fiche produit.',
    feature3_title: 'Rapports & Analyses',
    feature3_desc: 'KPIs par période, CA, marges, top produits, répartition paiements. Exports CSV et PDF en un clic.',
    feature4_title: 'CRM Clients',
    feature4_desc: "Fiches clients, types (gros/semi-gros/fidèle), programme de fidélité et historique d'achats complet.",
    feature5_title: 'RH & Planning',
    feature5_desc: 'Fiches employés, planning hebdomadaire drag & drop, gestion des congés et suivi des présences.',
    feature6_title: 'Sécurité & RBAC',
    feature6_desc: "Rôles et permissions granulaires, authentification 2FA TOTP, journal d'audit immuable, multi-tenant.",
    how_label: 'COMMENT ÇA MARCHE',
    how_title: 'Démarrez en 4 étapes',
    step1_title: 'Créez votre boutique',
    step1_desc: 'Inscription en 2 minutes. Configurez votre espace, ajoutez vos produits et votre équipe.',
    step2_title: 'Formez votre équipe',
    step2_desc: "Interface intuitive. Vos caissiers maîtrisent la caisse en moins d'une heure.",
    step3_title: 'Encaissez & gérez',
    step3_desc: 'POS rapide, gestion du stock en temps réel, alertes automatiques, rapports instantanés.',
    step4_title: 'Analysez & croissez',
    step4_desc: 'Tableaux de bord, exports, tendances produits. Prenez de meilleures décisions chaque jour.',
    testimonials_label: 'TÉMOIGNAGES',
    testimonials_title: 'Ils font confiance à HabaShop',
    test1_name: 'Mamadou Diallo',
    test1_role: 'Grossiste · Dakar',
    test1_quote: "Depuis HabaShop, j'ai une visibilité totale sur mon stock. Les alertes de rupture m'ont sauvé plusieurs fois.",
    test2_name: 'Fatou Koné',
    test2_role: 'Épicerie · Abidjan',
    test2_quote: "La caisse est ultra-rapide et fonctionne même quand internet coupe. Mes caissières ont été formées en 30 minutes.",
    test3_name: 'Ibrahim Touré',
    test3_role: 'Demi-grossiste · Bamako',
    test3_quote: "Les rapports de vente m'aident à prendre de meilleures décisions d'achat. L'interface est claire et les données sont toujours à jour.",
    pricing_label: 'TARIFS',
    pricing_title: "Des prix adaptés à l'Afrique",
    pricing_sub: "14 jours d'essai gratuit — aucune carte requise",
    per_month: '/mois',
    on_estimate: 'Sur devis',
    most_popular: '⭐ Le plus populaire',
    free_start: 'Commencer gratuitement',
    try_free: 'Essayer 14 jours',
    contact_us: 'Nous contacter',
    starter_name: 'Starter',
    starter_sub: 'Pour les petits commerces',
    business_name: 'Business',
    business_sub: 'Pour les commerces en croissance',
    enterprise_name: 'Enterprise',
    enterprise_sub: 'Pour les réseaux de boutiques',
    feat_pos_1: 'Caisse POS (1 caisse)',
    feat_stock_500: 'Gestion stock (500 produits)',
    feat_reports: 'Rapports de base',
    feat_support: 'Support par email',
    feat_multiuser: 'Multi-utilisateurs',
    feat_hr: 'Module RH & Planning',
    feat_pos_3: 'Caisse POS (3 caisses)',
    feat_stock_inf: 'Stock illimité',
    feat_crm: 'CRM Clients complet',
    feat_hr_full: 'RH, Planning, Paie',
    feat_5users: '5 utilisateurs inclus',
    feat_priority: 'Support prioritaire',
    feat_pos_inf: 'Caisses illimitées',
    feat_multi_shop: 'Multi-boutiques',
    feat_users_inf: 'Utilisateurs illimités',
    feat_api: 'API dédiée',
    feat_onboarding: 'Onboarding sur site',
    feat_sla: 'SLA garanti 99,9 %',
    faq_label: 'FAQ',
    faq_title: 'Questions fréquentes',
    faq1_q: 'HabaShop fonctionne-t-il sans internet ?',
    faq1_a: "Oui ! La caisse POS fonctionne en mode offline grâce à la technologie PWA. Les ventes sont stockées localement et synchronisées automatiquement au retour de la connexion.",
    faq2_q: "Combien de temps prend l'installation ?",
    faq2_a: "Aucune installation requise ! HabaShop est un logiciel web (SaaS). Vous vous connectez depuis n'importe quel navigateur. La configuration initiale prend moins de 30 minutes.",
    faq3_q: 'Mes données sont-elles sécurisées ?',
    faq3_a: "Absolument. Vos données sont chiffrées, hébergées en Europe et sauvegardées quotidiennement. L'authentification 2FA protège tous les accès. Conformité RGPD.",
    faq4_q: 'Puis-je gérer plusieurs boutiques ?',
    faq4_a: 'Oui, avec le plan Enterprise vous pouvez gérer un réseau de boutiques depuis un tableau de bord centralisé. Chaque boutique a ses propres données isolées.',
    faq5_q: 'Quelle devise est supportée ?',
    faq5_a: "HabaShop supporte le Franc CFA (XOF), l'Euro (EUR), le Dollar US (USD) et le Dollar canadien (CAD). La TVA est configurable par boutique.",
    cta_title: 'Prêt à moderniser votre commerce ?',
    cta_sub: "Rejoignez les commerçants d'Afrique qui font confiance à HabaShop",
    cta_btn: "🚀 Commencer maintenant — C'est gratuit",
    cta_note: "Aucune carte bancaire requise · 14 jours d'essai gratuit",
    footer: '© 2026 HabaShop · Logiciel SaaS pour commerces africains',
    footer_links: ['Confidentialité', 'CGU', 'Contact'],
  },
  en: {
    nav: ['Features', 'Pricing', 'FAQ'],
    nav_features: 'Features',
    nav_pricing: 'Pricing',
    nav_faq: 'FAQ',
    nav_login: 'Sign in →',
    badge: 'Built for francophone Africa',
    h1a: 'Manage your business',
    h1b: 'simply and efficiently',
    hero_sub: 'HabaShop centralizes your POS, inventory, team and finances in one tool — simple, fast, and available even without internet.',
    cta1: '🚀 Start for free',
    cta2: '▶ View demo',
    stat1_l: 'Integrated modules',
    stat2_l: 'Offline-ready',
    stat3_l: 'Supported currencies',
    stat4_l: 'Target countries',
    features_label: 'FEATURES',
    features_title: 'Everything you need',
    features_sub: '16 integrated modules to manage every aspect of your business',
    feature1_title: 'Point of Sale',
    feature1_desc: 'Fast checkout, filterable catalog, multi-payment modes, printed or WhatsApp receipt, offline mode.',
    feature2_title: 'Stock & Inventory',
    feature2_desc: 'Real-time stock alerts, product CRUD, automatic purchase order from product sheet.',
    feature3_title: 'Reports & Analytics',
    feature3_desc: 'KPIs by period, revenue, margins, top products, payment breakdown. CSV and PDF exports in one click.',
    feature4_title: 'CRM Customers',
    feature4_desc: 'Customer profiles, types (wholesale/loyal), loyalty program and full purchase history.',
    feature5_title: 'HR & Scheduling',
    feature5_desc: 'Employee profiles, drag & drop weekly schedule, leave management and attendance tracking.',
    feature6_title: 'Security & RBAC',
    feature6_desc: 'Granular roles and permissions, 2FA TOTP authentication, immutable audit log, multi-tenant.',
    how_label: 'HOW IT WORKS',
    how_title: 'Get started in 4 steps',
    step1_title: 'Create your store',
    step1_desc: 'Sign up in 2 minutes. Set up your workspace, add your products and team.',
    step2_title: 'Train your team',
    step2_desc: 'Intuitive interface. Your cashiers master the POS in less than an hour.',
    step3_title: 'Sell & manage',
    step3_desc: 'Fast POS, real-time inventory, automatic alerts, instant reports.',
    step4_title: 'Analyze & grow',
    step4_desc: 'Dashboards, exports, product trends. Make better decisions every day.',
    testimonials_label: 'TESTIMONIALS',
    testimonials_title: 'They trust HabaShop',
    test1_name: 'Mamadou Diallo',
    test1_role: 'Wholesaler · Dakar',
    test1_quote: "Since HabaShop, I have total visibility over my stock. The out-of-stock alerts have saved me several times.",
    test2_name: 'Fatou Koné',
    test2_role: 'Grocery · Abidjan',
    test2_quote: "The POS is ultra-fast and works even when the internet cuts out. My cashiers were trained in 30 minutes.",
    test3_name: 'Ibrahim Touré',
    test3_role: 'Semi-wholesaler · Bamako',
    test3_quote: "Sales reports help me make better purchasing decisions. The interface is clear and data is always up to date.",
    pricing_label: 'PRICING',
    pricing_title: 'Prices adapted for Africa',
    pricing_sub: '14-day free trial — no credit card required',
    per_month: '/mo',
    on_estimate: 'Custom quote',
    most_popular: '⭐ Most popular',
    free_start: 'Start for free',
    try_free: 'Try 14 days',
    contact_us: 'Contact us',
    starter_name: 'Starter',
    starter_sub: 'For small businesses',
    business_name: 'Business',
    business_sub: 'For growing businesses',
    enterprise_name: 'Enterprise',
    enterprise_sub: 'For store networks',
    feat_pos_1: 'POS (1 register)',
    feat_stock_500: 'Stock management (500 products)',
    feat_reports: 'Basic reports',
    feat_support: 'Email support',
    feat_multiuser: 'Multi-user',
    feat_hr: 'HR & Scheduling module',
    feat_pos_3: 'POS (3 registers)',
    feat_stock_inf: 'Unlimited stock',
    feat_crm: 'Full CRM',
    feat_hr_full: 'HR, Scheduling, Payroll',
    feat_5users: '5 users included',
    feat_priority: 'Priority support',
    feat_pos_inf: 'Unlimited registers',
    feat_multi_shop: 'Multi-store',
    feat_users_inf: 'Unlimited users',
    feat_api: 'Dedicated API',
    feat_onboarding: 'On-site onboarding',
    feat_sla: '99.9% SLA guarantee',
    faq_label: 'FAQ',
    faq_title: 'Frequently asked questions',
    faq1_q: 'Does HabaShop work without internet?',
    faq1_a: 'Yes! The POS works offline thanks to PWA technology. Sales are stored locally and automatically synced when the connection returns.',
    faq2_q: 'How long does setup take?',
    faq2_a: 'No installation required! HabaShop is a web app (SaaS). You connect from any browser. Initial setup takes less than 30 minutes.',
    faq3_q: 'Is my data secure?',
    faq3_a: 'Absolutely. Your data is encrypted, hosted in Europe and backed up daily. 2FA authentication protects all access. GDPR compliant.',
    faq4_q: 'Can I manage multiple stores?',
    faq4_a: 'Yes, with the Enterprise plan you can manage a network of stores from a centralized dashboard. Each store has its own isolated data.',
    faq5_q: 'Which currencies are supported?',
    faq5_a: 'HabaShop supports CFA Franc (XOF), Euro (EUR), US Dollar (USD) and Canadian Dollar (CAD). VAT is configurable per store.',
    cta_title: 'Ready to modernize your business?',
    cta_sub: 'Join African merchants who trust HabaShop',
    cta_btn: "🚀 Start now — It's free",
    cta_note: 'No credit card required · 14-day free trial',
    footer: '© 2026 HabaShop · SaaS software for African businesses',
    footer_links: ['Privacy', 'Terms', 'Contact'],
  },
  es: {
    nav: ['Funciones', 'Precios', 'FAQ'],
    nav_features: 'Funciones',
    nav_pricing: 'Precios',
    nav_faq: 'FAQ',
    nav_login: 'Iniciar sesión →',
    badge: 'Diseñado para el África francófona',
    h1a: 'Gestiona tu negocio',
    h1b: 'de forma simple y eficiente',
    hero_sub: 'HabaShop centraliza tu caja, inventario, equipo y finanzas en una sola herramienta — simple, rápida y disponible incluso sin internet.',
    cta1: '🚀 Empezar gratis',
    cta2: '▶ Ver demo',
    stat1_l: 'Módulos integrados',
    stat2_l: 'Offline-ready',
    stat3_l: 'Divisas admitidas',
    stat4_l: 'Países objetivo',
    features_label: 'FUNCIONES',
    features_title: 'Todo lo que necesitas',
    features_sub: '16 módulos integrados para gestionar cada aspecto de tu negocio',
    feature1_title: 'Punto de Venta',
    feature1_desc: 'Cobro rápido, catálogo filtrable, múltiples modos de pago, ticket impreso o por WhatsApp, modo offline.',
    feature2_title: 'Stock e Inventario',
    feature2_desc: 'Alertas de rotura en tiempo real, CRUD de productos, pedido automático desde la ficha de producto.',
    feature3_title: 'Informes y Análisis',
    feature3_desc: 'KPIs por período, ingresos, márgenes, top productos, desglose de pagos. Exportaciones CSV y PDF en un clic.',
    feature4_title: 'CRM Clientes',
    feature4_desc: 'Fichas de clientes, tipos (mayorista/fiel), programa de fidelidad e historial completo de compras.',
    feature5_title: 'RRHH y Horarios',
    feature5_desc: 'Fichas de empleados, horario semanal drag & drop, gestión de bajas y seguimiento de asistencia.',
    feature6_title: 'Seguridad y RBAC',
    feature6_desc: 'Roles y permisos granulares, autenticación 2FA TOTP, registro de auditoría inmutable, multi-tenant.',
    how_label: 'CÓMO FUNCIONA',
    how_title: 'Empieza en 4 pasos',
    step1_title: 'Crea tu tienda',
    step1_desc: 'Regístrate en 2 minutos. Configura tu espacio, añade tus productos y equipo.',
    step2_title: 'Forma a tu equipo',
    step2_desc: 'Interfaz intuitiva. Tus cajeros dominan el POS en menos de una hora.',
    step3_title: 'Vende y gestiona',
    step3_desc: 'POS rápido, inventario en tiempo real, alertas automáticas, informes instantáneos.',
    step4_title: 'Analiza y crece',
    step4_desc: 'Paneles, exportaciones, tendencias de productos. Toma mejores decisiones cada día.',
    testimonials_label: 'TESTIMONIOS',
    testimonials_title: 'Confían en HabaShop',
    test1_name: 'Mamadou Diallo',
    test1_role: 'Mayorista · Dakar',
    test1_quote: "Desde HabaShop, tengo visibilidad total sobre mi stock. Las alertas de rotura me han salvado varias veces.",
    test2_name: 'Fatou Koné',
    test2_role: 'Colmado · Abiyán',
    test2_quote: "La caja es ultrarrápida y funciona incluso cuando se corta internet. Mis cajeras se formaron en 30 minutos.",
    test3_name: 'Ibrahim Touré',
    test3_role: 'Semi-mayorista · Bamako',
    test3_quote: "Los informes de ventas me ayudan a tomar mejores decisiones de compra. La interfaz es clara y los datos siempre están al día.",
    pricing_label: 'PRECIOS',
    pricing_title: 'Precios adaptados para África',
    pricing_sub: '14 días de prueba gratuita — sin tarjeta requerida',
    per_month: '/mes',
    on_estimate: 'Presupuesto',
    most_popular: '⭐ El más popular',
    free_start: 'Empezar gratis',
    try_free: 'Probar 14 días',
    contact_us: 'Contáctanos',
    starter_name: 'Starter',
    starter_sub: 'Para pequeños negocios',
    business_name: 'Business',
    business_sub: 'Para negocios en crecimiento',
    enterprise_name: 'Enterprise',
    enterprise_sub: 'Para redes de tiendas',
    feat_pos_1: 'POS (1 caja)',
    feat_stock_500: 'Gestión stock (500 productos)',
    feat_reports: 'Informes básicos',
    feat_support: 'Soporte por email',
    feat_multiuser: 'Multi-usuario',
    feat_hr: 'Módulo RRHH y Horarios',
    feat_pos_3: 'POS (3 cajas)',
    feat_stock_inf: 'Stock ilimitado',
    feat_crm: 'CRM completo',
    feat_hr_full: 'RRHH, Horarios, Nóminas',
    feat_5users: '5 usuarios incluidos',
    feat_priority: 'Soporte prioritario',
    feat_pos_inf: 'Cajas ilimitadas',
    feat_multi_shop: 'Multi-tienda',
    feat_users_inf: 'Usuarios ilimitados',
    feat_api: 'API dedicada',
    feat_onboarding: 'Onboarding en sitio',
    feat_sla: 'SLA garantizado 99,9 %',
    faq_label: 'FAQ',
    faq_title: 'Preguntas frecuentes',
    faq1_q: '¿HabaShop funciona sin internet?',
    faq1_a: '¡Sí! La caja POS funciona offline gracias a la tecnología PWA. Las ventas se almacenan localmente y se sincronizan automáticamente al recuperar la conexión.',
    faq2_q: '¿Cuánto tarda la instalación?',
    faq2_a: '¡No requiere instalación! HabaShop es una aplicación web (SaaS). Te conectas desde cualquier navegador. La configuración inicial lleva menos de 30 minutos.',
    faq3_q: '¿Mis datos están seguros?',
    faq3_a: 'Absolutamente. Tus datos están cifrados, alojados en Europa y respaldados diariamente. La autenticación 2FA protege todos los accesos. Cumplimiento RGPD.',
    faq4_q: '¿Puedo gestionar varias tiendas?',
    faq4_a: 'Sí, con el plan Enterprise puedes gestionar una red de tiendas desde un panel centralizado. Cada tienda tiene sus propios datos aislados.',
    faq5_q: '¿Qué divisas están admitidas?',
    faq5_a: 'HabaShop admite Franco CFA (XOF), Euro (EUR), Dólar US (USD) y Dólar canadiense (CAD). El IVA es configurable por tienda.',
    cta_title: '¿Listo para modernizar tu negocio?',
    cta_sub: 'Únete a los comerciantes africanos que confían en HabaShop',
    cta_btn: '🚀 Empezar ahora — Es gratis',
    cta_note: 'Sin tarjeta de crédito · 14 días de prueba gratuita',
    footer: '© 2026 HabaShop · Software SaaS para comercios africanos',
    footer_links: ['Privacidad', 'Términos', 'Contacto'],
  },
  it: {
    nav: ['Funzioni', 'Prezzi', 'FAQ'],
    nav_features: 'Funzioni',
    nav_pricing: 'Prezzi',
    nav_faq: 'FAQ',
    nav_login: 'Accedi →',
    badge: "Progettato per l'Africa francofona",
    h1a: 'Gestisci il tuo business',
    h1b: 'in modo semplice ed efficiente',
    hero_sub: 'HabaShop centralizza il tuo POS, magazzino, team e finanze in un unico strumento — semplice, veloce e disponibile anche senza internet.',
    cta1: '🚀 Inizia gratis',
    cta2: '▶ Guarda la demo',
    stat1_l: 'Moduli integrati',
    stat2_l: 'Offline-ready',
    stat3_l: 'Valute supportate',
    stat4_l: 'Paesi target',
    features_label: 'FUNZIONI',
    features_title: 'Tutto ciò di cui hai bisogno',
    features_sub: '16 moduli integrati per gestire ogni aspetto del tuo business',
    feature1_title: 'Punto Vendita',
    feature1_desc: 'Incasso rapido, catalogo filtrabile, multi-pagamento, scontrino stampato o WhatsApp, modalità offline.',
    feature2_title: 'Magazzino & Inventario',
    feature2_desc: "Avvisi di esaurimento in tempo reale, CRUD prodotti, ordine automatico dalla scheda prodotto.",
    feature3_title: 'Report & Analisi',
    feature3_desc: 'KPI per periodo, fatturato, margini, top prodotti, ripartizione pagamenti. Export CSV e PDF in un clic.',
    feature4_title: 'CRM Clienti',
    feature4_desc: "Schede clienti, tipi (ingrosso/fedele), programma fedeltà e storico acquisti completo.",
    feature5_title: 'HR & Turni',
    feature5_desc: 'Schede dipendenti, turni settimanali drag & drop, gestione ferie e tracciamento presenze.',
    feature6_title: 'Sicurezza & RBAC',
    feature6_desc: 'Ruoli e permessi granulari, autenticazione 2FA TOTP, registro di audit immutabile, multi-tenant.',
    how_label: 'COME FUNZIONA',
    how_title: 'Inizia in 4 passi',
    step1_title: 'Crea il tuo negozio',
    step1_desc: 'Registrazione in 2 minuti. Configura il tuo spazio, aggiungi prodotti e team.',
    step2_title: 'Forma il tuo team',
    step2_desc: 'Interfaccia intuitiva. I tuoi cassieri padroneggiano il POS in meno di un ora.',
    step3_title: 'Vendi e gestisci',
    step3_desc: 'POS veloce, inventario in tempo reale, avvisi automatici, report istantanei.',
    step4_title: 'Analizza e cresci',
    step4_desc: 'Dashboard, esportazioni, tendenze prodotti. Prendi decisioni migliori ogni giorno.',
    testimonials_label: 'TESTIMONIANZE',
    testimonials_title: 'Si fidano di HabaShop',
    test1_name: 'Mamadou Diallo',
    test1_role: 'Grossista · Dakar',
    test1_quote: "Da quando uso HabaShop, ho visibilità totale sul mio magazzino. Gli avvisi di esaurimento mi hanno salvato più volte.",
    test2_name: 'Fatou Koné',
    test2_role: 'Alimentari · Abidjan',
    test2_quote: "Il POS è ultrarapido e funziona anche quando manca la connessione. Le mie cassiere sono state formate in 30 minuti.",
    test3_name: 'Ibrahim Touré',
    test3_role: 'Semi-grossista · Bamako',
    test3_quote: "I report di vendita mi aiutano a prendere decisioni d'acquisto migliori. L'interfaccia è chiara e i dati sono sempre aggiornati.",
    pricing_label: 'PREZZI',
    pricing_title: "Prezzi adattati per l'Africa",
    pricing_sub: '14 giorni di prova gratuita — nessuna carta richiesta',
    per_month: '/mese',
    on_estimate: 'Su preventivo',
    most_popular: '⭐ Il più popolare',
    free_start: 'Inizia gratis',
    try_free: 'Prova 14 giorni',
    contact_us: 'Contattaci',
    starter_name: 'Starter',
    starter_sub: 'Per le piccole attività',
    business_name: 'Business',
    business_sub: "Per le attività in crescita",
    enterprise_name: 'Enterprise',
    enterprise_sub: 'Per le reti di negozi',
    feat_pos_1: 'POS (1 cassa)',
    feat_stock_500: 'Gestione magazzino (500 prodotti)',
    feat_reports: 'Report di base',
    feat_support: 'Supporto via email',
    feat_multiuser: 'Multi-utente',
    feat_hr: 'Modulo HR & Turni',
    feat_pos_3: 'POS (3 casse)',
    feat_stock_inf: 'Magazzino illimitato',
    feat_crm: 'CRM completo',
    feat_hr_full: 'HR, Turni, Paghe',
    feat_5users: '5 utenti inclusi',
    feat_priority: 'Supporto prioritario',
    feat_pos_inf: 'Casse illimitate',
    feat_multi_shop: 'Multi-negozio',
    feat_users_inf: 'Utenti illimitati',
    feat_api: 'API dedicata',
    feat_onboarding: 'Onboarding in loco',
    feat_sla: 'SLA garantito 99,9 %',
    faq_label: 'FAQ',
    faq_title: 'Domande frequenti',
    faq1_q: 'HabaShop funziona senza internet?',
    faq1_a: 'Sì! Il POS funziona offline grazie alla tecnologia PWA. Le vendite vengono salvate localmente e sincronizzate automaticamente al ripristino della connessione.',
    faq2_q: "Quanto tempo richiede l'installazione?",
    faq2_a: 'Nessuna installazione richiesta! HabaShop è un software web (SaaS). Ti connetti da qualsiasi browser. La configurazione iniziale richiede meno di 30 minuti.',
    faq3_q: 'I miei dati sono al sicuro?',
    faq3_a: 'Assolutamente. I tuoi dati sono crittografati, ospitati in Europa e sottoposti a backup giornaliero. L\'autenticazione 2FA protegge tutti gli accessi. Conformità GDPR.',
    faq4_q: 'Posso gestire più negozi?',
    faq4_a: 'Sì, con il piano Enterprise puoi gestire una rete di negozi da una dashboard centralizzata. Ogni negozio ha i propri dati isolati.',
    faq5_q: 'Quali valute sono supportate?',
    faq5_a: 'HabaShop supporta Franco CFA (XOF), Euro (EUR), Dollaro US (USD) e Dollaro canadese (CAD). L\'IVA è configurabile per negozio.',
    cta_title: 'Pronto a modernizzare il tuo business?',
    cta_sub: "Unisciti ai commercianti africani che si fidano di HabaShop",
    cta_btn: "🚀 Inizia ora — È gratis",
    cta_note: "Nessuna carta di credito richiesta · 14 giorni di prova gratuita",
    footer: '© 2026 HabaShop · Software SaaS per le attività africane',
    footer_links: ['Privacy', 'Termini', 'Contatto'],
  },
}

const S = {
  lp: '#5B4EE8', lp2: '#7C6FF0', lp3: '#A78BFA',
  lbg: '#f8f7ff', lbg2: '#f0effe', lbg3: '#e8e5fd',
  ltext: '#0f0e1a', ltext2: '#6b6880', ltext3: '#9b98b0',
  lborder: 'rgba(91,78,232,.13)', lborder2: 'rgba(91,78,232,.25)',
  lcard: '#ffffff',
  lshadow: '0 8px 40px rgba(91,78,232,.12)',
  green: '#0EC47E', orange: '#F0A500',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { lang, setLang, currency, setCurrency } = useAppStore()
  const lp = (LANDING_TRANSLATIONS as Record<string, typeof LANDING_TRANSLATIONS.fr>)[lang] ?? LANDING_TRANSLATIONS.fr

  const [showSignupModal, setShowSignupModal] = useState(false)
  const [signupForm, setSignupForm] = useState({
    shopName: '', name: '', email: '',
    password: '', confirm: '', country: 'SN',
    currency: 'XOF' as Currency,
    plan: 'starter' as 'starter' | 'business',
  })
  const [signupStep, setSignupStep] = useState(1)

  const sym = currency === 'XOF' || currency === 'XAF' ? 'FCFA' :
              currency === 'EUR' ? '€' :
              currency === 'USD' ? '$' : 'CA$'
  const symBefore = ['USD', 'CAD'].includes(currency)

  const convertedPrice = (amountInXOF: number): string => {
    const converted = convertAmount(amountInXOF, 'XOF', currency as Currency)
    const isAnglo = ['USD', 'CAD'].includes(currency)
    return new Intl.NumberFormat(isAnglo ? 'en-US' : 'fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(converted)
  }

  const features = [
    { icon: '🛒', title: lp.feature1_title, desc: lp.feature1_desc },
    { icon: '📦', title: lp.feature2_title, desc: lp.feature2_desc },
    { icon: '📊', title: lp.feature3_title, desc: lp.feature3_desc },
    { icon: '👥', title: lp.feature4_title, desc: lp.feature4_desc },
    { icon: '🧑‍💼', title: lp.feature5_title, desc: lp.feature5_desc },
    { icon: '🔐', title: lp.feature6_title, desc: lp.feature6_desc },
  ]

  const steps = [
    { num: '1', title: lp.step1_title, desc: lp.step1_desc },
    { num: '2', title: lp.step2_title, desc: lp.step2_desc },
    { num: '3', title: lp.step3_title, desc: lp.step3_desc },
    { num: '4', title: lp.step4_title, desc: lp.step4_desc },
  ]

  const testimonials = [
    { name: lp.test1_name, role: lp.test1_role, avatar: 'MD', color: '#6C3FD6', quote: lp.test1_quote, stars: 5 },
    { name: lp.test2_name, role: lp.test2_role, avatar: 'FK', color: '#F59E0B', quote: lp.test2_quote, stars: 5 },
    { name: lp.test3_name, role: lp.test3_role, avatar: 'IT', color: '#10B981', quote: lp.test3_quote, stars: 5 },
  ]

  const pricing = [
    {
      name: lp.starter_name, price: '22', currency: '€', period: lp.per_month, fcfa: '14 400 FCFA',
      sub: lp.starter_sub, pop: false,
      features: [
        { ok: true,  text: lp.feat_pos_1 },
        { ok: true,  text: lp.feat_stock_500 },
        { ok: true,  text: lp.feat_reports },
        { ok: true,  text: lp.feat_support },
        { ok: false, text: lp.feat_multiuser },
        { ok: false, text: lp.feat_hr },
      ],
      btn: 'light', btnText: lp.free_start,
    },
    {
      name: lp.business_name, price: '53', currency: '€', period: lp.per_month, fcfa: '34 750 FCFA',
      sub: lp.business_sub, pop: true, tag: lp.most_popular,
      features: [
        { ok: true, text: lp.feat_pos_3 },
        { ok: true, text: lp.feat_stock_inf },
        { ok: true, text: lp.feat_crm },
        { ok: true, text: lp.feat_hr_full },
        { ok: true, text: lp.feat_5users },
        { ok: true, text: lp.feat_priority },
      ],
      btn: 'white', btnText: lp.try_free,
    },
    {
      name: lp.enterprise_name, price: lp.on_estimate, currency: '', period: '', fcfa: '',
      sub: lp.enterprise_sub, pop: false,
      features: [
        { ok: true, text: lp.feat_pos_inf },
        { ok: true, text: lp.feat_multi_shop },
        { ok: true, text: lp.feat_users_inf },
        { ok: true, text: lp.feat_api },
        { ok: true, text: lp.feat_onboarding },
        { ok: true, text: lp.feat_sla },
      ],
      btn: 'outline', btnText: lp.contact_us,
    },
  ]

  const faqs = [
    { q: lp.faq1_q, a: lp.faq1_a },
    { q: lp.faq2_q, a: lp.faq2_a },
    { q: lp.faq3_q, a: lp.faq3_a },
    { q: lp.faq4_q, a: lp.faq4_a },
    { q: lp.faq5_q, a: lp.faq5_a },
  ]

  const stats = [
    { v: '16',    l: lp.stat1_l },
    { v: '100 %', l: lp.stat2_l },
    { v: '4+',    l: lp.stat3_l },
    { v: '5+',    l: lp.stat4_l },
  ]

  return (
    <div style={{ background: S.lbg, color: S.ltext, fontFamily: "'Outfit', sans-serif", minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', padding: '0 32px', height: 68,
        background: 'rgba(248,247,255,.88)', backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${S.lborder}`,
        position: 'sticky', top: 0, zIndex: 100, gap: 10, flexWrap: 'nowrap',
        boxShadow: `0 1px 0 ${S.lborder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: `linear-gradient(135deg,${S.lp},${S.lp2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, fontWeight: 900, color: '#fff',
            boxShadow: '0 4px 18px rgba(91,78,232,.38)',
          }}>H</div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.5px', color: S.ltext, whiteSpace: 'nowrap' }}>
            Haba<span style={{ color: S.lp }}>Shop</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>
          {[
            { label: lp.nav_features, target: 'section-features' },
            { label: lp.nav_pricing,  target: 'section-pricing'  },
            { label: lp.nav_faq,      target: 'section-faq'      },
          ].map(item => (
            <a key={item.target}
              onClick={e => {
                e.preventDefault()
                document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              style={{
                color: S.ltext2, fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
                padding: '7px 14px', borderRadius: 9, cursor: 'pointer', transition: 'all .18s',
                display: 'block', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = S.lbg2; (e.currentTarget as HTMLElement).style.color = S.ltext; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = S.ltext2; }}
            >{item.label}</a>
          ))}
        </div>

        {/* separator */}
        <div style={{ width: 1, height: 28, background: 'rgba(91,78,232,.15)', flexShrink: 0 }} />

        {/* Language dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select
            value={lang}
            onChange={e => setLang(e.target.value as Lang)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              background: '#fff',
              border: '1.5px solid rgba(91,78,232,.2)',
              borderRadius: 10, padding: '7px 34px 7px 12px',
              fontSize: 13, fontWeight: 700,
              color: '#5B4EE8', cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(91,78,232,.1)',
              outline: 'none',
            }}
          >
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Español</option>
            <option value="it">🇮🇹 Italiano</option>
          </select>
          <div style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none', fontSize: 10, color: '#5B4EE8',
          }}>▼</div>
        </div>

        {/* Currency dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value as Currency)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              background: '#fff',
              border: '1.5px solid rgba(91,78,232,.2)',
              borderRadius: 10, padding: '7px 34px 7px 12px',
              fontSize: 13, fontWeight: 700,
              color: '#5B4EE8', cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(91,78,232,.1)',
              outline: 'none',
            }}
          >
            <option value="XOF">🌍 FCFA (XOF)</option>
            <option value="XAF">🌍 FCFA (XAF)</option>
            <option value="EUR">🇪🇺 Euro (EUR)</option>
            <option value="USD">🇺🇸 Dollar (USD)</option>
            <option value="CAD">🇨🇦 CA Dollar (CAD)</option>
          </select>
          <div style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none', fontSize: 10, color: '#5B4EE8',
          }}>▼</div>
        </div>

        <button
          onClick={() => navigate('/login')}
          style={{
            background: `linear-gradient(135deg,${S.lp},${S.lp2})`,
            color: '#fff', borderRadius: 10, padding: '8px 20px', fontWeight: 700,
            boxShadow: '0 4px 18px rgba(91,78,232,.35)', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, transition: 'all .2s',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 26px rgba(91,78,232,.45)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(91,78,232,.35)'; }}
        >{lp.nav_login}</button>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        padding: '100px 24px 80px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(180deg,${S.lbg2} 0%,${S.lbg} 60%)`,
      }}>
        <div style={{
          position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
          width: 900, height: 900, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle,rgba(91,78,232,.12) 0%,transparent 70%)',
        }} />
        <h1 style={{
          fontSize: 'clamp(36px,5.8vw,76px)', fontWeight: 900, lineHeight: 1.04,
          maxWidth: 900, marginBottom: 22, letterSpacing: '-3px', color: S.ltext,
        }}>
          {lp.h1a}{' '}
          <span style={{
            background: `linear-gradient(135deg,${S.lp} 0%,${S.lp3} 50%,${S.orange} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>{lp.h1b}</span>
        </h1>

        <p style={{ color: S.ltext2, fontSize: 18, maxWidth: 580, lineHeight: 1.7, marginBottom: 40 }}>
          {lp.hero_sub}
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 72 }}>
          <button onClick={() => { setSignupForm(f => ({...f, plan:'starter'})); setShowSignupModal(true) }} style={{
            background: `linear-gradient(135deg,${S.lp},${S.lp2})`, color: '#fff', border: 'none',
            borderRadius: 13, padding: '15px 36px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 10px 32px rgba(91,78,232,.4)', transition: 'all .22s', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 48px rgba(91,78,232,.48)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 32px rgba(91,78,232,.4)'; }}
          >
            {lp.cta1}
          </button>
          <button onClick={() => navigate('/login')} style={{
            background: '#fff', color: S.ltext, border: `1.5px solid ${S.lborder2}`,
            borderRadius: 13, padding: '15px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            transition: 'all .22s', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {lp.cta2}
          </button>
        </div>

        {/* Hero mock */}
        <div style={{
          maxWidth: 960, width: '95%', margin: '0 auto',
          background: '#fff', border: `1px solid ${S.lborder}`,
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 60px 150px rgba(91,78,232,.22), 0 0 0 1px rgba(91,78,232,.08)',
          transform: 'perspective(1200px) rotateX(2deg)',
          transition: 'transform .4s ease', position: 'relative', zIndex: 1,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'perspective(1200px) rotateX(0deg)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'perspective(1200px) rotateX(2deg)'; }}
        >
          <div style={{ background: S.lbg2, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: `1px solid ${S.lborder}` }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
            <span style={{ color: S.ltext2, fontSize: 10.5, marginLeft: 8, fontFamily: 'SF Mono,monospace' }}>app.habashop.com/dashboard</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '168px 1fr', height: 240 }}>
            <div style={{ background: 'linear-gradient(180deg,#f4f2ff,#edeaff)', borderRight: `1px solid ${S.lborder}`, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {['🏠 Dashboard','🛒 POS','📦 Stock','🚚 Fournisseurs','👥 Clients','📊 Rapports'].map((item, i) => (
                <div key={item} style={{
                  padding: '7px 10px', borderRadius: 7, fontSize: 10.5,
                  color: i === 0 ? '#fff' : S.ltext2,
                  background: i === 0 ? S.lp : 'transparent',
                  fontWeight: i === 0 ? 700 : 400,
                  boxShadow: i === 0 ? '0 3px 10px rgba(91,78,232,.3)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>{item}</div>
              ))}
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { l: 'Ventes du jour', v: '842 000 F' },
                  { l: 'Articles stock', v: '3 248' },
                  { l: 'Employés actifs', v: '18/21' },
                  { l: 'CA mensuel', v: '2,65M F' },
                ].map(k => (
                  <div key={k.l} style={{ background: 'linear-gradient(135deg,#f8f7ff,#f0effe)', border: `1px solid ${S.lborder}`, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 8, color: S.ltext2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, letterSpacing: .5 }}>{k.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S.ltext }}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {[55,72,45,83,97,100,88].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0', minHeight: 4,
                    background: i === 6
                      ? 'linear-gradient(to top,#F0A500,#FCD34D)'
                      : `linear-gradient(to top,${S.lp},${S.lp3})`,
                    opacity: i === 6 ? 1 : 0.7,
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div style={{ display: 'flex', justifyContent: 'center', background: `linear-gradient(135deg,${S.lp},${S.lp2})` }}>
        {stats.map((s, i) => (
          <div key={s.l} style={{
            flex: 1, maxWidth: 220, padding: '40px 24px', textAlign: 'center',
            borderRight: i < 3 ? '1px solid rgba(255,255,255,.15)' : 'none',
          }}>
            <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, color: '#fff', marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>{s.v}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', fontWeight: 500 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section id="section-features" style={{ padding: '96px 24px', background: S.lbg }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>{lp.features_label}</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>{lp.features_title}</h2>
          <p style={{ color: S.ltext2, fontSize: 16, maxWidth: 540, margin: '0 auto' }}>{lp.features_sub}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 1060, margin: '0 auto' }}>
          {features.map(f => (
            <div key={f.title}
              style={{ background: '#fff', border: `1px solid ${S.lborder}`, borderRadius: 18, padding: 28, transition: 'all .25s', cursor: 'default', boxShadow: '0 2px 12px rgba(91,78,232,.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = S.lborder2; (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(91,78,232,.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = S.lborder; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(91,78,232,.05)'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,rgba(91,78,232,.12),rgba(124,111,240,.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16, border: `1px solid ${S.lborder2}` }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: S.ltext }}>{f.title}</div>
              <div style={{ color: S.ltext2, fontSize: 13.5, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '96px 24px', background: S.lbg2, borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>{lp.how_label}</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>{lp.how_title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, maxWidth: 1060, margin: '0 auto' }}>
          {steps.map(s => (
            <div key={s.num} style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 18px', background: `linear-gradient(135deg,${S.lp},${S.lp2})`, color: '#fff', fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(91,78,232,.3)' }}>{s.num}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.ltext, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: S.ltext2, lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: '96px 24px', background: '#fff', borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>{lp.testimonials_label}</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>{lp.testimonials_title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 1060, margin: '0 auto' }}>
          {testimonials.map(t => (
            <div key={t.name} style={{ background: S.lbg, border: `1px solid ${S.lborder}`, borderRadius: 18, padding: 26 }}>
              <div style={{ color: S.orange, fontSize: 13, marginBottom: 12 }}>{'★'.repeat(t.stars)}</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: S.ltext, marginBottom: 16, fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{t.avatar}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.ltext }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: S.ltext2 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="section-pricing" style={{ padding: '96px 24px', background: `linear-gradient(180deg,${S.lbg},${S.lbg2})`, borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>{lp.pricing_label}</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>{lp.pricing_title}</h2>
          <p style={{ color: S.ltext2, fontSize: 16 }}>{lp.pricing_sub}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 980, margin: '0 auto' }}>
          {pricing.map(p => (
            <div key={p.name}
              style={{
                background: p.pop ? `linear-gradient(135deg,${S.lp},${S.lp2})` : '#fff',
                border: `1.5px solid ${p.pop ? 'transparent' : S.lborder}`,
                borderRadius: 22, padding: 32, transition: 'all .25s', position: 'relative',
                boxShadow: p.pop ? '0 20px 60px rgba(91,78,232,.38)' : '0 2px 16px rgba(91,78,232,.06)',
              }}
              onMouseEnter={e => { if (!p.pop) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 70px rgba(91,78,232,.14)'; } }}
              onMouseLeave={e => { if (!p.pop) { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(91,78,232,.06)'; } }}
            >
              {p.tag && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#fff', color: S.lp, fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap', border: `1.5px solid ${S.lborder2}`, boxShadow: '0 2px 8px rgba(91,78,232,.15)' }}>{p.tag}</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: p.pop ? 'rgba(255,255,255,.75)' : S.ltext2, marginBottom: 12 }}>{p.name}</div>
              <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -3, lineHeight: 1, color: p.pop ? '#fff' : S.ltext }}>
                {p.price !== lp.on_estimate ? (
                  <>
                    {symBefore && (
                      <span style={{ fontSize: 20, fontWeight: 600, opacity: .7 }}>{sym}{' '}</span>
                    )}
                    {p.name === 'Starter' ? convertedPrice(14410) : p.name === 'Business' ? convertedPrice(34750) : ''}
                    {!symBefore && (
                      <span style={{ fontSize: 18, fontWeight: 600, opacity: .65 }}>{' '}{sym}{p.period}</span>
                    )}
                    {symBefore && p.period && (
                      <span style={{ fontSize: 18, fontWeight: 600, opacity: .65 }}>{p.period}</span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 28 }}>{lp.on_estimate}</span>
                )}
              </div>
              {p.price !== lp.on_estimate && (
                <div style={{ fontSize: 11, color: p.pop ? 'rgba(255,255,255,.6)' : S.ltext3, marginTop: 4, marginBottom: 12 }}>
                  {currency !== 'XOF' && `≈ ${p.name === 'Starter' ? '14 410' : '34 750'} FCFA / ${lang === 'fr' ? 'mois' : lang === 'en' ? 'month' : lang === 'es' ? 'mes' : 'mese'}`}
                </div>
              )}
              <div style={{ fontSize: 13, color: p.pop ? 'rgba(255,255,255,.65)' : S.ltext2, marginBottom: 24 }}>{p.sub}</div>
              <div style={{ height: 1, background: 'currentColor', opacity: .1, marginBottom: 20 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {p.features.map(f => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: p.pop ? 'rgba(255,255,255,.9)' : (f.ok ? S.ltext : S.ltext3) }}>
                    <span style={{ fontSize: 14, color: p.pop ? '#fff' : (f.ok ? S.lp : S.ltext3) }}>{f.ok ? '✓' : '✗'}</span>
                    {f.text}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  if (p.name === 'Starter') { setSignupForm(f => ({...f, plan:'starter'})); setShowSignupModal(true) }
                  else if (p.name === 'Business') { setSignupForm(f => ({...f, plan:'business'})); setShowSignupModal(true) }
                  else navigate('/login')
                }}
                style={{
                  width: '100%', border: p.btn === 'outline' ? `1.5px solid ${S.lborder2}` : 'none',
                  borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
                  background: p.btn === 'light' ? `linear-gradient(135deg,${S.lp},${S.lp2})` : p.btn === 'white' ? '#fff' : 'transparent',
                  color: p.btn === 'light' ? '#fff' : p.btn === 'white' ? S.lp : S.lp,
                  boxShadow: p.btn === 'light' ? '0 6px 20px rgba(91,78,232,.3)' : p.btn === 'white' ? '0 4px 16px rgba(0,0,0,.12)' : 'none',
                }}
              >{p.btnText}</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="section-faq" style={{ padding: '96px 24px', background: '#fff', borderTop: `1px solid ${S.lborder}` }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: 'rgba(91,78,232,.1)', border: `1px solid rgba(91,78,232,.2)`, color: S.lp, fontSize: 11, fontWeight: 700, padding: '5px 15px', borderRadius: 100, letterSpacing: .8 }}>{lp.faq_label}</span>
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,44px)', fontWeight: 900, margin: '12px 0', letterSpacing: -2, color: S.ltext }}>{lp.faq_title}</h2>
        </div>
        <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faqs.map((f, i) => (
            <details key={i} style={{ background: S.lbg, border: `1px solid ${S.lborder}`, borderRadius: 14, overflow: 'hidden' }}>
              <summary style={{ padding: '18px 22px', fontSize: 14.5, fontWeight: 700, color: S.ltext, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', listStyle: 'none' }}>
                {f.q} <span style={{ fontSize: 18, color: S.lp, flexShrink: 0 }}>+</span>
              </summary>
              <div style={{ padding: '0 22px 18px', fontSize: 14, color: S.ltext2, lineHeight: 1.75 }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: '100px 24px', textAlign: 'center',
        background: `linear-gradient(135deg,${S.lp},${S.lp2} 60%,${S.lp3})`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='1.5' fill='%23ffffff' fill-opacity='0.07'/%3E%3C/svg%3E\")" }} />
        <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 900, letterSpacing: -2, color: '#fff', marginBottom: 16, position: 'relative' }}>
          {lp.cta_title}
        </h2>
        <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 17, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px', position: 'relative' }}>
          {lp.cta_sub}
        </p>
        <button onClick={() => { setSignupForm(f => ({...f, plan:'starter'})); setShowSignupModal(true) }} style={{
          background: '#fff', color: S.lp, border: 'none', borderRadius: 13,
          padding: '15px 40px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 12px 36px rgba(0,0,0,.2)', position: 'relative', fontFamily: 'inherit',
          transition: 'all .22s', display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 50px rgba(0,0,0,.28)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 36px rgba(0,0,0,.2)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
        >
          {lp.cta_btn}
        </button>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 14, position: 'relative' }}>
          {lp.cta_note}
        </div>
      </section>

      {/* ── SIGNUP MODAL ── */}
      {showSignupModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 20,
        }}
          onClick={e => e.target === e.currentTarget && setShowSignupModal(false)}
        >
          <div style={{
            background: '#fff', borderRadius: 20,
            padding: '36px 40px', width: '100%',
            maxWidth: 480, position: 'relative',
            boxShadow: '0 40px 100px rgba(0,0,0,.25)',
          }}>
            <button onClick={() => setShowSignupModal(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: '#f0effe', border: 'none',
                borderRadius: '50%', width: 32, height: 32,
                cursor: 'pointer', fontSize: 16, color: '#5B4EE8',
              }}>✕</button>

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg,#5B4EE8,#7C6FF0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 900, color: '#fff',
                margin: '0 auto 12px',
                boxShadow: '0 8px 24px rgba(91,78,232,.35)',
              }}>H</div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1a1a2e', marginBottom: 4 }}>
                {signupStep === 1 ? 'Créer votre compte' : 'Votre boutique'}
              </h2>
              <p style={{ fontSize: 13, color: '#888' }}>
                {signupStep === 1
                  ? 'Plan ' + (signupForm.plan === 'business' ? 'Business' : 'Starter') + ' · 14 jours gratuits'
                  : 'Configurez votre espace commercial'}
              </p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14 }}>
                {[1, 2].map(step => (
                  <div key={step} style={{
                    height: 4, width: 40, borderRadius: 99,
                    background: step <= signupStep ? '#5B4EE8' : '#e5e7eb',
                    transition: 'background .3s',
                  }} />
                ))}
              </div>
            </div>

            {signupStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Nom complet *', key: 'name', type: 'text', placeholder: 'Prénom Nom' },
                  { label: 'Email *', key: 'email', type: 'email', placeholder: 'vous@email.com' },
                  { label: 'Mot de passe *', key: 'password', type: 'password', placeholder: 'Min. 8 caractères' },
                  { label: 'Confirmer le mot de passe *', key: 'confirm', type: 'password', placeholder: 'Répétez le mot de passe' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      style={{
                        width: '100%', padding: '11px 14px',
                        border: '1.5px solid #e5e7eb', borderRadius: 10,
                        fontSize: 14, fontFamily: 'inherit', outline: 'none',
                        transition: 'border-color .15s', boxSizing: 'border-box',
                      }}
                      placeholder={f.placeholder}
                      value={(signupForm as Record<string, string>)[f.key]}
                      onChange={e => setSignupForm(form => ({ ...form, [f.key]: e.target.value }))}
                      onFocus={e => (e.target as HTMLElement).style.borderColor = '#5B4EE8'}
                      onBlur={e => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    if (!signupForm.name || !signupForm.email || !signupForm.password) {
                      alert('Veuillez remplir tous les champs')
                      return
                    }
                    if (signupForm.password !== signupForm.confirm) {
                      alert('Les mots de passe ne correspondent pas')
                      return
                    }
                    if (signupForm.password.length < 8) {
                      alert('Le mot de passe doit contenir au moins 8 caractères')
                      return
                    }
                    setSignupStep(2)
                  }}
                  style={{
                    width: '100%', padding: '13px',
                    background: 'linear-gradient(135deg,#5B4EE8,#7C6FF0)',
                    border: 'none', borderRadius: 12,
                    fontSize: 15, fontWeight: 800, color: '#fff',
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 6px 20px rgba(91,78,232,.38)',
                    marginTop: 4,
                  }}
                >Continuer →</button>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#888', margin: 0 }}>
                  Déjà un compte ?{' '}
                  <span
                    onClick={() => { setShowSignupModal(false); navigate('/login') }}
                    style={{ color: '#5B4EE8', fontWeight: 700, cursor: 'pointer' }}
                  >Se connecter</span>
                </p>
              </div>
            )}

            {signupStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                    Nom de votre boutique *
                  </label>
                  <input
                    style={{
                      width: '100%', padding: '11px 14px',
                      border: '1.5px solid #e5e7eb', borderRadius: 10,
                      fontSize: 14, fontFamily: 'inherit', outline: 'none',
                      transition: 'border-color .15s', boxSizing: 'border-box',
                    }}
                    placeholder="Ex: Supermarché Central"
                    value={signupForm.shopName}
                    onChange={e => setSignupForm(f => ({ ...f, shopName: e.target.value }))}
                    onFocus={e => (e.target as HTMLElement).style.borderColor = '#5B4EE8'}
                    onBlur={e => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                    Pays
                  </label>
                  <select
                    value={signupForm.country}
                    onChange={e => setSignupForm(f => ({ ...f, country: e.target.value }))}
                    style={{
                      width: '100%', padding: '11px 14px',
                      border: '1.5px solid #e5e7eb', borderRadius: 10,
                      fontSize: 14, fontFamily: 'inherit', outline: 'none',
                      background: '#fff', cursor: 'pointer', boxSizing: 'border-box',
                    }}
                  >
                    <option value="SN">🇸🇳 Sénégal</option>
                    <option value="CI">🇨🇮 Côte d'Ivoire</option>
                    <option value="ML">🇲🇱 Mali</option>
                    <option value="BF">🇧🇫 Burkina Faso</option>
                    <option value="CM">🇨🇲 Cameroun</option>
                    <option value="CG">🇨🇬 Congo</option>
                    <option value="CD">🇨🇩 RD Congo</option>
                    <option value="GA">🇬🇦 Gabon</option>
                    <option value="NE">🇳🇪 Niger</option>
                    <option value="TG">🇹🇬 Togo</option>
                    <option value="BJ">🇧🇯 Bénin</option>
                    <option value="GN">🇬🇳 Guinée</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="BE">🇧🇪 Belgique</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="US">🇺🇸 États-Unis</option>
                    <option value="OTHER">🌍 Autre</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                    Devise principale
                  </label>
                  <select
                    value={signupForm.currency}
                    onChange={e => setSignupForm(f => ({ ...f, currency: e.target.value as Currency }))}
                    style={{
                      width: '100%', padding: '11px 14px',
                      border: '1.5px solid #e5e7eb', borderRadius: 10,
                      fontSize: 14, fontFamily: 'inherit', outline: 'none',
                      background: '#fff', cursor: 'pointer', boxSizing: 'border-box',
                    }}
                  >
                    <option value="XOF">🌍 Franc CFA BCEAO (XOF)</option>
                    <option value="XAF">🌍 Franc CFA BEAC (XAF)</option>
                    <option value="EUR">🇪🇺 Euro (EUR)</option>
                    <option value="USD">🇺🇸 Dollar US (USD)</option>
                    <option value="CAD">🇨🇦 Dollar Canadien (CAD)</option>
                  </select>
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(91,78,232,.06)',
                  border: '1px solid rgba(91,78,232,.2)',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>
                      Plan {signupForm.plan === 'business' ? 'Business' : 'Starter'}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      14 jours gratuits · Sans carte bancaire
                    </div>
                  </div>
                  <button
                    onClick={() => setSignupForm(f => ({ ...f, plan: f.plan === 'business' ? 'starter' : 'business' }))}
                    style={{
                      fontSize: 11, color: '#5B4EE8', background: 'none',
                      border: 'none', cursor: 'pointer', fontWeight: 700,
                      fontFamily: 'inherit',
                    }}
                  >Changer</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setSignupStep(1)}
                    style={{
                      padding: '12px 20px',
                      background: '#f0effe',
                      border: 'none', borderRadius: 12,
                      fontSize: 14, fontWeight: 700,
                      color: '#5B4EE8', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >← Retour</button>
                  <button
                    onClick={() => {
                      if (!signupForm.shopName) {
                        alert('Nom de boutique requis')
                        return
                      }
                      setCurrency(signupForm.currency)
                      setShowSignupModal(false)
                      setSignupStep(1)
                      navigate('/login')
                    }}
                    style={{
                      flex: 1, padding: '12px',
                      background: 'linear-gradient(135deg,#5B4EE8,#7C6FF0)',
                      border: 'none', borderRadius: 12,
                      fontSize: 14, fontWeight: 800, color: '#fff',
                      cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 6px 20px rgba(91,78,232,.38)',
                    }}
                  >🚀 Créer mon compte gratuitement</button>
                </div>
                <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', margin: 0 }}>
                  En créant un compte vous acceptez nos{' '}
                  <span style={{ color: '#5B4EE8', cursor: 'pointer' }}>CGU</span>
                  {' '}et notre{' '}
                  <span style={{ color: '#5B4EE8', cursor: 'pointer' }}>politique de confidentialité</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0f0e1a', color: 'rgba(255,255,255,.45)', padding: '36px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.7)', fontWeight: 700 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${S.lp},${S.lp2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 14 }}>H</div>
          HabaShop
        </div>
        <span>{lp.footer}</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {lp.footer_links.map(label => (
            <a key={label} style={{ color: 'rgba(255,255,255,.45)', textDecoration: 'none', cursor: 'pointer', transition: 'color .15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,.8)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,.45)'; }}
            >{label}</a>
          ))}
        </div>
      </footer>
    </div>
  )
}
