import { useState, useEffect } from 'react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'

type ResendEventType = 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked'

interface ResendEvent {
  type:      ResendEventType
  email:     string
  timestamp: string
}

interface ResendStats {
  sent:        number
  failed:      number
  retried:     number
  queued:      number
  avgDuration: number
}

interface ResendMonitorProps {
  ratelimitLimit?:     number
  ratelimitRemaining?: number
  ratelimitReset?:     number
  dailyQuota?:         number
  dailyLimit?:         number
  monthlyQuota?:       number
  monthlyLimit?:       number
  stats?:              ResendStats
  events?:             ResendEvent[]
  plan?:               'free' | 'pro' | 'enterprise'
  lang?:               string
}

// Données mock par défaut (le composant est fonctionnel sans aucune prop)
const DEFAULT_EVENTS: ResendEvent[] = [
  { type: 'delivered',  email: 'admin@habashop.com', timestamp: '09:14:32' },
  { type: 'delivered',  email: 'kone@habashop.com',  timestamp: '09:13:45' },
  { type: 'opened',     email: 'kone@habashop.com',  timestamp: '09:12:18' },
  { type: 'bounced',    email: 'test@invalid.xyz',   timestamp: '09:11:55' },
  { type: 'delivered',  email: 'demo@habashop.com',  timestamp: '09:10:33' },
  { type: 'clicked',    email: 'admin@habashop.com', timestamp: '09:09:12' },
  { type: 'complained', email: 'spam@example.com',   timestamp: '09:08:01' },
]

const DEFAULT_STATS: ResendStats = {
  sent:        1284,
  failed:      23,
  retried:     7,
  queued:      4,
  avgDuration: 342,
}

export default function ResendMonitor({
  ratelimitLimit     = 5,
  ratelimitRemaining = 3,
  ratelimitReset     = 12,
  dailyQuota         = 67,
  dailyLimit         = 100,
  monthlyQuota       = 2341,
  monthlyLimit       = 3000,
  stats              = DEFAULT_STATS,
  events             = DEFAULT_EVENTS,
  plan               = 'free',
  lang               = 'fr',
}: ResendMonitorProps) {

  // Auto-refresh simulé toutes les 5 secondes
  const [tick, setTick] = useState(0)
  const [liveRemaining, setLiveRemaining] = useState(ratelimitRemaining)
  const [liveReset, setLiveReset] = useState(ratelimitReset)
  const [liveEvents, setLiveEvents] = useState<ResendEvent[]>(events)
  const [liveStats, setLiveStats] = useState<ResendStats>(stats)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
      // Simule des variations légères
      setLiveRemaining(r =>
        Math.max(0, Math.min(ratelimitLimit, r + (Math.random() > 0.5 ? 1 : -1)))
      )
      setLiveReset(r => (r <= 5 ? ratelimitReset : r - 5))
      // Ajoute un événement simulé occasionnellement
      if (Math.random() > 0.7) {
        const types = ['delivered', 'delivered', 'delivered', 'opened', 'clicked', 'bounced'] as const
        const emails = ['user@senegal.sn', 'boutique@ci.com', 'shop@mali.ml', 'commerce@bf.bf']
        const newEvent: ResendEvent = {
          type:      types[Math.floor(Math.random() * types.length)],
          email:     emails[Math.floor(Math.random() * emails.length)],
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        }
        setLiveEvents(prev => [newEvent, ...prev.slice(0, 6)])
        if (newEvent.type === 'delivered') {
          setLiveStats(s => ({ ...s, sent: s.sent + 1 }))
        }
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [ratelimitLimit, ratelimitReset])

  // Couleur selon le pourcentage d'utilisation
  const getColor = (used: number, total: number) => {
    const pct = (used / total) * 100
    if (pct > 80) return 'var(--danger)'
    if (pct > 60) return 'var(--acc)'
    return 'var(--acc2)'
  }

  // Config des événements webhook
  const EVENT_CONFIG: Record<ResendEventType, { icon: string; label: string; color: string }> = {
    delivered:  { icon: '✅', label: lang === 'en' ? 'Delivered' : lang === 'es' ? 'Entregado' : lang === 'it' ? 'Consegnato' : 'Livré', color: 'var(--acc2)' },
    bounced:    { icon: '⚠️', label: lang === 'en' ? 'Bounced' : lang === 'es' ? 'Rebote' : lang === 'it' ? 'Rimbalzo' : 'Rebond',   color: 'var(--danger)' },
    complained: { icon: '🚫', label: lang === 'en' ? 'Spam' : lang === 'es' ? 'Spam' : lang === 'it' ? 'Spam' : 'Spam',      color: '#FF3B5C' },
    opened:     { icon: '👁',  label: lang === 'en' ? 'Opened' : lang === 'es' ? 'Abierto' : lang === 'it' ? 'Aperto' : 'Ouvert',    color: 'var(--acc3)' },
    clicked:    { icon: '🖱️', label: lang === 'en' ? 'Clicked' : lang === 'es' ? 'Clicado' : lang === 'it' ? 'Cliccato' : 'Cliqué',   color: 'var(--p3)' },
  }

  // Calculs
  const dailyPct   = Math.round((dailyQuota / dailyLimit) * 100)
  const monthlyPct = Math.round((monthlyQuota / monthlyLimit) * 100)
  const ratePct    = Math.round(((ratelimitLimit - liveRemaining) / ratelimitLimit) * 100)

  // Alertes
  const bounceRate = liveStats.failed / Math.max(1, liveStats.sent)
  const alerts = [
    monthlyPct > 80 && {
      level: 'danger',
      msg: lang === 'fr'
        ? `Quota mensuel à ${monthlyPct}% — ${monthlyLimit - monthlyQuota} emails restants`
        : `Monthly quota at ${monthlyPct}% — ${monthlyLimit - monthlyQuota} emails left`,
    },
    bounceRate > 0.02 && {
      level: 'warn',
      msg: lang === 'fr'
        ? `Taux de rebond élevé : ${(bounceRate * 100).toFixed(1)}% (seuil: 2%)`
        : `High bounce rate: ${(bounceRate * 100).toFixed(1)}% (threshold: 2%)`,
    },
    liveStats.avgDuration > 2000 && {
      level: 'warn',
      msg: lang === 'fr'
        ? `Temps de réponse élevé : ${liveStats.avgDuration}ms`
        : `High response time: ${liveStats.avgDuration}ms`,
    },
  ].filter(Boolean) as { level: string; msg: string }[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>

      {/* ── ALERTES ──────────────────────────── */}
      {alerts.map((alert, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: alert.level === 'danger' ? 'rgba(255,59,92,.08)' : 'rgba(255,149,0,.08)',
          border: `1px solid ${alert.level === 'danger' ? 'rgba(255,59,92,.25)' : 'rgba(255,149,0,.25)'}`,
          borderRadius: 10, fontSize: 12,
          color: alert.level === 'danger' ? 'var(--danger)' : 'var(--acc)', fontWeight: 600,
        }}>
          <span>{alert.level === 'danger' ? '🔴' : '⚠️'}</span>
          {alert.msg}
        </div>
      ))}

      {/* ── RATE LIMIT GAUGE ─────────────────── */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc3)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Rate Limit API</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc2)', boxShadow: '0 0 6px var(--acc2)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>live</span>
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{
            height: '100%', width: `${ratePct}%`,
            background: `linear-gradient(90deg, var(--acc3), ${ratePct > 80 ? 'var(--danger)' : ratePct > 60 ? 'var(--acc)' : 'var(--acc3)'})`,
            borderRadius: 99, transition: 'width .5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
          <span>
            <span style={{ fontWeight: 800, color: 'var(--acc3)', fontFamily: 'var(--mono)' }}>{liveRemaining}</span>
            /{ratelimitLimit} {lang === 'en' ? 'req/s left' : lang === 'es' ? 'req/s restantes' : lang === 'it' ? 'req/s rimaste' : 'req/s restantes'}
          </span>
          <span style={{ fontFamily: 'var(--mono)' }}>{lang === 'en' ? 'Reset in' : lang === 'es' ? 'Reinicio en' : lang === 'it' ? 'Reset tra' : 'Reset dans'} {liveReset}s</span>
        </div>
      </div>

      {/* ── QUOTA JOUR + MOIS ─────────────────── */}
      <ResponsiveGrid min={160} gap={10}>
        {[
          { label: lang === 'en' ? 'Daily Quota' : lang === 'es' ? 'Cuota diaria' : lang === 'it' ? 'Quota giornaliera' : 'Quota Journalier', used: dailyQuota, total: dailyLimit, pct: dailyPct, sublabel: `${dailyLimit - dailyQuota} ${lang === 'en' ? 'left' : lang === 'es' ? 'restantes' : lang === 'it' ? 'rimanenti' : 'restants'}` },
          { label: lang === 'en' ? 'Monthly Quota' : lang === 'es' ? 'Cuota mensual' : lang === 'it' ? 'Quota mensile' : 'Quota Mensuel', used: monthlyQuota, total: monthlyLimit, pct: monthlyPct, sublabel: `${monthlyLimit - monthlyQuota} ${lang === 'en' ? 'left' : lang === 'es' ? 'restantes' : lang === 'it' ? 'rimanenti' : 'restants'}` },
        ].map((q, i) => {
          const color = getColor(q.used, q.total)
          return (
            <div key={i} style={{ background: 'var(--bg3)', border: `1px solid ${q.pct > 80 ? 'rgba(255,59,92,.25)' : 'var(--border)'}`, borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>{q.label}</div>
              <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 10px' }}>
                <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${q.pct} ${100 - q.pct}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .5s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color, fontFamily: 'var(--mono)' }}>{q.pct}%</div>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                <span style={{ fontWeight: 800, color: 'var(--text)' }}>{q.used.toLocaleString('fr-FR')}</span>/{q.total.toLocaleString('fr-FR')}
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, color: q.pct > 80 ? 'var(--danger)' : 'var(--text4)', marginTop: 2, fontWeight: q.pct > 80 ? 700 : 400 }}>{q.sublabel}</div>
            </div>
          )
        })}
      </ResponsiveGrid>

      {/* ── STATS D'ENVOI ─────────────────────── */}
      <ResponsiveGrid min={100} gap={8}>
        {[
          { lbl: lang === 'en' ? 'Sent' : lang === 'es' ? 'Enviados' : lang === 'it' ? 'Inviati' : 'Envoyés', val: liveStats.sent, color: 'var(--acc2)' },
          { lbl: lang === 'en' ? 'Failed' : lang === 'es' ? 'Fallidos' : lang === 'it' ? 'Falliti' : 'Échoués', val: liveStats.failed, color: 'var(--danger)' },
          { lbl: lang === 'en' ? 'Retried' : lang === 'es' ? 'Reintentados' : lang === 'it' ? 'Ritentati' : 'Retentés', val: liveStats.retried, color: 'var(--acc)' },
          { lbl: lang === 'en' ? 'Queued' : lang === 'es' ? 'En cola' : lang === 'it' ? 'In coda' : 'En queue', val: liveStats.queued, color: 'var(--acc3)' },
          { lbl: lang === 'en' ? 'Latency' : lang === 'es' ? 'Latencia' : lang === 'it' ? 'Latenza' : 'Latence', val: `${liveStats.avgDuration}ms`, color: liveStats.avgDuration > 2000 ? 'var(--danger)' : liveStats.avgDuration > 1000 ? 'var(--acc)' : 'var(--text2)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, fontFamily: 'var(--mono)', letterSpacing: '-.3px', marginBottom: 3 }}>
              {typeof s.val === 'number' ? s.val.toLocaleString('fr-FR') : s.val}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{s.lbl}</div>
          </div>
        ))}
      </ResponsiveGrid>

      {/* ── FLUX ÉVÉNEMENTS WEBHOOK ──────────── */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--p3)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{lang === 'en' ? 'Webhook Events' : lang === 'es' ? 'Eventos Webhook' : lang === 'it' ? 'Eventi Webhook' : 'Événements Webhook'}</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{lang === 'en' ? 'last 24h' : lang === 'es' ? 'últimas 24h' : lang === 'it' ? 'ultime 24h' : 'dernières 24h'}</span>
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {liveEvents.map((evt, i) => {
            const cfg = EVENT_CONFIG[evt.type]
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                borderBottom: i < liveEvents.length - 1 ? '1px solid var(--border)' : 'none',
                background: i === 0 && tick > 0 ? 'rgba(108,71,255,.04)' : 'transparent', transition: 'background .3s',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{cfg.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.email}</div>
                  <div style={{ fontSize: 9, color: cfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 1 }}>{cfg.label}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{evt.timestamp}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PLAN BADGE ────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg4)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text4)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {lang === 'en' ? 'Current plan' : lang === 'es' ? 'Plan actual' : lang === 'it' ? 'Piano attuale' : 'Plan actuel'}
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px',
          background: plan === 'free' ? 'rgba(136,136,168,.1)' : plan === 'pro' ? 'rgba(0,208,132,.1)' : 'rgba(108,71,255,.1)',
          color: plan === 'free' ? 'var(--text3)' : plan === 'pro' ? 'var(--acc2)' : 'var(--p3)',
          border: plan === 'free' ? '1px solid var(--border)' : plan === 'pro' ? '1px solid rgba(0,208,132,.25)' : '1px solid rgba(108,71,255,.25)',
        }}>
          {plan} · {monthlyLimit.toLocaleString('fr-FR')} {lang === 'en' ? 'emails/mo' : lang === 'es' ? 'emails/mes' : lang === 'it' ? 'email/mese' : 'emails/mois'}
        </span>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }`}</style>
    </div>
  )
}
