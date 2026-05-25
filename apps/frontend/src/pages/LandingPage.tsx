import { useNavigate } from 'react-router-dom'
import { useAppStore, convertAmount } from '@/stores/appStore'
import type { Lang, Currency } from '@/stores/appStore'
import {
  ShoppingCart, Package, BarChart2, Users, Briefcase, Lock,
  Sparkles, Globe, Check, Star, Zap, Shield, ArrowRight, Play,
} from 'lucide-react'

// ─── TRADUCTIONS LANDING ──────────────────────────────────────────────────────

const LANDING_TRANSLATIONS = {
  fr: {
    nav: ['Fonctionnalités', 'Tarifs', 'FAQ'],
    nav_features: 'Fonctionnalités',
    nav_pricing: 'Tarifs',
    nav_faq: 'FAQ',
    nav_login: 'Connexion',
    badge: "N°1 en Afrique francophone · Sénégal · Côte d'Ivoire · Mali · Burkina",
    h1a: 'Gérez votre boutique en Afrique',
    h1b: 'Caisse, stock, clients & RH en un seul logiciel',
    hero_sub: "HabaShop est le logiciel de gestion commerciale tout-en-un pour les boutiques et superettes d'Afrique : caisse (POS), gestion de stock, clients, RH et analytics — rapide et disponible même sans internet.",
    cta1: 'Démarrer gratuitement',
    cta2: 'Voir la démo',
    stat1_l: 'Modules intégrés',
    stat2_l: 'Offline-ready',
    stat3_l: 'Devises supportées',
    stat4_l: 'Pays cibles',
    features_label: 'FONCTIONNALITÉS',
    features_title: 'Tout ce dont vous avez besoin',
    features_sub: '16 modules intégrés pour gérer chaque aspect de votre commerce',
    feature1_title: 'Caisse Enregistreuse (POS)',
    feature1_desc: 'Encaissement rapide, catalogue filtrable, multi-modes de paiement, ticket imprimé ou WhatsApp, mode offline.',
    feature2_title: 'Gestion de Stock Temps Réel',
    feature2_desc: 'Alertes rupture en temps réel, CRUD produits, bon de commande automatique depuis la fiche produit.',
    feature3_title: 'Rapports & Analyses',
    feature3_desc: 'KPIs par période, CA, marges, top produits, répartition paiements. Exports CSV et PDF en un clic.',
    feature4_title: 'Gestion Clients & Fidélité',
    feature4_desc: "Fiches clients, types (gros/semi-gros/fidèle), programme de fidélité et historique d'achats complet.",
    feature5_title: 'Ressources Humaines & Paie',
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
    pricing_title: "Des prix en Franc CFA, accessibles partout en Afrique",
    pricing_sub: "14 jours d'essai gratuit — payez par Wave, Orange Money ou MTN. Aucune carte requise.",
    per_month: '/mois',
    on_estimate: 'Sur devis',
    most_popular: 'Le plus populaire',
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
    faq2_q: "Quels modes de paiement sont acceptés pour s'abonner ?",
    faq2_a: "HabaShop accepte Wave, Orange Money, MTN Money, virement bancaire et carte bancaire. Aucune carte internationale n'est requise.",
    faq3_q: 'Combien coûte HabaShop ?',
    faq3_a: "HabaShop propose un essai gratuit de 14 jours. Le plan Starter coûte 9 900 F CFA/mois, le plan Pro 24 900 F CFA/mois et le plan Enterprise 49 900 F CFA/mois.",
    faq4_q: "HabaShop est-il disponible en Côte d'Ivoire, au Mali et au Burkina Faso ?",
    faq4_a: "Oui, HabaShop est disponible dans toute l'Afrique francophone : Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Guinée, Cameroun, Congo, Gabon, Togo, Bénin et plus de 150 pays.",
    faq5_q: 'Puis-je importer mes produits existants dans HabaShop ?',
    faq5_a: "Oui, HabaShop permet l'import de produits via fichier CSV ou Excel. L'équipe support peut vous accompagner dans la migration depuis votre ancien système.",
    cta_title: 'Prêt à moderniser votre commerce ?',
    cta_sub: "Rejoignez les commerçants d'Afrique qui font confiance à HabaShop",
    cta_btn: "Commencer maintenant — C'est gratuit",
    cta_note: "Aucune carte bancaire requise · 14 jours d'essai gratuit",
    footer: '© 2026 HabaShop · Logiciel SaaS pour commerces africains',
    footer_links: ['Confidentialité', 'CGU', 'Contact'],
    trust_title: "Déjà actifs au Sénégal, en Côte d'Ivoire, au Mali et 8+ pays africains",
    cur_title: 'Multi-devises & Multi-langues',
    cur_sub: 'Adapté à votre marché, dans votre langue',
    proof_stores: 'boutiques actives (Sénégal, CI, Mali)',
    proof_countries: '150+ pays',
  },
  en: {
    nav: ['Features', 'Pricing', 'FAQ'],
    nav_features: 'Features',
    nav_pricing: 'Pricing',
    nav_faq: 'FAQ',
    nav_login: 'Sign in',
    badge: 'Built for francophone Africa',
    h1a: 'Manage your business',
    h1b: 'simply and efficiently',
    hero_sub: 'HabaShop centralizes your POS, inventory, team and finances in one tool — simple, fast, and available even without internet.',
    cta1: 'Start for free',
    cta2: 'View demo',
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
    most_popular: 'Most popular',
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
    faq2_q: 'Which payment methods are accepted to subscribe?',
    faq2_a: 'HabaShop accepts Wave, Orange Money, MTN Money, bank transfer and credit card. No international card required.',
    faq3_q: 'How much does HabaShop cost?',
    faq3_a: 'HabaShop offers a 14-day free trial. The Starter plan is 9,900 F CFA/month, Pro is 24,900 F CFA/month and Enterprise is 49,900 F CFA/month.',
    faq4_q: "Is HabaShop available in Côte d'Ivoire, Mali and Burkina Faso?",
    faq4_a: "Yes, HabaShop is available across French-speaking Africa: Senegal, Côte d'Ivoire, Mali, Burkina Faso, Guinea, Cameroon, Congo, Gabon, Togo, Benin and 150+ countries.",
    faq5_q: 'Can I import my existing products into HabaShop?',
    faq5_a: 'Yes, HabaShop lets you import products via CSV or Excel file. The support team can help you migrate from your previous system.',
    cta_title: 'Ready to modernize your business?',
    cta_sub: 'Join African merchants who trust HabaShop',
    cta_btn: "Start now — It's free",
    cta_note: 'No credit card required · 14-day free trial',
    footer: '© 2026 HabaShop · SaaS software for African businesses',
    footer_links: ['Privacy', 'Terms', 'Contact'],
    trust_title: 'Already active in 8+ African countries',
    cur_title: 'Multi-currency & Multi-language',
    cur_sub: 'Tailored to your market, in your language',
    proof_stores: 'active stores',
    proof_countries: '150+ countries',
  },
  es: {
    nav: ['Funciones', 'Precios', 'FAQ'],
    nav_features: 'Funciones',
    nav_pricing: 'Precios',
    nav_faq: 'FAQ',
    nav_login: 'Iniciar sesión',
    badge: 'Diseñado para el África francófona',
    h1a: 'Gestiona tu negocio',
    h1b: 'de forma simple y eficiente',
    hero_sub: 'HabaShop centraliza tu caja, inventario, equipo y finanzas en una sola herramienta — simple, rápida y disponible incluso sin internet.',
    cta1: 'Empezar gratis',
    cta2: 'Ver demo',
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
    most_popular: 'El más popular',
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
    faq5_a: 'HabaShop admite 6 divisas: Franco CFA de África Occidental (XOF), Franco CFA de África Central (XAF), Euro (EUR), Dólar US (USD), Dólar canadiense (CAD) y Libra Esterlina (GBP). La conversión es automática y el IVA es configurable por tienda.',
    cta_title: '¿Listo para modernizar tu negocio?',
    cta_sub: 'Únete a los comerciantes africanos que confían en HabaShop',
    cta_btn: 'Empezar ahora — Es gratis',
    cta_note: 'Sin tarjeta de crédito · 14 días de prueba gratuita',
    footer: '© 2026 HabaShop · Software SaaS para comercios africanos',
    footer_links: ['Privacidad', 'Términos', 'Contacto'],
    trust_title: 'Ya activos en 8+ países africanos',
    cur_title: 'Multi-divisa y Multi-idioma',
    cur_sub: 'Adaptado a tu mercado, en tu idioma',
    proof_stores: 'tiendas activas',
    proof_countries: '150+ países',
  },
  it: {
    nav: ['Funzioni', 'Prezzi', 'FAQ'],
    nav_features: 'Funzioni',
    nav_pricing: 'Prezzi',
    nav_faq: 'FAQ',
    nav_login: 'Accedi',
    badge: "Progettato per l'Africa francofona",
    h1a: 'Gestisci il tuo business',
    h1b: 'in modo semplice ed efficiente',
    hero_sub: 'HabaShop centralizza il tuo POS, magazzino, team e finanze in un unico strumento — semplice, veloce e disponibile anche senza internet.',
    cta1: 'Inizia gratis',
    cta2: 'Guarda la demo',
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
    most_popular: 'Il più popolare',
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
    faq3_a: "Assolutamente. I tuoi dati sono crittografati, ospitati in Europa e sottoposti a backup giornaliero. L'autenticazione 2FA protegge tutti gli accessi. Conformità GDPR.",
    faq4_q: 'Posso gestire più negozi?',
    faq4_a: 'Sì, con il piano Enterprise puoi gestire una rete di negozi da una dashboard centralizzata. Ogni negozio ha i propri dati isolati.',
    faq5_q: 'Quali valute sono supportate?',
    faq5_a: "HabaShop supporta 6 valute: Franco CFA dell'Africa Occidentale (XOF), Franco CFA dell'Africa Centrale (XAF), Euro (EUR), Dollaro US (USD), Dollaro canadese (CAD) e Sterlina britannica (GBP). La conversione è automatica e l'IVA è configurabile per negozio.",
    cta_title: 'Pronto a modernizzare il tuo business?',
    cta_sub: "Unisciti ai commercianti africani che si fidano di HabaShop",
    cta_btn: "Inizia ora — È gratis",
    cta_note: "Nessuna carta di credito richiesta · 14 giorni di prova gratuita",
    footer: '© 2026 HabaShop · Software SaaS per le attività africane',
    footer_links: ['Privacy', 'Termini', 'Contatto'],
    trust_title: 'Già attivi in 8+ paesi africani',
    cur_title: 'Multi-valuta & Multi-lingua',
    cur_sub: 'Adattato al tuo mercato, nella tua lingua',
    proof_stores: 'negozi attivi',
    proof_countries: '150+ paesi',
  },
}

// ─── DARK PALETTE ─────────────────────────────────────────────────────────────

const D = {
  bg:      '#07070F',
  bg2:     '#0D0D1C',
  bg3:     '#111128',
  bg4:     '#161636',
  p:       '#6C47FF',
  p2:      '#8B6FFF',
  p3:      '#A991FF',
  text:    '#F0F0FF',
  text2:   'rgba(240,240,255,.66)',
  text3:   'rgba(240,240,255,.65)',
  text4:   'rgba(240,240,255,.55)',
  border:  'rgba(255,255,255,.08)',
  border2: 'rgba(255,255,255,.15)',
  acc:     '#00D084',
  acc2:    '#00B8FF',
  acc3:    '#FF9500',
  acc4:    '#FF3B5C',
}

const FONT = "'Outfit', system-ui, -apple-system, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { lang, setLang, currency, setCurrency } = useAppStore()
  const lp = (LANDING_TRANSLATIONS as Record<string, typeof LANDING_TRANSLATIONS.fr>)[lang] ?? LANDING_TRANSLATIONS.fr

  const formatPlanPrice = (amountXOF: number): string => {
    const converted = convertAmount(amountXOF, 'XOF', currency as Currency)
    const rounded = Math.round(converted)
    if (currency === 'XOF' || currency === 'XAF') return new Intl.NumberFormat('fr-FR').format(rounded) + ' FCFA'
    if (currency === 'EUR') return new Intl.NumberFormat('fr-FR').format(rounded) + ' €'
    if (currency === 'USD') return '$ ' + new Intl.NumberFormat('en-US').format(rounded)
    if (currency === 'CAD') return 'CA$ ' + new Intl.NumberFormat('en-US').format(rounded)
    if (currency === 'GBP') return '£' + new Intl.NumberFormat('en-GB').format(rounded)
    return rounded.toString()
  }

  const itemsFR: Record<number, string[]> = {
    1: ['Modes paiement multiples', 'Ticket WhatsApp', 'Mode offline'],
    2: ['Alertes rupture auto', 'Scan codes-barres', 'Multi-entrepôts'],
    3: ['KPIs temps réel', 'Exports CSV / PDF', 'Top produits'],
    4: ['Points de fidélité', 'Historique achats', 'Segments clients'],
    5: ['Planning semaine', 'Bulletins PDF', 'Suivi présences'],
    6: ['Rôles & permissions', 'Auth 2FA TOTP', "Journal d'audit"],
  }
  const itemsEN: Record<number, string[]> = {
    1: ['Multiple payment modes', 'WhatsApp receipt', 'Offline mode'],
    2: ['Auto shortage alerts', 'Barcode scanning', 'Multi-warehouse'],
    3: ['Real-time KPIs', 'CSV / PDF exports', 'Top products'],
    4: ['Loyalty points', 'Purchase history', 'Customer segments'],
    5: ['Weekly schedule', 'PDF payslips', 'Attendance tracking'],
    6: ['Roles & permissions', '2FA TOTP auth', 'Audit log'],
  }
  const items = lang === 'fr' ? itemsFR : itemsEN

  const features: { icon: JSX.Element; color: string; title: string; desc: string; items: string[] }[] = [
    { icon: <ShoppingCart size={22}/>, color: '#6C47FF', title: lp.feature1_title, desc: lp.feature1_desc, items: items[1] },
    { icon: <Package      size={22}/>, color: '#00B8FF', title: lp.feature2_title, desc: lp.feature2_desc, items: items[2] },
    { icon: <BarChart2    size={22}/>, color: '#A991FF', title: lp.feature3_title, desc: lp.feature3_desc, items: items[3] },
    { icon: <Users        size={22}/>, color: '#FF9500', title: lp.feature4_title, desc: lp.feature4_desc, items: items[4] },
    { icon: <Briefcase    size={22}/>, color: '#00D084', title: lp.feature5_title, desc: lp.feature5_desc, items: items[5] },
    { icon: <Lock         size={22}/>, color: '#FF3B5C', title: lp.feature6_title, desc: lp.feature6_desc, items: items[6] },
  ]

  const stats = [
    { v: '16',    l: lp.stat1_l, c: D.p2   },
    { v: '100 %', l: lp.stat2_l, c: D.acc  },
    { v: '6',     l: lp.stat3_l, c: D.acc2 },
    { v: '15+',   l: lp.stat4_l, c: D.acc3 },
  ]

  const steps = [
    { num: '1', title: lp.step1_title, desc: lp.step1_desc },
    { num: '2', title: lp.step2_title, desc: lp.step2_desc },
    { num: '3', title: lp.step3_title, desc: lp.step3_desc },
    { num: '4', title: lp.step4_title, desc: lp.step4_desc },
  ]

  const testimonials = [
    { name: lp.test1_name, role: lp.test1_role, avatar: 'MD', color: '#6C47FF', fg: '#fff', quote: lp.test1_quote },
    { name: lp.test2_name, role: lp.test2_role, avatar: 'FK', color: '#FF9500', fg: '#1A1A2E', quote: lp.test2_quote },
    { name: lp.test3_name, role: lp.test3_role, avatar: 'IT', color: '#00D084', fg: '#1A1A2E', quote: lp.test3_quote },
  ]

  const pricing = [
    {
      name: lp.starter_name, sub: lp.starter_sub, xof: 14400, pop: false, btn: 'light',
      btnText: lp.free_start, color: D.acc2,
      features: [
        { ok: true,  text: lp.feat_pos_1 },
        { ok: true,  text: lp.feat_stock_500 },
        { ok: true,  text: lp.feat_reports },
        { ok: true,  text: lp.feat_support },
        { ok: false, text: lp.feat_multiuser },
        { ok: false, text: lp.feat_hr },
      ],
    },
    {
      name: lp.business_name, sub: lp.business_sub, xof: 34750, pop: true, btn: 'white',
      btnText: lp.try_free, tag: lp.most_popular, color: D.p3,
      features: [
        { ok: true, text: lp.feat_pos_3 },
        { ok: true, text: lp.feat_stock_inf },
        { ok: true, text: lp.feat_crm },
        { ok: true, text: lp.feat_hr_full },
        { ok: true, text: lp.feat_5users },
        { ok: true, text: lp.feat_priority },
      ],
    },
    {
      name: lp.enterprise_name, sub: lp.enterprise_sub, xof: 0, pop: false, btn: 'outline',
      btnText: lp.contact_us, color: D.acc3,
      features: [
        { ok: true, text: lp.feat_pos_inf },
        { ok: true, text: lp.feat_multi_shop },
        { ok: true, text: lp.feat_users_inf },
        { ok: true, text: lp.feat_api },
        { ok: true, text: lp.feat_onboarding },
        { ok: true, text: lp.feat_sla },
      ],
    },
  ]

  const faqs = [
    { q: lp.faq1_q, a: lp.faq1_a },
    { q: lp.faq2_q, a: lp.faq2_a },
    { q: lp.faq3_q, a: lp.faq3_a },
    { q: lp.faq4_q, a: lp.faq4_a },
    { q: lp.faq5_q, a: lp.faq5_a },
  ]

  const trustCountries = [
    { flag: '🇸🇳', name: 'Sénégal' },
    { flag: '🇨🇮', name: "Côte d'Ivoire" },
    { flag: '🇨🇲', name: 'Cameroun' },
    { flag: '🇲🇱', name: 'Mali' },
    { flag: '🇧🇫', name: 'Burkina Faso' },
    { flag: '🇨🇩', name: 'RD Congo' },
    { flag: '🇬🇭', name: 'Ghana' },
    { flag: '🇳🇬', name: 'Nigeria' },
  ]

  const currencyChips = [
    { code: 'XOF', flag: '🇸🇳', name: 'Franc CFA Ouest' },
    { code: 'XAF', flag: '🇨🇲', name: 'Franc CFA Centre' },
    { code: 'EUR', flag: '🇪🇺', name: 'Euro' },
    { code: 'USD', flag: '🇺🇸', name: 'Dollar US' },
    { code: 'CAD', flag: '🇨🇦', name: 'Dollar CA' },
    { code: 'GBP', flag: '🇬🇧', name: 'Livre Sterling' },
  ]

  const languageChips = [
    { flag: '🇫🇷', name: 'Français', code: 'fr' as Lang },
    { flag: '🇬🇧', name: 'English',  code: 'en' as Lang },
    { flag: '🇪🇸', name: 'Español',  code: 'es' as Lang },
    { flag: '🇮🇹', name: 'Italiano', code: 'it' as Lang },
  ]

  return (
    <div style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: FONT, overflowX: 'hidden' }}>

      {/* ════ NAVBAR ════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 100,
        background: 'rgba(7,7,15,.85)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${D.border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 clamp(16px,4vw,60px)', gap: 14,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: `linear-gradient(135deg,${D.p},${D.p2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 14px rgba(108,71,255,.4)', flexShrink: 0,
          }}>
            <ShoppingCart size={18} strokeWidth={2.4}/>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: D.text, letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>
            Haba<span style={{ background: `linear-gradient(135deg,${D.p2},${D.p3})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Shop</span>
          </span>
        </div>

        {/* Nav links (desktop) */}
        <div className="lp-nav-desktop" style={{ display: 'flex', gap: 4 }}>
          {[
            { label: lp.nav_features, target: 'section-features' },
            { label: lp.nav_pricing,  target: 'section-pricing'  },
            { label: lp.nav_faq,      target: 'section-faq'      },
          ].map(it => (
            <a key={it.target} href={`#${it.target}`}
              onClick={e => { e.preventDefault(); scrollTo(it.target) }}
              style={{
                padding: '7px 14px', borderRadius: 99,
                color: D.text2, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', cursor: 'pointer', transition: 'color .15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = D.text}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = D.text2}
            >{it.label}</a>
          ))}
        </div>

        {/* Language + Currency */}
        <div className="lp-selectors" style={{ display: 'flex', gap: 6 }}>
          <select value={lang} onChange={e => setLang(e.target.value as Lang)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              background: 'rgba(255,255,255,.05)',
              border: `1px solid ${D.border2}`, borderRadius: 9,
              padding: '6px 24px 6px 10px', fontSize: 12, fontWeight: 700,
              color: D.p3, cursor: 'pointer', fontFamily: FONT, outline: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A991FF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}>
            <option value="fr">🇫🇷 FR</option>
            <option value="en">🇬🇧 EN</option>
            <option value="es">🇪🇸 ES</option>
            <option value="it">🇮🇹 IT</option>
          </select>
          <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              background: 'rgba(255,255,255,.05)',
              border: `1px solid ${D.border2}`, borderRadius: 9,
              padding: '6px 24px 6px 10px', fontSize: 12, fontWeight: 700,
              color: D.p3, cursor: 'pointer', fontFamily: FONT, outline: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A991FF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}>
            <option value="XOF">XOF</option>
            <option value="XAF">XAF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => navigate('/login')}
            className="lp-btn-ghost"
            style={{
              padding: '8px 16px', borderRadius: 10, background: 'transparent',
              border: `1px solid ${D.border2}`, color: D.text2,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.06)'; el.style.color = D.text }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = D.text2 }}
          >{lp.nav_login}</button>
          <button type="button" onClick={() => navigate('/signup')}
            style={{
              padding: '8px 18px', borderRadius: 10,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: '0 4px 14px rgba(108,71,255,.35)',
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 20px rgba(108,71,255,.5)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 4px 14px rgba(108,71,255,.35)' }}
          >{lp.cta1}</button>
        </div>
      </nav>

      {/* ════ HERO ════ */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '120px clamp(16px,4vw,80px) 80px',
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(160deg,${D.bg} 0%,${D.bg2} 50%,#0A0718 100%)`,
      }}>
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(108,71,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(108,71,255,.06) 1px,transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Orbs */}
        <div style={{ position: 'absolute', top: '8%', left: '8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(108,71,255,.16),transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', animation: 'lp-float 6s ease-in-out infinite' }}/>
        <div style={{ position: 'absolute', bottom: '12%', right: '8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,208,132,.11),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none', animation: 'lp-float 8s ease-in-out infinite reverse' }}/>
        <div style={{ position: 'absolute', top: '38%', right: '32%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,184,255,.09),transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }}/>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 820, width: '100%' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', background: 'rgba(108,71,255,.12)',
            border: '1px solid rgba(108,71,255,.3)', borderRadius: 99, marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.p2, animation: 'lp-pulse 2s infinite', display: 'inline-block' }}/>
            <Sparkles size={12} strokeWidth={2.4} color={D.p3}/>
            <span style={{ fontSize: 12, fontWeight: 700, color: D.p3 }}>{lp.badge}</span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(22px,5.4vw,60px)', fontWeight: 900, color: D.text,
            letterSpacing: 'clamp(-2px,-.13vw,-.3px)', lineHeight: 1.12,
            marginBottom: 22, overflowWrap: 'break-word',
          }}>
            <span style={{ display: 'block' }}>{lp.h1a}</span>
            <span style={{
              display: 'block',
              background: `linear-gradient(135deg,${D.p},${D.p3} 50%,${D.acc})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{lp.h1b}</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(15px,1.8vw,18px)', color: D.text2,
            lineHeight: 1.75, maxWidth: 600, margin: '0 auto 36px',
          }}>{lp.hero_sub}</p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button type="button" onClick={() => navigate('/signup')}
              style={{
                padding: '15px 32px', borderRadius: 14,
                background: `linear-gradient(135deg,${D.p},${D.p2})`,
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', fontFamily: FONT,
                boxShadow: '0 8px 28px rgba(108,71,255,.5)', transition: 'all .2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 36px rgba(108,71,255,.65)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 8px 28px rgba(108,71,255,.5)' }}
            >
              <Zap size={16} strokeWidth={2.6}/>{lp.cta1}
            </button>
            <button type="button" onClick={() => navigate('/login')}
              style={{
                padding: '15px 28px', borderRadius: 14,
                background: 'rgba(255,255,255,.06)',
                border: `1px solid ${D.border2}`, color: D.text,
                fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                transition: 'all .2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)'}
            >
              <Play size={14} strokeWidth={2.6}/>{lp.cta2}
            </button>
          </div>

          {/* Social proof */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex' }}>
                {[
                  { bg: D.p,    fg: '#fff'    }, // violet : texte blanc (AA ok)
                  { bg: D.acc3, fg: '#1A1A2E' }, // orange : texte sombre (AA)
                  { bg: D.acc,  fg: '#1A1A2E' }, // vert   : texte sombre (AA)
                  { bg: D.acc2, fg: '#1A1A2E' }, // bleu   : texte sombre (AA)
                  { bg: D.acc4, fg: '#1A1A2E' }, // rouge  : texte sombre (AA)
                ].map((a, i) => (
                  <div key={i} style={{
                    width: 28, height: 28, borderRadius: '50%', background: a.bg,
                    border: `2px solid ${D.bg}`, marginLeft: i > 0 ? -8 : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, color: a.fg,
                  }}>{['MB','KD','FN','SK','AT'][i]}</div>
                ))}
              </div>
              <span style={{ fontSize: 13, color: D.text2 }}>
                <strong style={{ color: D.text }}>2 500+</strong>{' '}{lp.proof_stores}
              </span>
            </div>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: D.text4 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[1,2,3,4,5].map(i => <Star key={i} size={13} fill={D.acc3} color={D.acc3}/>)}
              <span style={{ fontSize: 13, color: D.text2, marginLeft: 4 }}>4.9/5</span>
            </div>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: D.text4 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: D.text2 }}>
              <Globe size={14} color={D.text3}/>{lp.proof_countries}
            </div>
          </div>
        </div>
      </section>

      {/* ════ TRUST BAND ════ */}
      <section style={{
        padding: '28px clamp(16px,4vw,80px)',
        borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}`,
        background: 'rgba(255,255,255,.02)',
      }}>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '.8px', color: D.text2, textTransform: 'uppercase', marginBottom: 18 }}>
          {lp.trust_title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,3vw,40px)', flexWrap: 'wrap' }}>
          {trustCountries.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: .85, transition: 'opacity .15s', cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '.85'}
            >
              <span style={{ fontSize: 22 }}>{c.flag}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: D.text2 }}>{c.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════ STATS ════ */}
      <section style={{ padding: '72px clamp(16px,4vw,80px)', background: `linear-gradient(180deg,${D.bg},${D.bg2})` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, maxWidth: 960, margin: '0 auto' }}>
          {stats.map(s => (
            <div key={s.l} style={{
              background: `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1px solid ${D.border}`, borderRadius: 20,
              padding: '24px 22px', textAlign: 'center',
              transition: 'all .2s', position: 'relative', overflow: 'hidden', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.borderColor = `${s.c}33`; el.style.boxShadow = `0 16px 40px ${s.c}15` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.borderColor = D.border; el.style.boxShadow = 'none' }}
            >
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${s.c}26,transparent 70%)`, pointerEvents: 'none' }}/>
              <div style={{ fontSize: 32, fontWeight: 900, color: s.c, fontFamily: MONO, letterSpacing: '-1px', marginBottom: 6, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 13, color: D.text2, fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ FEATURES ════ */}
      <section id="section-features" style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg2 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{
            display: 'inline-block', background: 'rgba(108,71,255,.1)',
            border: '1px solid rgba(108,71,255,.25)', color: D.p3,
            fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99,
            letterSpacing: '.8px',
          }}>{lp.features_label}</span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0', lineHeight: 1.2 }}>
            {lp.features_title}
          </h2>
          <p style={{ fontSize: 16, color: D.text2, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>{lp.features_sub}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1px solid ${D.border}`, borderRadius: 20, padding: 24,
              transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
              position: 'relative', overflow: 'hidden', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-5px)'; el.style.borderColor = `${f.color}40`; el.style.boxShadow = `0 20px 50px rgba(0,0,0,.5),0 0 0 1px ${f.color}22` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.borderColor = D.border; el.style.boxShadow = 'none' }}
            >
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${f.color}1F,transparent 70%)`, pointerEvents: 'none' }}/>

              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: `${f.color}18`, border: `1px solid ${f.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, color: f.color,
                boxShadow: `0 8px 24px ${f.color}26`,
              }}>{f.icon}</div>

              <h3 style={{ fontSize: 16, fontWeight: 800, color: D.text, marginBottom: 8, letterSpacing: '-.2px' }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: D.text2, lineHeight: 1.7, marginBottom: 16 }}>{f.desc}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {f.items.map(it => (
                  <div key={it} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: D.text2 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: `${f.color}22`, color: f.color, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={11} strokeWidth={3}/>
                    </span>
                    {it}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.how_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 0', lineHeight: 1.2 }}>
            {lp.how_title}
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24, maxWidth: 1060, margin: '0 auto' }}>
          {steps.map(s => (
            <div key={s.num} style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                background: `linear-gradient(135deg,${D.p},${D.p2})`,
                color: '#fff', fontSize: 22, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO,
                boxShadow: '0 8px 24px rgba(108,71,255,.35)',
              }}>{s.num}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: D.text, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: D.text2, lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ CURRENCIES + LANGUAGES ════ */}
      <section style={{ padding: '64px clamp(16px,4vw,80px)', background: D.bg2, borderTop: `1px solid ${D.border}`, textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 900, color: D.text, letterSpacing: '-.5px', marginBottom: 10 }}>
          {lp.cur_title}
        </h2>
        <p style={{ fontSize: 14, color: D.text3, marginBottom: 28 }}>{lp.cur_sub}</p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24, maxWidth: 880, margin: '0 auto 24px' }}>
          {currencyChips.map(c => (
            <div key={c.code} style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${D.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all .15s', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,184,0,.08)'; el.style.borderColor = 'rgba(255,184,0,.2)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.04)'; el.style.borderColor = D.border }}
            >
              <span style={{ fontSize: 20 }}>{c.flag}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: D.text, fontFamily: MONO }}>{c.code}</div>
                <div style={{ fontSize: 10, color: D.text3 }}>{c.name}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {languageChips.map(l => (
            <button key={l.code} type="button" onClick={() => setLang(l.code)}
              style={{
                padding: '8px 16px', borderRadius: 99,
                background: lang === l.code ? 'rgba(108,71,255,.16)' : 'rgba(108,71,255,.06)',
                border: `1px solid ${lang === l.code ? 'rgba(108,71,255,.4)' : 'rgba(108,71,255,.18)'}`,
                fontSize: 13, fontWeight: 700, color: D.p3,
                cursor: 'pointer', fontFamily: FONT,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all .15s',
              }}>
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ════ TESTIMONIALS ════ */}
      <section style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.testimonials_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 0', lineHeight: 1.2 }}>
            {lp.testimonials_title}
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 16, maxWidth: 1060, margin: '0 auto' }}>
          {testimonials.map(t => (
            <div key={t.name} style={{
              background: `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1px solid ${D.border}`, borderRadius: 20, padding: 26,
              transition: 'all .2s', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.borderColor = `${t.color}33`; el.style.boxShadow = `0 16px 40px ${t.color}15` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.borderColor = D.border; el.style.boxShadow = 'none' }}
            >
              <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
                {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={D.acc3} color={D.acc3}/>)}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: D.text, marginBottom: 18, fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: t.fg, flexShrink: 0, boxShadow: `0 4px 14px ${t.color}55` }}>
                  {t.avatar}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: D.text }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: D.text3 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ PAYS COUVERTS (SEO géographique) ════ */}
      <section aria-label="Pays disponibles" style={{ padding: '72px clamp(16px,4vw,80px)', background: D.bg, borderTop: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', marginBottom: 14, lineHeight: 1.2 }}>
            {lang === 'fr' ? "Disponible dans toute l'Afrique francophone" : 'Available across French-speaking Africa'}
          </h2>
          <p style={{ fontSize: 15, color: D.text2, maxWidth: 720, margin: '0 auto 36px', lineHeight: 1.7 }}>
            {lang === 'fr'
              ? "HabaShop fonctionne au Sénégal, en Côte d'Ivoire, au Mali, au Burkina Faso, en Guinée, au Cameroun, au Congo, au Gabon, au Togo, au Bénin et dans plus de 150 pays."
              : "HabaShop works in Senegal, Côte d'Ivoire, Mali, Burkina Faso, Guinea, Cameroon, Congo, Gabon, Togo, Benin and 150+ countries."}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {([
              ['🇸🇳', 'Sénégal'], ['🇨🇮', "Côte d'Ivoire"], ['🇲🇱', 'Mali'], ['🇧🇫', 'Burkina Faso'], ['🇬🇳', 'Guinée'],
              ['🇨🇲', 'Cameroun'], ['🇨🇬', 'Congo'], ['🇬🇦', 'Gabon'], ['🇹🇬', 'Togo'], ['🇧🇯', 'Bénin'],
            ] as [string, string][]).map(([flag, name]) => (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 99, fontSize: 14, fontWeight: 600, color: D.text2 }}>
                <span style={{ fontSize: 18 }}>{flag}</span>{name}
              </span>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 16px', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', borderRadius: 99, fontSize: 14, fontWeight: 700, color: D.p3 }}>
              + 140 {lang === 'fr' ? 'autres pays' : 'more countries'}
            </span>
          </div>
        </div>
      </section>

      {/* ════ PRICING ════ */}
      <section id="section-pricing" style={{ padding: '88px clamp(16px,4vw,80px)', background: `linear-gradient(180deg,${D.bg2},${D.bg})`, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.pricing_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 8' }}>
            {lp.pricing_title}
          </h2>
          <p style={{ fontSize: 15, color: D.text2 }}>{lp.pricing_sub}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18, maxWidth: 1000, margin: '0 auto', alignItems: 'start' }}>
          {pricing.map(p => (
            <div key={p.name} style={{
              background: p.pop
                ? `linear-gradient(160deg,${D.p},${D.p2} 70%,${D.p3})`
                : `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1.5px solid ${p.pop ? 'transparent' : D.border}`,
              borderRadius: 22, padding: '32px 28px',
              position: 'relative',
              transition: 'all .2s',
              transform: p.pop ? 'scale(1.03)' : 'none',
              boxShadow: p.pop
                ? '0 24px 60px rgba(108,71,255,.5),0 0 0 1px rgba(108,71,255,.2)'
                : '0 2px 12px rgba(0,0,0,.2)',
            }}
              onMouseEnter={e => { if (!p.pop) { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 20px 50px rgba(0,0,0,.5)' } }}
              onMouseLeave={e => { if (!p.pop) { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 2px 12px rgba(0,0,0,.2)' } }}
            >
              {p.tag && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: '#fff', color: D.p,
                  fontSize: 10, fontWeight: 900, padding: '5px 14px', borderRadius: 99,
                  textTransform: 'uppercase', letterSpacing: '.7px',
                  boxShadow: '0 6px 18px rgba(0,0,0,.3)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <Star size={11} fill={D.acc3} color={D.acc3}/>{p.tag}
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.2px', color: p.pop ? 'rgba(255,255,255,.75)' : D.text3, marginBottom: 6 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 13, color: p.pop ? 'rgba(255,255,255,.7)' : D.text2, marginBottom: 18 }}>
                {p.sub}
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: p.xof === 0 ? 26 : 40, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: p.pop ? '#fff' : D.text }}>
                  {p.xof === 0 ? lp.on_estimate : formatPlanPrice(p.xof)}
                </div>
                {p.xof !== 0 && (
                  <div style={{ fontSize: 13, color: p.pop ? 'rgba(255,255,255,.65)' : D.text3, marginTop: 4 }}>
                    {lp.per_month}
                  </div>
                )}
                {p.xof !== 0 && currency !== 'XOF' && currency !== 'XAF' && (
                  <div style={{ fontSize: 11, color: p.pop ? 'rgba(255,255,255,.5)' : D.text4, marginTop: 4, fontFamily: MONO }}>
                    ≈ {new Intl.NumberFormat('fr-FR').format(p.xof)} FCFA
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: p.pop ? 'rgba(255,255,255,.15)' : D.border, marginBottom: 20 }}/>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
                {p.features.map(f => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: p.pop
                        ? (f.ok ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)')
                        : (f.ok ? 'rgba(0,208,132,.18)' : 'rgba(255,255,255,.05)'),
                      color: p.pop
                        ? (f.ok ? '#fff' : 'rgba(255,255,255,.35)')
                        : (f.ok ? D.acc : D.text4),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {f.ok ? <Check size={11} strokeWidth={3.2}/> : '−'}
                    </span>
                    <span style={{ color: p.pop ? (f.ok ? '#fff' : 'rgba(255,255,255,.5)') : (f.ok ? D.text : D.text4) }}>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              <button type="button"
                onClick={() => p.name === lp.enterprise_name ? scrollTo('section-faq') : navigate('/signup')}
                style={{
                  width: '100%', borderRadius: 13, padding: '13px 0',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  fontFamily: FONT, transition: 'all .2s',
                  background: p.btn === 'light' ? `linear-gradient(135deg,${D.p},${D.p2})`
                    : p.btn === 'white' ? '#fff'
                    : 'rgba(255,255,255,.04)',
                  color: p.btn === 'light' ? '#fff' : p.btn === 'white' ? D.p : D.text,
                  border: p.btn === 'outline' ? `1.5px solid ${D.border2}` : 'none',
                  boxShadow: p.btn === 'light' ? '0 6px 20px rgba(108,71,255,.35)'
                    : p.btn === 'white' ? '0 6px 20px rgba(0,0,0,.25)'
                    : 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >
                {p.btnText}<ArrowRight size={14}/>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section id="section-faq" style={{ padding: '88px clamp(16px,4vw,80px)', background: D.bg2, borderTop: `1px solid ${D.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', background: 'rgba(108,71,255,.1)', border: '1px solid rgba(108,71,255,.25)', color: D.p3, fontSize: 11, fontWeight: 800, padding: '5px 14px', borderRadius: 99, letterSpacing: '.8px' }}>
            {lp.faq_label}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,42px)', fontWeight: 900, color: D.text, letterSpacing: '-1px', margin: '14px 0 0', lineHeight: 1.2 }}>
            {lp.faq_title}
          </h2>
        </div>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faqs.map((f, i) => (
            <details key={i} style={{
              background: `linear-gradient(160deg,${D.bg2},${D.bg3})`,
              border: `1px solid ${D.border}`, borderRadius: 14, overflow: 'hidden',
            }}>
              <summary style={{
                padding: '18px 22px', fontSize: 14.5, fontWeight: 700,
                color: D.text, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                userSelect: 'none', listStyle: 'none',
              }}>
                {f.q}
                <span style={{ fontSize: 18, color: D.p3, flexShrink: 0, marginLeft: 12 }}>+</span>
              </summary>
              <div style={{ padding: '0 22px 18px', fontSize: 14, color: D.text2, lineHeight: 1.75 }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ════ CTA FINAL ════ */}
      <section style={{
        padding: '100px clamp(16px,4vw,80px)',
        background: `linear-gradient(160deg,${D.bg},${D.bg2})`,
        position: 'relative', overflow: 'hidden', textAlign: 'center',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 540, height: 540, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(108,71,255,.18),transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }}/>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, color: D.text, letterSpacing: '-1.5px', marginBottom: 14, lineHeight: 1.1 }}>
            {lp.cta_title}
          </h2>
          <p style={{ fontSize: 16, color: D.text2, marginBottom: 32, maxWidth: 460, margin: '0 auto 32px' }}>
            {lp.cta_sub}
          </p>
          <button type="button" onClick={() => navigate('/signup')}
            style={{
              padding: '17px 38px', borderRadius: 14,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              border: 'none', color: '#fff', fontSize: 16, fontWeight: 800,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: '0 12px 40px rgba(108,71,255,.5)',
              transition: 'all .2s',
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 16px 50px rgba(108,71,255,.65)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 12px 40px rgba(108,71,255,.5)' }}
          >
            <Zap size={18} strokeWidth={2.6}/>{lp.cta_btn}
          </button>
          <div style={{ marginTop: 18, fontSize: 12, color: D.text3, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={12} color={D.acc}/>{lang === 'fr' ? '14 jours gratuits' : '14 days free'}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={12} color={D.acc}/>{lang === 'fr' ? 'Sans carte bancaire' : 'No credit card'}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={12} color={D.acc}/>{lang === 'fr' ? 'Annulation facile' : 'Easy cancellation'}</span>
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer style={{
        padding: '40px clamp(16px,4vw,80px) 28px',
        borderTop: `1px solid ${D.border}`,
        background: D.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
            }}>
              <ShoppingCart size={15} strokeWidth={2.4}/>
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: D.text }}>HabaShop</span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {lp.footer_links.map(link => (
              <a key={link} href="#" style={{
                fontSize: 12, color: D.text3, textDecoration: 'none',
                transition: 'color .15s', cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = D.text}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = D.text3}
              >{link}</a>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: D.text4, paddingTop: 18, borderTop: `1px solid ${D.border}`, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center', width: '100%' }}>
          {lp.footer}<Shield size={11}/>
        </div>
      </footer>

      <style>{`
        @keyframes lp-float {
          0%, 100% { transform: translateY(0) }
          50%      { transform: translateY(-20px) }
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50%      { opacity: .5; transform: scale(.8) }
        }
        @media (max-width: 880px) {
          .lp-nav-desktop { display: none !important }
        }
        @media (max-width: 640px) {
          .lp-selectors { display: none !important }
        }
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important }
        }
      `}</style>
    </div>
  )
}
