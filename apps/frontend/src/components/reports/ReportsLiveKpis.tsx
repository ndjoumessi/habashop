import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { productsApi, employeesApi, customersApi } from '@/lib/api'
import { normalizeClientType, type ClientTypeValue } from '@/lib/clientType'

/**
 * KPI des onglets Rapports — DONNÉES RÉELLES.
 *
 * ⚠️ Ces blocs remplacent des LITTÉRAUX FABRIQUÉS rendus en production : l'onglet Stock
 * affirmait « 142 articles en stock / 7 en rupture » à un commerçant qui en a 12 et 2, et
 * l'onglet RH affichait un effectif de 8 avec une équipe entière inventée. Le plus parlant :
 * le bloc serveur du haut disait « À réapprovisionner : 2 » pendant que le bloc fabriqué du
 * bas disait « 7 en rupture » — le même écran se contredisait.
 *
 * ⚠️ Les formules sont celles des ÉCRANS SOURCES, pas des variantes : `valeur du stock` =
 * Σ(stock × prix de VENTE) comme `Stock.tsx:108`, `ruptures` = stock ≤ seuil comme
 * `Stock.tsx:107`, `effectif`/`masse salariale` sur les employés ACTIFS comme `HR.tsx:375-376`.
 * Recalculer autrement recréerait la contradiction qu'on vient de supprimer.
 *
 * ⚠️ TROIS états distincts partout (chargement / échec / vide réel). Aucun repli sur une
 * valeur : un rapport qui invente est pire qu'un rapport absent — c'est un support de
 * décision, un commerçant commande son stock dessus.
 */

type L4 = (fr: string, en: string, es: string, it: string) => string

function useList(fetcher: () => Promise<any[]>) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    setRows(null); setFailed(false)
    fetcher()
      .then(d => { if (alive) setRows(Array.isArray(d) ? d : []) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { rows, failed }
}

function StateBox({ failed, i }: { failed: boolean; i: L4 }) {
  if (failed) {
    return (
      <div className="panel" style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={15} /> {i('Données indisponibles.', 'Data unavailable.', 'Datos no disponibles.', 'Dati non disponibili.')}
      </div>
    )
  }
  return <div className="panel" style={{ color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>{i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}</div>
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/** Onglet STOCK — articles, valeur, ruptures. Mêmes formules que la page Stock. */
export function StockKpis({ fmt, i }: { fmt: (n: number) => string; i: L4 }) {
  const { rows, failed } = useList(productsApi.list)
  if (!rows) return <StateBox failed={failed} i={i} />
  // Champs du FIL (cf. le mapper de Stock.tsx) : sellPrice / stockQty / stockMin.
  const stockOf = (p: any) => p.stockQty ?? 0
  const minOf = (p: any) => p.stockMin ?? 5
  const value = rows.reduce((s, p) => s + stockOf(p) * (p.sellPrice ?? 0), 0)
  const low = rows.filter(p => stockOf(p) <= minOf(p)).length
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <KpiCard color="var(--acc2)" label={i('Articles en stock', 'Items in stock', 'Artículos en stock', 'Articoli in stock')}
        value={String(rows.length)} sub={i('références actives', 'active SKUs', 'SKU activos', 'SKU attivi')} />
      <KpiCard color="var(--p2)" label={i('Valeur du stock', 'Stock value', 'Valor del stock', 'Valore stock')}
        value={fmt(value)} sub={i('au prix de vente', 'at sale price', 'a precio de venta', 'al prezzo di vendita')} />
      <KpiCard color={low > 0 ? 'var(--danger)' : 'var(--acc2)'} label={i('Ruptures / stock bas', 'Out of / low stock', 'Agotados / stock bajo', 'Esauriti / stock basso')}
        value={String(low)} sub={i('stock sous le seuil', 'below threshold', 'bajo el umbral', 'sotto la soglia')} />
    </div>
  )
}

/** Onglet RH — effectif et masse salariale des employés ACTIFS (comme la page RH). */
export function HrKpis({ fmt, i }: { fmt: (n: number) => string; i: L4 }) {
  const { rows, failed } = useList(employeesApi.list)
  if (!rows) return <StateBox failed={failed} i={i} />
  // ⚠️ Le FIL porte `isActive` (colonne Prisma) ; `HR.tsx` résout
  // `e.active ?? e.isActive ?? e.status !== 'inactive'` sur son objet MAPPÉ. Copier la
  // formule sans copier la résolution du champ donnait un effectif de 0 : la donnée était
  // là, on la lisait sous un nom qui n'existe pas sur la charge brute.
  const isActive = (e: any) => e.active ?? e.isActive ?? e.status !== 'inactive'
  const active = rows.filter(isActive)
  const payroll = active.reduce((s, e) => s + (e.salary ?? 0), 0)
  return (
    /* ⚠️ MÊME grille que les autres onglets (`lg:grid-cols-4`), pas `lg:grid-cols-2`.
       Deux valeurs occupaient deux cartes DEMI-LARGEUR empilées, hautes de toute la zone,
       pendant que Stock et Clients tenaient en cellules de quart. Ce n'est pas la place qui
       manquait : c'est la grille qui différait d'un onglet à l'autre, ce qui fait sauter la
       taille des cartes quand on change d'onglet. Deux cellules sur quatre restent vides —
       c'est le bon résultat : on n'invente pas deux indicateurs pour remplir. */
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard color="var(--p2)" label={i('Effectif total', 'Total staff', 'Plantilla total', 'Organico totale')}
        value={String(active.length)} sub={i('collaborateurs actifs', 'active employees', 'colaboradores activos', 'collaboratori attivi')} />
      <KpiCard color="var(--acc)" label={i('Masse salariale', 'Payroll', 'Masa salarial', 'Costo del personale')}
        value={fmt(payroll)} sub={i('par mois', 'per month', 'por mes', 'al mese')} />
    </div>
  )
}

const SEGMENT_COLOR: Record<ClientTypeValue, string> = {
  wholesale: '#6C47FF', 'semi-wholesale': '#FFB020', retail: '#00D084', loyal: '#00B8FF',
}

/** Onglet CLIENTS — répartition RÉELLE par palier (compte + CA), triée par CA. */
export function ClientSegments({ fmt, i, lang }: { fmt: (n: number) => string; i: L4; lang: string }) {
  const { rows, failed } = useList(customersApi.list)
  if (!rows) return <StateBox failed={failed} i={i} />

  const LABEL: Record<ClientTypeValue, string> = {
    wholesale: i('Grossistes', 'Wholesalers', 'Mayoristas', 'Grossisti'),
    'semi-wholesale': i('Semi-grossistes', 'Semi-wholesalers', 'Semi-mayoristas', 'Semi-grossisti'),
    retail: i('Détail', 'Retail', 'Minoristas', 'Dettaglio'),
    loyal: i('Fidèles', 'Loyal', 'Fieles', 'Fedeli'),
  }
  void lang

  // ⚠️ Le palier passe par le juge unique : la base a porté deux vocabulaires (#215), et
  // comparer au littéral ici recréerait la divergence qu'on vient de fermer.
  const buckets = new Map<ClientTypeValue, { n: number; ca: number }>()
  let untyped = 0
  for (const c of rows) {
    const t = normalizeClientType(c.type)
    if (!t) { untyped++; continue }   // ⚠️ pas de repli sur « retail » : ce serait inventer un palier
    const b = buckets.get(t) ?? { n: 0, ca: 0 }
    // ⚠️ Même piège que l'effectif : le FIL porte `totalRevenue` (colonne Prisma), c'est
    // `mapApiCustomer` qui le renomme `totalCA`. Lire le nom MAPPÉ sur la charge brute
    // aurait mis 0 € à tous les segments — des barres vides sous des comptes justes.
    b.n += 1; b.ca += c.totalCA ?? c.totalRevenue ?? 0
    buckets.set(t, b)
  }
  const segs = [...buckets.entries()].sort((a, b) => b[1].ca - a[1].ca)
  const maxCa = Math.max(1, ...segs.map(([, v]) => v.ca))

  if (segs.length === 0) {
    return <div className="panel" style={{ color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
      {i('Aucun client avec un palier renseigné.', 'No customer with a tier set.', 'Ningún cliente con nivel definido.', 'Nessun cliente con livello impostato.')}
    </div>
  }
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">{i('Segments clients', 'Customer segments', 'Segmentos de clientes', 'Segmenti clienti')}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
        {segs.map(([t, v]) => (
          <div key={t}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEGMENT_COLOR[t], flexShrink: 0 }} />
                {LABEL[t]}
                <span className="nav-badge" style={{ background: 'var(--bg4)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{v.n}</span>
              </span>
              <span className="td-num" style={{ fontSize: 'var(--fs-sm)', color: SEGMENT_COLOR[t] }}>{fmt(v.ca)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((v.ca / maxCa) * 100)}%`, height: '100%', background: SEGMENT_COLOR[t], borderRadius: 99 }} />
            </div>
          </div>
        ))}
        {/* Les clients sans palier sont COMPTÉS À PART, jamais versés dans « Détail » :
            les fondre inventerait un segment et gonflerait son CA. */}
        {untyped > 0 && (
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginTop: 2 }}>
            {untyped} {i('client(s) sans palier renseigné', 'customer(s) with no tier set', 'cliente(s) sin nivel', 'cliente(i) senza livello')}
          </div>
        )}
      </div>
    </div>
  )
}
