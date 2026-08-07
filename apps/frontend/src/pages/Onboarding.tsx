import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Store, Coins, Users, Box, Rocket, Check, ArrowRight, MapPin } from 'lucide-react'
import { useAppStore, type Currency, type Lang } from '@/stores/appStore'
import { saved } from '@/lib/saved'
import { useI18n } from '@/hooks/useI18n'
import { tenantApi, productsApi } from '@/lib/api'
import { suggestedCurrencyForCountry } from '@/utils/countryCurrency'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import LogoMark from '@/components/ui/LogoMark'
import { DEFAULT_MARKET } from '@/lib/defaultMarket'

/**
 * Onboarding tenant — 1:1 maquette 05-onboarding-wizard.view.html :
 * carte compacte NKONI, fil de 5 étapes à icônes (Boutique · Devise · Équipe ·
 * Produits · C'est parti), « Passer pour l'instant » à CHAQUE étape (progressive
 * disclosure — ne bloque jamais), CTA « Continuer → » en --grad-p.
 * Logique conservée : tenantApi.update + produit optionnel + flag
 * localStorage `habashop_onboarded` + redirect dashboard.
 */
export default function Onboarding() {
  const navigate = useNavigate()
  const { updateConfig, setLang, setCurrency } = useAppStore()
  const storeLang = useAppStore(s => s.lang)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  // La devise est auto-déduite du pays tant que l'utilisateur n'y a pas touché manuellement.
  const [currencyTouched, setCurrencyTouched] = useState(false)
  const [form, setForm] = useState({
    shopName: '', ownerName: '', shopType: 'grocery',
    country: DEFAULT_MARKET.country, city: '', address: '', phone: '',
    currency: DEFAULT_MARKET.currency as Currency, language: storeLang as Lang, taxRate: 18,
    productName: '', productPrice: 0, productStock: 0, skipProduct: false,
  })

  const lang = form.language
  const { i } = useI18n()
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const handleFinish = async () => {
    setLoading(true)
    try {
      const address = [form.address, form.city].filter(Boolean).join(', ')
      // Payload DÉFENSIF : « Passer pour l'instant » ne doit jamais écraser des
      // valeurs existantes avec du vide (nom/téléphone/adresse omis si non saisis).
      const patch: Record<string, unknown> = { country: form.country, currency: form.currency, vatRate: form.taxRate }
      if (form.shopName.trim()) patch.name = form.shopName.trim()
      if (form.phone.trim()) patch.phone = form.phone
      if (address) patch.address = address
      // ⚠️ L'échec ARRÊTE la progression. Avant, un `.catch(() => {})` le jetait : le
      // store local était mis à jour, l'onboarding marqué terminé, l'écran de succès
      // affiché — et NI le nom, NI le téléphone, NI l'adresse, NI le pays, NI la TVA
      // n'étaient enregistrés. On reste à l'étape, données intactes à l'écran, avec le
      // message du serveur : le commerçant peut corriger et resoumettre.
      const enregistre = await saved(
        tenantApi.update(patch),
        i('les réglages de la boutique', 'the shop settings', 'los ajustes de la tienda', 'le impostazioni del negozio'),
      )
      if (!enregistre) return
      updateConfig({
        ...(form.shopName.trim() ? { shopName: form.shopName.trim() } : {}),
        shopAddress: address, shopCountry: form.country, shopPhone: form.phone,
        shopVatRate: form.taxRate, currency: form.currency, lang: form.language,
      })
      setCurrency(form.currency)
      setLang(form.language)
      if (form.productName.trim() && !form.skipProduct) {
        // Le premier produit est ACCESSOIRE : son échec ne bloque pas l'onboarding —
        // mais il se DIT, sinon le commerçant croit son catalogue commencé.
        await saved(
          productsApi.create({ name: form.productName, sellPrice: form.productPrice, buyPrice: Math.round(form.productPrice * 0.7), stockQty: form.productStock, stockMin: 5, category: 'Général', isActive: true }),
          i('le premier produit', 'the first product', 'el primer producto', 'il primo prodotto'),
        )
      }
      localStorage.setItem('habashop_onboarded', 'true')
      setStep(5)
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally {
      setLoading(false)
    }
  }

  // Étape courante ∈ [1..4] = formulaire ; 5 = succès. Avancer depuis 4 → handleFinish.
  const next = () => (step === 4 ? handleFinish() : setStep(s => Math.min(5, s + 1)))
  // « Passer pour l'instant » : même progression, sans exiger les champs (jamais bloquant).
  const skip = () => next()

  const STEPS = [
    { id: 1, icon: Store, label: i('Boutique', 'Shop', 'Tienda', 'Negozio') },
    { id: 2, icon: Coins, label: i('Devise', 'Currency', 'Divisa', 'Valuta') },
    { id: 3, icon: Users, label: i('Équipe', 'Team', 'Equipo', 'Squadra') },
    { id: 4, icon: Box, label: i('Produits', 'Products', 'Productos', 'Prodotti') },
    { id: 5, icon: Rocket, label: i("C'est parti", "Let's go", '¡Vamos!', 'Si parte') },
  ]

  const lbl: React.CSSProperties = { color: 'var(--text2)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)' as any, display: 'block' }
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', margin: '6px 0 14px' }
  const chip = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--p)' : 'var(--card)',
    color: active ? '#fff' : 'var(--text2)',
    fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)' as any,
    padding: '7px 13px', minHeight: 36, borderRadius: 9,
    border: active ? '1px solid var(--p)' : '1px solid var(--border2)',
    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font)' }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 18, padding: 22 }}>

        {/* ── En-tête : logo Sac+H · « Bienvenue sur HabaShop » · N / 5 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <LogoMark size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)' }}>{i('Bienvenue sur HabaShop', 'Welcome to HabaShop', 'Bienvenido a HabaShop', 'Benvenuto su HabaShop')}</div>
            <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-label)' }}>{i('Configurons votre boutique en 5 minutes', "Let's set up your shop in 5 minutes", 'Configuremos tu tienda en 5 minutos', 'Configuriamo il tuo negozio in 5 minuti')}</div>
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 'var(--fs-label)', flexShrink: 0 }}>{Math.min(step, 5)} / 5</span>
        </div>

        {/* ── Fil d'étapes (icônes) : courante --p · faites check · à venir card2 ── */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }} role="list" aria-label={i('Étapes', 'Steps', 'Pasos', 'Passi')}>
          {STEPS.map((s, idx) => {
            const Icon = s.icon
            const done = step > s.id
            const current = step === s.id
            return (
              <div key={s.id} style={{ display: 'contents' }}>
                {idx > 0 && <div aria-hidden="true" style={{ flex: 0.6, height: 2, background: done || current ? 'color-mix(in srgb, var(--p) 45%, transparent)' : 'var(--border2)', marginBottom: 18 }} />}
                <div role="listitem" aria-current={current ? 'step' : undefined} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: current ? 'var(--p)' : done ? 'color-mix(in srgb, var(--acc2) 18%, transparent)' : 'var(--card2)',
                    color: current ? '#fff' : done ? 'var(--acc2)' : 'var(--text3)',
                    border: current ? 'none' : done ? '1px solid color-mix(in srgb, var(--acc2) 40%, transparent)' : '1px solid var(--border2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{done ? <Check size={14} /> : <Icon size={14} />}</span>
                  <span style={{ color: current ? 'var(--text)' : 'var(--text3)', fontSize: 10, marginTop: 5, whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ══ Étape 1 — Boutique ══ */}
        {step === 1 && (
          <>
            <div style={{ color: 'var(--text)', fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', marginBottom: 4 }}>{i('Votre boutique', 'Your shop', 'Tu tienda', 'Il tuo negozio')}</div>
            <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginBottom: 18 }}>{i('Ces infos apparaîtront sur vos tickets et factures.', 'This info will appear on your receipts and invoices.', 'Esta información aparecerá en tus tickets y facturas.', 'Queste informazioni appariranno su scontrini e fatture.')}</div>

            <label style={lbl} htmlFor="ob-shop-name">{i('Nom de la boutique', 'Shop name', 'Nombre de la tienda', 'Nome del negozio')}</label>
            <input id="ob-shop-name" className="input" style={inputStyle} autoFocus
              placeholder={i('Ex : Alimentation Centrale', 'Ex: Central Market', 'Ej: Tienda Central', 'Es: Negozio Centrale')}
              value={form.shopName} onChange={e => set({ shopName: e.target.value })} />

            <label style={lbl}>{i('Type de commerce', 'Business type', 'Tipo de negocio', 'Tipo di attività')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' }}>
              {([
                { v: 'grocery',       label: i('Épicerie', 'Grocery', 'Tienda', 'Drogheria') },
                { v: 'superette',     label: i('Superette', 'Mini-market', 'Superete', 'Minimarket') },
                // ⚠️ Libellé aligné sur « Semi-gros » (un seul mot dans toute l'app pour cette
                // notion). La VALEUR `semiwholesale` reste inchangée : `shopType` décrit le
                // TYPE DE COMMERCE, un axe distinct du palier client (`CLIENT_TYPES`) — les
                // lier serait une erreur, malgré la ressemblance des mots.
                { v: 'semiwholesale', label: i('Semi-gros', 'Semi-wholesale', 'Semi-mayorista', 'Semi-ingrosso') },
                { v: 'wholesale',     label: i('Grossiste', 'Wholesale', 'Mayorista', 'Grossista') },
              ]).map(t => (
                <button key={t.v} type="button" aria-pressed={form.shopType === t.v} onClick={() => set({ shopType: t.v })} style={chip(form.shopType === t.v)}>
                  {t.label}
                </button>
              ))}
            </div>

            <label style={lbl} htmlFor="ob-country">{i('Pays', 'Country', 'País', 'Paese')}</label>
            <select id="ob-country" className="input" style={inputStyle} value={form.country}
              onChange={e => { const sug = suggestedCurrencyForCountry(e.target.value); set({ country: e.target.value, ...(!currencyTouched && sug ? { currency: sug } : {}) }) }}>
              {/* ⚠️ La `value` est le code ISO-2, le LIBELLÉ reste français. C'est ce sélecteur
                  qui a écrit « France » dans `Tenant.country` : il PATCHait son propre libellé.
                  Le pays sert à normaliser le téléphone du commerçant (`resolveRecipient`), qui
                  n'accepte que l'ISO-2 — un libellé y devient COUNTRY_UNKNOWN, donc plus aucun
                  WhatsApp ni SMS, en silence. Ne jamais remettre le libellé en `value`.
                  « Autre » est retiré : il ne désigne aucun pays, il ne peut donc rien écrire. */}
              {/* ⚠️ SIXIÈME liste de pays du dépôt, en tableau de tableaux : la détection par
                  forme du verrou cherche `{ iso: … }` et ne l'a PAS vue. Cameroun en tête,
                  comme les cinq autres — cf. `defaultMarket.test.ts`, limite assumée n°3. */}
              {[['CM', 'Cameroun', '🇨🇲'], ['SN', 'Sénégal', '🇸🇳'], ['CI', "Côte d'Ivoire", '🇨🇮'], ['ML', 'Mali', '🇲🇱'], ['BF', 'Burkina Faso', '🇧🇫'], ['GN', 'Guinée', '🇬🇳'], ['CD', 'Congo RDC', '🇨🇩'], ['GA', 'Gabon', '🇬🇦'], ['TG', 'Togo', '🇹🇬'], ['BJ', 'Bénin', '🇧🇯'], ['NE', 'Niger', '🇳🇪'], ['TD', 'Tchad', '🇹🇩'], ['FR', 'France', '🇫🇷'], ['BE', 'Belgique', '🇧🇪'], ['CA', 'Canada', '🇨🇦']].map(([iso, c, f]) => <option key={iso} value={iso}>{f} {c}</option>)}
            </select>

            <label style={lbl} htmlFor="ob-city">{i('Ville', 'City', 'Ciudad', 'Città')}</label>
            <div style={{ position: 'relative', margin: '6px 0 8px' }}>
              <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input id="ob-city" className="input" style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34 }}
                placeholder={i('Ex : votre ville', 'Ex: your city', 'Ej: su ciudad', 'Es: la tua città')}
                value={form.city} onChange={e => set({ city: e.target.value })} />
            </div>
          </>
        )}

        {/* ══ Étape 2 — Devise & langue ══ */}
        {step === 2 && (
          <>
            <div style={{ color: 'var(--text)', fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', marginBottom: 4 }}>{i('Devise & langue', 'Currency & language', 'Divisa e idioma', 'Valuta e lingua')}</div>
            <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginBottom: 18 }}>{i('Modifiable à tout moment dans les réglages.', 'Can be changed anytime in settings.', 'Modificable en cualquier momento en ajustes.', 'Modificabile in qualsiasi momento nelle impostazioni.')}</div>

            <label style={lbl}>{i('Devise', 'Currency', 'Divisa', 'Valuta')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' }}>
              {(['XOF', 'XAF', 'EUR', 'USD', 'CAD', 'GBP'] as const).map(code => (
                <button key={code} type="button" aria-pressed={form.currency === code}
                  onClick={() => { setCurrencyTouched(true); set({ currency: code as Currency }) }} style={chip(form.currency === code)}>
                  {code}
                </button>
              ))}
            </div>

            <label style={lbl}>{i('Langue de l’interface', 'Interface language', 'Idioma de la interfaz', 'Lingua dell’interfaccia')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' }}>
              {([['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['it', 'Italiano']] as const).map(([code, name]) => (
                <button key={code} type="button" aria-pressed={form.language === code} onClick={() => set({ language: code as Lang })} style={chip(form.language === code)}>
                  {name}
                </button>
              ))}
            </div>

            <label style={lbl}>{i('Taux de TVA (%)', 'VAT rate (%)', 'Tasa de IVA (%)', 'Aliquota IVA (%)')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 8px', alignItems: 'center' }}>
              {[0, 10, 18, 20, 25].map(r => (
                <button key={r} type="button" aria-pressed={form.taxRate === r} onClick={() => set({ taxRate: r })} style={chip(form.taxRate === r)}>{r}%</button>
              ))}
              <input type="number" min={0} max={100} className="input" style={{ width: 80 }} aria-label={i('Autre taux', 'Other rate', 'Otra tasa', 'Altra aliquota')} placeholder={i('Autre', 'Other', 'Otro', 'Altro')} onChange={e => set({ taxRate: Number(e.target.value) })} />
            </div>
          </>
        )}

        {/* ══ Étape 3 — Équipe (informationnelle : l'invitation vit dans Réglages) ══ */}
        {step === 3 && (
          <>
            <div style={{ color: 'var(--text)', fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', marginBottom: 4 }}>{i('Votre équipe', 'Your team', 'Tu equipo', 'La tua squadra')}</div>
            <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginBottom: 18 }}>{i('Caissiers, gérants, comptables — chacun son rôle et ses accès.', 'Cashiers, managers, accountants — each with their own role and access.', 'Cajeros, gerentes, contables — cada uno con su rol y accesos.', 'Cassieri, gestori, contabili — ognuno con il proprio ruolo e accessi.')}</div>

            <label style={lbl} htmlFor="ob-owner">{i('Votre nom (propriétaire)', 'Your name (owner)', 'Tu nombre (propietario)', 'Il tuo nome (proprietario)')}</label>
            <input id="ob-owner" className="input" style={inputStyle}
              placeholder={i('Ex : Aminata', 'Ex: John Smith', 'Ej: María García', 'Es: Mario Rossi')}
              value={form.ownerName} onChange={e => set({ ownerName: e.target.value })} />

            <label style={lbl}>{i('Téléphone de la boutique', 'Shop phone', 'Teléfono de la tienda', 'Telefono del negozio')}</label>
            <div style={{ margin: '6px 0 14px' }}>
              <PhoneInputWithCountry value={form.phone} onChange={(v: string) => set({ phone: v })} lang={lang} />
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 11, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Users size={15} style={{ color: 'var(--p2)', flexShrink: 0, marginTop: 2 }} />
              <span style={{ color: 'var(--text2)', fontSize: 'var(--fs-label)', lineHeight: 1.5 }}>
                {i('Vous pourrez inviter votre équipe à tout moment dans Réglages → Utilisateurs (rôle par personne : caissier, gérant, RH…).',
                  'You can invite your team anytime in Settings → Users (one role per person: cashier, manager, HR…).',
                  'Podrás invitar a tu equipo en Ajustes → Usuarios (un rol por persona).',
                  'Potrai invitare la tua squadra in Impostazioni → Utenti (un ruolo per persona).')}
              </span>
            </div>
          </>
        )}

        {/* ══ Étape 4 — Produits ══ */}
        {step === 4 && (
          <>
            <div style={{ color: 'var(--text)', fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', marginBottom: 4 }}>{i('Votre premier produit', 'Your first product', 'Tu primer producto', 'Il tuo primo prodotto')}</div>
            <div style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginBottom: 18 }}>{i('Optionnel — vous pourrez en ajouter autant que vous voulez ensuite.', 'Optional — you can add as many as you want later.', 'Opcional — podrás añadir más después.', 'Opzionale — potrai aggiungerne altri dopo.')}</div>

            <label style={lbl} htmlFor="ob-product">{i('Nom du produit', 'Product name', 'Nombre del producto', 'Nome prodotto')}</label>
            <input id="ob-product" className="input" style={inputStyle}
              placeholder={i('Ex : Riz local 25kg', 'Ex: Local rice 25kg', 'Ej: Arroz local 25kg', 'Es: Riso locale 25kg')}
              value={form.productName} onChange={e => set({ productName: e.target.value, skipProduct: !e.target.value.trim() })} />
            {form.productName.trim() && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                <div>
                  <label style={lbl} htmlFor="ob-price">{i('Prix de vente', 'Sell price', 'Precio de venta', 'Prezzo di vendita')} ({form.currency})</label>
                  <input id="ob-price" type="number" min={0} className="input" style={{ width: '100%', boxSizing: 'border-box', marginTop: 6 }} value={form.productPrice || ''} onChange={e => set({ productPrice: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={lbl} htmlFor="ob-stock">{i('Stock initial', 'Initial stock', 'Stock inicial', 'Stock iniziale')}</label>
                  <input id="ob-stock" type="number" min={0} className="input" style={{ width: '100%', boxSizing: 'border-box', marginTop: 6 }} value={form.productStock || ''} onChange={e => set({ productStock: Number(e.target.value) })} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ Étape 5 — C'est parti (succès) ══ */}
        {step === 5 && (
          <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'color-mix(in srgb, var(--acc2) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--acc2) 35%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Rocket size={26} style={{ color: 'var(--acc2)' }} />
            </div>
            <div style={{ color: 'var(--text)', fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', marginBottom: 8 }}>{i('Votre boutique est prête !', 'Your shop is ready!', '¡Tu tienda está lista!', 'Il tuo negozio è pronto!')}</div>
            <p style={{ color: 'var(--text2)', fontSize: 'var(--fs-sm)', lineHeight: 1.6, maxWidth: 340, margin: '0 auto 22px' }}>
              {form.shopName.trim()
                ? i(`${form.shopName} est configurée. Commencez à vendre !`, `${form.shopName} is configured. Start selling!`, `${form.shopName} está configurada. ¡Empieza a vender!`, `${form.shopName} è configurato. Inizia a vendere!`)
                : i('Configuration enregistrée. Commencez à vendre !', 'Setup saved. Start selling!', 'Configuración guardada. ¡Empieza a vender!', 'Configurazione salvata. Inizia a vendere!')}
            </p>
            <button type="button" onClick={() => navigate('/app/dashboard')}
              style={{ width: '100%', background: 'var(--grad-p)', color: '#fff', border: 'none', borderRadius: 11, padding: '13px 22px', minHeight: 48, fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {i('Accéder au tableau de bord', 'Go to dashboard', 'Ir al panel', 'Vai alla dashboard')} <ArrowRight size={15} />
            </button>
            <div style={{ marginTop: 14, fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{i("14 jours d'essai gratuit — aucune carte requise", '14-day free trial — no card required', '14 días de prueba gratis — sin tarjeta', '14 giorni di prova gratuita — nessuna carta')}</div>
          </div>
        )}

        {/* ── Navigation : « Passer pour l'instant » (jamais bloquant) + Continuer → ── */}
        {step < 5 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 10 }}>
            <button type="button" onClick={skip} disabled={loading}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'var(--font)', padding: '10px 0', minHeight: 44 }}>
              {i("Passer pour l'instant", 'Skip for now', 'Omitir por ahora', 'Salta per ora')}
            </button>
            <button type="button" onClick={next} disabled={loading}
              style={{ background: 'var(--grad-p)', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 22px', minHeight: 48, fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading
                ? i('Enregistrement…', 'Saving…', 'Guardando…', 'Salvataggio…')
                : step === 4 ? i('Terminer', 'Finish', 'Terminar', 'Termina') : i('Continuer', 'Continue', 'Continuar', 'Continua')}
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
