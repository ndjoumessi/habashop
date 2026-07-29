import { useAppStore, formatAmount, formatInCurrency, convertFromXOF, CURRENCY_DECIMALS, t } from '@/stores/appStore'
import { openPDF, htmlTable, htmlInfoGrid } from '@/utils/export'

export type PayStatus = 'PAYÉ' | 'EN ATTENTE' | 'SUSPENDU' | 'GÉNÉRÉ'

export interface PayRecord {
  // ⚠️ `id` était un NUMBER dérivé de l'index du tableau (`i + 1`) — or `Employee.id` est un
  // cuid STRING (cf. CLAUDE.md « jamais Number(id) »). « Marquer payé » visait donc une
  // POSITION, pas une personne : un changement d'ordre de la liste payait le mauvais bulletin.
  // Désormais : identifiant du bulletin persisté, ou `pending:<employeeId>` tant qu'il n'existe
  // pas encore en base.
  id: string
  employeeId: string        // cuid de l'employé — la seule identité stable
  employee: string; avatar: string; color: string; role: string
  baseSalary: number; bonus: number; overtime: number; deductions: number
  absences: number; status: PayStatus; paidAt: string | null; month: string
}

/** Préfixe d'un bulletin PAS ENCORE persisté (aucune ligne en base pour ce mois). */
export const PENDING_PREFIX = 'pending:'
export const isPending = (id: string) => id.startsWith(PENDING_PREFIX)

// Noms de mois FR = base des CLÉS de mois ("Mois AAAA"). L'année est RÉELLE (jamais codée en dur).
const FR_MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
export function buildMonths(year: number): string[] {
  return FR_MONTH_NAMES.map(n => `${n} ${year}`)
}
export const MONTHS = buildMonths(new Date().getFullYear())

/**
 * Libellé d'écran (« Juillet 2026 ») → clé de base « 2026-07 ».
 *
 * ⚠️ Le libellé FR ne doit JAMAIS atteindre le serveur : une clé qui dépend de la langue
 * d'affichage rend les données illisibles au changement de locale, et deux tenants en langues
 * différentes écriraient des mois incompatibles. Le serveur REFUSE d'ailleurs tout ce qui
 * n'est pas `YYYY-MM` (400).
 *
 * Rend `null` si le libellé n'est pas reconnu — jamais un mois par défaut : un repli
 * silencieux écrirait la paie sur le mauvais mois.
 */
export function monthKey(label: string): string | null {
  const [name, yearStr] = label.split(' ')
  const idx = FR_MONTH_NAMES.indexOf(name)
  const year = Number(yearStr)
  if (idx < 0 || !Number.isInteger(year) || year < 1970) return null
  return `${year}-${String(idx + 1).padStart(2, '0')}`
}

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

/**
 * ⚠️ SOURCE UNIQUE des retenues de paie — front. Miroir exact du backend
 * (`apps/backend/src/utils/payroll.ts`), exercé sur `docs/shared-fixtures/payroll-net-cases.json`.
 *
 * ⚠️ IL Y AVAIT DEUX RÈGLES INCOMPATIBLES DANS LE DÉPÔT, et le bulletin PDF appliquait la
 * mauvaise. Mesuré : ce fichier calculait CNSS **5,6 % du salaire de BASE** avec un IRPP
 * **résiduel**, et surtout ni l'un ni l'autre ne réduisait le net (c'était une simple
 * ventilation d'affichage de `deductions`) ; pendant que `PayrollGrid.tsx` et
 * `PayrollPayslips.tsx` appliquaient **8 % + 5 % du brut, réellement déduits**. Sur
 * 150 000 XOF sans prime, le PDF imprimait 150 000 et l'onglet RH 130 500 — deux nets
 * différents pour le même salaire, sur des documents remis à l'employé.
 *
 * Le commentaire de `PayrollGrid.tsx` se déclarait d'ailleurs « source unique (cf. payroll-calc) »
 * alors que payroll-calc divergeait. Un doublon qui s'affirme canonique est pire qu'un doublon
 * assumé : il décourage la vérification.
 *
 * RÈGLE RETENUE (arbitrage produit du 2026-07-30) : 8 % + 5 % du BRUT, calculés et DÉDUITS.
 * Les 6 autres fichiers qui codaient `0.08` en dur importent désormais ces constantes.
 */
export const CNSS_RATE = 0.08 // cotisation salariale CNSS, assise sur le BRUT
export const IR_RATE   = 0.05 // impôt sur salaire, assis sur le BRUT

/** Un mois de paie compte 26 jours ouvrés — base de la retenue pour absence. */
export const WORKING_DAYS = 26

export interface PayrollBreakdown {
  brut: number             // salaire de base + primes + heures sup
  cnss: number             // CNSS salarié = round(brut × 8 %) — DÉDUITE du net
  ir: number               // impôt sur salaire = round(brut × 5 %) — DÉDUIT du net
  absencePenalty: number   // retenue absences = round(absences × base / 26)
  exceptional: number      // retenues EXCEPTIONNELLES saisies (avance, casse, saisie sur salaire)
  totalDeductions: number  // cnss + ir + exceptionnelles + pénalité absence
  net: number              // net à payer = brut − totalDeductions
}

/**
 * Source UNIQUE du calcul (bulletin PDF, modale bulletin, table paie, onglet RH, backend).
 * Fonction pure, base XOF, arrondis à l'unité.
 *
 * ⚠️ `deductions` = retenues EXCEPTIONNELLES, elles s'AJOUTENT aux cotisations (elles n'en sont
 * plus la ventilation). Une avance sur salaire et la CNSS sont deux choses distinctes ; les
 * confondre faisait qu'une avance de 0 annulait aussi les cotisations.
 */
export function payrollBreakdown(r: Pick<PayRecord, 'baseSalary' | 'bonus' | 'overtime' | 'deductions' | 'absences'>): PayrollBreakdown {
  const brut = r.baseSalary + r.bonus + r.overtime
  const cnss = Math.round(brut * CNSS_RATE)
  const ir   = Math.round(brut * IR_RATE)
  const absencePenalty = Math.round(r.absences * r.baseSalary / WORKING_DAYS)
  const exceptional = r.deductions
  const totalDeductions = cnss + ir + exceptional + absencePenalty
  return { brut, cnss, ir, absencePenalty, exceptional, totalDeductions, net: brut - totalDeductions }
}

/**
 * ⚠️ COHÉRENCE ARITHMÉTIQUE DU DOCUMENT — détail XOF → devise d'AFFICHAGE.
 *
 * Le calcul vit en XOF (devise pivot) ; l'affichage peut être en EUR/USD/… avec 2 décimales.
 * Convertir chaque ligne PUIS le total séparément produit un bulletin qui ne s'additionne pas.
 *
 * MESURÉ sur 350 000 XOF affichés en EUR (parité fixe 655,957) :
 *   lignes    : CNSS 42,69 · IR 26,68
 *   total si on convertit le total XOF (45 500)  → 69,36   ✗ (42,69 + 26,68 = 69,37)
 *   net   si on convertit le net XOF (304 500)   → 464,21  ✗ (533,57 − 69,37 = 464,20)
 *
 * Un écart d'un centime, mais sur un bulletin de paie : l'employé qui additionne les lignes
 * n'obtient pas le total imprimé. Un document qui ne s'additionne pas est inutilisable, même
 * s'il est « plus proche » de la valeur en base. On impose donc, dans la devise d'affichage :
 *   total = SOMME des lignes arrondies   ·   net = brut − total
 *
 * ⚠️ En XOF (0 décimale, aucune conversion) tout est déjà entier : ce helper est neutre. Le
 * problème n'apparaît QUE pour une devise d'affichage à décimales.
 *
 * ⚠️ Les valeurs rendues sont DÉJÀ CONVERTIES : les formater avec `formatInCurrency`, jamais
 * avec `fmt()`/`formatAmount` qui reconvertiraient (double conversion, cf. § Règles devise —
 * c'est l'exception documentée « valeurs déjà en devise tenant »).
 */
export interface PayrollDisplay {
  baseSalary: number; bonus: number; overtime: number; brut: number
  cnss: number; ir: number; absencePenalty: number; exceptional: number
  totalDeductions: number; net: number
}

export function payrollDisplay(
  r: Pick<PayRecord, 'baseSalary' | 'bonus' | 'overtime' | 'deductions' | 'absences'>,
  currency: string,
): PayrollDisplay {
  const bd = payrollBreakdown(r)
  const dec = CURRENCY_DECIMALS[currency as keyof typeof CURRENCY_DECIMALS] ?? 2
  const f = 10 ** dec
  const arrondi = (x: number) => Math.round(x * f) / f
  const conv = (xof: number) => arrondi(convertFromXOF(xof, currency))

  // ── GAINS : le brut est la somme des lignes affichées, pas la conversion du brut XOF.
  // Même raison que pour les retenues : le bulletin liste base + primes + heures sup et
  // annonce un TOTAL BRUT ; il doit s'additionner.
  const baseSalary = conv(r.baseSalary)
  const bonus = conv(r.bonus)
  const overtime = conv(r.overtime)
  const brut = arrondi(baseSalary + bonus + overtime)

  // ── RETENUES : total = somme des lignes affichées, jamais la conversion du total XOF.
  const cnss = conv(bd.cnss)
  const ir = conv(bd.ir)
  const absencePenalty = conv(bd.absencePenalty)
  const exceptional = conv(bd.exceptional)
  const totalDeductions = arrondi(cnss + ir + absencePenalty + exceptional)

  // ── NET : déduit du brut et du total AFFICHÉS, jamais de la conversion du net XOF.
  return {
    baseSalary, bonus, overtime, brut,
    cnss, ir, absencePenalty, exceptional, totalDeductions,
    net: arrondi(brut - totalDeductions),
  }
}

/** Formate une valeur DÉJÀ convertie (sortie de `payrollDisplay`) — pas de reconversion. */
export const fmtDisplay = (v: number, currency: string) => formatInCurrency(v, currency)

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
  // ⚠️ On passe par `payrollDisplay` : les montants sont DÉJÀ convertis dans la devise
  // d'affichage, avec total = somme des lignes et net = brut − total. Les formater donc avec
  // `fmtDisplay` (= `formatInCurrency`), JAMAIS avec `formatAmount` qui reconvertirait depuis
  // XOF — double conversion (le bug « 686,02 € affiché en ~1,05 € »).
  const d = payrollDisplay(bulletin, currency)
  const fmtP = (n: number) => fmtDisplay(n, currency)

  const { brut, absencePenalty, cnss, ir, exceptional, net, totalDeductions } = d

  const gainsRows: string[][] = [
    [t('payslip_base_salary'), '26 j', '100 %', fmtP(d.baseSalary)],
    ...(bulletin.bonus > 0 ? [[t('payslip_bonus'), '', '', fmtP(d.bonus)]] : []),
    ...(bulletin.overtime > 0 ? [[t('payslip_overtime'), '', '25 %', fmtP(d.overtime)]] : []),
  ]
  // ⚠️ CNSS et IR sont TOUJOURS affichés : ils sont désormais réellement déduits du net.
  // Avant, ils n'apparaissaient que si `deductions > 0` — cohérent avec l'ancienne règle où
  // ils n'étaient qu'une VENTILATION de `deductions`, faux avec la nouvelle. Le taux est rendu
  // depuis les constantes, jamais écrit dans le libellé i18n (un libellé « 5,6 % » redevient
  // faux au premier changement de loi, dans 4 langues à la fois).
  const pct = (r: number) => `${String(r * 100).replace('.', ',')} %`
  const retenuesRows: string[][] = [
    [t('payslip_cnss'), pct(CNSS_RATE), fmtP(cnss)],
    [t('payslip_tax'),  pct(IR_RATE),   fmtP(ir)],
    ...(exceptional > 0 ? [[t('payslip_exceptional'), '', fmtP(exceptional)]] : []),
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
      // ⚠️ Total = SOMME des lignes affichées ci-dessus (CNSS + IR + exceptionnelles +
      // pénalité absence), calculée dans la devise d'affichage par `payrollDisplay`. Le
      // commentaire précédent décrivait l'ancienne règle (« retenues saisies + pénalité »).
      ['', `<strong>${t('payslip_total_deductions')}</strong>`, `<strong style="color:#dc2626;">- ${fmtP(totalDeductions)}</strong>`]
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
