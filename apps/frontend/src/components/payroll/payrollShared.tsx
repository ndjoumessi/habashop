import { useAppStore, formatAmount, t } from '@/stores/appStore'
import { openPDF, htmlTable, htmlInfoGrid } from '@/utils/export'

export type PayStatus = 'PAYÉ' | 'EN ATTENTE' | 'SUSPENDU' | 'GÉNÉRÉ'

export interface PayRecord {
  id: number; employee: string; avatar: string; color: string; role: string
  baseSalary: number; bonus: number; overtime: number; deductions: number
  absences: number; status: PayStatus; paidAt: string | null; month: string
}

// Noms de mois FR = base des CLÉS de mois ("Mois AAAA"). L'année est RÉELLE (jamais codée en dur).
const FR_MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
export function buildMonths(year: number): string[] {
  return FR_MONTH_NAMES.map(n => `${n} ${year}`)
}
export const MONTHS = buildMonths(new Date().getFullYear())

export const PAY_COLORS = ['#6C3FD6','#F59E0B','#10B981','#EF4444','#3B82F6','#8B5CF6','#EC4899','#F472B6']
export const currentMonthLabel = MONTHS[new Date().getMonth()] ?? MONTHS[0]

// Localise un libellé de mois FR ("Mai 2026" → mois localisé + année RÉELLE de la clé) ; clé inchangée.
export const monthLabel = (m: string, lang: string) => {
  const [name, yearStr] = m.split(' ')
  const idx = FR_MONTH_NAMES.indexOf(name)
  if (idx < 0) return m
  const year = Number(yearStr) || new Date().getFullYear()
  const loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const s = new Date(year, idx, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Libellés des postes employés (traduits à l'affichage, valeurs custom passent inchangées)
const ROLE_T: Record<string, Record<string, string>> = {
  'Caissier':   { fr:'Caissier',   en:'Cashier',     es:'Cajero',     it:'Cassiere'     },
  'Caissière':  { fr:'Caissière',  en:'Cashier',     es:'Cajera',     it:'Cassiera'     },
  'Vendeur':    { fr:'Vendeur',    en:'Sales rep',   es:'Vendedor',   it:'Venditore'    },
  'Vendeuse':   { fr:'Vendeuse',   en:'Sales rep',   es:'Vendedora',  it:'Venditrice'   },
  'Manager':    { fr:'Manager',    en:'Manager',     es:'Gerente',    it:'Manager'      },
  'Directeur':  { fr:'Directeur',  en:'Director',    es:'Director',   it:'Direttore'    },
  'Comptable':  { fr:'Comptable',  en:'Accountant',  es:'Contable',   it:'Contabile'    },
  'Magasinier': { fr:'Magasinier', en:'Storekeeper', es:'Almacenero', it:'Magazziniere' },
  'Livreur':    { fr:'Livreur',    en:'Delivery',    es:'Repartidor', it:'Fattorino'    },
  'Sécurité':   { fr:'Sécurité',   en:'Security',    es:'Seguridad',  it:'Sicurezza'    },
  'Employé':    { fr:'Employé',    en:'Employee',    es:'Empleado',   it:'Dipendente'   },
}
export const roleLabel = (r: string, lang: string) => ROLE_T[r]?.[lang] ?? r

export const STATUS_CFG: Record<PayStatus, { cls: string; label: string }> = {
  'PAYÉ':       { cls:'badge-green',  label:'PAYÉ'       },
  'EN ATTENTE': { cls:'badge-amber',  label:'EN ATTENTE' },
  'SUSPENDU':   { cls:'badge-red',    label:'SUSPENDU'   },
  'GÉNÉRÉ':     { cls:'badge-violet', label:'GÉNÉRÉ'     },
}

const STATUS_LABELS: Record<PayStatus, Record<string, string>> = {
  'PAYÉ':       { fr:'PAYÉ',       en:'PAID',      es:'PAGADO',     it:'PAGATO'    },
  'EN ATTENTE': { fr:'EN ATTENTE', en:'PENDING',   es:'PENDIENTE',  it:'IN ATTESA' },
  'SUSPENDU':   { fr:'SUSPENDU',   en:'SUSPENDED', es:'SUSPENDIDO', it:'SOSPESO'   },
  'GÉNÉRÉ':     { fr:'GÉNÉRÉ',     en:'GENERATED', es:'GENERADO',   it:'GENERATO'  },
}
export const statusLabel = (s: PayStatus, lang: string) => STATUS_LABELS[s]?.[lang] ?? s

// Taux CNSS salarié (part employé). Base de calcul = salaire de base (XOF).
export const CNSS_RATE = 0.056

export interface PayrollBreakdown {
  brut: number             // salaire de base + primes + heures sup
  absencePenalty: number   // retenue pour absences = round(absences × base / 26)
  cnss: number             // cotisation CNSS = round(base × 5,6 %)
  irpp: number             // impôt sur salaire (résiduel) = round(retenues − CNSS − pénalité absence)
  totalDeductions: number  // retenues totales affichées = retenues saisies + pénalité absence
  net: number              // net à payer = brut − retenues saisies − pénalité absence
}

// Source UNIQUE du calcul de paie (bulletin PDF, modale bulletin, table paie) —
// fonction pure (base XOF). Évite les divergences d'arrondi entre les vues.
export function payrollBreakdown(r: Pick<PayRecord, 'baseSalary' | 'bonus' | 'overtime' | 'deductions' | 'absences'>): PayrollBreakdown {
  const brut = r.baseSalary + r.bonus + r.overtime
  const absencePenalty = Math.round(r.absences * r.baseSalary / 26)
  const cnss = Math.round(r.baseSalary * CNSS_RATE)
  const irpp = Math.round(r.deductions - cnss - absencePenalty)
  return {
    brut,
    absencePenalty,
    cnss,
    irpp,
    totalDeductions: r.deductions + absencePenalty,
    net: brut - r.deductions - absencePenalty,
  }
}

export function calcNet(r: PayRecord) {
  return payrollBreakdown(r).net
}

export function calcBrut(r: PayRecord) {
  return payrollBreakdown(r).brut
}

export function EmpAvatar({ r, size = 32 }: { r: PayRecord; size?: number }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:r.color, display:'flex', alignItems:'center', justifyContent:'center',
      color:'#fff', fontSize:size * 0.35, fontWeight:'var(--fw-bold)',
    }}>{r.avatar}</div>
  )
}

export function printBulletin(bulletin: PayRecord) {
  const { currency, lang } = useAppStore.getState()
  // Montants en base XOF. formatAmount convertit XOF→devise PUIS formate — exactement
  // ce que fait useFormatAmount à l'écran. (Bug corrigé : ne PAS pré-convertir avant,
  // sinon double conversion → PDF ≠ écran, ex. 686,02 € affiché en ~1,05 €.)
  const fmtP = (n: number) => formatAmount(n, currency)

  const { brut, absencePenalty, cnss, irpp, net } = payrollBreakdown(bulletin)

  const gainsRows: string[][] = [
    [t('payslip_base_salary'), '26 j', '100 %', fmtP(bulletin.baseSalary)],
    ...(bulletin.bonus > 0 ? [[t('payslip_bonus'), '', '', fmtP(bulletin.bonus)]] : []),
    ...(bulletin.overtime > 0 ? [[t('payslip_overtime'), '', '25 %', fmtP(bulletin.overtime)]] : []),
  ]
  const retenuesRows: string[][] = [
    [t('payslip_cnss'), '5,6 %', fmtP(cnss)],
    ...(irpp > 0 ? [[t('payslip_tax'), '', fmtP(irpp)]] : []),
    ...(bulletin.absences > 0 ? [[`${t('payslip_absence_deduction')} (${bulletin.absences}j)`, '', fmtP(absencePenalty)]] : []),
  ]

  const body = `
    ${htmlInfoGrid([
      { label: t('hr_new_employee').toUpperCase(), value: `<span style="font-size:16px;font-weight:900;">${bulletin.employee}</span><br><span style="font-size:12px;color:#888;">${roleLabel(bulletin.role, lang)}</span>` },
      { label: t('doc_period').toUpperCase(),      value: `${monthLabel(bulletin.month, lang)}<br><span style="font-size:11px;color:#888;">${lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'} : <strong style="color:${bulletin.status === 'PAYÉ' ? '#059669' : '#d97706'}">${statusLabel(bulletin.status, lang)}</strong></span>` },
    ])}

    <h2>${t('payslip_gains')}</h2>
    ${htmlTable(
      [t('expenses_label'), t('payroll_base'), '%', t('col_amount')],
      gainsRows,
      ['', '', `<strong>${t('payslip_gross')}</strong>`, `<strong>${fmtP(brut)}</strong>`]
    )}

    <h2>${t('payslip_deductions')}</h2>
    ${htmlTable(
      [t('expenses_label'), '%', t('col_amount')],
      retenuesRows,
      ['', `<strong>${t('payslip_total_deductions')}</strong>`, `<strong style="color:#dc2626;">- ${fmtP(bulletin.deductions)}</strong>`]
    )}

    <div class="net-payer">
      <div>
        <div class="net-label">${t('doc_net')}</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">
          ${t('doc_payment_mode')} · ${bulletin.status === 'PAYÉ' ? bulletin.paidAt ?? '' : t('status_pending')}
        </div>
      </div>
      <div class="net-value">${fmtP(net)}</div>
    </div>

    <div class="signature-block">
      <div><div class="signature-line">${t('doc_signature_employer')}</div></div>
      <div><div class="signature-line">${t('doc_signature_employee')}</div></div>
    </div>
  `
  openPDF(`${t('payslip_title')} — ${bulletin.employee} — ${monthLabel(bulletin.month, lang)}`, body)
}
