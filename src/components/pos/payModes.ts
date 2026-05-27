// Modes de paiement partagés entre le panier (POSCart) et la confirmation (POSConfirmModal).
export const PAY_MODES = [
  { id: 'cash',   icon: '💵', fr: 'Espèces', en: 'Cash',   es: 'Efectivo', it: 'Contanti' },
  { id: 'wave',   icon: '🌊', fr: 'Wave',    en: 'Wave',   es: 'Wave',     it: 'Wave'     },
  { id: 'orange', icon: '🟠', fr: 'Orange',  en: 'Orange', es: 'Orange',   it: 'Orange'   },
  { id: 'card',   icon: '💳', fr: 'Carte',   en: 'Card',   es: 'Tarjeta',  it: 'Carta'    },
] as const
