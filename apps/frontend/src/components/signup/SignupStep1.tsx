import { useState, useRef, useEffect } from 'react'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import { suggestedCurrencyForCountry } from '@/utils/countryCurrency'
import { Store, User, Mail, MessageSquare, Globe, Coins, Search, Check, AlertCircle, ArrowRight } from 'lucide-react'
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
                <div style={{ marginTop: 5, fontSize: 10.5, color: D.text3, display: 'flex', alignItems: 'center', gap: 5 }}>
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
                        fontFamily: FONT, fontSize: 13,
                        color: D.text, textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        transition: 'border-color .15s', boxSizing: 'border-box',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span style={{ fontSize: 16 }}>{selectedCountry.flag}</span>
                        <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCountry.name}</span>
                      </div>
                      <span style={{ fontSize: 9, color: D.text3, transform: showCountry ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block', flexShrink: 0 }}>▼</span>
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
                                borderRadius: 8, fontSize: 12,
                                color: D.text, fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
                              }}/>
                          </div>
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                          {filteredCountries.length === 0 ? (
                            <div style={{ padding: 18, textAlign: 'center', color: D.text3, fontSize: 12 }}>
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
                                fontSize: 12, textAlign: 'left',
                                color: form.country === c.code ? D.p3 : D.text,
                              }}
                              onMouseEnter={e => { if (form.country !== c.code) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                              onMouseLeave={e => { if (form.country !== c.code) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                            >
                              <span style={{ fontSize: 16 }}>{c.flag}</span>
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
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.25)', color: D.danger, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Next */}
              <button type="button" disabled={!step1Valid}
                onClick={onNext}
                style={{
                  width: '100%', padding: '14px', marginTop: 4,
                  background: step1Valid ? `linear-gradient(135deg,${D.p},${D.p2})` : 'rgba(255,255,255,.05)',
                  border: step1Valid ? 'none' : `1px solid ${D.border}`,
                  borderRadius: 12,
                  color: step1Valid ? '#fff' : D.text4,
                  fontSize: 14, fontWeight: 800,
                  cursor: step1Valid ? 'pointer' : 'not-allowed',
                  fontFamily: FONT,
                  boxShadow: step1Valid ? '0 6px 20px rgba(124,58,237,.4)' : 'none',
                  transition: 'all .2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (step1Valid) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
              >
                {step1Valid ? <>{tx.next_btn}<ArrowRight size={15}/></> : tx.next_disabled}
              </button>
            </div>
  )
}
