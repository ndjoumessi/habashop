import { useState } from 'react'
import { Lock, Eye, EyeOff, Check, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { D, FONT, MONO, getStrength, inputBase, focusOn, focusOff, Label } from './signupShared'
import type { ST, Currency } from './signupShared'

interface SignupForm {
  shopName: string; ownerName: string; email: string; phone: string
  password: string; confirmPwd: string; currency: Currency; country: string; acceptTerms: boolean
}

interface Props {
  tx: ST
  i: (fr: string, en: string, es: string, it: string) => string
  form: SignupForm
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>
  showPwd: boolean
  setShowPwd: (v: boolean) => void
  showConfirm: boolean
  setShowConfirm: (v: boolean) => void
  step2Valid: boolean
  loading: boolean
  error: string
  onSubmit: () => void
  onBack: () => void
}

export default function SignupStep2({ tx, i, form, setForm, showPwd, setShowPwd, showConfirm, setShowConfirm, step2Valid, loading, error, onSubmit, onBack }: Props) {
  const [showMissing, setShowMissing] = useState(false)

  /**
   * Champs manquants, NOMMÉS — `step2Valid` reste la source de vérité de la validité,
   * cette liste ne fait que l'expliquer.
   */
  const missing: string[] = []
  if (form.password.length < 8)            missing.push(tx.password)
  else if (form.password !== form.confirmPwd) missing.push(tx.confirm)

  const handleSubmit = () => {
    if (!step2Valid) {
      setShowMissing(true)
      document.getElementById(form.password.length < 8 ? 'su-password' : 'su-confirm')?.focus()
      return
    }
    setShowMissing(false)
    onSubmit()
  }

  const strength = getStrength(form.password)
  const strengthColors = ['', D.danger, D.warn, D.acc2, D.acc]
  const strengthLabel = ['', tx.pwd_weak, tx.pwd_fair, tx.pwd_good, tx.pwd_excellent][strength]

  return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Recap */}
              <div style={{
                padding: '12px 14px',
                background: 'rgba(0,208,132,.07)',
                border: '1px solid rgba(0,208,132,.2)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,208,132,.18)', color: D.acc, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={14} strokeWidth={3}/>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: D.acc, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.shopName}
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: D.text3, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.email} · {form.phone}
                  </div>
                </div>
                <button type="button" onClick={onBack}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.text3, fontSize: 'var(--fs-caption)', fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>
                  {tx.back}
                </button>
              </div>

              {/* Password */}
              <div>
                <Label icon={Lock}>{tx.password} *</Label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={D.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input type={showPwd ? 'text' : 'password'} placeholder={tx.password_ph}
                    id="su-password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{ ...inputBase, paddingLeft: 38, paddingRight: 44 }}/>
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    aria-label={i('Afficher/masquer le mot de passe', 'Toggle password', 'Mostrar/ocultar contraseña', 'Mostra/nascondi password')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.text3, display: 'flex', padding: 4 }}>
                    {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3, 4].map(lvl => (
                        <div key={lvl} style={{
                          flex: 1, height: 4, borderRadius: 99,
                          background: strength >= lvl ? strengthColors[strength] : 'rgba(255,255,255,.08)',
                          transition: 'all .3s',
                        }}/>
                      ))}
                    </div>
                    <span style={{ fontSize: 'var(--fs-caption)', color: strength > 0 ? strengthColors[strength] : D.text3, fontWeight: 700 }}>
                      {strengthLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <Label icon={Lock}>{tx.confirm} *</Label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={D.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input type={showConfirm ? 'text' : 'password'} placeholder={tx.confirm_ph}
                    id="su-confirm"
                    value={form.confirmPwd}
                    onChange={e => setForm(f => ({ ...f, confirmPwd: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{
                      ...inputBase, paddingLeft: 38, paddingRight: 44,
                      borderColor: form.confirmPwd.length > 0
                        ? (form.password === form.confirmPwd ? 'rgba(0,208,132,.45)' : 'rgba(255,59,92,.45)')
                        : D.border2,
                    }}/>
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={i('Afficher/masquer la confirmation', 'Toggle confirm', 'Mostrar/ocultar confirmación', 'Mostra/nascondi conferma')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.text3, display: 'flex', padding: 4 }}>
                    {showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {form.confirmPwd.length > 0 && (
                  <div style={{ fontSize: 'var(--fs-caption)', marginTop: 5, fontWeight: 700, color: form.password === form.confirmPwd ? D.acc : D.danger, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {form.password === form.confirmPwd
                      ? <><Check size={11} strokeWidth={3}/>{tx.pwd_match}</>
                      : <><AlertCircle size={11}/>{tx.pwd_nomatch}</>}
                  </div>
                )}
              </div>

              {/* Terms */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px',
                background: 'rgba(255,255,255,.03)',
                border: `1px solid ${form.acceptTerms ? 'rgba(0,208,132,.3)' : D.border}`,
                borderRadius: 12, cursor: 'pointer',
                transition: 'all .15s',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: form.acceptTerms ? D.acc : 'rgba(255,255,255,.06)',
                  border: `2px solid ${form.acceptTerms ? D.acc : D.border2}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1, transition: 'all .2s',
                }}>
                  {form.acceptTerms && <Check size={12} strokeWidth={3} color="#fff"/>}
                </div>
                <input type="checkbox" checked={form.acceptTerms}
                  onChange={e => setForm(f => ({ ...f, acceptTerms: e.target.checked }))}
                  style={{ display: 'none' }}/>
                <span style={{ fontSize: 'var(--fs-label)', color: D.text2, lineHeight: 1.5 }}>
                  {/**
                    * ⚠️ LES DEUX LIENS ÉTAIENT DES `href="#"`. Le commerçant cochait « j'accepte »
                    * DEUX documents dont AUCUN n'était atteignable : un consentement à des
                    * conditions illisibles.
                    *
                    * · La politique de confidentialité EXISTE (`/privacy`, 247 lignes) → vrai
                    *   lien, ouvert dans un NOUVEL ONGLET pour ne pas perdre le formulaire, et
                    *   `stopPropagation` parce que ce texte vit dans un `<label>` : sans lui, le
                    *   clic décocherait la case au moment même où on va lire ce qu'on accepte.
                    * · Les CONDITIONS GÉNÉRALES n'existent NULLE PART — ni route, ni fichier dans
                    *   `legal/`. Elles restent donc du TEXTE, pas un lien : promettre un document
                    *   qu'on ne peut pas servir est pire que d'admettre qu'il manque.
                    *   ⚠️ CE N'EST PAS UNE CORRECTION COMPLÈTE, et il ne faut pas la lire comme
                    *   telle : la phrase demande toujours d'accepter des CGU inexistantes. Le
                    *   correctif réel est de les RÉDIGER — acte juridique, décision de Nelson.
                    *   Le lien mort masquait ce trou ; le texte nu le laisse voir.
                    */}
                  {tx.terms_pre}
                  <span>{tx.terms_a}</span>
                  {tx.terms_and}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: D.p3, textDecoration: 'underline' }}>{tx.terms_b}</a>
                </span>
              </label>

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.25)', color: D.danger, fontSize: 'var(--fs-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Ce qui manque, annoncé — jamais un bouton muet. */}
              <div role="status" aria-live="polite">
                {showMissing && missing.length > 0 && (
                  <div style={{
                    marginTop: 4, padding: '10px 13px', borderRadius: 10,
                    background: 'var(--c-orange-bg)', border: '1px solid var(--c-orange-border)',
                    color: 'var(--text2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} color="var(--acc3)"/>
                    <span>{tx.missing_prefix} <strong>{missing.join(', ')}</strong></span>
                  </div>
                )}
              </div>

              {/* ⚠️ ACTIF sauf pendant l'envoi. `disabled={loading}` est légitime — il
                  empêche la double soumission et dure une seconde ; `disabled={!step2Valid}`
                  ne l'était pas : il éteignait le bouton sans dire ce qui manquait. */}
              <button type="button" disabled={loading}
                onClick={handleSubmit}
                style={{
                  width: '100%', padding: '14px', marginTop: 4,
                  background: `linear-gradient(135deg,${D.p},${D.p2})`,
                  border: 'none', borderRadius: 12, color: '#fff',
                  fontSize: 'var(--fs-body)', fontWeight: 800,
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? .6 : 1,
                  fontFamily: FONT,
                  boxShadow: '0 6px 20px rgba(124,58,237,.4)',
                  transition: 'all .2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >
                {loading
                  ? <><Loader2 size={15} className="su-spin"/>{tx.loading}</>
                  : <>{tx.submit}<ArrowRight size={15}/></>}
              </button>

              <button type="button" onClick={onBack}
                style={{
                  width: '100%', padding: '10px',
                  background: 'transparent', border: 'none',
                  color: D.text3, fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <ArrowLeft size={14}/>{tx.back}
              </button>
            </div>
  )
}
