// ─── Calcul TVA POS (pur, testable) ─────────
// Applique la config POS : si les prix incluent la TVA (TTC, défaut) → on EXTRAIT la TVA
// du sous-total ; sinon (HT) → on AJOUTE la TVA au-dessus.
//   pricesIncludeVat = priceMode !== 'HT'   (le mode TTC/HT est l'unique pilote)
export function computePosVat(
  subtotalAfterDiscount: number,
  vatRatePct: number,
  pricesIncludeVat: boolean,
): { totalHT: number; tva: number; total: number } {
  const r = Math.max(0, vatRatePct) / 100
  if (pricesIncludeVat) {
    const totalHT = subtotalAfterDiscount / (1 + r)
    return { totalHT, tva: subtotalAfterDiscount - totalHT, total: subtotalAfterDiscount }
  }
  const tva = subtotalAfterDiscount * r
  return { totalHT: subtotalAfterDiscount, tva, total: subtotalAfterDiscount + tva }
}

/**
 * Prix barré (référence) affiché UNIQUEMENT s'il dépasse strictement le prix effectif —
 * c.-à-d. quand un vrai écart existe (tarif grossiste/demi-gros distinct, ou promo).
 * Égalité (produit sans tarif de gros → fallback sur le prix détail) → un seul montant,
 * jamais « 2 800 2 800 FCFA ». Pur/testable ; l'affichage seul, aucun calcul de prix.
 */
export function showStrikePrice(referencePrice: number, effectivePrice: number): boolean {
  return referencePrice > effectivePrice
}

export const CATS = [
  { id: 'all',     label: 'Tous' },
  { id: 'cereals', label: 'Céréales' },
  { id: 'fat',     label: 'Corps gras' },
  { id: 'grocery', label: 'Épicerie' },
  { id: 'hygiene', label: 'Hygiène' },
  { id: 'dairy',   label: 'Laitiers' },
  { id: 'canned',  label: 'Conserves' },
]

// ─── Libellés catégories i18n (par id) ──────
export const CAT_LABELS: Record<string, Record<string, string>> = {
  all:     { fr: 'Tous',       en: 'All',         es: 'Todo',        it: 'Tutto'     },
  cereals: { fr: 'Céréales',   en: 'Cereals',     es: 'Cereales',    it: 'Cereali'   },
  fat:     { fr: 'Corps gras', en: 'Oils & Fats', es: 'Grasas',      it: 'Grassi'    },
  grocery: { fr: 'Épicerie',   en: 'Grocery',     es: 'Comestibles', it: 'Drogheria' },
  hygiene: { fr: 'Hygiène',    en: 'Hygiene',     es: 'Higiene',     it: 'Igiene'    },
  dairy:   { fr: 'Laitiers',   en: 'Dairy',       es: 'Lácteos',     it: 'Latticini' },
  canned:  { fr: 'Conserves',  en: 'Canned',      es: 'Conservas',   it: 'Conserve'  },
}
export const catLabel = (id: string, lang: string) =>
  CAT_LABELS[id]?.[lang] ?? CAT_LABELS[id]?.fr ?? id

export const PRODUCTS = [
  { id:1,  name:'Riz parfumé 5kg',        price:4500,  priceWholesale:3800, priceSemiWholesale:4100, cat:'cereals', emoji:'🌾', stock:120, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:2,  name:'Huile palme 1L',          price:1800,  priceWholesale:1400, priceSemiWholesale:1600, cat:'fat',     emoji:'🫙', stock:18,  promotion:true,  promotionPrice:1500, promotionEnd:'2026-05-31' },
  { id:3,  name:'Sucre 1kg',               price:850,   priceWholesale:700,  priceSemiWholesale:780,  cat:'grocery', emoji:'🍚', stock:245, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:4,  name:'Farine blé 1kg',          price:650,   priceWholesale:520,  priceSemiWholesale:590,  cat:'cereals', emoji:'🌾', stock:89,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:5,  name:'Savon OMO 500g',          price:500,   priceWholesale:380,  priceSemiWholesale:430,  cat:'hygiene', emoji:'🧼', stock:150, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:6,  name:'Lait poudre 400g',        price:2200,  priceWholesale:1800, priceSemiWholesale:2000, cat:'dairy',   emoji:'🥛', stock:67,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:7,  name:'Tomate conc. 800g',       price:1400,  priceWholesale:1100, priceSemiWholesale:1250, cat:'canned',  emoji:'🍅', stock:112, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:8,  name:'Huile végétale 5L',       price:8500,  priceWholesale:7000, priceSemiWholesale:7800, cat:'fat',     emoji:'🫒', stock:34,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:9,  name:'Café soluble 200g',       price:2800,  priceWholesale:2200, priceSemiWholesale:2500, cat:'grocery', emoji:'☕', stock:55,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:10, name:'Sardines 155g',           price:900,   priceWholesale:700,  priceSemiWholesale:800,  cat:'canned',  emoji:'🐟', stock:200, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:11, name:'Savon ménage 400g',       price:350,   priceWholesale:270,  priceSemiWholesale:310,  cat:'hygiene', emoji:'🫧', stock:180, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:12, name:'Lait concentré 397g',     price:1100,  priceWholesale:880,  priceSemiWholesale:990,  cat:'dairy',   emoji:'🥤', stock:95,  promotion:false, promotionPrice:0,    promotionEnd:'' },
]

export type PosProduct = typeof PRODUCTS[0] & {
  id: number | string
  sku?: string
  barcode?: string
  priceTiers?: { minQty: number; price: number; label?: string }[]
}

export interface CartItem {
  id: number | string
  name: string
  price: number
  qty: number
  emoji: string
  tierLabel?: string
}

// ─── INDICATIFS PAYS ────────────────────────
export const COUNTRY_CODES = [
  { code:'+221', flag:'🇸🇳', country:'Sénégal',        region:'Afrique Ouest'    },
  { code:'+225', flag:'🇨🇮', country:"Côte d'Ivoire",  region:'Afrique Ouest'    },
  { code:'+223', flag:'🇲🇱', country:'Mali',            region:'Afrique Ouest'    },
  { code:'+226', flag:'🇧🇫', country:'Burkina Faso',    region:'Afrique Ouest'    },
  { code:'+227', flag:'🇳🇪', country:'Niger',           region:'Afrique Ouest'    },
  { code:'+228', flag:'🇹🇬', country:'Togo',            region:'Afrique Ouest'    },
  { code:'+229', flag:'🇧🇯', country:'Bénin',           region:'Afrique Ouest'    },
  { code:'+224', flag:'🇬🇳', country:'Guinée',          region:'Afrique Ouest'    },
  { code:'+245', flag:'🇬🇼', country:'Guinée-Bissau',   region:'Afrique Ouest'    },
  { code:'+232', flag:'🇸🇱', country:'Sierra Leone',    region:'Afrique Ouest'    },
  { code:'+231', flag:'🇱🇷', country:'Liberia',         region:'Afrique Ouest'    },
  { code:'+220', flag:'🇬🇲', country:'Gambie',          region:'Afrique Ouest'    },
  { code:'+238', flag:'🇨🇻', country:'Cap-Vert',        region:'Afrique Ouest'    },
  { code:'+234', flag:'🇳🇬', country:'Nigeria',         region:'Afrique Ouest'    },
  { code:'+233', flag:'🇬🇭', country:'Ghana',           region:'Afrique Ouest'    },
  { code:'+237', flag:'🇨🇲', country:'Cameroun',        region:'Afrique Centrale' },
  { code:'+241', flag:'🇬🇦', country:'Gabon',           region:'Afrique Centrale' },
  { code:'+242', flag:'🇨🇬', country:'Congo',           region:'Afrique Centrale' },
  { code:'+243', flag:'🇨🇩', country:'RD Congo',        region:'Afrique Centrale' },
  { code:'+236', flag:'🇨🇫', country:'Centrafrique',    region:'Afrique Centrale' },
  { code:'+235', flag:'🇹🇩', country:'Tchad',           region:'Afrique Centrale' },
  { code:'+212', flag:'🇲🇦', country:'Maroc',           region:'Afrique Nord'     },
  { code:'+213', flag:'🇩🇿', country:'Algérie',         region:'Afrique Nord'     },
  { code:'+216', flag:'🇹🇳', country:'Tunisie',         region:'Afrique Nord'     },
  { code:'+20',  flag:'🇪🇬', country:'Égypte',          region:'Afrique Nord'     },
  { code:'+218', flag:'🇱🇾', country:'Libye',           region:'Afrique Nord'     },
  { code:'+254', flag:'🇰🇪', country:'Kenya',           region:'Afrique Est'      },
  { code:'+255', flag:'🇹🇿', country:'Tanzanie',        region:'Afrique Est'      },
  { code:'+256', flag:'🇺🇬', country:'Ouganda',         region:'Afrique Est'      },
  { code:'+251', flag:'🇪🇹', country:'Éthiopie',        region:'Afrique Est'      },
  { code:'+33',  flag:'🇫🇷', country:'France',          region:'Europe'           },
  { code:'+32',  flag:'🇧🇪', country:'Belgique',        region:'Europe'           },
  { code:'+41',  flag:'🇨🇭', country:'Suisse',          region:'Europe'           },
  { code:'+44',  flag:'🇬🇧', country:'Royaume-Uni',     region:'Europe'           },
  { code:'+352', flag:'🇱🇺', country:'Luxembourg',      region:'Europe'           },
  { code:'+39',  flag:'🇮🇹', country:'Italie',          region:'Europe'           },
  { code:'+34',  flag:'🇪🇸', country:'Espagne',         region:'Europe'           },
  { code:'+1',   flag:'🇺🇸', country:'USA / Canada',    region:'Amériques'        },
]

// ─── TEXTES CAISSE i18n ─────────────────────
export const CASHIER_TEXTS = {
  fr: {
    closed_title: 'Caisse fermée',
    closed_sub: 'Ouvrez la caisse pour commencer les ventes.',
    fund_label: 'Fond de caisse initial',
    fund_placeholder: 'Ex: 50 000',
    cashier_label: 'Caisse 1',
    open_btn: 'Ouvrir la caisse',
    close_btn: '🔒 Fermer',
    close_title: 'Clôture de caisse',
    open_time: 'Heure ouverture',
    close_time: 'Heure fermeture',
    initial_fund: 'Fond de caisse',
    transactions: 'Transactions',
    ca_cashed: 'CA encaissé',
    total_cash: 'Total en caisse',
    counted_label: 'Montant compté en caisse',
    counted_placeholder: 'Entrez le montant physique compté...',
    confirm_close: 'Confirmer la fermeture',
    cancel: 'Annuler',
    opened_on: 'Caisse ouverte le',
  },
  en: {
    closed_title: 'Cash register closed',
    closed_sub: 'Open the register to start sales.',
    fund_label: 'Opening float',
    fund_placeholder: 'Ex: 50,000',
    cashier_label: 'Register 1',
    open_btn: 'Open register',
    close_btn: '🔒 Close',
    close_title: 'Close register',
    open_time: 'Opening time',
    close_time: 'Closing time',
    initial_fund: 'Opening float',
    transactions: 'Transactions',
    ca_cashed: 'Revenue',
    total_cash: 'Total in register',
    counted_label: 'Counted amount',
    counted_placeholder: 'Enter the physically counted amount...',
    confirm_close: 'Confirm closing',
    cancel: 'Cancel',
    opened_on: 'Register opened on',
  },
  es: {
    closed_title: 'Caja cerrada',
    closed_sub: 'Abra la caja para comenzar las ventas.',
    fund_label: 'Fondo de caja inicial',
    fund_placeholder: 'Ej: 50,000',
    cashier_label: 'Caja 1',
    open_btn: 'Abrir caja',
    close_btn: '🔒 Cerrar',
    close_title: 'Cierre de caja',
    open_time: 'Hora apertura',
    close_time: 'Hora cierre',
    initial_fund: 'Fondo inicial',
    transactions: 'Transacciones',
    ca_cashed: 'Ingresos',
    total_cash: 'Total en caja',
    counted_label: 'Importe contado',
    counted_placeholder: 'Ingrese el importe contado físicamente...',
    confirm_close: 'Confirmar cierre',
    cancel: 'Cancelar',
    opened_on: 'Caja abierta el',
  },
  it: {
    closed_title: 'Cassa chiusa',
    closed_sub: 'Apri la cassa per iniziare le vendite.',
    fund_label: 'Fondo cassa iniziale',
    fund_placeholder: 'Es: 50.000',
    cashier_label: 'Cassa 1',
    open_btn: 'Apri cassa',
    close_btn: '🔒 Chiudi',
    close_title: 'Chiusura cassa',
    open_time: 'Ora apertura',
    close_time: 'Ora chiusura',
    initial_fund: 'Fondo iniziale',
    transactions: 'Transazioni',
    ca_cashed: 'Incasso',
    total_cash: 'Totale in cassa',
    counted_label: 'Importo contato',
    counted_placeholder: 'Inserire l\'importo contato fisicamente...',
    confirm_close: 'Conferma chiusura',
    cancel: 'Annulla',
    opened_on: 'Cassa aperta il',
  },
}

// ─── COUNTRY ITEM ───────────────────────────
export function CountryItem({ c, selected, onSelect }: {
  c: { code: string; flag: string; country: string; region: string }
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      role="option"
      aria-selected={selected}
      onMouseDown={onSelect}
      style={{
        display:'flex', alignItems:'center', gap:10,
        width:'100%', padding:'8px 12px',
        background: selected ? 'rgba(124,111,240,.15)' : 'transparent',
        border:'none', borderRadius:8,
        cursor:'pointer', textAlign:'left',
        transition:'background .1s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      <span style={{ fontSize:20 }}>{c.flag}</span>
      <span style={{ flex:1, fontSize:13, color:'var(--text)', fontWeight: selected ? 700 : 400 }}>{c.country}</span>
      <span style={{ fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)' }}>{c.code}</span>
    </button>
  )
}

/** Libellé localisé d'un mode de paiement (incl. 'mixed' → Mixte/Mixed/Mixto/Misto). */
export function payModeLabel(mode: string, lang: string): string {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  switch (mode) {
    case 'cash':   return i('Espèces', 'Cash', 'Efectivo', 'Contanti')
    case 'card':   return i('Carte', 'Card', 'Tarjeta', 'Carta')
    case 'wave':   return 'Wave'
    case 'orange': return 'Orange Money'
    case 'mtn':    return 'MTN MoMo'
    case 'mixed':  return i('Mixte', 'Mixed', 'Mixto', 'Misto')
    default:       return i('Mobile', 'Mobile', 'Móvil', 'Mobile')
  }
}
