import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppStore, type Currency, type Lang } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { tenantApi, productsApi } from '@/lib/api'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'

const STEPS = [
  { id: 1, icon: '👋' }, { id: 2, icon: '📍' }, { id: 3, icon: '⚙️' }, { id: 4, icon: '📦' }, { id: 5, icon: '🚀' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { updateConfig, setLang, setCurrency } = useAppStore()
  const storeLang = useAppStore(s => s.lang)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    shopName: '', ownerName: '', shopType: 'retail',
    country: 'Sénégal', city: '', address: '', phone: '',
    currency: 'XOF' as Currency, language: storeLang as Lang, taxRate: 18,
    productName: '', productPrice: 0, productStock: 0, skipProduct: false,
  })

  const lang = form.language
  const { i } = useI18n()
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const handleFinish = async () => {
    setLoading(true)
    try {
      const address = [form.address, form.city].filter(Boolean).join(', ')
      await tenantApi.update({ name: form.shopName, country: form.country, currency: form.currency, vatRate: form.taxRate, phone: form.phone, address }).catch(() => {})
      updateConfig({ shopName: form.shopName, shopAddress: address, shopCountry: form.country, shopPhone: form.phone, shopVatRate: form.taxRate, currency: form.currency, lang: form.language })
      setCurrency(form.currency)
      setLang(form.language)
      if (form.productName.trim() && !form.skipProduct) {
        await productsApi.create({ name: form.productName, sellPrice: form.productPrice, buyPrice: Math.round(form.productPrice * 0.7), stockQty: form.productStock, stockMin: 5, category: 'Général', isActive: true }).catch(() => {})
      }
      localStorage.setItem('habashop_onboarded', 'true')
      setStep(5)
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally {
      setLoading(false)
    }
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 7 }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#07070F 0%,#0D0D1C 50%,#111128 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#6C47FF,#8B6FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 8px 24px rgba(108,71,255,.4)' }}>🛒</div>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-.5px' }}>HabaShop</span>
      </div>

      {/* Progress */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{i('Étape', 'Step', 'Paso', 'Passo')} {step} / {STEPS.length}</span>
          <span style={{ fontSize: 11, color: 'var(--p3)', fontWeight: 700 }}>{Math.round((step / STEPS.length) * 100)}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${(step / STEPS.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#6C47FF,#8B6FFF)', borderRadius: 99, transition: 'width .4s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 0 12px rgba(108,71,255,.5)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ width: 28, height: 28, borderRadius: '50%', background: step > s.id ? 'var(--acc2)' : step === s.id ? 'linear-gradient(135deg,#6C47FF,#8B6FFF)' : 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: step > s.id ? 12 : 14, border: step === s.id ? '2px solid rgba(108,71,255,.5)' : 'none', transition: 'all .3s' }}>{step > s.id ? '✓' : s.icon}</div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(160deg,#0D0D1C,#111128)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>

        {step === 1 && (
          <div style={{ padding: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--p3)', marginBottom: 8 }}>{i('BIENVENUE', 'WELCOME', 'BIENVENIDO', 'BENVENUTO')}</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-.5px', marginBottom: 6, lineHeight: 1.2 }}>{i('🎉 Créons votre boutique', "🎉 Let's set up your shop", '🎉 Creemos tu tienda', '🎉 Creiamo il tuo negozio')}</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28, lineHeight: 1.6 }}>{i('En quelques minutes, votre boutique sera prête à vendre.', 'In a few minutes, your shop will be ready to sell.', 'En unos minutos, tu tienda estará lista para vender.', 'In pochi minuti, il tuo negozio sarà pronto per vendere.')}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>{i('NOM DE VOTRE BOUTIQUE *', 'YOUR SHOP NAME *', 'NOMBRE DE TU TIENDA *', 'NOME DEL NEGOZIO *')}</label>
              <input aria-label={i('NOM DE VOTRE BOUTIQUE *', 'YOUR SHOP NAME *', 'NOMBRE DE TU TIENDA *', 'NOME DEL NEGOZIO *')} className="input" style={{ fontSize: 15, fontWeight: 700 }} autoFocus placeholder={i('Ex: Épicerie Centrale Dakar', 'Ex: Central Market', 'Ej: Tienda Central', 'Es: Negozio Centrale')} value={form.shopName} onChange={e => set({ shopName: e.target.value })} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>{i('VOTRE NOM *', 'YOUR NAME *', 'TU NOMBRE *', 'IL TUO NOME *')}</label>
              <input aria-label={i('VOTRE NOM *', 'YOUR NAME *', 'TU NOMBRE *', 'IL TUO NOME *')} className="input" placeholder={i('Ex: Aminata Diallo', 'Ex: John Smith', 'Ej: María García', 'Es: Mario Rossi')} value={form.ownerName} onChange={e => set({ ownerName: e.target.value })} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>{i('TYPE DE COMMERCE', 'BUSINESS TYPE', 'TIPO DE NEGOCIO', 'TIPO DI ATTIVITÀ')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { v: 'retail', icon: '🛍️', label: { fr: 'Commerce de détail', en: 'Retail', es: 'Comercio minorista', it: 'Dettaglio' } },
                  { v: 'wholesale', icon: '🏭', label: { fr: 'Grossiste', en: 'Wholesale', es: 'Mayorista', it: 'Grossista' } },
                  { v: 'restaurant', icon: '🍽️', label: { fr: 'Restaurant/Café', en: 'Restaurant/Café', es: 'Restaurante', it: 'Ristorante' } },
                  { v: 'service', icon: '🔧', label: { fr: 'Services', en: 'Services', es: 'Servicios', it: 'Servizi' } },
                ].map(t => (
                  <button key={t.v} type="button" onClick={() => set({ shopType: t.v })} style={{ padding: '12px 14px', borderRadius: 12, background: form.shopType === t.v ? 'rgba(108,71,255,.15)' : 'rgba(255,255,255,.04)', border: `1.5px solid ${form.shopType === t.v ? 'rgba(108,71,255,.4)' : 'rgba(255,255,255,.08)'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .15s' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: form.shopType === t.v ? 'var(--p3)' : 'var(--text2)' }}>{t.label[lang as keyof typeof t.label] ?? t.label.fr}</div>
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 15, fontWeight: 800 }} disabled={!form.shopName.trim() || !form.ownerName.trim()} onClick={() => setStep(2)}>{i('Continuer →', 'Continue →', 'Continuar →', 'Continua →')}</button>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--acc3)', marginBottom: 8 }}>{i('LOCALISATION', 'LOCATION', 'UBICACIÓN', 'POSIZIONE')}</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-.3px', marginBottom: 6 }}>📍 {i('Où êtes-vous situé ?', 'Where are you located?', '¿Dónde estás ubicado?', 'Dove sei situato?')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>{i('Utile pour la livraison et les rapports.', 'Useful for delivery and reports.', 'Útil para entregas e informes.', 'Utile per consegne e report.')}</p>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{i('PAYS', 'COUNTRY', 'PAÍS', 'PAESE')}</label>
              <select aria-label={i('PAYS', 'COUNTRY', 'PAÍS', 'PAESE')} className="input" value={form.country} onChange={e => set({ country: e.target.value })}>
                {[['Sénégal', '🇸🇳'], ["Côte d'Ivoire", '🇨🇮'], ['Mali', '🇲🇱'], ['Burkina Faso', '🇧🇫'], ['Guinée', '🇬🇳'], ['Cameroun', '🇨🇲'], ['Congo RDC', '🇨🇩'], ['Gabon', '🇬🇦'], ['Togo', '🇹🇬'], ['Bénin', '🇧🇯'], ['Niger', '🇳🇪'], ['Tchad', '🇹🇩'], ['France', '🇫🇷'], ['Belgique', '🇧🇪'], ['Canada', '🇨🇦'], ['Autre', '🌍']].map(([c, f]) => <option key={c} value={c}>{f} {c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{i('VILLE', 'CITY', 'CIUDAD', 'CITTÀ')}</label>
              <input aria-label={i('VILLE', 'CITY', 'CIUDAD', 'CITTÀ')} className="input" placeholder={i('Ex: Dakar, Abidjan…', 'Ex: Lagos, Accra…', 'Ej: Bamako…', 'Es: Dakar…')} value={form.city} onChange={e => set({ city: e.target.value })} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{i('TÉLÉPHONE BOUTIQUE', 'SHOP PHONE', 'TELÉFONO TIENDA', 'TELEFONO NEGOZIO')}</label>
              <PhoneInputWithCountry value={form.phone} onChange={(v: string) => set({ phone: v })} lang={lang} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>{i('ADRESSE (optionnel)', 'ADDRESS (optional)', 'DIRECCIÓN (opcional)', 'INDIRIZZO (opzionale)')}</label>
              <input aria-label={i('ADRESSE (optionnel)', 'ADDRESS (optional)', 'DIRECCIÓN (opcional)', 'INDIRIZZO (opzionale)')} className="input" placeholder={i('Rue, quartier…', 'Street, district…', 'Calle, barrio…', 'Via, quartiere…')} value={form.address} onChange={e => set({ address: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← {i('Retour', 'Back', 'Volver', 'Indietro')}</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: 14, fontSize: 15 }} onClick={() => setStep(3)}>{i('Continuer →', 'Continue →', 'Continuar →', 'Continua →')}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--warn)', marginBottom: 8 }}>{i('CONFIGURATION', 'CONFIGURATION', 'CONFIGURACIÓN', 'CONFIGURAZIONE')}</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-.3px', marginBottom: 6 }}>⚙️ {i('Paramètres de base', 'Basic settings', 'Ajustes básicos', 'Impostazioni base')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>{i('Modifiable à tout moment dans les paramètres.', 'Can be changed anytime in settings.', 'Modificable en cualquier momento.', 'Modificabile in qualsiasi momento.')}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>{i('DEVISE', 'CURRENCY', 'DIVISA', 'VALUTA')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {([['XOF', '🇸🇳', 'CFA Ouest'], ['XAF', '🇨🇲', 'CFA Centre'], ['EUR', '🇪🇺', 'Euro'], ['USD', '🇺🇸', 'Dollar US'], ['CAD', '🇨🇦', 'Dollar CA'], ['GBP', '🇬🇧', 'Livre £']] as const).map(([code, flag, name]) => (
                  <button key={code} type="button" onClick={() => set({ currency: code as Currency })} style={{ padding: '10px 8px', borderRadius: 10, background: form.currency === code ? 'rgba(255,184,0,.12)' : 'rgba(255,255,255,.04)', border: `1.5px solid ${form.currency === code ? 'rgba(255,184,0,.4)' : 'rgba(255,255,255,.08)'}`, cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font)', transition: 'all .15s' }}>
                    <div style={{ fontSize: 20 }}>{flag}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: form.currency === code ? 'var(--warn)' : 'var(--text2)', marginTop: 3 }}>{code}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>{i('LANGUE INTERFACE', 'INTERFACE LANGUAGE', 'IDIOMA INTERFAZ', 'LINGUA INTERFACCIA')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {([['fr', '🇫🇷', 'FR'], ['en', '🇬🇧', 'EN'], ['es', '🇪🇸', 'ES'], ['it', '🇮🇹', 'IT']] as const).map(([code, flag, name]) => (
                  <button key={code} type="button" onClick={() => set({ language: code as Lang })} style={{ padding: '10px 6px', borderRadius: 10, background: form.language === code ? 'rgba(108,71,255,.15)' : 'rgba(255,255,255,.04)', border: `1.5px solid ${form.language === code ? 'rgba(108,71,255,.4)' : 'rgba(255,255,255,.08)'}`, cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font)', transition: 'all .15s' }}>
                    <div style={{ fontSize: 20 }}>{flag}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: form.language === code ? 'var(--p3)' : 'var(--text2)' }}>{name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>{i('TAUX TVA (%)', 'VAT RATE (%)', 'TASA IVA (%)', 'ALIQUOTA IVA (%)')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[0, 10, 18, 20, 25].map(r => (
                  <button key={r} type="button" onClick={() => set({ taxRate: r })} style={{ padding: '8px 16px', borderRadius: 10, background: form.taxRate === r ? 'rgba(255,149,0,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${form.taxRate === r ? 'rgba(255,149,0,.4)' : 'rgba(255,255,255,.08)'}`, cursor: 'pointer', color: form.taxRate === r ? 'var(--acc)' : 'var(--text3)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, transition: 'all .15s' }}>{r}%</button>
                ))}
                <input type="number" min={0} max={100} className="input" style={{ width: 80 }} placeholder={i('Autre', 'Other', 'Otro', 'Altro')} onChange={e => set({ taxRate: Number(e.target.value) })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>← {i('Retour', 'Back', 'Volver', 'Indietro')}</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: 14, fontSize: 15 }} onClick={() => setStep(4)}>{i('Continuer →', 'Continue →', 'Continuar →', 'Continua →')}</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ padding: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--acc2)', marginBottom: 8 }}>{i('PREMIER PRODUIT', 'FIRST PRODUCT', 'PRIMER PRODUCTO', 'PRIMO PRODOTTO')}</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-.3px', marginBottom: 6 }}>📦 {i('Ajoutez votre premier produit', 'Add your first product', 'Agrega tu primer producto', 'Aggiungi il tuo primo prodotto')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>{i('Optionnel — vous pourrez en ajouter plus tard.', 'Optional — you can add more later.', 'Opcional — puedes agregar más después.', 'Opzionale — puoi aggiungerne altri dopo.')}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>{i('NOM DU PRODUIT', 'PRODUCT NAME', 'NOMBRE DEL PRODUCTO', 'NOME PRODOTTO')}</label>
              <input aria-label={i('NOM DU PRODUIT', 'PRODUCT NAME', 'NOMBRE DEL PRODUCTO', 'NOME PRODOTTO')} className="input" placeholder={i('Ex: Riz local 25kg', 'Ex: Local rice 25kg', 'Ej: Arroz local 25kg', 'Es: Riso locale 25kg')} value={form.productName} onChange={e => set({ productName: e.target.value, skipProduct: !e.target.value.trim() })} />
            </div>
            {form.productName.trim() && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                <div>
                  <label style={lbl}>{i('PRIX VENTE', 'SELL PRICE', 'PRECIO VENTA', 'PREZZO VENDITA')} ({form.currency})</label>
                  <input type="number" min={0} className="input" value={form.productPrice || ''} onChange={e => set({ productPrice: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={lbl}>{i('STOCK INITIAL', 'INITIAL STOCK', 'STOCK INICIAL', 'STOCK INIZIALE')}</label>
                  <input aria-label={i('STOCK INITIAL', 'INITIAL STOCK', 'STOCK INICIAL', 'STOCK INIZIALE')} type="number" min={0} className="input" value={form.productStock || ''} onChange={e => set({ productStock: Number(e.target.value) })} />
                </div>
              </div>
            )}
            <button type="button" style={{ width: '100%', padding: 10, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', marginBottom: 12, fontFamily: 'var(--font)' }} onClick={() => { set({ skipProduct: true }); handleFinish() }}>{i('Passer cette étape →', 'Skip this step →', 'Saltar este paso →', 'Salta questo passo →')}</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(3)}>← {i('Retour', 'Back', 'Volver', 'Indietro')}</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: 14, fontSize: 15 }} disabled={loading} onClick={handleFinish}>{loading ? '⏳ …' : i('Terminer 🚀', 'Finish 🚀', 'Terminar 🚀', 'Termina 🚀')}</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ padding: '48px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-.5px', marginBottom: 10 }}>{i('🎉 Votre boutique est prête !', '🎉 Your shop is ready!', '🎉 ¡Tu tienda está lista!', '🎉 Il tuo negozio è pronto!')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 32px' }}>{i(`${form.shopName} est configurée. Commencez à vendre !`, `${form.shopName} is configured. Start selling!`, `${form.shopName} está configurada. ¡Empieza a vender!`, `${form.shopName} è configurato. Inizia a vendere!`)}</p>
            <div style={{ background: 'rgba(0,208,132,.06)', border: '1px solid rgba(0,208,132,.15)', borderRadius: 16, padding: 20, marginBottom: 28, textAlign: 'left', maxWidth: 360, margin: '0 auto 28px' }}>
              {[
                i('✅ Boutique créée', '✅ Shop created', '✅ Tienda creada', '✅ Negozio creato'),
                i('✅ Localisation configurée', '✅ Location configured', '✅ Ubicación configurada', '✅ Posizione configurata'),
                i('✅ Devise et langue définies', '✅ Currency and language set', '✅ Divisa e idioma definidos', '✅ Valuta e lingua impostate'),
                form.skipProduct ? i('⏭️ Produits à ajouter', '⏭️ Products to add', '⏭️ Productos por agregar', '⏭️ Prodotti da aggiungere') : i('✅ Premier produit ajouté', '✅ First product added', '✅ Primer producto añadido', '✅ Primo prodotto aggiunto'),
              ].map((item, idx) => <div key={idx} style={{ fontSize: 13, color: 'var(--acc2)', marginBottom: 8, fontWeight: 600 }}>{item}</div>)}
            </div>
            <button className="btn btn-primary" style={{ padding: '16px 32px', fontSize: 16, fontWeight: 900, width: '100%', justifyContent: 'center' }} onClick={() => navigate('/app/dashboard')}>{i('Accéder au tableau de bord →', 'Go to dashboard →', 'Ir al panel →', 'Vai alla dashboard →')}</button>
            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text3)' }}>🎁 {i("14 jours d'essai gratuit — aucune carte requise", '14-day free trial — no card required', '14 días de prueba gratis — sin tarjeta', '14 giorni di prova gratuita — nessuna carta')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
