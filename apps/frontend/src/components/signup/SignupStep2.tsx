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
                  <div style={{ fontSize: 13, fontWeight: 800, color: D.acc, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.shopName}
                  </div>
                  <div style={{ fontSize: 11, color: D.text3, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.email} · {form.phone}
                  </div>
                </div>
                <button type="button" onClick={onBack}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.text3, fontSize: 11, fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>
                  {tx.back}
                </button>
              </div>

              {/* Password */}
              <div>
                <Label icon={Lock}>{tx.password} *</Label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color={D.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input type={showPwd ? 'text' : 'password'} placeholder={tx.password_ph}
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
                    <span style={{ fontSize: 10.5, color: strength > 0 ? strengthColors[strength] : D.text3, fontWeight: 700 }}>
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
                  <div style={{ fontSize: 10.5, marginTop: 5, fontWeight: 700, color: form.password === form.confirmPwd ? D.acc : D.danger, display: 'flex', alignItems: 'center', gap: 5 }}>
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
                <span style={{ fontSize: 12, color: D.text2, lineHeight: 1.5 }}>
                  {tx.terms_pre}
                  <a href="#" style={{ color: D.p3, textDecoration: 'underline' }}>{tx.terms_a}</a>
                  {tx.terms_and}
                  <a href="#" style={{ color: D.p3, textDecoration: 'underline' }}>{tx.terms_b}</a>
                </span>
              </label>

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.25)', color: D.danger, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Submit */}
              <button type="button" disabled={!step2Valid || loading}
                onClick={onSubmit}
                style={{
                  width: '100%', padding: '14px', marginTop: 4,
                  background: step2Valid && !loading ? `linear-gradient(135deg,${D.p},${D.p2})` : 'rgba(255,255,255,.05)',
                  border: 'none', borderRadius: 12,
                  color: step2Valid && !loading ? '#fff' : D.text4,
                  fontSize: 14, fontWeight: 800,
                  cursor: step2Valid && !loading ? 'pointer' : 'not-allowed',
                  fontFamily: FONT,
                  boxShadow: step2Valid && !loading ? '0 6px 20px rgba(124,58,237,.4)' : 'none',
                  transition: 'all .2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (step2Valid && !loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
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
                  color: D.text3, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <ArrowLeft size={14}/>{tx.back}
              </button>
            </div>
  )
}
