import { TrendingUp, TrendingDown } from 'lucide-react'

export type Period = 'today' | '7days' | '30days' | '3months' | 'year'

export const PERIOD_DATA: Record<Period, {
  ca: number; margin: number; transactions: number; avgCart: number
  caEvol: number; marginEvol: number; txEvol: number; cartEvol: number
}> = {
  today:    { ca: 485000,    margin: 142000,   transactions: 23,   avgCart: 21087, caEvol: 12.4,  marginEvol: 8.2,   txEvol: 15.0,  cartEvol: -2.1 },
  '7days':  { ca: 2840000,   margin: 854000,   transactions: 147,  avgCart: 19320, caEvol: 8.7,   marginEvol: 6.5,   txEvol: 5.2,   cartEvol: 3.3  },
  '30days': { ca: 12600000,  margin: 3780000,  transactions: 612,  avgCart: 20588, caEvol: 15.3,  marginEvol: 11.8,  txEvol: 9.4,   cartEvol: 5.4  },
  '3months':{ ca: 34200000,  margin: 10260000, transactions: 1820, avgCart: 18791, caEvol: 22.1,  marginEvol: 18.6,  txEvol: 14.2,  cartEvol: 6.9  },
  year:     { ca: 142000000, margin: 42600000, transactions: 7840, avgCart: 18112, caEvol: 31.5,  marginEvol: 27.2,  txEvol: 22.8,  cartEvol: 7.1  },
}

export const CHART_DATA = [
  { day: 'Lun', val: 1840000, h: 55 },
  { day: 'Mar', val: 2150000, h: 65 },
  { day: 'Mer', val: 1620000, h: 49 },
  { day: 'Jeu', val: 2890000, h: 87 },
  { day: 'Ven', val: 3320000, h: 100 },
  { day: 'Sam', val: 2640000, h: 79 },
  { day: 'Dim', val: 1180000, h: 35 },
]

export const PAYMENT_MODES = [
  { label: 'Espèces',      pct: 62, color: 'var(--acc2)', amount: 7812000 },
  { label: 'Mobile',       pct: 28, color: 'var(--p2)',   amount: 3528000 },
  { label: 'Carte',        pct: 10, color: 'var(--acc)',  amount: 1260000 },
]

export const RADIAN = Math.PI / 180

export const TOP_PRODUCTS = [
  { rank: 1, name: '🌾 Riz parfumé 5kg',        ca: 1840000, qty: 408  },
  { rank: 2, name: '🫙 Huile palme 1L',           ca: 1530000, qty: 850  },
  { rank: 3, name: '🍚 Sucre 1kg',                ca: 1292500, qty: 1521 },
  { rank: 4, name: '🍅 Tomate concentrée 800g',   ca: 980000,  qty: 700  },
  { rank: 5, name: '🥛 Lait poudre 400g',         ca: 880000,  qty: 400  },
]

export const RECENT_SALES = [
  { ref: 'VNT-2026-148', date: '2026-05-13 14:32', client: 'Marché Central Sandaga',   total: 520000, mode: 'Espèces', items: 6 },
  { ref: 'VNT-2026-147', date: '2026-05-13 11:15', client: 'Super Épicerie du Plateau', total: 215000, mode: 'Mobile',  items: 7 },
  { ref: 'VNT-2026-146', date: '2026-05-13 09:48', client: 'Client direct',             total: 32500,  mode: 'Espèces', items: 2 },
  { ref: 'VNT-2026-145', date: '2026-05-12 16:20', client: 'Boutique Awa Diallo',       total: 87000,  mode: 'Mobile',  items: 3 },
  { ref: 'VNT-2026-144', date: '2026-05-12 14:05', client: 'Client direct',             total: 18500,  mode: 'Espèces', items: 1 },
]

export function Trend({ evol }: { evol: number }) {
  const up = evol >= 0
  return (
    <div className={up ? 'trend-up' : 'trend-down'}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{evol} %
    </div>
  )
}
