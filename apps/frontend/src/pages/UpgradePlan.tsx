import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppStore } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { api, billingApi } from '@/lib/api'

type Step = 'plan' | 'payment' | 'done'
type L4 = { fr: string; en: string; es: string; it: string }

const PRICES: Record<string, Record<string, number>> = {
  pro:        { monthly: 24900, yearly: 249000 },
  enterprise: { monthly: 49900, yearly: 499000 },
}

const PAYMENT_METHODS: { id: string; icon: string; name: string; color: string; desc: L4; number: string }[] = [
  { id: 'wave', icon: '🌊', name: 'Wave', color: '#00B3FF', desc: { fr: 'Paiement instantané', en: 'Instant payment', es: 'Pago instantáneo', it: 'Pagamento istantaneo' }, number: '+221 77 000 0000' },
  { id: 'orange_money', icon: '🟠', name: 'Orange Money', color: '#FF6600', desc: { fr: 'Mobile money Orange', en: 'Orange mobile money', es: 'Orange mobile money', it: 'Orange mobile money' }, number: '+221 78 000 0000' },
  { id: 'mtn_money', icon: '💛', name: 'MTN Money', color: '#FFCC00', desc: { fr: 'Mobile money MTN', en: 'MTN mobile money', es: 'MTN mobile money', it: 'MTN mobile money' }, number: '+237 65 000 0000' },
  { id: 'virement', icon: '🏦', name: 'Virement bancaire', color: '#6C47FF', desc: { fr: 'Virement SWIFT/IBAN', en: 'Bank transfer', es: 'Transferencia bancaria', it: 'Bonifico bancario' }, number: 'IBAN: SN00 0000 0000' },
]

export default function UpgradePlan() {
  const navigate = useNavigate()
  const lang = useAppStore(s => s.lang)
  const { i } = useI18n()
  const L = (o: L4) => o[lang] ?? o.fr

  const [step, setStep] = useState<Step>('plan')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ plan: 'pro', period: 'monthly', paymentMethod: 'wave', paymentRef: '', notes: '' })
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))
  const amount = PRICES[form.plan][form.period]
  // Wave & Orange Money ont une API : on initie le paiement et on redirige.
  // Les autres méthodes (MTN, virement) restent en demande manuelle.
  const isAuto = form.paymentMethod === 'wave' || form.paymentMethod === 'orange_money'

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await billingApi.requestPlan(form)
      setStep('done')
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur lors de la demande', 'Request failed', 'Error en la solicitud', 'Errore nella richiesta'))
    } finally {
      setLoading(false)
    }
  }

  // Paiement automatique Wave / Orange Money → redirection vers le prestataire.
  const handleAutoPayment = async () => {
    setLoading(true)
    try {
      if (form.paymentMethod === 'wave') {
        const res = await api.post<{ checkoutUrl: string }>('/api/payments/wave/checkout', { plan: form.plan, period: form.period })
        window.location.href = res.checkoutUrl
      } else {
        const res = await api.post<{ paymentUrl: string }>('/api/payments/orange/checkout', { plan: form.plan, period: form.period })
        window.location.href = res.paymentUrl
      }
      // Redirection en cours : on laisse le spinner actif (la page va se décharger).
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur de paiement', 'Payment error', 'Error de pago', 'Errore di pagamento'))
      setLoading(false)
    }
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 'var(--fw-regular)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 7 }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#07070F,#0D0D1C)', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 'var(--fs-label)' }} onClick={() => navigate(-1)}>← {i('Retour', 'Back', 'Volver', 'Indietro')}</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: '#F0F0FF' }}>⚡ {i('Passer au Pro', 'Upgrade to Pro', 'Pasarse a Pro', 'Passa a Pro')}</div>
        </div>
        <div style={{ width: 70 }} />
      </div>

      <div style={{ width: '100%', maxWidth: 520, background: 'linear-gradient(160deg,#0D0D1C,#111128)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, overflow: 'hidden' }}>

        {step === 'plan' && (
          <div style={{ padding: 32 }}>
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', color: '#F0F0FF', marginBottom: 6 }}>{i('Choisissez votre plan', 'Choose your plan', 'Elige tu plan', 'Scegli il tuo piano')}</h2>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginBottom: 20 }}>{i('Activé sous 24-48h après validation du paiement.', 'Activated within 24-48h after payment validation.', 'Activado en 24-48h después de la validación del pago.', 'Attivato entro 24-48h dopo la validazione del pagamento.')}</p>

            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: 3, marginBottom: 16, width: 'fit-content' }}>
              {([{ id: 'monthly', label: { fr: 'Mensuel', en: 'Monthly', es: 'Mensual', it: 'Mensile' } }, { id: 'yearly', label: { fr: 'Annuel (-20%)', en: 'Yearly (-20%)', es: 'Anual (-20%)', it: 'Annuale (-20%)' } }] as { id: string; label: L4 }[]).map(p => (
                <button key={p.id} type="button" onClick={() => set({ period: p.id })} style={{ padding: '6px 14px', borderRadius: 8, background: form.period === p.id ? 'linear-gradient(135deg,#6C47FF,#8B6FFF)' : 'transparent', border: 'none', cursor: 'pointer', color: form.period === p.id ? '#fff' : 'var(--text3)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', fontFamily: 'var(--font)', transition: 'all .15s' }}>{L(p.label)}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {['pro', 'enterprise'].map(planId => {
                const price = PRICES[planId][form.period]
                const isSelected = form.plan === planId
                return (
                  <button key={planId} type="button" onClick={() => set({ plan: planId })} style={{ padding: 16, borderRadius: 14, background: isSelected ? (planId === 'pro' ? 'rgba(108,71,255,.12)' : 'rgba(255,149,0,.1)') : 'rgba(255,255,255,.03)', border: `2px solid ${isSelected ? (planId === 'pro' ? 'rgba(108,71,255,.4)' : 'rgba(255,149,0,.35)') : 'rgba(255,255,255,.08)'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: planId === 'pro' ? 'rgba(108,71,255,.2)' : 'rgba(255,149,0,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-2xl)', flexShrink: 0 }}>{planId === 'pro' ? '⚡' : '🏢'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)', color: isSelected ? (planId === 'pro' ? 'var(--p3)' : 'var(--acc)') : 'var(--text)', marginBottom: 2 }}>
                        {planId === 'pro' ? 'Pro' : 'Enterprise'}
                        {planId === 'pro' && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 'var(--fw-regular)', padding: '2px 7px', borderRadius: 99, background: 'rgba(108,71,255,.2)', color: 'var(--p3)' }}>{i('POPULAIRE', 'POPULAR', 'POPULAR', 'POPOLARE')}</span>}
                      </div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{planId === 'pro' ? i('5 utilisateurs · Rapports · WhatsApp', '5 users · Reports · WhatsApp', '5 usuarios · Informes · WhatsApp', '5 utenti · Report · WhatsApp') : i('Illimité · IA · Support prioritaire', 'Unlimited · AI · Priority support', 'Ilimitado · IA · Soporte prioritario', 'Illimitato · IA · Supporto prioritario')}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', color: isSelected ? (planId === 'pro' ? 'var(--p3)' : 'var(--acc)') : 'var(--text2)', fontFamily: 'var(--mono)' }}>{price.toLocaleString('fr-FR')}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>F/{i('mois', 'mo', 'mes', 'mese')}</div>
                    </div>
                    {isSelected && <div style={{ width: 22, height: 22, borderRadius: '50%', background: planId === 'pro' ? 'var(--p2)' : 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-caption)', color: '#fff', fontWeight: 'var(--fw-regular)', flexShrink: 0 }}>✓</div>}
                  </button>
                )
              })}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 'var(--fs-body)' }} onClick={() => setStep('payment')}>{i('Continuer →', 'Continue →', 'Continuar →', 'Continua →')}</button>
          </div>
        )}

        {step === 'payment' && (
          <div style={{ padding: 32 }}>
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', color: '#F0F0FF', marginBottom: 6 }}>💳 {i('Mode de paiement', 'Payment method', 'Método de pago', 'Metodo di pagamento')}</h2>

            <div style={{ padding: '12px 16px', marginBottom: 20, background: 'rgba(108,71,255,.08)', border: '1px solid rgba(108,71,255,.2)', borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>Plan {form.plan} · {form.period === 'monthly' ? i('mensuel', 'monthly', 'mensual', 'mensile') : i('annuel', 'yearly', 'anual', 'annuale')}</span>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--p3)', fontFamily: 'var(--mono)' }}>{amount.toLocaleString('fr-FR')} F CFA</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {PAYMENT_METHODS.map(m => {
                const isSelected = form.paymentMethod === m.id
                return (
                  <button key={m.id} type="button" onClick={() => set({ paymentMethod: m.id })} style={{ padding: '12px 16px', borderRadius: 12, background: isSelected ? `${m.color}15` : 'rgba(255,255,255,.03)', border: `1.5px solid ${isSelected ? m.color + '44' : 'rgba(255,255,255,.08)'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 'var(--fs-display)' }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: isSelected ? m.color : 'var(--text)' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{L(m.desc)}</div>
                    </div>
                    {isSelected && <div style={{ width: 20, height: 20, borderRadius: '50%', background: m.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 'var(--fw-regular)' }}>✓</div>}
                  </button>
                )
              })}
            </div>

            {isAuto ? (
              <div style={{ padding: '14px 16px', marginBottom: 20, background: 'rgba(0,208,132,.06)', border: '1px solid rgba(0,208,132,.15)', borderRadius: 12 }}>
                <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)', lineHeight: 1.7 }}>
                  ⚡ {form.paymentMethod === 'wave'
                    ? i('Vous allez être redirigé vers Wave pour payer en toute sécurité. Votre plan est activé automatiquement dès le paiement confirmé.', 'You will be redirected to Wave to pay securely. Your plan is activated automatically once payment is confirmed.', 'Será redirigido a Wave para pagar de forma segura. Su plan se activa automáticamente al confirmarse el pago.', 'Verrai reindirizzato a Wave per pagare in sicurezza. Il piano si attiva automaticamente alla conferma del pagamento.')
                    : i('Vous allez être redirigé vers Orange Money pour payer en toute sécurité. Votre plan est activé automatiquement dès le paiement confirmé.', 'You will be redirected to Orange Money to pay securely. Your plan is activated automatically once payment is confirmed.', 'Será redirigido a Orange Money para pagar de forma segura. Su plan se activa automáticamente al confirmarse el pago.', 'Verrai reindirizzato a Orange Money per pagare in sicurezza. Il piano si attiva automaticamente alla conferma del pagamento.')}
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 16px', marginBottom: 16, background: 'rgba(255,184,0,.06)', border: '1px solid rgba(255,184,0,.15)', borderRadius: 12 }}>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', color: 'var(--warn)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>📋 {i('Instructions de paiement', 'Payment instructions', 'Instrucciones de pago', 'Istruzioni di pagamento')}</div>
                  {(() => {
                    const method = PAYMENT_METHODS.find(m => m.id === form.paymentMethod)
                    return (
                      <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)', lineHeight: 1.7 }}>
                        {form.paymentMethod === 'virement' ? (
                          <>
                            {i(`Effectuez un virement de ${amount.toLocaleString('fr-FR')} F CFA à :`, `Transfer ${amount.toLocaleString('fr-FR')} F CFA to:`, `Transfiera ${amount.toLocaleString('fr-FR')} F CFA a:`, `Bonificate ${amount.toLocaleString('fr-FR')} F CFA a:`)}<br />
                            <strong>IBAN:</strong> SN00 0000 0000 0000<br />
                            <strong>BIC:</strong> HABITDAKXXX<br />
                            <strong>{i('Motif', 'Reference', 'Referencia', 'Causale')}:</strong> HABASHOP-{form.plan.toUpperCase()}
                          </>
                        ) : (
                          <>
                            {i(`Envoyez ${amount.toLocaleString('fr-FR')} F CFA au :`, `Send ${amount.toLocaleString('fr-FR')} F CFA to:`, `Envíe ${amount.toLocaleString('fr-FR')} F CFA al:`, `Invia ${amount.toLocaleString('fr-FR')} F CFA al:`)}<br />
                            <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--warn)', fontFamily: 'var(--mono)' }}>{method?.number}</strong><br />
                            {i('Puis entrez la référence de transaction ci-dessous.', 'Then enter the transaction reference below.', 'Luego ingresa la referencia de transacción abajo.', 'Poi inserisci il riferimento della transazione qui sotto.')}
                          </>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>{i('RÉFÉRENCE TRANSACTION (optionnel)', 'TRANSACTION REFERENCE (optional)', 'REFERENCIA TRANSACCIÓN (opcional)', 'RIFERIMENTO TRANSAZIONE (opzionale)')}</label>
                  <input aria-label={i('RÉFÉRENCE TRANSACTION (optionnel)', 'TRANSACTION REFERENCE (optional)', 'REFERENCIA TRANSACCIÓN (opcional)', 'RIFERIMENTO TRANSAZIONE (opzionale)')} className="input" placeholder={i('Ex: WV-12345678 ou numéro Orange Money', 'Ex: WV-12345678 or Orange Money number', 'Ej: WV-12345678 o número Orange Money', 'Es: WV-12345678 o numero Orange Money')} value={form.paymentRef} onChange={e => set({ paymentRef: e.target.value })} />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={lbl}>{i('MESSAGE (optionnel)', 'MESSAGE (optional)', 'MENSAJE (opcional)', 'MESSAGGIO (opzionale)')}</label>
                  <textarea aria-label={i('MESSAGE (optionnel)', 'MESSAGE (optional)', 'MENSAJE (opcional)', 'MESSAGGIO (opzionale)')} className="input" rows={2} placeholder={i('Informations complémentaires…', 'Additional information…', 'Información adicional…', 'Informazioni aggiuntive…')} value={form.notes} onChange={e => set({ notes: e.target.value })} style={{ resize: 'none' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep('plan')}>← {i('Retour', 'Back', 'Volver', 'Indietro')}</button>
              {isAuto ? (
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: 14, fontSize: 'var(--fs-body)' }} disabled={loading} onClick={handleAutoPayment}>{loading ? i('Redirection…', 'Redirecting…', 'Redirigiendo…', 'Reindirizzamento…') : `${form.paymentMethod === 'wave' ? '🌊' : '🟠'} ${i('Payer', 'Pay', 'Pagar', 'Paga')} ${amount.toLocaleString('fr-FR')} F`}</button>
              ) : (
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: 14, fontSize: 'var(--fs-body)' }} disabled={loading} onClick={handleSubmit}>{loading ? '⏳ …' : i('Envoyer la demande ✓', 'Send request ✓', 'Enviar solicitud ✓', 'Invia richiesta ✓')}</button>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)', color: '#F0F0FF', marginBottom: 10 }}>{i('✅ Demande envoyée !', '✅ Request sent!', '✅ ¡Solicitud enviada!', '✅ Richiesta inviata!')}</h2>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text3)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 28px' }}>{i('Notre équipe va valider votre paiement et activer votre plan sous 24-48h. Vous recevrez une confirmation.', 'Our team will validate your payment and activate your plan within 24-48h. You will receive a confirmation.', 'Nuestro equipo validará su pago y activará su plan en 24-48h. Recibirá una confirmación.', 'Il nostro team validerà il pagamento e attiverà il piano entro 24-48h. Riceverai una conferma.')}</p>
            <div style={{ padding: 16, marginBottom: 24, background: 'rgba(0,208,132,.06)', border: '1px solid rgba(0,208,132,.15)', borderRadius: 14, textAlign: 'left', maxWidth: 360, margin: '0 auto 24px' }}>
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--acc2)', lineHeight: 1.9 }}>
                ✅ {i('Plan demandé', 'Plan requested', 'Plan solicitado', 'Piano richiesto')} : <strong>{form.plan}</strong><br />
                ✅ {i('Montant', 'Amount', 'Importe', 'Importo')} : <strong>{amount.toLocaleString('fr-FR')} F CFA</strong><br />
                ✅ {i('Paiement via', 'Payment via', 'Pago via', 'Pagamento via')} : <strong>{PAYMENT_METHODS.find(m => m.id === form.paymentMethod)?.name}</strong><br />
                ⏳ {i('Délai validation', 'Validation delay', 'Plazo validación', 'Tempo validazione')} : <strong>24-48h</strong>
              </div>
            </div>
            <button className="btn btn-primary" style={{ padding: '13px 28px', fontSize: 'var(--fs-body)', justifyContent: 'center' }} onClick={() => navigate('/app/dashboard')}>{i('Retour au dashboard →', 'Back to dashboard →', 'Volver al panel →', 'Torna alla dashboard →')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
