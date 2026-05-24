import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { billingApi } from '@/lib/api'

interface BillingStatus {
  plan: string
  status: string
  trialDaysLeft: number
  isTrialExpired: boolean
  hasPendingRequest: boolean
  canContinue: boolean
}

export default function BillingBanner() {
  const lang = useAppStore(s => s.lang)
  const navigate = useNavigate()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const i = (fr: string, en: string, es: string, it: string) => (lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it)

  useEffect(() => {
    billingApi.status().then(setStatus).catch(() => {})
  }, [])

  if (!status || dismissed) return null
  if (status.status === 'active' && !status.isTrialExpired) return null

  // Demande en cours
  if (status.hasPendingRequest) return (
    <div style={{ padding: '10px 20px', background: 'rgba(0,184,255,.08)', borderBottom: '1px solid rgba(0,184,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--acc3)' }}>
        <span>⏳</span>
        <span style={{ fontWeight: 600 }}>{i('Votre demande de plan est en cours de traitement (24-48h)', 'Your plan request is being processed (24-48h)', 'Tu solicitud de plan está siendo procesada (24-48h)', 'La tua richiesta di piano è in elaborazione (24-48h)')}</span>
      </div>
      <button type="button" onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: '0 4px' }}>✕</button>
    </div>
  )

  // Essai expiré
  if (status.isTrialExpired) return (
    <div style={{ padding: '12px 20px', background: 'rgba(255,59,92,.1)', borderBottom: '1px solid rgba(255,59,92,.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 600, fontSize: 13 }}>
        <span>🔒</span>
        <span>{i('Votre essai gratuit est expiré. Choisissez un plan pour continuer.', 'Your free trial has expired. Choose a plan to continue.', 'Tu prueba gratuita ha expirado. Elige un plan para continuar.', 'La tua prova gratuita è scaduta. Scegli un piano per continuare.')}</span>
      </div>
      <button onClick={() => navigate('/app/upgrade')} style={{ padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#FF3B5C,#FF6B6B)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font)', boxShadow: '0 4px 12px rgba(255,59,92,.35)', flexShrink: 0 }}>{i('Choisir un plan →', 'Choose a plan →', 'Elegir plan →', 'Scegli piano →')}</button>
    </div>
  )

  // ≤7 jours d'essai
  if (status.trialDaysLeft > 7) return null
  const isUrgent = status.trialDaysLeft <= 3
  return (
    <div style={{ padding: '10px 20px', background: isUrgent ? 'rgba(255,59,92,.08)' : 'rgba(255,184,0,.07)', borderBottom: `1px solid ${isUrgent ? 'rgba(255,59,92,.2)' : 'rgba(255,184,0,.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isUrgent ? 'var(--danger)' : 'var(--warn)', fontSize: 13, fontWeight: 600 }}>
        <span>{isUrgent ? '⚠️' : '⏳'}</span>
        <span>{status.trialDaysLeft === 0
          ? i("Dernier jour d'essai !", 'Last day of trial!', '¡Último día de prueba!', 'Ultimo giorno di prova!')
          : i(`${status.trialDaysLeft} jour(s) d'essai restant(s)`, `${status.trialDaysLeft} trial day(s) left`, `${status.trialDaysLeft} día(s) de prueba restante(s)`, `${status.trialDaysLeft} giorno/i di prova rimasti`)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => navigate('/app/upgrade')} style={{ padding: '7px 16px', borderRadius: 10, background: isUrgent ? 'linear-gradient(135deg,#FF3B5C,#FF6B6B)' : 'linear-gradient(135deg,#FFB800,#FF9500)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font)', flexShrink: 0 }}>⚡ {i('Passer au Pro', 'Upgrade to Pro', 'Pasarse a Pro', 'Passa a Pro')}</button>
        <button type="button" onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16 }}>✕</button>
      </div>
    </div>
  )
}
