// Construit les feuilles Excel (xlsx) des rapports — données BRUTES de la période, en-têtes
// traduites, montants convertis dans la devise d'affichage (nombre → triable/sommable dans Excel).
// Les montants stockés sont en base XOF → convertFromXOF vers la devise courante.
import { convertFromXOF } from '@/stores/appStore'
import type { XlsxSheet } from '@/utils/xlsxWriter'

export interface ReportExportInput {
  lang: string
  currency: string
  range: { from: number; to: number }
  sales: any[]
  expenses: any[]
  products: any[]
  employees: any[]
  filterCat: string  // '' = toutes catégories
}

const localeOf = (lang: string) => lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

export function buildReportSheets(input: ReportExportInput): XlsxSheet[] {
  const { lang, currency, range, sales, expenses, products, employees, filterCat } = input
  const i = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const loc = localeOf(lang)
  const cv = (xof: number) => Math.round(convertFromXOF(xof ?? 0, currency) * 100) / 100 // XOF → devise, 2 déc.
  const cur = (label: string) => `${label} (${currency})`
  const inRange = (ts: number) => Number.isFinite(ts) && ts >= range.from && ts <= range.to
  const dstr = (d: any) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? x.toLocaleDateString(loc) : '' }

  // ── Ventes (filtrées période + catégorie) ──
  const salesP = sales.filter(s => inRange(new Date(s.createdAt).getTime()))
  const salesF = filterCat ? salesP.filter(s => (s.items ?? []).some((it: any) => (it.product?.category ?? '') === filterCat)) : salesP
  const ventes: XlsxSheet = {
    name: i('Ventes', 'Sales', 'Ventas', 'Vendite'),
    headers: [i('Date', 'Date', 'Fecha', 'Data'), i('Référence', 'Reference', 'Referencia', 'Riferimento'),
      i('Mode de paiement', 'Payment method', 'Método de pago', 'Metodo di pagamento'),
      cur(i('Total', 'Total', 'Total', 'Totale')), i('Articles', 'Items', 'Artículos', 'Articoli')],
    rows: salesF.map(s => [
      dstr(s.createdAt),
      `V-${String(s.id ?? '000000').slice(-6).toUpperCase()}`,
      s.paymentMode ?? 'cash',
      cv(s.total ?? 0),
      (s.items ?? []).length,
    ]),
  }

  // ── Stock (filtré catégorie) ──
  const prodF = filterCat ? products.filter(p => (p.category ?? '') === filterCat) : products
  const stock: XlsxSheet = {
    name: i('Stock', 'Stock', 'Stock', 'Magazzino'),
    headers: ['SKU', i('Nom', 'Name', 'Nombre', 'Nome'), i('Catégorie', 'Category', 'Categoría', 'Categoria'),
      i('Quantité', 'Quantity', 'Cantidad', 'Quantità'), i('Seuil mini', 'Min. threshold', 'Umbral mín.', 'Soglia min.'),
      cur(i('Prix de vente', 'Sell price', 'Precio venta', 'Prezzo vendita')),
      cur(i('Valeur stock', 'Stock value', 'Valor stock', 'Valore stock'))],
    rows: prodF.map(p => [
      p.sku ?? '', p.name ?? '', p.category ?? '',
      p.stockQty ?? 0, p.stockMin ?? 0,
      cv(p.sellPrice ?? 0),
      cv((p.sellPrice ?? 0) * (p.stockQty ?? 0)),
    ]),
  }

  // ── Dépenses (filtrées période) ──
  const expP = expenses.filter(e => inRange(new Date(e.date).getTime()))
  const depenses: XlsxSheet = {
    name: i('Dépenses', 'Expenses', 'Gastos', 'Spese'),
    headers: [i('Date', 'Date', 'Fecha', 'Data'), i('Libellé', 'Label', 'Concepto', 'Descrizione'),
      i('Catégorie', 'Category', 'Categoría', 'Categoria'), cur(i('Montant', 'Amount', 'Importe', 'Importo')),
      i('Mode', 'Method', 'Modo', 'Modo'), i('Statut', 'Status', 'Estado', 'Stato')],
    rows: expP.map(e => [
      dstr(e.date), e.label ?? '', e.category ?? '',
      cv(e.amountTTC ?? e.amount ?? 0),
      e.mode ?? '', e.status ?? '',
    ]),
  }

  // ── Paie (tous les employés) ──
  const paie: XlsxSheet = {
    name: i('Paie', 'Payroll', 'Nómina', 'Paghe'),
    headers: [i('Employé', 'Employee', 'Empleado', 'Dipendente'), i('Rôle', 'Role', 'Rol', 'Ruolo'),
      i('Département', 'Department', 'Departamento', 'Reparto'),
      cur(i('Salaire mensuel', 'Monthly salary', 'Salario mensual', 'Stipendio mensile'))],
    rows: employees.map(e => [e.name ?? '', e.role ?? '', e.department ?? e.dept ?? '', cv(e.salary ?? 0)]),
  }

  return [ventes, stock, depenses, paie]
}
