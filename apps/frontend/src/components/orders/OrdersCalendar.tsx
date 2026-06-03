import { CalendarDays } from 'lucide-react'
import { useConfig } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import type { Order } from './ordersShared'

interface Props {
  orders: Order[]
  currentMonth: Date
  prevMonth: () => void
  nextMonth: () => void
}

export default function OrdersCalendar({ orders, currentMonth, prevMonth, nextMonth }: Props) {
  const { lang } = useConfig()
  const { i } = useI18n()
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><CalendarDays size={14}/> {i('Calendrier des livraisons', 'Delivery calendar', 'Calendario de entregas', 'Calendario consegne')}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="mini-btn" onClick={prevMonth}>← {i('Préc.', 'Prev', 'Ant.', 'Prec.')}</button>
          <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
            {currentMonth.toLocaleDateString(
              lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'it-IT',
              { month: 'long', year: 'numeric' }
            )}
          </span>
          <button className="mini-btn" onClick={nextMonth}>{i('Suiv.', 'Next', 'Sig.', 'Succ.')} →</button>
        </div>
      </div>
      {(() => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const offset = firstDay === 0 ? 6 : firstDay - 1
        const DAY_HEADERS: Record<string, string[]> = {
          fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
          en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
          es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
          it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
        }
        const dayHeaders = DAY_HEADERS[lang] ?? DAY_HEADERS.fr
        const todayStr = new Date().toISOString().split('T')[0]
        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
              {dayHeaders.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', padding: '6px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {Array(offset).fill(null).map((_, i) => (
                <div key={`e-${i}`} style={{ minHeight: 70 }} />
              ))}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dateStr === todayStr
                const deliveries = orders.filter(o => {
                  if (!o.expectedAt) return false
                  return o.expectedAt === dateStr && ['ENVOYÉE','CONFIRMÉE','EN TRANSIT'].includes(o.status)
                })
                const ordered = orders.filter(o => o.date === dateStr)
                return (
                  <div key={day} style={{
                    minHeight: 70, borderRadius: 8, padding: '4px',
                    background: isToday ? 'rgba(91,78,232,.12)' : 'var(--bg3)',
                    border: `1px solid ${isToday ? 'var(--p2)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 400, color: isToday ? 'var(--p2)' : 'var(--text2)', marginBottom: 4 }}>{day}</div>
                    {deliveries.slice(0, 2).map((o, j) => (
                      <div key={j} style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', background: 'rgba(14,196,126,.15)', color: 'var(--acc2)', borderRadius: 4, padding: '2px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${lang === 'en' ? 'Delivery' : lang === 'es' ? 'Entrega' : lang === 'it' ? 'Consegna' : 'Livraison'}: ${o.supplier}`}>
                        ▸ {o.supplier.slice(0, 8)}
                      </div>
                    ))}
                    {ordered.slice(0, 2).map((o, j) => (
                      <div key={j} style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', background: 'rgba(91,78,232,.12)', color: 'var(--p2)', borderRadius: 4, padding: '2px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${lang === 'en' ? 'Order' : lang === 'es' ? 'Pedido' : lang === 'it' ? 'Ordine' : 'Commande'}: ${o.ref}`}>
                        · {o.ref.slice(-6)}
                      </div>
                    ))}
                    {(deliveries.length + ordered.length) > 2 && (
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>+{deliveries.length + ordered.length - 2}</div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(14,196,126,.25)' }} />
                {i('Livraison prévue', 'Expected delivery', 'Entrega prevista', 'Consegna prevista')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(91,78,232,.2)' }} />
                {i('Commande passée', 'Order placed', 'Pedido realizado', 'Ordine effettuato')}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
