import { useEffect, useState } from 'react'
import { AlertTriangle, PackageX, TrendingUp, Boxes } from 'lucide-react'
import { reportsApi, type InventoryInsights as Insights } from '@/lib/api'
import { stockCatLabel } from '@/components/stock/stockShared'

interface Props {
  fmt: (n: number) => string
  lang: string
}

/**
 * Rapports actionnables v1 — « À réapprovisionner » (stock ≤ seuil, classé par
 * vélocité 30j) + « Produits dormants » (aucune vente sur 60j, par valeur
 * immobilisée). Données serveur (/api/reports/inventory). Présentationnel +
 * fetch ; tokens Daylight, i18n fr/en/es/it.
 */
export default function InventoryInsights({ fmt, lang }: Props) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const dloc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    reportsApi.inventory()
      .then(d => { if (alive) setData(d) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const th: React.CSSProperties = { textAlign: 'right' }
  const sectionHead = (icon: React.ReactNode, title: string, count: number, color: string) => (
    <div className="panel-head">
      <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color }}>{icon}</span> {title}
        <span className="nav-badge" style={{ background: 'var(--bg4)', color: 'var(--text2)', border: '1px solid var(--border)', marginLeft: 4 }}>{count}</span>
      </span>
    </div>
  )

  if (loading) {
    return <div className="panel" style={{ color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>{i('Chargement des rapports…', 'Loading reports…', 'Cargando informes…', 'Caricamento report…')}</div>
  }
  if (error || !data) {
    return <div className="panel" style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <AlertTriangle size={15} /> {i('Impossible de charger les rapports.', 'Could not load reports.', 'No se pudieron cargar los informes.', 'Impossibile caricare i report.')}
    </div>
  }

  const emptyRow = (msg: string) => (
    <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>{msg}</div>
  )

  return (
    <>
      {/* ── À réapprovisionner ── */}
      <div className="panel">
        {sectionHead(<AlertTriangle size={15} />, i('À réapprovisionner', 'To reorder', 'Para reabastecer', 'Da riordinare'), data.reorder.length, 'var(--danger)')}
        {data.reorder.length === 0
          ? emptyRow(i('Aucun produit sous le seuil. 👍', 'No product below threshold. 👍', 'Ningún producto bajo el umbral. 👍', 'Nessun prodotto sotto la soglia. 👍'))
          : (
            <div className="table-wrap data-table">
              <table aria-label={i('À réapprovisionner', 'To reorder', 'Para reabastecer', 'Da riordinare')}>
                <thead>
                  <tr>
                    <th scope="col">{i('Produit', 'Product', 'Producto', 'Prodotto')}</th>
                    <th scope="col" style={th}>{i('Stock', 'Stock', 'Stock', 'Scorta')}</th>
                    <th scope="col" style={th}>{i('Seuil', 'Threshold', 'Umbral', 'Soglia')}</th>
                    <th scope="col" style={th}>{i('Vélocité 30j', 'Velocity 30d', 'Velocidad 30d', 'Velocità 30g')}</th>
                    <th scope="col" style={th}>{i('Réappro suggérée', 'Suggested reorder', 'Reabast. sugerido', 'Riordino suggerito')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reorder.map(r => (
                    <tr key={r.id}>
                      <td className="td-bold">
                        {r.name}
                        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{stockCatLabel(r.category, lang)}</div>
                      </td>
                      <td className="td-num">
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
                          borderRadius: 'var(--r-full)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
                          fontFamily: 'var(--mono)',
                          background: r.stock === 0 ? 'var(--c-red-bg)' : 'var(--c-orange-bg)',
                          border: r.stock === 0 ? '1px solid var(--c-red-border)' : '1px solid var(--c-orange-border)',
                          color: r.stock === 0 ? 'var(--danger)' : 'var(--warn)',
                        }}>{r.stock}</span>
                      </td>
                      <td className="td-num" style={{ color: 'var(--text3)' }}>{r.threshold}</td>
                      <td className="td-num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <TrendingUp size={12} style={{ color: r.velocity30d > 0 ? 'var(--acc2)' : 'var(--text4)' }} />
                        {r.velocity30d}
                      </td>
                      <td className="td-num">
                        {r.suggestedQty > 0
                          ? <span style={{ color: 'var(--p3)', fontWeight: 'var(--fw-bold)' }} title={i('Suggestion (couvrir 30j)', 'Suggestion (cover 30d)', 'Sugerencia (cubrir 30d)', 'Suggerimento (coprire 30g)')}>≈ {r.suggestedQty}</span>
                          : <span style={{ color: 'var(--text4)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', marginTop: 8, fontStyle: 'italic' }}>
                {i('« ≈ » = quantité indicative pour couvrir 30 jours à la vélocité actuelle.', '“≈” = indicative quantity to cover 30 days at current velocity.', '«≈» = cantidad indicativa para cubrir 30 días a la velocidad actual.', '«≈» = quantità indicativa per coprire 30 giorni alla velocità attuale.')}
              </div>
            </div>
          )}
      </div>

      {/* ── Produits dormants ── */}
      <div className="panel">
        {sectionHead(<PackageX size={15} />, i('Produits dormants', 'Dormant products', 'Productos inactivos', 'Prodotti dormienti'), data.dormant.length, 'var(--warn)')}
        {data.dormant.length === 0
          ? emptyRow(i('Aucun stock dormant. 👍', 'No dormant stock. 👍', 'Sin stock inactivo. 👍', 'Nessuna scorta dormiente. 👍'))
          : (
            <div className="table-wrap data-table">
              <table aria-label={i('Produits dormants', 'Dormant products', 'Productos inactivos', 'Prodotti dormienti')}>
                <thead>
                  <tr>
                    <th scope="col">{i('Produit', 'Product', 'Producto', 'Prodotto')}</th>
                    <th scope="col">{i('Dernière vente', 'Last sale', 'Última venta', 'Ultima vendita')}</th>
                    <th scope="col" style={th}>{i('Stock', 'Stock', 'Stock', 'Scorta')}</th>
                    <th scope="col" style={th}>{i('Valeur immobilisée', 'Tied-up value', 'Valor inmovilizado', 'Valore immobilizzato')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dormant.map(d => (
                    <tr key={d.id}>
                      <td className="td-bold">
                        {d.name}
                        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{stockCatLabel(d.category, lang)}</div>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 'var(--fs-label)' }}>
                        {d.lastSale
                          ? <>{new Date(d.lastSale).toLocaleDateString(dloc, { day: '2-digit', month: 'short', year: 'numeric' })}{d.daysSinceSale != null && <span style={{ color: 'var(--text4)' }}> · {i('il y a', '', 'hace', 'da')} {d.daysSinceSale} {i('j', 'd ago', 'd', 'g')}</span>}</>
                          : <span style={{ fontStyle: 'italic', color: 'var(--text4)' }}>{i('Jamais vendu', 'Never sold', 'Nunca vendido', 'Mai venduto')}</span>}
                      </td>
                      <td className="td-num">
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
                          borderRadius: 'var(--r-full)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
                          fontFamily: 'var(--mono)',
                          background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)',
                        }}>{d.stock}</span>
                      </td>
                      <td className="td-num" style={{ color: 'var(--warn)', fontWeight: 'var(--fw-bold)' }}>{fmt(d.immobilizedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', marginTop: 8, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Boxes size={12} /> {i(`Aucune vente depuis ${data.dormantDays} jours · valeur = stock × coût d'achat.`, `No sale in ${data.dormantDays} days · value = stock × purchase cost.`, `Sin ventas desde hace ${data.dormantDays} días · valor = stock × costo de compra.`, `Nessuna vendita da ${data.dormantDays} giorni · valore = scorta × costo d'acquisto.`)}
              </div>
            </div>
          )}
      </div>
    </>
  )
}
