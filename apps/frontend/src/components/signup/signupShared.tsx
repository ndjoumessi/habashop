import React from 'react'
import type { Lang, Currency } from '@/stores/appStore'
export type { Lang, Currency }

export type ST = {
  brand_title: string; brand_sub: string
  step1_label: string; step2_label: string
  step1_head: string; step1_sub: string
  step2_head: string; step2_sub: string
  shopName: string; ownerName: string; email: string; phone: string
  phone_hint: string; country: string; currency: string
  password: string; confirm: string
  shop_ph: string; owner_ph: string; email_ph: string
  password_ph: string; confirm_ph: string
  next_btn: string; missing_prefix: string
  back: string; submit: string; loading: string
  terms_pre: string; terms_a: string; terms_and: string; terms_b: string
  pwd_weak: string; pwd_fair: string; pwd_good: string; pwd_excellent: string
  pwd_match: string; pwd_nomatch: string
  login_q: string; login_link: string
  search_country: string; no_country: string
  errRequired: string; errPassword: string; errPasswordLen: string; errTerms: string
  after_title: string; after_body: string
  trial_title: string; trial_body: string
  pay_title:   string; pay_body: string
}

export const TX: Record<Lang, ST> = {
  fr: {
    brand_title: 'Rejoignez HabaShop',
    brand_sub: 'Créez votre boutique en ligne en 2 minutes et commencez à gérer votre commerce.',
    step1_label: 'Infos boutique', step2_label: 'Sécurité',
    step1_head: 'Votre boutique', step1_sub: 'Étape 1/2 — Informations générales',
    step2_head: 'Sécurisez votre compte', step2_sub: 'Étape 2/2 — Créez votre mot de passe',
    shopName: 'Nom de la boutique', ownerName: 'Votre nom complet',
    email: 'Adresse email', phone: 'Téléphone WhatsApp',
    phone_hint: 'Utilisé pour recevoir les tickets WhatsApp',
    country: 'Pays', currency: 'Devise',
    password: 'Mot de passe', confirm: 'Confirmer le mot de passe',
    shop_ph: 'Ex: Boutique Aminata', owner_ph: 'Ex: Aminata Koné',
    email_ph: 'vous@exemple.com',
    password_ph: '8 caractères minimum', confirm_ph: 'Répétez le mot de passe',
    next_btn: 'Continuer', missing_prefix: 'Il manque encore :',
    back: 'Retour', submit: 'Créer mon compte HabaShop', loading: 'Création du compte…',
    terms_pre: "J'accepte les ", terms_a: 'Conditions Générales',
    terms_and: ' et la ', terms_b: 'Politique de confidentialité',
    pwd_weak: 'Faible', pwd_fair: 'Moyen', pwd_good: 'Bon', pwd_excellent: 'Excellent',
    pwd_match: 'Les mots de passe correspondent', pwd_nomatch: 'Les mots de passe ne correspondent pas',
    login_q: 'Déjà un compte ?', login_link: 'Se connecter',
    search_country: 'Rechercher un pays…', no_country: 'Aucun pays trouvé',
    errRequired: 'Veuillez remplir tous les champs obligatoires',
    errPassword: 'Les mots de passe ne correspondent pas',
    errPasswordLen: 'Le mot de passe doit contenir au moins 8 caractères',
    errTerms: 'Vous devez accepter les CGU',
    after_title: 'Dans deux minutes',
    after_body: 'Votre boutique est créée et vous êtes dedans. Devise, langue et TVA se règlent à la première ouverture — rien à installer.',
    trial_title: '14 jours, tout compris',
    trial_body: 'Caisse, stock, clients, fournisseurs, RH et rapports — sans restriction ni quota. Vos données restent les vôtres si vous vous arrêtez.',
    pay_title: 'Et pour continuer',
    pay_body: 'Starter 8 000 F CFA par mois, Business 25 000. Sans engagement, résiliable à tout moment.',
  },
  en: {
    brand_title: 'Join HabaShop',
    brand_sub: 'Create your online store in 2 minutes and start managing your business.',
    step1_label: 'Shop info', step2_label: 'Security',
    step1_head: 'Your shop', step1_sub: 'Step 1/2 — General information',
    step2_head: 'Secure your account', step2_sub: 'Step 2/2 — Create your password',
    shopName: 'Shop name', ownerName: 'Your full name',
    email: 'Email address', phone: 'WhatsApp phone',
    phone_hint: 'Used to receive WhatsApp receipts',
    country: 'Country', currency: 'Currency',
    password: 'Password', confirm: 'Confirm password',
    shop_ph: 'Ex: Aminata Store', owner_ph: 'Ex: Aminata Koné',
    email_ph: 'you@example.com',
    password_ph: '8 characters minimum', confirm_ph: 'Repeat the password',
    next_btn: 'Continue', missing_prefix: 'Still missing:',
    back: 'Back', submit: 'Create my HabaShop account', loading: 'Creating account…',
    terms_pre: 'I accept the ', terms_a: 'Terms of Service',
    terms_and: ' and the ', terms_b: 'Privacy Policy',
    pwd_weak: 'Weak', pwd_fair: 'Fair', pwd_good: 'Good', pwd_excellent: 'Excellent',
    pwd_match: 'Passwords match', pwd_nomatch: 'Passwords do not match',
    login_q: 'Already have an account?', login_link: 'Sign in',
    search_country: 'Search a country…', no_country: 'No country found',
    errRequired: 'Please fill in all required fields',
    errPassword: 'Passwords do not match',
    errPasswordLen: 'Password must be at least 8 characters',
    errTerms: 'You must accept the terms',
    after_title: 'Two minutes from now',
    after_body: 'Your shop is created and you are inside it. Currency, language and VAT are set on first open — nothing to install.',
    trial_title: '14 days, everything included',
    trial_body: 'Till, stock, customers, suppliers, HR and reports — unrestricted, no quotas. Your data stays yours if you stop.',
    pay_title: 'And to carry on',
    pay_body: 'Starter 8,000 CFA per month, Business 25,000. No commitment, cancel at any time.',
  },
  es: {
    brand_title: 'Únete a HabaShop',
    brand_sub: 'Crea tu tienda online en 2 minutos y empieza a gestionar tu negocio.',
    step1_label: 'Info tienda', step2_label: 'Seguridad',
    step1_head: 'Tu tienda', step1_sub: 'Paso 1/2 — Información general',
    step2_head: 'Asegura tu cuenta', step2_sub: 'Paso 2/2 — Crea tu contraseña',
    shopName: 'Nombre de la tienda', ownerName: 'Tu nombre completo',
    email: 'Dirección email', phone: 'Teléfono WhatsApp',
    phone_hint: 'Usado para recibir tickets por WhatsApp',
    country: 'País', currency: 'Divisa',
    password: 'Contraseña', confirm: 'Confirmar contraseña',
    shop_ph: 'Ej: Tienda Aminata', owner_ph: 'Ej: Aminata Koné',
    email_ph: 'tu@ejemplo.com',
    password_ph: '8 caracteres mínimo', confirm_ph: 'Repite la contraseña',
    next_btn: 'Continuar', missing_prefix: 'Todavía falta:',
    back: 'Atrás', submit: 'Crear mi cuenta HabaShop', loading: 'Creando cuenta…',
    terms_pre: 'Acepto los ', terms_a: 'Términos y Condiciones',
    terms_and: ' y la ', terms_b: 'Política de Privacidad',
    pwd_weak: 'Débil', pwd_fair: 'Regular', pwd_good: 'Buena', pwd_excellent: 'Excelente',
    pwd_match: 'Las contraseñas coinciden', pwd_nomatch: 'Las contraseñas no coinciden',
    login_q: '¿Ya tienes cuenta?', login_link: 'Iniciar sesión',
    search_country: 'Buscar un país…', no_country: 'Ningún país encontrado',
    errRequired: 'Por favor completa todos los campos obligatorios',
    errPassword: 'Las contraseñas no coinciden',
    errPasswordLen: 'La contraseña debe tener al menos 8 caracteres',
    errTerms: 'Debes aceptar los términos',
    after_title: 'Dentro de dos minutos',
    after_body: 'Tu tienda está creada y ya estás dentro. Divisa, idioma e IVA se configuran al abrir — nada que instalar.',
    trial_title: '14 días, todo incluido',
    trial_body: 'Caja, stock, clientes, proveedores, RRHH e informes — sin restricciones ni cuotas. Tus datos siguen siendo tuyos si lo dejas.',
    pay_title: 'Y para continuar',
    pay_body: 'Starter 8 000 F CFA al mes, Business 25 000. Sin compromiso, cancela cuando quieras.',
  },
  it: {
    brand_title: 'Unisciti a HabaShop',
    brand_sub: 'Crea il tuo negozio online in 2 minuti e inizia a gestire la tua attività.',
    step1_label: 'Info negozio', step2_label: 'Sicurezza',
    step1_head: 'Il tuo negozio', step1_sub: 'Passo 1/2 — Informazioni generali',
    step2_head: 'Proteggi il tuo account', step2_sub: 'Passo 2/2 — Crea la tua password',
    shopName: 'Nome del negozio', ownerName: 'Il tuo nome completo',
    email: 'Indirizzo email', phone: 'Telefono WhatsApp',
    phone_hint: 'Usato per ricevere gli scontrini WhatsApp',
    country: 'Paese', currency: 'Valuta',
    password: 'Password', confirm: 'Conferma password',
    shop_ph: 'Es: Negozio Aminata', owner_ph: 'Es: Aminata Koné',
    email_ph: 'tu@esempio.com',
    password_ph: '8 caratteri minimo', confirm_ph: 'Ripeti la password',
    next_btn: 'Continua', missing_prefix: 'Manca ancora:',
    back: 'Indietro', submit: 'Crea il mio account HabaShop', loading: 'Creazione account…',
    terms_pre: 'Accetto i ', terms_a: 'Termini di Servizio',
    terms_and: ' e la ', terms_b: 'Privacy Policy',
    pwd_weak: 'Debole', pwd_fair: 'Discreto', pwd_good: 'Buono', pwd_excellent: 'Eccellente',
    pwd_match: 'Le password corrispondono', pwd_nomatch: 'Le password non corrispondono',
    login_q: 'Hai già un account?', login_link: 'Accedi',
    search_country: 'Cerca un paese…', no_country: 'Nessun paese trovato',
    errRequired: 'Compila tutti i campi obbligatori',
    errPassword: 'Le password non corrispondono',
    errPasswordLen: 'La password deve contenere almeno 8 caratteri',
    errTerms: 'Devi accettare i termini',
    after_title: 'Tra due minuti',
    after_body: 'Il tuo negozio è creato e ci sei dentro. Valuta, lingua e IVA si impostano alla prima apertura — niente da installare.',
    trial_title: '14 giorni, tutto incluso',
    trial_body: 'Cassa, magazzino, clienti, fornitori, HR e report — senza limiti né quote. I tuoi dati restano tuoi se ti fermi.',
    pay_title: 'E per continuare',
    pay_body: 'Starter 8 000 F CFA al mese, Business 25 000. Nessun vincolo, disdici quando vuoi.',
  },
}

export const COUNTRIES = [
  { code: 'SN', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'CI', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'ML', flag: '🇲🇱', name: 'Mali' },
  { code: 'BF', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: 'CM', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'CG', flag: '🇨🇬', name: 'Congo' },
  { code: 'CD', flag: '🇨🇩', name: 'RD Congo' },
  { code: 'GA', flag: '🇬🇦', name: 'Gabon' },
  { code: 'NE', flag: '🇳🇪', name: 'Niger' },
  { code: 'TG', flag: '🇹🇬', name: 'Togo' },
  { code: 'BJ', flag: '🇧🇯', name: 'Bénin' },
  { code: 'GN', flag: '🇬🇳', name: 'Guinée' },
  { code: 'GH', flag: '🇬🇭', name: 'Ghana' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'MA', flag: '🇲🇦', name: 'Maroc' },
  { code: 'DZ', flag: '🇩🇿', name: 'Algérie' },
  { code: 'TN', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', flag: '🇨🇭', name: 'Suisse' },
  { code: 'ES', flag: '🇪🇸', name: 'España' },
  { code: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', name: 'Deutschland' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'US', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'OTHER', flag: '🌍', name: 'Autre' },
]

export const D = {
  bg:      '#0A0A0F',
  bg2:     '#0F0F1A',
  bg3:     '#13132A',
  bg4:     'rgba(255,255,255,.03)',
  p:       '#7C3AED',
  p2:      '#8B5CF6',
  p3:      '#A78BFA',
  gold:    '#EAB308',
  gold2:   '#FCD34D',
  text:    '#F8FAFC',
  text2:   '#94A3B8',
  text3:   '#64748B',
  text4:   'rgba(148,163,184,.45)',
  border:  'rgba(139,92,246,.15)',
  border2: 'rgba(139,92,246,.25)',
  acc:     '#22C55E',
  acc2:    '#38BDF8',
  acc3:    '#EAB308',
  warn:    '#FBBF24',
  danger:  '#F43F5E',
}

export const FONT = "'Outfit', system-ui, -apple-system, sans-serif"
export const MONO = "'JetBrains Mono', ui-monospace, monospace"

export function getStrength(pwd: string): number {
  if (pwd.length < 4) return 0
  let s = 0
  if (pwd.length >= 8)             s++
  if (/[A-Z]/.test(pwd))           s++
  if (/[0-9]/.test(pwd))           s++
  if (/[^A-Za-z0-9]/.test(pwd))    s++
  return s
}

export const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(255,255,255,.03)',
    border: `1.5px solid rgba(139,92,246,.2)`,
    borderRadius: 12,
    fontSize: 'var(--fs-body)',
    fontFamily: FONT,
    color: D.text,
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    boxSizing: 'border-box',
  }

  export const focusOn = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = D.p2
    e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,.15)'
  }
  export const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(139,92,246,.2)'
    e.target.style.boxShadow = 'none'
  }

export const Label = ({ icon: Icon, children }: { icon: React.ComponentType<any>; children: React.ReactNode }) => (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 10, fontWeight: 800, color: D.text3,
      textTransform: 'uppercase', letterSpacing: '.6px',
      marginBottom: 6,
    }}>
      <Icon size={11} strokeWidth={2.4}/>{children}
    </label>
  )
