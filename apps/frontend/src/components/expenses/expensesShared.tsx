import { Home, Zap, Car, Wrench, Package, Megaphone, GraduationCap, Tag } from 'lucide-react'

export type Category = 'Loyer' | 'Énergie' | 'Transport' | 'Maintenance' | 'Fournitures' | 'Marketing' | 'Formation' | 'Autre'
export type ExpStatus = 'PAYÉ' | 'EN ATTENTE'

export interface Expense {
  id: number; _apiId?: string; date: string; label: string; category: Category
  amount: number; vat: number; mode: string
  status: ExpStatus; recurrent: boolean
}

export const BUDGETS_INIT: Record<Category, number> = {
  Loyer: 500000, Énergie: 150000, Transport: 100000, Maintenance: 200000,
  Fournitures: 50000, Marketing: 100000, Formation: 200000, Autre: 50000,
}

export const CATEGORIES: Category[] = ['Loyer','Énergie','Transport','Maintenance','Fournitures','Marketing','Formation','Autre']

// Libellés d'affichage des catégories (la clé reste la valeur canonique FR
// utilisée pour le filtrage / l'API — on ne traduit que l'affichage).
const CATEGORY_LABELS: Record<string, { fr: string; en: string; es: string; it: string }> = {
  Loyer:       { fr:'Loyer',       en:'Rent',        es:'Alquiler',      it:'Affitto'      },
  Énergie:     { fr:'Énergie',     en:'Energy',      es:'Energía',       it:'Energia'      },
  Transport:   { fr:'Transport',   en:'Transport',   es:'Transporte',    it:'Trasporto'    },
  Maintenance: { fr:'Maintenance', en:'Maintenance', es:'Mantenimiento', it:'Manutenzione' },
  Fournitures: { fr:'Fournitures', en:'Supplies',    es:'Suministros',   it:'Forniture'    },
  Marketing:   { fr:'Marketing',   en:'Marketing',   es:'Marketing',     it:'Marketing'    },
  Formation:   { fr:'Formation',   en:'Training',    es:'Formación',     it:'Formazione'   },
  Autre:       { fr:'Autre',       en:'Other',       es:'Otro',          it:'Altro'        },
}
export const catLabel = (cat: string, lang: string): string =>
  (CATEGORY_LABELS[cat] as Record<string, string> | undefined)?.[lang] ?? CATEGORY_LABELS[cat]?.fr ?? cat

export const CATEGORY_STYLE: Record<Category, { bg: string; color: string; icon: JSX.Element }> = {
  Loyer:       { bg:'rgba(124,111,240,.15)', color:'#A89CF5', icon:<Home size={14}/> },
  Énergie:     { bg:'rgba(240,165,0,.15)',   color:'#F0A500', icon:<Zap size={14}/> },
  Transport:   { bg:'rgba(59,130,246,.15)',  color:'#60A5FA', icon:<Car size={14}/> },
  Maintenance: { bg:'rgba(251,146,60,.15)',  color:'#FB923C', icon:<Wrench size={14}/> },
  Fournitures: { bg:'rgba(20,184,166,.15)',  color:'#2DD4BF', icon:<Package size={14}/> },
  Marketing:   { bg:'rgba(236,72,153,.15)',  color:'#F472B6', icon:<Megaphone size={14}/> },
  Formation:   { bg:'rgba(14,196,126,.15)',  color:'#0EC47E', icon:<GraduationCap size={14}/> },
  Autre:       { bg:'rgba(136,134,168,.15)', color:'#8886A8', icon:<Tag size={14}/> },
}

export const MODES = ['Espèces','Carte','Chèque','Virement','Prélèvement']
export const VAT_RATES = [0, 10, 18, 20]

export function CatPill({ cat, lang }: { cat: Category; lang: string }) {
  const s = CATEGORY_STYLE[cat]
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px',
      borderRadius:'var(--r-full)', fontSize:12, fontWeight:'var(--fw-semibold)',
      background:s.bg, color:s.color,
    }}>{s.icon} {catLabel(cat, lang)}</span>
  )
}

export function ttcAmount(e: Expense) { return Math.round(e.amount * (1 + e.vat / 100)) }

let _expIdCounter = 1000
export const nextExpId = () => ++_expIdCounter

export function mapApiExpense(e: any): Expense {
  return {
    id: nextExpId(),
    _apiId: e.id,
    date: e.date?.split('T')[0] ?? e.createdAt?.split('T')[0] ?? '',
    label: e.label,
    category: (e.category || 'Autre') as Category,
    amount: e.amountHT ?? 0,
    vat: e.vat ?? 0,
    mode: e.mode || 'Espèces',
    status: (e.status === 'PAYÉ' ? 'PAYÉ' : 'EN ATTENTE') as ExpStatus,
    recurrent: e.recurrent ?? false,
  }
}
