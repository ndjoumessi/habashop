import { useState, useRef, useEffect } from 'react'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import { suggestedCurrencyForCountry } from '@/utils/countryCurrency'
import { Store, User, Mail, MessageSquare, Globe, Coins, Search, Check, AlertCircle, ArrowRight, ChevronDown } from 'lucide-react'
import { D, FONT, COUNTRIES, inputBase, focusOn, focusOff, Label } from './signupShared'
import type { ST, Lang, Currency } from './signupShared'

interface SignupForm {
  shopName: string; ownerName: string; email: string; phone: string
  password: string; confirmPwd: string; currency: Currency; country: string; acceptTerms: boolean
}

interface Props {
  tx: ST
  i: (fr: string, en: string, es: string, it: string) => string
  lang: Lang
  form: SignupForm
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>
  currencyTouched: boolean
  setCurrencyTouched: (v: boolean) => void
  step1Valid: boolean
  error: string
  onNext: () => void
}

export default function SignupStep1({ tx, i, lang, form, setForm, currencyTouched, setCurrencyTouched, step1Valid, error, onNext }: Props) {
  const [showMissing, setShowMissing] = useState(false)

  /**
   * Champs manquants, NOMMÉS. `step1Valid` reste la source de vérité de la validité —
   * cette liste ne fait que l'expliquer, elle ne la remplace pas.
   */
  const missing: string[] = []
  if (!form.shopName?.trim())  missing.push(tx.shopName)
  if (!form.ownerName?.trim()) missing.push(tx.ownerName)

  const handleNext = () => {
    if (!step1Valid) {
      setShowMissing(true)
      // Focus au premier champ manquant : l'utilisateur n'a pas à le chercher.
      const first = !form.shopName?.trim() ? 'su-shopName' : 'su-ownerName'
      document.getElementById(first)?.focus()
      return
    }
    setShowMissing(false)
    onNext()
  }
  const [showCountry, setShowCountry] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setShowCountry(false); setCountrySearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  )
  const selectedCountry = COUNTRIES.find(c => c.code === form.country) ?? COUNTRIES[0]

  return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Shop name */}
              <div>
                <Label icon={Store}>{tx.shopName} *</Label>
                <div style={{ position: 'relative' }}>
                  <input type="text" placeholder={tx.shop_ph}
                    id="su-shopName"
                    value={form.shopName}
                    onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={inputBase}/>
                  {form.shopName.trim().length >= 2 && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: D.acc, display: 'flex' }}>
                      <Check size={14} strokeWidth={3}/>
                    </span>
                  )}
                </div>
              </div>

              {/* Owner name */}
              <div>
                <Label icon={User}>{tx.ownerName} *</Label>
                <input type="text" placeholder={tx.owner_ph}
                  id="su-ownerName"
                  value={form.ownerName}
                  onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                  onFocus={focusOn} onBlur={focusOff}
                  style={inputBase}/>
              </div>

              {/* Email */}
              <div>
                <Label icon={Mail}>{tx.email} *</Label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color={D.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input type="email" placeholder={tx.email_ph}
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{ ...inputBase, paddingLeft: 38 }}/>
                </div>
              </div>

              {/* Phone (PhoneInputWithCountry) */}
              <div>
                <Label icon={MessageSquare}>{tx.phone} *</Label>
                <PhoneInputWithCountry
                  value={form.phone}
                  onChange={phone => setForm(f => ({ ...f, phone }))}
                  placeholder="77 000 00 00"
                  lang={lang}
                />
                <div style={{ marginTop: 5, fontSize: 'var(--fs-caption)', color: D.text3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MessageSquare size={11} color="#25D366"/>{tx.phone_hint}
                </div>
              </div>

              {/* Country + Currency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Country */}
                <div>
                  <Label icon={Globe}>{tx.country}</Label>
                  <div ref={countryRef} style={{ position: 'relative' }}>
                    <button type="button"
                      onClick={() => setShowCountry(!showCountry)}
                      style={{
                        width: '100%', padding: '11px 14px',
                        background: D.bg4,
                        border: `1.5px solid ${showCountry ? D.p2 : D.border2}`,
                        borderRadius: 10, cursor: 'pointer',
                        fontFamily: FONT, fontSize: 'var(--fs-sm)',
                        color: D.text, textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        transition: 'border-color .15s', boxSizing: 'border-box',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ fontSize: 'var(--fs-md)' }}>{selectedCountry.flag}</span>
                        <span style={{ fontWeight: 600, fontSize: 'var(--fs-label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCountry.name}</span>
                      </div>
                      <ChevronDown size={14} aria-hidden="true" style={{ color: D.text3, transform: showCountry ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
                    </button>

                    {showCountry && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 999,
                        background: D.bg2, border: `1px solid ${D.border2}`,
                        borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.6)', overflow: 'hidden',
                      }}>
                        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${D.border}` }}>
                          <div style={{ position: 'relative' }}>
                            <Search size={13} color={D.text3} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}/>
                            <input autoFocus type="text" aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')} placeholder={tx.search_country}
                              value={countrySearch}
                              onChange={e => setCountrySearch(e.target.value)}
                              style={{
                                width: '100%', padding: '7px 10px 7px 30px',
                                background: D.bg4, border: `1px solid ${D.border}`,
                                borderRadius: 8, fontSize: 'var(--fs-label)',
                                color: D.text, fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
                              }}/>
                          </div>
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                          {filteredCountries.length === 0 ? (
                            <div style={{ padding: 18, textAlign: 'center', color: D.text3, fontSize: 'var(--fs-label)' }}>
                              {tx.no_country}
                            </div>
                          ) : filteredCountries.map(c => (
                            <button key={c.code} type="button"
                              onMouseDown={() => {
                                const sug = suggestedCurrencyForCountry(c.code)
                                setForm(f => ({ ...f, country: c.code, ...(!currencyTouched && sug ? { currency: sug } : {}) }))
                                setShowCountry(false); setCountrySearch('')
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', padding: '9px 14px',
                                background: form.country === c.code ? 'rgba(124,58,237,.14)' : 'transparent',
                                border: 'none', borderBottom: `1px solid ${D.border}`,
                                cursor: 'pointer', fontFamily: FONT,
                                fontSize: 'var(--fs-label)', textAlign: 'left',
                                color: form.country === c.code ? D.p3 : D.text,
                              }}
                              onMouseEnter={e => { if (form.country !== c.code) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                              onMouseLeave={e => { if (form.country !== c.code) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            >
                              <span style={{ fontSize: 'var(--fs-md)' }}>{c.flag}</span>
                              <span style={{ flex: 1, fontWeight: form.country === c.code ? 700 : 500 }}>{c.name}</span>
                              {form.country === c.code && <Check size={13} color={D.p3} strokeWidth={3}/>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <Label icon={Coins}>{tx.currency}</Label>
                  <select value={form.currency}
                    onChange={e => { setCurrencyTouched(true); setForm(f => ({ ...f, currency: e.target.value as Currency })) }}
                    onFocus={focusOn} onBlur={focusOff}
                    style={{ ...inputBase, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A78BFA' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
                    }}>
                    <option value="XOF">XOF — {i('FCFA Ouest', 'West CFA Franc', 'Franco CFA Oeste', 'Franco CFA Ovest')}</option>
                    <option value="XAF">XAF — {i('FCFA Centre', 'Central CFA Franc', 'Franco CFA Central', 'Franco CFA Centrale')}</option>
                    <option value="EUR">EUR — {i('Euro', 'Euro', 'Euro', 'Euro')}</option>
                    <option value="USD">USD — {i('Dollar US', 'US Dollar', 'Dólar estadounidense', 'Dollaro USA')}</option>
                    <option value="CAD">CAD — {i('Dollar CA', 'Canadian Dollar', 'Dólar canadiense', 'Dollaro canadese')}</option>
                    <option value="GBP">GBP — {i('Livre Sterling', 'Pound Sterling', 'Libra esterlina', 'Sterlina')}</option>
                  </select>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.25)', color: D.danger, fontSize: 'var(--fs-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* ⚠️ BOUTON TOUJOURS ACTIF, libellé invariable « Continuer ».
                  L'ancien était désactivé et affichait « Remplissez tous les champs » en
                  gris : un contrôle sans contraste, qui gronde avant toute erreur et ne dit
                  pas CE QUI manque — au toucher, il n'affiche même pas d'infobulle.
                  Au clic, on NOMME les champs manquants et on donne le focus au premier. */}
              <button type="button"
                onClick={handleNext}
                aria-describedby={missing.length ? 'su-missing' : undefined}
                style={{
                  width: '100%', padding: '14px', marginTop: 4,
                  background: `linear-gradient(135deg,${D.p},${D.p2})`,
                  border: 'none', borderRadius: 12, color: '#fff',
                  fontSize: 'var(--fs-body)', fontWeight: 800,
                  cursor: 'pointer', fontFamily: FONT,
                  boxShadow: '0 6px 20px rgba(124,58,237,.4)',
                  transition: 'all .2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >
                {tx.next_btn}<ArrowRight size={15}/>
              </button>

              {/* Ce qui manque, annoncé — jamais un bouton muet. */}
              <div id="su-missing" role="status" aria-live="polite">
                {showMissing && missing.length > 0 && (
                  <div style={{
                    marginTop: 10, padding: '10px 13px', borderRadius: 10,
                    background: 'var(--c-orange-bg)', border: '1px solid var(--c-orange-border)',
                    color: 'var(--text2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} color="var(--acc3)"/>
                    <span>{tx.missing_prefix} <strong>{missing.join(', ')}</strong></span>
                  </div>
                )}
              </div>
            </div>
  )
}
