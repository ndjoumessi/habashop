import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '@/hooks/useI18n'
import { api } from '@/lib/api'

export default function PaymentCallback() {
  const [params]   = useSearchParams()
  const navigate   = useNavigate()
  const { i }      = useI18n()
  const status     = params.get('status')
  const reference  = params.get('ref')
  const [checking, setChecking] = useState(true)
  const [result,   setResult]   = useState<'success' | 'pending' | 'error' | null>(null)

  useEffect(() => {
    if (!reference) {
      setResult('error')
      setChecking(false)
      return
    }

    // Vérifie le statut du paiement
    const checkStatus = async () => {
      try {
        const data = await api.get<{ activated?: boolean }>(`/api/payments/status/${reference}`)
        if (data.activated || status === 'success') {
          setResult('success')
        } else {
          setResult('pending')
        }
      } catch {
        setResult(status === 'success' ? 'success' : 'error')
      } finally {
        setChecking(false)
      }
    }

    checkStatus()
  }, [reference, status])

  // Redirect automatique après succès
  useEffect(() => {
    if (result === 'success') {
      const t = setTimeout(() => navigate('/app/dashboard'), 3000)
      return () => clearTimeout(t)
    }
  }, [result, navigate])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', fontFamily: 'var(--font)',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '48px 40px',
        maxWidth: 480, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        {checking ? (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: '4px solid rgba(108,71,255,.2)',
              borderTopColor: 'var(--p)',
              animation: 'spin .8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {i('Vérification du paiement…', 'Verifying payment…', 'Verificando pago…', 'Verifica pagamento…')}
            </div>
          </>
        ) : result === 'success' ? (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(0,208,132,.12)',
              border: '2px solid rgba(0,208,132,.3)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36, margin: '0 auto 20px',
            }}>✅</div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              color: 'var(--text)', marginBottom: 8,
            }}>
              {i('Paiement confirmé !', 'Payment confirmed!', '¡Pago confirmado!', 'Pagamento confermato!')}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--text2)',
              lineHeight: 1.6, marginBottom: 24,
            }}>
              {i(
                'Votre plan est maintenant actif. Redirection en cours…',
                'Your plan is now active. Redirecting…',
                'Su plan está activo. Redirigiendo…',
                'Il tuo piano è attivo. Reindirizzamento…'
              )}
            </div>
            <div style={{
              height: 4, borderRadius: 99,
              background: 'rgba(0,208,132,.2)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', background: 'var(--acc2)',
                borderRadius: 99,
                animation: 'progress 3s linear forwards',
              }} />
            </div>
          </>
        ) : result === 'error' ? (
          <>
            <div style={{ fontSize: 48, margin: '0 auto 20px' }}>❌</div>
            <div style={{
              fontSize: 20, fontWeight: 800,
              color: 'var(--danger)', marginBottom: 8,
            }}>
              {i('Paiement échoué', 'Payment failed', 'Pago fallido', 'Pagamento fallito')}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--text2)', marginBottom: 24,
            }}>
              {i(
                'Le paiement n\'a pas pu être traité. Aucun montant n\'a été débité.',
                'Payment could not be processed. No amount was charged.',
                'El pago no pudo procesarse. No se realizó ningún cargo.',
                'Il pagamento non è stato elaborato. Nessun addebito.'
              )}
            </div>
            <button
              onClick={() => navigate('/app/upgrade')}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {i('Réessayer', 'Try again', 'Reintentar', 'Riprova')}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, margin: '0 auto 20px' }}>⏳</div>
            <div style={{
              fontSize: 18, fontWeight: 800,
              color: 'var(--text)', marginBottom: 8,
            }}>
              {i('Paiement en attente', 'Payment pending', 'Pago pendiente', 'Pagamento in attesa')}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--text2)', marginBottom: 24,
            }}>
              {i(
                'Votre paiement est en cours de validation. Vous recevrez un email de confirmation.',
                'Your payment is being validated. You will receive a confirmation email.',
                'Su pago está siendo validado. Recibirá un correo de confirmación.',
                'Il pagamento è in fase di validazione. Riceverai un\'email di conferma.'
              )}
            </div>
            <button
              onClick={() => navigate('/app/dashboard')}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {i('Aller au dashboard', 'Go to dashboard', 'Ir al dashboard', 'Vai al dashboard')}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes progress { from { width:0 } to { width:100% } }
      `}</style>
    </div>
  )
}
