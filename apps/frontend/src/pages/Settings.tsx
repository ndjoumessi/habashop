import { useState, useRef, useEffect, type CSSProperties } from 'react'
import {
  useConfig, t, ACCENT_PAIRS, useFormatAmount, useAppStore,
  convertAmount, useCurrencyInfo, formatInCurrency,
} from '@/stores/appStore'
import type { Currency, Lang } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { tenantApi, cronApi } from '@/lib/api'
import {
  Store, Globe, ShoppingCart, Bell, Shield, FileText,
  Save, Upload, Download, X, RefreshCw, AlertTriangle,
  Info, Image, Lock, LockOpen, ArrowLeftRight, Moon, Sun,
  Paintbrush, DollarSign, Receipt, Mail, Smartphone, Sunrise, ShieldCheck,
  Clock, ClipboardList, CheckCircle, FlaskConical, ChevronRight, Package, Cog,
} from 'lucide-react'
import { generateCDC } from '@/utils/export'
import toast from 'react-hot-toast'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'

type SectionId = 'boutique' | 'pos' | 'lang' | 'notif' | 'security' | 'docs'

const STATIC_QR = [
  1,1,1,1,1,1,1,0,0,1,0,1,
  1,0,0,0,0,0,1,0,1,0,0,1,
  1,0,1,1,1,0,1,1,0,1,0,0,
  1,0,1,1,1,0,1,0,0,0,1,0,
  1,0,1,1,1,0,1,1,0,0,0,1,
  1,0,0,0,0,0,1,0,1,0,1,0,
  1,1,1,1,1,1,1,0,0,1,0,0,
  0,0,0,0,0,0,0,1,0,1,1,0,
  1,0,1,1,0,1,1,0,0,1,0,1,
  0,1,0,0,1,0,0,1,0,0,1,0,
  1,1,0,1,0,1,0,0,1,0,0,1,
  0,0,1,0,1,0,0,1,0,1,0,1,
]

const CURRENCY_META: { code: Currency; flag: string; symbol: string; descKey: string; regionKey: string }[] = [
  { code: 'XOF', flag: '🇸🇳', symbol: 'FCFA', descKey: 'currency_xof', regionKey: 'settings_west_africa' },
  { code: 'XAF', flag: '🇨🇲', symbol: 'FCFA', descKey: 'currency_xaf', regionKey: 'settings_central_africa' },
  { code: 'EUR', flag: '🇪🇺', symbol: '€',    descKey: 'currency_eur', regionKey: 'settings_europe' },
  { code: 'USD', flag: '🇺🇸', symbol: '$',    descKey: 'currency_usd', regionKey: 'settings_usa' },
  { code: 'CAD', flag: '🇨🇦', symbol: 'CA$',  descKey: 'currency_cad', regionKey: 'settings_canada' },
  { code: 'GBP', flag: '🇬🇧', symbol: '£',    descKey: 'currency_gbp', regionKey: 'settings_uk' },
]

const ALL_CURRENCY_CODES: Currency[] = ['XOF', 'XAF', 'EUR', 'USD', 'CAD', 'GBP']

const LANG_META: { code: Lang; flag: string; name: string; native: string }[] = [
  { code: 'fr', flag: '🇫🇷', name: 'Français', native: 'Langue officielle' },
  { code: 'en', flag: '🇬🇧', name: 'English',  native: 'International' },
  { code: 'es', flag: '🇪🇸', name: 'Español',  native: 'Iberoamérica' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano', native: 'Europa' },
]

function getAccentColors() {
  return Object.entries(ACCENT_PAIRS).map(([hex, pair]) => ({
    hex,
    nameKey: hex === '#5B4EE8' ? 'color_violet' :
             hex === '#3B82F6' ? 'color_blue' :
             hex === '#10B981' ? 'color_green' :
             hex === '#F59E0B' ? 'color_orange' :
             hex === '#EF4444' ? 'color_red' : 'color_pink',
    p2: pair.p2,
  }))
}

const VAT_OPTIONS = [0, 5, 10, 18, 20]

const SECTIONS: {
  id: SectionId; icon: JSX.Element
  labelFr: string; labelEn: string; descFr: string; descEn: string
}[] = [
  { id: 'boutique', icon: <Store size={16} />,       labelFr: 'Boutique',        labelEn: 'Shop',               descFr: 'Infos générales',    descEn: 'General info'      },
  { id: 'pos',      icon: <ShoppingCart size={16} />, labelFr: 'Config POS',      labelEn: 'POS Config',         descFr: 'Caisse & TVA',       descEn: 'Cashier & VAT'     },
  { id: 'lang',     icon: <Globe size={16} />,        labelFr: 'Langue & Devise',  labelEn: 'Language & Currency', descFr: 'Localisation',      descEn: 'Localization'      },
  { id: 'notif',    icon: <Bell size={16} />,         labelFr: 'Notifications',   labelEn: 'Notifications',      descFr: 'Alertes & rapports', descEn: 'Alerts & reports'  },
  { id: 'security', icon: <Shield size={16} />,       labelFr: 'Sécurité',        labelEn: 'Security',           descFr: 'Accès & sessions',   descEn: 'Access & sessions' },
  { id: 'docs',     icon: <FileText size={16} />,     labelFr: 'Documents',       labelEn: 'Documents',          descFr: 'PDF & exports',      descEn: 'PDF & exports'     },
]

const card: CSSProperties = {
  background: 'linear-gradient(160deg,#0D0D1C 0%,#111128 100%)',
  border: '1px solid rgba(255,255,255,.06)',
  borderRadius: 18, padding: 24, marginBottom: 16,
}

function CardHead({ icon, title, desc }: { icon: JSX.Element; title: string; desc?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(108,71,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A991FF' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{desc}</div>}
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ position: 'relative', width: 48, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0, background: value ? '#00D084' : 'rgba(255,255,255,.15)', transition: 'background .2s' }}>
      <div style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: '#fff', top: 4, transition: 'left .15s', left: value ? 26 : 4, boxShadow: '0 1px 4px rgba(0,0,0,.35)' }} />
    </button>
  )
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, marginTop: 2, color: 'var(--text3)' }}>{sub}</div>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>
      {children}
    </label>
  )
}

export default function Settings() {
  const cfg = useConfig()
  const fmt = useFormatAmount()
  const { symbol: currencySymbol } = useCurrencyInfo()
  const { settingsLocked, lockSettings, unlockSettings } = useAppStore()
  const { updateUser } = useAuthStore()

  const [activeSection, setActiveSection] = useState<SectionId>('boutique')
  const [showReset, setShowReset]         = useState(false)
  const [shopEditMode, setShopEditMode]   = useState(false)
  const [posEditMode, setPosEditMode]     = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const [shopForm, setShopForm] = useState({
    shopName: cfg.shopName, shopSlogan: cfg.shopSlogan,
    shopAddress: cfg.shopAddress, shopPhone: cfg.shopPhone,
    shopEmail: cfg.shopEmail, shopCountry: cfg.shopCountry,
    shopSiret: cfg.shopSiret, shopVatRate: cfg.shopVatRate,
  })

  useEffect(() => {
    tenantApi.get().then(data => {
      if (data) setShopForm(p => ({
        ...p,
        shopName:    data.name     ?? p.shopName,
        shopCountry: data.country  ?? p.shopCountry,
        shopPhone:   data.phone    ?? p.shopPhone,
        shopEmail:   data.email    ?? p.shopEmail,
        shopAddress: data.address  ?? p.shopAddress,
        shopVatRate: data.vatRate  ?? p.shopVatRate,
      }))
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => cfg.updateConfig({ shopLogo: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  const handleExportConfig = () => {
    const blob = new Blob([cfg.exportConfig()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `habashop-config-${new Date().toISOString().split('T')[0]}.json`; a.click()
    URL.revokeObjectURL(url)
    toast.success(t('settings_config_exported'))
  }

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { cfg.importConfig(ev.target?.result as string); toast.success(t('settings_import_success')) }
      catch { toast.error(t('settings_import_error')) }
    }
    reader.readAsText(file); e.target.value = ''
  }

  const lbl = (fr: string, en: string) => cfg.lang === 'fr' ? fr : en

  return (
    <div className="animate-in">
      <input ref={importRef} type="file" accept=".json" onChange={handleImportConfig} style={{ display: 'none' }} />

      <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left nav ── */}
        <div style={{ position: 'sticky', top: 80, background: 'linear-gradient(160deg,#0D0D1C,#111128)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 20, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map(sec => {
            const active = activeSection === sec.id
            return (
              <button key={sec.id} onClick={() => setActiveSection(sec.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, width: '100%', border: active ? '1px solid rgba(108,71,255,.3)' : '1px solid transparent', background: active ? 'rgba(108,71,255,.12)' : 'transparent', cursor: 'pointer', transition: 'all .15s', textAlign: 'left', fontFamily: 'var(--font)' }}>
                <span style={{ color: active ? '#A991FF' : 'var(--text3)', flexShrink: 0, display: 'flex' }}>{sec.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text2)' }}>{cfg.lang === 'fr' ? sec.labelFr : sec.labelEn}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{cfg.lang === 'fr' ? sec.descFr : sec.descEn}</div>
                </div>
                {active && <ChevronRight size={13} style={{ color: '#A991FF', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>

        {/* ── Right content (key triggers slideUp on section change) ── */}
        <div key={activeSection} style={{ animation: 'slideUp .22s ease' }}>

          {/* ════ BOUTIQUE ════ */}
          {activeSection === 'boutique' && <>
            <div style={card}>
              <CardHead icon={<Store size={16} />} title={lbl('Informations boutique', 'Shop information')} desc={lbl('Nom, adresse, coordonnées', 'Name, address, contacts')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {([
                  { label: t('settings_shop_name'), key: 'shopName',    type: 'text',  span: true  },
                  { label: t('settings_slogan'),    key: 'shopSlogan',  type: 'text',  span: true  },
                  { label: t('settings_country'),   key: 'shopCountry', type: 'text',  span: false },
                  { label: t('settings_siret'),     key: 'shopSiret',   type: 'text',  span: false },
                  { label: t('settings_phone'),     key: 'shopPhone',   type: 'tel',   span: false },
                  { label: t('settings_email'),     key: 'shopEmail',   type: 'email', span: false },
                ] as { label: string; key: keyof typeof shopForm; type: string; span: boolean }[]).map(f => (
                  <div key={f.key} style={{ gridColumn: f.span ? '1/-1' : 'auto' }}>
                    <Label>{f.label}</Label>
                    <input className="input text-sm" type={f.type} readOnly={!shopEditMode}
                      value={String(shopForm[f.key])}
                      onChange={e => setShopForm(s => ({ ...s, [f.key]: e.target.value }))}
                      style={{ opacity: shopEditMode ? 1 : .65, cursor: shopEditMode ? 'text' : 'default' }} />
                  </div>
                ))}
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>{t('settings_address')}</Label>
                  {shopEditMode
                    ? <AddressAutocomplete value={shopForm.shopAddress} onChange={v => setShopForm(s => ({ ...s, shopAddress: v }))} />
                    : <input className="input text-sm" readOnly value={shopForm.shopAddress} style={{ opacity: .65, cursor: 'default' }} />}
                </div>
                <div>
                  <div style={{ padding: '10px 14px', background: 'rgba(0,184,255,.06)', border: '1px solid rgba(0,184,255,.12)', borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--acc3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Info size={12} /> {lbl('À quoi sert ce champ ?', 'What is this field for?')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
                      {lbl("Taux TVA pour factures et devis. Distinct du taux TVA du POS.", "VAT rate for invoices and quotes. Separate from the POS tax rate.")}
                    </div>
                  </div>
                  <Label>{t('settings_vat')}</Label>
                  <select className="input text-sm" disabled={!shopEditMode} value={shopForm.shopVatRate} onChange={e => setShopForm(s => ({ ...s, shopVatRate: +e.target.value }))}>
                    {VAT_OPTIONS.map(v => <option key={v} value={v}>{v} %</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                {!shopEditMode ? (
                  <button className="btn btn-ghost gap-2" onClick={() => setShopEditMode(true)} style={{ cursor: 'pointer' }}>
                    <Save size={13} /> {lbl('Modifier', 'Edit')}
                  </button>
                ) : <>
                  <button className="btn btn-ghost gap-2" onClick={() => setShopEditMode(false)} style={{ cursor: 'pointer' }}>
                    <X size={13} /> {lbl('Annuler', 'Cancel')}
                  </button>
                  <button className="btn btn-primary gap-2" style={{ cursor: 'pointer' }} onClick={async () => {
                    cfg.updateConfig(shopForm)
                    updateUser({ shopName: shopForm.shopName })
                    try {
                      await tenantApi.update({ name: shopForm.shopName, country: shopForm.shopCountry, phone: shopForm.shopPhone, email: shopForm.shopEmail, address: shopForm.shopAddress, vatRate: shopForm.shopVatRate })
                      toast.success('✅ Boutique mise à jour !')
                    } catch { toast.success(t('settings_saved')) }
                    setShopEditMode(false)
                  }}>
                    <Save size={13} /> {lbl('Sauvegarder', 'Save')}
                  </button>
                </>}
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<Image size={16} />} title={t('settings_logo')} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 80, height: 80, borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,.04)', border: '2px dashed rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {cfg.shopLogo ? <img src={cfg.shopLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Store size={32} style={{ color: 'var(--text3)' }} />}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{cfg.shopLogo ? t('settings_logo_change') : t('settings_logo_none')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{t('settings_logo_formats')}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label className="btn btn-ghost gap-2" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                      <Upload size={13} /> {t('settings_logo_upload')}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    </label>
                    {cfg.shopLogo && (
                      <button className="btn btn-ghost gap-2" style={{ color: 'var(--danger)', cursor: 'pointer' }} onClick={() => { cfg.updateConfig({ shopLogo: null }); toast.success(t('settings_saved')) }}>
                        <X size={13} /> {t('btn_delete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<Paintbrush size={16} />} title={t('settings_theme')} />
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                {[
                  { id: 'dark',  label: t('settings_dark'),  icon: <Moon size={24} />,  desc: t('settings_dark_desc')  },
                  { id: 'light', label: t('settings_light'), icon: <Sun size={24} />,   desc: t('settings_light_desc') },
                ].map(th => (
                  <div key={th.id} onClick={() => cfg.updateConfig({ theme: th.id as 'dark' | 'light' })} style={{ flex: 1, padding: '14px 16px', borderRadius: 14, cursor: 'pointer', transition: 'all .15s', background: cfg.theme === th.id ? 'rgba(108,71,255,.1)' : 'rgba(255,255,255,.03)', border: `1px solid ${cfg.theme === th.id ? 'rgba(108,71,255,.35)' : 'rgba(255,255,255,.06)'}` }}>
                    <div style={{ marginBottom: 8, display: 'flex', color: cfg.theme === th.id ? '#A991FF' : 'var(--text3)' }}>{th.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{th.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{th.desc}</div>
                    {cfg.theme === th.id && <span className="badge badge-teal" style={{ marginTop: 8, display: 'inline-block' }}>{t('status_active')}</span>}
                  </div>
                ))}
              </div>
              <Label>{t('settings_accent_color')}</Label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                {getAccentColors().map(ac => (
                  <div key={ac.hex} onClick={() => cfg.updateConfig({ accentColor: ac.hex })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: ac.hex, border: cfg.accentColor === ac.hex ? `3px solid ${ac.p2}` : '3px solid transparent', outline: cfg.accentColor === ac.hex ? '2px solid rgba(255,255,255,.2)' : 'none', boxShadow: cfg.accentColor === ac.hex ? `0 0 0 2px ${ac.hex}44` : 'none', transition: 'all .15s' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: cfg.accentColor === ac.hex ? 'var(--text)' : 'var(--text3)' }}>{t(ac.nameKey)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* ════ POS ════ */}
          {activeSection === 'pos' && <>
            <div style={card}>
              <CardHead icon={<ShoppingCart size={16} />} title={t('settings_pos_config')} desc={lbl('Configuration de la caisse', 'Cash register configuration')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Label>{lbl('Mode d\'affichage des prix', 'Price display mode')}</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { id: 'TTC', title: 'TTC', subtitle: lbl('Prix taxes incluses', 'Prices with taxes'), example: lbl('1 000 FCFA (TVA incluse)', '1,000 XOF (tax included)'), icon: <DollarSign size={20} /> },
                      { id: 'HT',  title: 'HT',  subtitle: lbl('Prix HT + TVA séparée', 'Excl. tax + VAT line'),    example: lbl('847 FCFA + TVA 153 FCFA', '847 XOF + VAT 153 XOF'),    icon: <Receipt size={20} />    },
                    ].map(mode => (
                      <button key={mode.id} type="button" disabled={!posEditMode} aria-pressed={cfg.priceMode === mode.id}
                        onClick={() => cfg.updateConfig({ priceMode: mode.id as 'TTC' | 'HT' })}
                        style={{ padding: 14, borderRadius: 12, cursor: posEditMode ? 'pointer' : 'default', transition: 'all .15s', background: cfg.priceMode === mode.id ? 'rgba(108,71,255,.1)' : 'rgba(255,255,255,.02)', border: `2px solid ${cfg.priceMode === mode.id ? 'var(--p)' : 'rgba(255,255,255,.06)'}`, boxShadow: cfg.priceMode === mode.id ? '0 4px 14px rgba(108,71,255,.2)' : 'none', fontFamily: 'var(--font)', width: '100%', textAlign: 'left', opacity: posEditMode ? 1 : .7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ display: 'flex', color: cfg.priceMode === mode.id ? '#A991FF' : 'var(--text3)' }}>{mode.icon}</span>
                            <span style={{ fontSize: 15, fontWeight: 900, color: cfg.priceMode === mode.id ? 'var(--p3)' : 'var(--text)' }}>{mode.title}</span>
                          </div>
                          {cfg.priceMode === mode.id && <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--p)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800 }}>✓</div>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>{mode.subtitle}</div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: cfg.priceMode === mode.id ? 'var(--p2)' : 'var(--text3)', background: cfg.priceMode === mode.id ? 'rgba(108,71,255,.08)' : 'rgba(255,255,255,.03)', padding: '3px 7px', borderRadius: 5 }}>
                          ex: {mode.example}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{lbl('Mode de paiement par défaut', 'Default payment mode')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{lbl('Pré-sélectionné à l\'ouverture du panier', 'Pre-selected when opening cart')}</div>
                  </div>
                  <select className="input" style={{ width: 'auto', minWidth: 140 }} disabled={!posEditMode}
                    value={cfg.posDefaultPayment} onChange={e => cfg.updateConfig({ posDefaultPayment: e.target.value as 'cash' | 'card' | 'mobile' })}>
                    <option value="cash">💵 {lbl('Espèces', 'Cash')}</option>
                    <option value="card">💳 {lbl('Carte', 'Card')}</option>
                    <option value="wave">🌊 Wave</option>
                    <option value="orange">🟠 Orange Money</option>
                    <option value="mobile">📱 Mobile</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{lbl('Taux de taxe POS (%)', 'POS tax rate (%)')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{lbl('TVA appliquée sur toutes les ventes', 'VAT applied to all sales')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="input" type="number" style={{ width: 70, textAlign: 'right' }} disabled={!posEditMode}
                      value={cfg.posTaxRate} min="0" max="100" step="0.5"
                      onChange={e => cfg.updateConfig({ posTaxRate: Math.max(0, Math.min(100, +e.target.value)) })} />
                    <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>%</span>
                  </div>
                </div>

                <div>
                  <Label>Fond de caisse par défaut</Label>
                  <div style={{ position: 'relative' }}>
                    <input className="input text-sm" type="number" min={0} step={1000} disabled={!posEditMode}
                      value={cfg.posDefaultFund} onChange={e => cfg.updateConfig({ posDefaultFund: +e.target.value })} style={{ paddingRight: 60 }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: 'var(--text3)', pointerEvents: 'none' }}>{currencySymbol}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Montant pré-rempli à l'ouverture de la caisse</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ToggleRow label={t('settings_pos_show_stock')} sub="Affiche la quantité disponible sous chaque produit" value={cfg.posShowStockOnTile} onChange={v => cfg.updateConfig({ posShowStockOnTile: v })} />
                  <ToggleRow label={t('settings_pos_autoprint')} value={cfg.posAutoprint} onChange={v => cfg.updateConfig({ posAutoprint: v })} />
                  <ToggleRow label={t('settings_pos_vat_included')} value={cfg.posVatIncluded} onChange={v => cfg.updateConfig({ posVatIncluded: v })} />
                  <ToggleRow label="Programme fidélité" sub="Active les points de fidélité à la caisse" value={cfg.enableLoyalty} onChange={v => cfg.updateConfig({ enableLoyalty: v })} />
                  <ToggleRow label="Ouverture de caisse obligatoire" sub="Exiger l'ouverture de caisse avant toute vente" value={cfg.requireCashier} onChange={v => cfg.updateConfig({ requireCashier: v })} />
                  <ToggleRow label="Scanner codes-barres" sub="Active le scanner de codes-barres intégré" value={cfg.enableScanner} onChange={v => cfg.updateConfig({ enableScanner: v })} />
                  <ToggleRow label="WhatsApp automatique" sub="Envoie automatiquement le ticket par WhatsApp" value={cfg.autoWhatsApp} onChange={v => cfg.updateConfig({ autoWhatsApp: v })} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {!posEditMode ? (
                    <button className="btn btn-ghost gap-2" onClick={() => setPosEditMode(true)} style={{ cursor: 'pointer' }}>
                      <Save size={13} /> {lbl('Modifier', 'Edit')}
                    </button>
                  ) : <>
                    <button className="btn btn-ghost gap-2" onClick={() => setPosEditMode(false)} style={{ cursor: 'pointer' }}><X size={13} /> {lbl('Annuler', 'Cancel')}</button>
                    <button className="btn btn-primary gap-2" style={{ cursor: 'pointer' }} onClick={() => { toast.success(t('settings_saved')); setPosEditMode(false) }}><Save size={13} /> {lbl('Sauvegarder', 'Save')}</button>
                  </>}
                </div>
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<Package size={16} />} title={t('settings_stock_config')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <Label>{t('settings_stock_threshold')}</Label>
                  <input className="input text-sm" type="number" min={0} value={cfg.stockLowThreshold} onChange={e => cfg.updateConfig({ stockLowThreshold: +e.target.value })} />
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('settings_stock_threshold_desc')}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ToggleRow label={t('settings_stock_auto_order')} sub={t('settings_stock_auto_order_desc')} value={cfg.stockAutoOrder} onChange={v => cfg.updateConfig({ stockAutoOrder: v })} />
                  <ToggleRow label={t('settings_stock_show_sku')} sub={t('settings_stock_show_sku_desc')} value={cfg.stockShowSKU} onChange={v => cfg.updateConfig({ stockShowSKU: v })} />
                </div>
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<Cog size={16} />} title={t('settings_display_options')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ToggleRow label={t('settings_compact')} sub={t('settings_compact_desc')} value={cfg.compactMode} onChange={v => cfg.updateConfig({ compactMode: v })} />
                <ToggleRow label={t('settings_animations')} sub={t('settings_animations_desc')} value={cfg.showAnimations} onChange={v => cfg.updateConfig({ showAnimations: v })} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('settings_rows_per_page')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t('settings_rows_per_page_desc')}</div>
                  </div>
                  <select className="input text-sm" style={{ width: 'auto', padding: '6px 10px' }} value={cfg.tableRowsPerPage} onChange={e => cfg.updateConfig({ tableRowsPerPage: +e.target.value })}>
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} lignes</option>)}
                  </select>
                </div>
              </div>
            </div>
          </>}

          {/* ════ LANGUE & DEVISE ════ */}
          {activeSection === 'lang' && <>
            {settingsLocked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(255,149,0,.08)', border: '1px solid rgba(255,149,0,.15)', borderRadius: 12, marginBottom: 16 }}>
                <Lock size={13} style={{ color: 'var(--acc)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--acc)', flex: 1 }}>{lbl('Les paramètres langue/devise sont verrouillés', 'Language/currency settings are locked')}</span>
                <button className="mini-btn" style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={() => { unlockSettings(); toast.success(lbl('🔓 Paramètres déverrouillés', '🔓 Settings unlocked')) }}>
                  <LockOpen size={12} /> {lbl('Déverrouiller', 'Unlock')}
                </button>
              </div>
            )}

            <div style={card}>
              <CardHead icon={<Globe size={16} />} title={t('settings_language_label')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {LANG_META.map(l => (
                  <div key={l.code} onClick={() => { if (settingsLocked) return; cfg.updateConfig({ lang: l.code }); toast.success(`Langue : ${l.name}`) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: cfg.lang === l.code ? 'rgba(108,71,255,.1)' : 'rgba(255,255,255,.02)', border: `1px solid ${cfg.lang === l.code ? 'rgba(108,71,255,.35)' : 'rgba(255,255,255,.06)'}`, cursor: settingsLocked ? 'default' : 'pointer', transition: 'all .15s', opacity: settingsLocked && cfg.lang !== l.code ? .45 : 1 }}>
                    <span style={{ fontSize: 26 }}>{l.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.native}</div>
                    </div>
                    {cfg.lang === l.code && <span className="badge badge-teal">{t('status_active')}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<ArrowLeftRight size={16} />} title={t('settings_currency_label')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {CURRENCY_META.map(c => (
                  <div key={c.code} onClick={() => { if (settingsLocked) return; cfg.updateConfig({ currency: c.code }); tenantApi.update({ currency: c.code }).catch(() => {}); toast.success(lbl(`Devise : ${c.code}`, `Currency: ${c.code}`)) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: cfg.currency === c.code ? 'rgba(0,208,132,.08)' : 'rgba(255,255,255,.02)', border: `1px solid ${cfg.currency === c.code ? 'rgba(0,208,132,.3)' : 'rgba(255,255,255,.06)'}`, cursor: settingsLocked ? 'default' : 'pointer', transition: 'all .15s', opacity: settingsLocked && cfg.currency !== c.code ? .45 : 1 }}>
                    <span style={{ fontSize: 22 }}>{c.flag}</span>
                    <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, color: 'var(--p2)', fontFamily: 'var(--mono)' }}>{c.symbol}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.code}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t(c.descKey)} — {t(c.regionKey)}</div>
                    </div>
                    {cfg.currency === c.code && <span className="badge badge-teal">{t('status_active')}</span>}
                  </div>
                ))}
              </div>
              <div style={{ padding: 16, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 12 }}>
                  {t('settings_conversion_preview')} — 1 000 {cfg.currency}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {ALL_CURRENCY_CODES.filter(code => code !== cfg.currency).map(code => {
                    const meta = CURRENCY_META.find(m => m.code === code)
                    return (
                      <div key={code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{meta?.flag} {code}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p2)', fontFamily: 'var(--mono)' }}>{formatInCurrency(convertAmount(1000, cfg.currency, code), code)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {!settingsLocked && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary gap-2" style={{ cursor: 'pointer' }} onClick={() => { lockSettings(); toast.success(lbl('✅ Paramètres verrouillés', '✅ Settings locked')) }}>
                  <Lock size={14} /> {lbl('Verrouiller les paramètres', 'Lock settings')}
                </button>
              </div>
            )}
          </>}

          {/* ════ NOTIFICATIONS ════ */}
          {activeSection === 'notif' && <>
            <div style={card}>
              <CardHead icon={<Bell size={16} />} title={t('notif_preferences')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><Mail size={12} /> Email</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ToggleRow label={t('notif_sales_recap')} sub={t('notif_sales_recap_desc')} value={cfg.notifEmailSales} onChange={v => cfg.updateConfig({ notifEmailSales: v })} />
                    <ToggleRow label={t('notif_stock_alert')} sub={t('notif_stock_alert_desc')} value={cfg.notifEmailStock} onChange={v => cfg.updateConfig({ notifEmailStock: v })} />
                    <ToggleRow label={t('notif_payroll')} sub={t('notif_payroll_desc')} value={cfg.notifEmailPayroll} onChange={v => cfg.updateConfig({ notifEmailPayroll: v })} />
                  </div>
                  {cfg.notifEmailStock && (
                    <div style={{ marginTop: 10 }}>
                      <Label>Email de destination pour les alertes stock</Label>
                      <input className="input text-sm" type="email" value={cfg.notifStockEmail} onChange={e => cfg.updateConfig({ notifStockEmail: e.target.value })} placeholder="alerte@moncommerce.com" />
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><Smartphone size={12} /> SMS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ToggleRow label={`${t('notif_big_sales')} (> ${fmt(100000)})`} sub={t('notif_big_sales_desc')} value={cfg.notifSmsSales} onChange={v => cfg.updateConfig({ notifSmsSales: v })} />
                    <ToggleRow label={t('notif_critical_stock')} sub={t('notif_critical_stock_desc')} value={cfg.notifSmsStock} onChange={v => cfg.updateConfig({ notifSmsStock: v })} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><Bell size={12} /> Push</div>
                  <ToggleRow label={t('notif_push_all')} sub={t('notif_push_all_desc')} value={cfg.notifPushAll} onChange={v => cfg.updateConfig({ notifPushAll: v })} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary gap-2" style={{ cursor: 'pointer' }} onClick={() => toast.success(t('settings_saved'))}><Save size={13} /> {t('btn_save')}</button>
                </div>
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<Smartphone size={16} />} title="Alertes WhatsApp automatiques" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: <Sunrise size={22} style={{ color: '#FFB800' }} />, title: lbl('Alerte stock — 8h00', 'Stock alert — 8:00 AM'), desc: lbl('Reçoit une alerte si des produits sont en rupture', 'Receives an alert if products are out of stock'), key: 'morning' as const },
                  { icon: <Moon size={22} style={{ color: '#6C47FF' }} />,    title: lbl('Résumé des ventes — 20h00', 'Sales summary — 8:00 PM'), desc: lbl('Reçoit un résumé des ventes de la journée', 'Receives a sales summary for the day'), key: 'evening' as const },
                ].map(alert => (
                  <div key={alert.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {alert.icon}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{alert.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{alert.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="mini-btn" style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                        onClick={async () => {
                          try { if (alert.key === 'morning') await cronApi.testMorning(); else await cronApi.testEvening(); toast.success('📱 Message de test envoyé !') }
                          catch { toast.error('Erreur envoi test') }
                        }}>
                        <FlaskConical size={12} /> Tester
                      </button>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc2)', background: 'rgba(14,196,126,.12)', borderRadius: 20, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={10} /> Actif
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* ════ SECURITY ════ */}
          {activeSection === 'security' && <>
            <div style={card}>
              <CardHead icon={<ShieldCheck size={16} />} title="Authentification à deux facteurs (2FA)" />
              <ToggleRow label={t('settings_2fa_active')} sub={t('settings_2fa_desc')} value={cfg.twoFAEnabled} onChange={v => { cfg.updateConfig({ twoFAEnabled: v }); toast.success(v ? '2FA activé' : '2FA désactivé') }} />
              {cfg.twoFAEnabled && (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 16, padding: 16, background: 'rgba(0,208,132,.06)', border: '1px solid rgba(0,208,132,.2)', borderRadius: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 2, width: 90, height: 90, padding: 6, background: 'white', borderRadius: 8, flexShrink: 0 }}>
                    {STATIC_QR.map((b, i) => <div key={i} style={{ background: b ? '#111' : 'transparent', borderRadius: 1 }} />)}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Scannez ce QR code</p>
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Utilisez Google Authenticator, Authy ou toute app TOTP</p>
                    <code style={{ fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.06)', color: 'var(--p2)' }}>HABA-XXXX-XXXX-XXXX</code>
                  </div>
                </div>
              )}
            </div>

            <div style={card}>
              <CardHead icon={<Clock size={16} />} title="Paramètres de session" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <Label>{t('settings_session_timeout')}</Label>
                  <select className="input text-sm" value={cfg.sessionTimeout} onChange={e => cfg.updateConfig({ sessionTimeout: +e.target.value })}>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 heure</option>
                    <option value={240}>4 heures</option>
                    <option value={0}>Jamais</option>
                  </select>
                </div>
                <div>
                  <Label>{t('settings_max_attempts')}</Label>
                  <select className="input text-sm" value={cfg.maxLoginAttempts} onChange={e => cfg.updateConfig({ maxLoginAttempts: +e.target.value })}>
                    <option value={3}>3 tentatives</option>
                    <option value={5}>5 tentatives</option>
                    <option value={10}>10 tentatives</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<Shield size={16} />} title={t('settings_active_sessions')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { device: '💻 MacBook Pro', location: 'Dakar, Sénégal', time: 'Maintenant', current: true  },
                  { device: '📱 iPhone 15',   location: 'Dakar, Sénégal', time: 'Il y a 2h',  current: false },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.device}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.location} · {s.time}</div>
                    </div>
                    {s.current
                      ? <span className="badge badge-green">{t('settings_current_session')}</span>
                      : <button className="mini-btn" style={{ color: 'var(--danger)', cursor: 'pointer' }} onClick={() => toast.success('Session révoquée')}>{t('settings_revoke')}</button>}
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<Lock size={16} />} title={lbl('Verrouillage des paramètres', 'Settings lock')} desc={lbl('Protège les paramètres langue/devise', 'Protects language/currency settings')} />
              <ToggleRow
                label={lbl('Paramètres verrouillés', 'Settings locked')}
                sub={lbl('Les changements de langue/devise sont bloqués', 'Language/currency changes are blocked')}
                value={settingsLocked}
                onChange={v => {
                  if (v) { lockSettings(); toast.success(lbl('🔒 Paramètres verrouillés', '🔒 Settings locked')) }
                  else { unlockSettings(); toast.success(lbl('🔓 Paramètres déverrouillés', '🔓 Settings unlocked')) }
                }} />
            </div>
          </>}

          {/* ════ DOCS ════ */}
          {activeSection === 'docs' && <>
            <div style={card}>
              <CardHead icon={<FileText size={16} />} title={lbl('Documents & Exports', 'Documents & Exports')} desc={lbl('PDF, CSV et configuration', 'PDF, CSV and configuration')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: <ClipboardList size={18} style={{ color: '#6C47FF' }} />, title: lbl('Cahier des charges PDF', 'Technical spec PDF'), desc: lbl('Génère le cahier des charges complet de votre boutique', "Generates your shop's complete technical spec"), action: () => { generateCDC(); toast.success(lbl('📄 PDF généré !', '📄 PDF generated!')) }, color: 'rgba(108,71,255,.08)', border: 'rgba(108,71,255,.2)' },
                  { icon: <Download size={18} style={{ color: '#00D084' }} />,       title: lbl('Exporter la configuration', 'Export configuration'), desc: lbl('Sauvegarde tous vos paramètres en JSON', 'Save all your settings as JSON'), action: handleExportConfig, color: 'rgba(0,208,132,.06)', border: 'rgba(0,208,132,.2)' },
                  { icon: <Upload size={18} style={{ color: '#00B8FF' }} />,         title: lbl('Importer la configuration', 'Import configuration'), desc: lbl('Restaure une configuration précédemment exportée', 'Restore a previously exported configuration'), action: () => importRef.current?.click(), color: 'rgba(0,184,255,.06)', border: 'rgba(0,184,255,.2)' },
                ].map((item, i) => (
                  <button key={i} type="button" onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, background: item.color, border: `1px solid ${item.border}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'opacity .15s', width: '100%' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.75'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                    {item.icon}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>

            <div style={card}>
              <CardHead icon={<RefreshCw size={16} />} title="Réinitialisation" />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, background: 'rgba(255,59,92,.07)', border: '1px solid rgba(255,59,92,.15)', borderRadius: 12, marginBottom: 14 }}>
                <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 3 }}>Action irréversible</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>Toutes vos préférences seront remises aux valeurs par défaut. Vos données métier ne seront pas affectées.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowReset(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(255,59,92,.1)', color: 'var(--danger)', border: '1px solid rgba(255,59,92,.2)', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600 }}>
                <RefreshCw size={13} /> {t('settings_reset')}
              </button>
            </div>

            <div style={card}>
              <CardHead icon={<Info size={16} />} title={t('settings_system_info')} />
              <div>
                {[
                  { label: t('settings_version'),     value: 'v2.0.0'       },
                  { label: t('settings_environment'), value: (import.meta as { env?: { MODE?: string } }).env?.MODE === 'production' ? 'Production' : t('settings_development') },
                  { label: t('settings_last_update'),  value: '22 mai 2026' },
                  { label: 'Navigateur',              value: navigator.userAgent.split(' ').slice(-1)[0] || '—' },
                  { label: 'Stockage utilisé',        value: `${(JSON.stringify(localStorage).length / 1024).toFixed(1)} Ko` },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>}

        </div>
      </div>

      {/* Reset modal */}
      {showReset && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowReset(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} style={{ color: 'var(--danger)' }} /> Confirmer la réinitialisation
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(false)}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.7 }}>
              {t('settings_reset_warning')}<br /><br />{t('settings_reset_desc')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost flex-1 justify-center" onClick={() => setShowReset(false)}>{t('btn_cancel')}</button>
              <button className="btn flex-1 justify-center" style={{ background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  cfg.resetConfig(); setShowReset(false)
                  setShopForm({ shopName: cfg.shopName, shopSlogan: cfg.shopSlogan, shopAddress: cfg.shopAddress, shopPhone: cfg.shopPhone, shopEmail: cfg.shopEmail, shopCountry: cfg.shopCountry, shopSiret: cfg.shopSiret, shopVatRate: cfg.shopVatRate })
                  toast.success(t('settings_config_reset'))
                }}>
                {t('settings_reset')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
