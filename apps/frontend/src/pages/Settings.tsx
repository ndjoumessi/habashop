import { useState, useRef, useEffect } from 'react'
import { useConfig, formatCurrency, t, ACCENT_PAIRS, useFormatAmount } from '@/stores/appStore'
import type { Currency, Lang } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { tenantApi, cronApi } from '@/lib/api'
import {
  Store, User, Globe, Palette, ShoppingCart, Package, Bell, Shield, Cog,
  Save, Upload, Download, X, RefreshCw, AlertTriangle,
} from 'lucide-react'
import PhoneInput from '@/components/ui/PhoneInput'
import toast from 'react-hot-toast'

type Tab = 'boutique' | 'compte' | 'langue' | 'apparence' | 'pos' | 'stock' | 'notifications' | 'securite' | 'avance'

// Fake QR code pattern (12×12)
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

// Conversion rates (indicative, XOF base)
const RATES: Partial<Record<Currency, Partial<Record<Currency, number>>>> = {
  XOF: { XAF: 1,       EUR: 1/655.957, USD: 1/609,   CAD: 1/445 },
  XAF: { XOF: 1,       EUR: 1/655.957, USD: 1/609,   CAD: 1/445 },
  EUR: { XOF: 655.957, XAF: 655.957,   USD: 1.08,    CAD: 1.47 },
  USD: { XOF: 609,     XAF: 609,       EUR: 0.926,   CAD: 1.36 },
  CAD: { XOF: 445,     XAF: 445,       EUR: 0.680,   USD: 0.735 },
}

const CURRENCY_META: { code: Currency; flag: string; symbol: string; descKey: string; regionKey: string }[] = [
  { code: 'XOF', flag: '🇸🇳', symbol: 'F CFA', descKey: 'currency_xof', regionKey: 'settings_west_africa' },
  { code: 'XAF', flag: '🇨🇲', symbol: 'F CFA', descKey: 'currency_xaf', regionKey: 'settings_central_africa' },
  { code: 'EUR', flag: '🇪🇺', symbol: '€',     descKey: 'currency_eur', regionKey: 'settings_europe' },
  { code: 'USD', flag: '🇺🇸', symbol: '$',     descKey: 'currency_usd', regionKey: 'settings_usa' },
  { code: 'CAD', flag: '🇨🇦', symbol: 'CA$',   descKey: 'currency_cad', regionKey: 'settings_canada' },
]

const LANG_META: { code: Lang; flag: string; name: string; native: string }[] = [
  { code: 'fr', flag: '🇫🇷', name: 'Français',  native: 'Langue officielle' },
  { code: 'en', flag: '🇬🇧', name: 'English',   native: 'International' },
  { code: 'es', flag: '🇪🇸', name: 'Español',   native: 'Iberoamérica' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano',  native: 'Europa' },
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', width: 44, height: 24, borderRadius: 99,
        border: 'none', cursor: 'pointer', flexShrink: 0,
        background: value ? 'var(--acc2)' : 'var(--bg4)',
        transition: 'background .2s',
      }}
    >
      <div style={{
        position: 'absolute', width: 16, height: 16, borderRadius: '50%',
        background: '#fff', top: 4, transition: 'left .15s',
        left: value ? 24 : 4,
      }} />
    </button>
  )
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{sub}</div>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>
      {children}
    </label>
  )
}

const TABS: { id: Tab; key: string; icon: React.ReactNode }[] = [
  { id: 'boutique',       key: 'settings_shop',           icon: <Store size={14} />        },
  { id: 'compte',         key: 'settings_account',        icon: <User size={14} />         },
  { id: 'langue',         key: 'settings_language',       icon: <Globe size={14} />        },
  { id: 'apparence',      key: 'settings_appearance',     icon: <Palette size={14} />      },
  { id: 'pos',            key: 'settings_pos',            icon: <ShoppingCart size={14} /> },
  { id: 'stock',          key: 'settings_stock',          icon: <Package size={14} />      },
  { id: 'notifications',  key: 'settings_notifications',  icon: <Bell size={14} />         },
  { id: 'securite',       key: 'settings_security',       icon: <Shield size={14} />       },
  { id: 'avance',         key: 'settings_advanced',       icon: <Cog size={14} />          },
]

export default function Settings() {
  const cfg = useConfig()
  const fmt = useFormatAmount()
  const { user, updateUser } = useAuthStore()
  const [tab, setTab] = useState<Tab>('boutique')
  const [showReset, setShowReset] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const [shopForm, setShopForm] = useState({
    shopName: cfg.shopName, shopSlogan: cfg.shopSlogan,
    shopAddress: cfg.shopAddress, shopPhone: cfg.shopPhone,
    shopEmail: cfg.shopEmail, shopCountry: cfg.shopCountry,
    shopSiret: cfg.shopSiret, shopVatRate: cfg.shopVatRate,
  })
  const [accountForm, setAccountForm] = useState({
    name: user?.name || '', email: user?.email || '', phone: '',
    currentPwd: '', newPwd: '', confirmPwd: '',
  })

  useEffect(() => {
    tenantApi.get()
      .then(data => {
        if (data) setShopForm(prev => ({
          ...prev,
          shopName:    data.name     ?? prev.shopName,
          shopCountry: data.country  ?? prev.shopCountry,
          shopPhone:   data.phone    ?? prev.shopPhone,
          shopEmail:   data.email    ?? prev.shopEmail,
          shopAddress: data.address  ?? prev.shopAddress,
          shopVatRate: data.vatRate  ?? prev.shopVatRate,
        }))
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => toast.success(t('settings_saved'))

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => cfg.updateConfig({ shopLogo: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  const handleExportConfig = () => {
    const json = cfg.exportConfig()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `habashop-config-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('settings_config_exported'))
  }

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        cfg.importConfig(ev.target?.result as string)
        toast.success(t('settings_import_success'))
      } catch {
        toast.error(t('settings_import_error'))
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const activeTabStyle = {
    background: 'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(20,184,166,0.12))',
    color: 'var(--text)' as const,
    border: '1px solid rgba(20,184,166,0.25)',
  }
  const inactiveTabStyle = {
    background: 'transparent', color: 'var(--text2)' as const,
    border: '1px solid transparent',
  }

  return (
    <div className="animate-in">
      <input ref={importRef} type="file" accept=".json" onChange={handleImportConfig} style={{ display: 'none' }} />

      <div className="flex gap-5">
        {/* ── Sidebar tabs ── */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="panel p-2" style={{ marginBottom: 0 }}>
            {TABS.map(tb => (
              <button key={tb.id}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5"
                style={{ ...(tab === tb.id ? activeTabStyle : inactiveTabStyle), cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                onClick={() => setTab(tb.id)}
              >
                <span style={{ color: tab === tb.id ? 'var(--p2)' : 'var(--text3)' }}>{tb.icon}</span>
                {t(tb.key)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Contenu ── */}
        <div className="flex-1 min-w-0">

          {/* ════ BOUTIQUE ════ */}
          {tab === 'boutique' && (
            <div className="space-y-4">
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🏪 Informations boutique</span></div>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { label: t('settings_shop_name'), key: 'shopName',    type: 'text',  span: true },
                    { label: t('settings_slogan'),    key: 'shopSlogan',  type: 'text',  span: true },
                    { label: t('settings_country'),   key: 'shopCountry', type: 'text',  span: false },
                    { label: t('settings_siret'),     key: 'shopSiret',   type: 'text',  span: false },
                    { label: t('settings_phone'),     key: 'shopPhone',   type: 'text',  span: false },
                    { label: t('settings_email'),     key: 'shopEmail',   type: 'email', span: false },
                  ] as { label: string; key: keyof typeof shopForm; type: string; span: boolean }[]).map(f => (
                    <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                      <Label>{f.label}</Label>
                      {f.key === 'shopPhone'
                        ? <PhoneInput value={String(shopForm[f.key])} onChange={v => setShopForm(s => ({ ...s, shopPhone: v }))} />
                        : <input className="input text-sm" type={f.type}
                            value={String(shopForm[f.key])}
                            onChange={e => setShopForm(s => ({ ...s, [f.key]: e.target.value }))} />
                      }
                    </div>
                  ))}
                  <div className="col-span-2">
                    <Label>{t('settings_address')}</Label>
                    <textarea className="input text-sm" rows={2} value={shopForm.shopAddress}
                      onChange={e => setShopForm(s => ({ ...s, shopAddress: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t('settings_vat')}</Label>
                    <select className="input text-sm" value={shopForm.shopVatRate}
                      onChange={e => setShopForm(s => ({ ...s, shopVatRate: +e.target.value }))}>
                      {VAT_OPTIONS.map(v => <option key={v} value={v}>{v} %</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button className="btn btn-primary gap-2" onClick={async () => {
                    cfg.updateConfig(shopForm)
                    updateUser({ shopName: shopForm.shopName })
                    try {
                      await tenantApi.update({
                        name:    shopForm.shopName,
                        country: shopForm.shopCountry,
                        phone:   shopForm.shopPhone,
                        email:   shopForm.shopEmail,
                        address: shopForm.shopAddress,
                        vatRate: shopForm.shopVatRate,
                      })
                      toast.success('✅ Boutique mise à jour en base !')
                    } catch {
                      save()
                    }
                  }}>
                    <Save size={14} /> {t('btn_save')}
                  </button>
                </div>
              </div>

              {/* Logo */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🖼️ {t('settings_logo')}</span></div>
                <div className="flex items-center gap-5">
                  <div style={{
                    width: 80, height: 80, borderRadius: 16, overflow: 'hidden',
                    background: 'var(--bg3)', border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {cfg.shopLogo
                      ? <img src={cfg.shopLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 32 }}>🏪</span>
                    }
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                      {cfg.shopLogo ? t('settings_logo_change') : t('settings_logo_none')}
                    </p>
                    <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>{t('settings_logo_formats')}</p>
                    <label className="btn btn-ghost gap-2 cursor-pointer" style={{ display: 'inline-flex' }}>
                      <Upload size={14} /> {t('settings_logo_upload')}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    </label>
                    {cfg.shopLogo && (
                      <button className="btn btn-ghost gap-2 ml-2" style={{ color: 'var(--danger)' }}
                        onClick={() => { cfg.updateConfig({ shopLogo: null }); toast.success(t('settings_saved')) }}>
                        <X size={14} /> {t('btn_delete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ COMPTE ════ */}
          {tab === 'compte' && (
            <div className="space-y-4">
              <div className="panel">
                <div className="panel-head"><span className="panel-title">👤 {t('settings_personal_info')}</span></div>
                <div className="flex items-center gap-4 mb-5">
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--p), var(--acc))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 700, color: '#fff',
                  }}>
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-base" style={{ color: 'var(--text)' }}>{user?.name}</div>
                    <div className="text-sm" style={{ color: 'var(--text3)' }}>{user?.email}</div>
                    <span className="badge badge-red mt-1" style={{ fontSize: 10 }}>Administrateur</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { label: t('col_name'),       key: 'name',  type: 'text',  span: false },
                    { label: t('settings_phone'), key: 'phone', type: 'text',  span: false },
                    { label: t('settings_email'), key: 'email', type: 'email', span: true  },
                  ] as { label: string; key: keyof typeof accountForm; type: string; span: boolean }[]).map(f => (
                    <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                      <Label>{f.label}</Label>
                      {f.key === 'phone'
                        ? <PhoneInput value={accountForm[f.key]} onChange={v => setAccountForm(a => ({ ...a, phone: v }))} />
                        : <input className="input text-sm" type={f.type}
                            value={accountForm[f.key]}
                            onChange={e => setAccountForm(a => ({ ...a, [f.key]: e.target.value }))} />
                      }
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <button className="btn btn-primary gap-2" onClick={() => {
                    updateUser({ name: accountForm.name, email: accountForm.email })
                    save()
                  }}>
                    <Save size={14} /> {t('btn_save')}
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><span className="panel-title">🔑 {t('settings_change_password')}</span></div>
                <div className="space-y-3">
                  {([
                    { label: t('settings_current_pwd'), key: 'currentPwd' },
                    { label: t('settings_new_pwd'),     key: 'newPwd'     },
                    { label: t('settings_confirm_pwd'), key: 'confirmPwd' },
                  ] as { label: string; key: keyof typeof accountForm }[]).map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input className="input text-sm" type="password" placeholder="••••••••"
                        value={accountForm[f.key]}
                        onChange={e => setAccountForm(a => ({ ...a, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <button className="btn btn-primary gap-2" onClick={() => {
                    if (accountForm.newPwd !== accountForm.confirmPwd) {
                      toast.error('Les mots de passe ne correspondent pas')
                      return
                    }
                    setAccountForm(a => ({ ...a, currentPwd: '', newPwd: '', confirmPwd: '' }))
                    save()
                  }}>
                    <Save size={14} /> {t('settings_update')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ LANGUE & DEVISE ════ */}
          {tab === 'langue' && (
            <div className="space-y-5">
              {/* Langue */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🌍 {t('settings_language_label')}</span></div>
                <div className="grid grid-cols-2 gap-3">
                  {LANG_META.map(l => (
                    <div key={l.code}
                      className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: cfg.lang === l.code ? 'rgba(99,102,241,0.10)' : 'var(--bg3)',
                        border: `1px solid ${cfg.lang === l.code ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                      }}
                      onClick={() => { cfg.updateConfig({ lang: l.code }); toast.success(`Langue : ${l.name}`) }}
                    >
                      <span style={{ fontSize: 28 }}>{l.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{l.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text3)' }}>{l.native}</div>
                      </div>
                      {cfg.lang === l.code && <span className="badge badge-teal">{t('status_active')}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Devise */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">💱 {t('settings_currency_label')}</span></div>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {CURRENCY_META.map(c => (
                    <div key={c.code}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: cfg.currency === c.code ? 'rgba(14,196,126,0.10)' : 'var(--bg3)',
                        border: `1px solid ${cfg.currency === c.code ? 'rgba(14,196,126,0.35)' : 'var(--border)'}`,
                      }}
                      onClick={() => {
                        cfg.updateConfig({ currency: c.code })
                        tenantApi.update({ currency: c.code }).catch(() => {})
                        toast.success(
                          cfg.lang === 'fr'
                            ? `✅ Devise changée : ${c.code}`
                            : `✅ Currency changed: ${c.code}`
                        )
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{c.flag}</span>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: 'var(--bg4)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--p2)',
                        fontFamily: 'var(--mono)',
                      }}>
                        {c.symbol}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.code}</div>
                        <div className="text-xs" style={{ color: 'var(--text3)' }}>{t(c.descKey)} — {t(c.regionKey)}</div>
                      </div>
                      {cfg.currency === c.code && <span className="badge badge-teal">{t('status_active')}</span>}
                    </div>
                  ))}
                </div>

                {/* Conversion preview */}
                <div className="p-4 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
                    {t('settings_conversion_preview')} — 1 000 {cfg.currency}
                  </div>
                  <div className="space-y-2">
                    {CURRENCY_META.filter(c => c.code !== cfg.currency).map(c => {
                      const rate = RATES[cfg.currency]?.[c.code] ?? 1
                      return (
                        <div key={c.code} className="flex justify-between items-center text-sm">
                          <span style={{ color: 'var(--text2)' }}>{c.flag} {c.code}</span>
                          <span className="font-bold" style={{ color: 'var(--p2)', fontFamily: 'var(--mono)' }}>
                            {formatCurrency(1000 * rate, c.code)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ APPARENCE ════ */}
          {tab === 'apparence' && (
            <div className="space-y-4">
              {/* Thème */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🎨 {t('settings_theme')}</span></div>
                <div className="flex gap-3">
                  {[
                    { id: 'dark',  label: t('settings_dark'),  emoji: '🌙', desc: t('settings_dark_desc') },
                    { id: 'light', label: t('settings_light'), emoji: '☀️', desc: t('settings_light_desc') },
                  ].map(th => (
                    <div key={th.id}
                      className="flex-1 p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: cfg.theme === th.id ? 'rgba(99,102,241,0.10)' : 'var(--bg3)',
                        border: `1px solid ${cfg.theme === th.id ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                      }}
                      onClick={() => cfg.updateConfig({ theme: th.id as 'dark' | 'light' })}
                    >
                      <div style={{ fontSize: 28, marginBottom: 6 }}>{th.emoji}</div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{th.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{th.desc}</div>
                      {cfg.theme === th.id && <span className="badge badge-teal mt-2" style={{ display: 'block', marginTop: 8 }}>{t('status_active')}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Couleur d'accent */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🖌️ {t('settings_accent_color')}</span></div>
                <div className="flex gap-3 flex-wrap">
                  {getAccentColors().map(ac => (
                    <div key={ac.hex}
                      className="flex flex-col items-center gap-2 cursor-pointer"
                      onClick={() => cfg.updateConfig({ accentColor: ac.hex })}
                    >
                      <div style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: ac.hex,
                        border: cfg.accentColor === ac.hex ? `3px solid ${ac.p2}` : '3px solid transparent',
                        outline: cfg.accentColor === ac.hex ? `2px solid var(--border2)` : 'none',
                        boxShadow: cfg.accentColor === ac.hex ? `0 0 0 2px ${ac.hex}44` : 'none',
                        transition: 'all .15s',
                      }} />
                      <span className="text-xs font-medium" style={{ color: cfg.accentColor === ac.hex ? 'var(--text)' : 'var(--text3)' }}>
                        {t(ac.nameKey)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Options d'affichage */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">⚙️ {t('settings_display_options')}</span></div>
                <div className="space-y-3">
                  <ToggleRow label={t('settings_compact')} sub={t('settings_compact_desc')}
                    value={cfg.compactMode} onChange={v => cfg.updateConfig({ compactMode: v })} />
                  <ToggleRow label={t('settings_animations')} sub={t('settings_animations_desc')}
                    value={cfg.showAnimations} onChange={v => cfg.updateConfig({ showAnimations: v })} />
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('settings_rows_per_page')}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{t('settings_rows_per_page_desc')}</div>
                    </div>
                    <select className="input text-sm" style={{ width: 'auto', padding: '6px 10px' }}
                      value={cfg.tableRowsPerPage}
                      onChange={e => cfg.updateConfig({ tableRowsPerPage: +e.target.value })}>
                      {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} lignes</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ POS ════ */}
          {tab === 'pos' && (
            <div className="panel">
              <div className="panel-head"><span className="panel-title">🛒 {t('settings_pos_config')}</span></div>
              <div className="space-y-4">
                <div>
                  <Label>{t('settings_pos_default_payment')}</Label>
                  <div className="flex gap-3">
                    {[
                      { id: 'cash',   label: '💵 Espèces' },
                      { id: 'card',   label: '💳 Carte' },
                      { id: 'mobile', label: '📲 Mobile' },
                    ].map(m => (
                      <button key={m.id}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: cfg.posDefaultPayment === m.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg3)',
                          color: cfg.posDefaultPayment === m.id ? '#fff' : 'var(--text2)',
                          border: `1px solid ${cfg.posDefaultPayment === m.id ? 'transparent' : 'var(--border)'}`,
                          cursor: 'pointer', fontFamily: 'inherit',
                          boxShadow: cfg.posDefaultPayment === m.id ? '0 4px 14px rgba(91,78,232,.3)' : 'none',
                        }}
                        onClick={() => cfg.updateConfig({ posDefaultPayment: m.id as 'cash' | 'card' | 'mobile' })}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>{t('settings_pos_tax_rate')}</Label>
                  <select className="input text-sm" value={cfg.posTaxRate}
                    onChange={e => cfg.updateConfig({ posTaxRate: +e.target.value })}>
                    {VAT_OPTIONS.map(v => <option key={v} value={v}>{v} %</option>)}
                  </select>
                </div>

                <div>
                  <Label>Mode de prix</Label>
                  <div className="flex gap-3">
                    {(['TTC', 'HT'] as const).map(m => (
                      <button key={m} className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: cfg.priceMode === m ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg3)',
                          color: cfg.priceMode === m ? '#fff' : 'var(--text2)',
                          border: `1px solid ${cfg.priceMode === m ? 'transparent' : 'var(--border)'}`,
                          cursor: 'pointer', fontFamily: 'inherit',
                          boxShadow: cfg.priceMode === m ? '0 4px 14px rgba(91,78,232,.3)' : 'none',
                        }}
                        onClick={() => cfg.updateConfig({ priceMode: m })}
                      >
                        {m === 'TTC' ? '💰 TTC (toutes taxes)' : '📊 HT (hors taxes)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <ToggleRow label={t('settings_pos_show_stock')} sub="Affiche la quantité disponible sous chaque produit"
                    value={cfg.posShowStockOnTile} onChange={v => cfg.updateConfig({ posShowStockOnTile: v })} />
                  <ToggleRow label={t('settings_pos_autoprint')}
                    value={cfg.posAutoprint} onChange={v => cfg.updateConfig({ posAutoprint: v })} />
                  <ToggleRow label={t('settings_pos_vat_included')}
                    value={cfg.posVatIncluded} onChange={v => cfg.updateConfig({ posVatIncluded: v })} />
                  <ToggleRow label="Programme fidélité" sub="Active les points de fidélité à la caisse"
                    value={cfg.enableLoyalty} onChange={v => cfg.updateConfig({ enableLoyalty: v })} />
                  <ToggleRow label="Ouverture de caisse obligatoire" sub="Exiger l'ouverture de caisse avant toute vente"
                    value={cfg.requireCashier} onChange={v => cfg.updateConfig({ requireCashier: v })} />
                </div>

                <div className="flex justify-end">
                  <button className="btn btn-primary gap-2" onClick={() => save()}>
                    <Save size={14} /> {t('btn_save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ STOCK ════ */}
          {tab === 'stock' && (
            <div className="panel">
              <div className="panel-head"><span className="panel-title">📦 {t('settings_stock_config')}</span></div>
              <div className="space-y-4">
                <div>
                  <Label>{t('settings_stock_threshold')}</Label>
                  <input className="input text-sm" type="number" min={0}
                    value={cfg.stockLowThreshold}
                    onChange={e => cfg.updateConfig({ stockLowThreshold: +e.target.value })} />
                  <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                    {t('settings_stock_threshold_desc')}
                  </p>
                </div>
                <div className="space-y-3">
                  <ToggleRow label={t('settings_stock_auto_order')}
                    sub={t('settings_stock_auto_order_desc')}
                    value={cfg.stockAutoOrder} onChange={v => cfg.updateConfig({ stockAutoOrder: v })} />
                  <ToggleRow label={t('settings_stock_show_sku')}
                    sub={t('settings_stock_show_sku_desc')}
                    value={cfg.stockShowSKU} onChange={v => cfg.updateConfig({ stockShowSKU: v })} />
                </div>
                <div className="flex justify-end">
                  <button className="btn btn-primary gap-2" onClick={() => save()}>
                    <Save size={14} /> {t('btn_save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ NOTIFICATIONS ════ */}
          {tab === 'notifications' && (
            <>
            <div className="panel">
              <div className="panel-head"><span className="panel-title">🔔 {t('notif_preferences')}</span></div>
              <div className="space-y-5">
                {/* Email */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>📧 Email</h4>
                  <div className="space-y-2">
                    <ToggleRow label={t('notif_sales_recap')}
                      sub={t('notif_sales_recap_desc')}
                      value={cfg.notifEmailSales} onChange={v => cfg.updateConfig({ notifEmailSales: v })} />
                    <ToggleRow label={t('notif_stock_alert')}
                      sub={t('notif_stock_alert_desc')}
                      value={cfg.notifEmailStock} onChange={v => cfg.updateConfig({ notifEmailStock: v })} />
                    <ToggleRow label={t('notif_payroll')}
                      sub={t('notif_payroll_desc')}
                      value={cfg.notifEmailPayroll} onChange={v => cfg.updateConfig({ notifEmailPayroll: v })} />
                  </div>
                  {cfg.notifEmailStock && (
                    <div className="mt-3">
                      <Label>Email de destination pour les alertes stock</Label>
                      <input className="input text-sm" type="email"
                        value={cfg.notifStockEmail}
                        onChange={e => cfg.updateConfig({ notifStockEmail: e.target.value })}
                        placeholder="alerte@moncommerce.com" />
                    </div>
                  )}
                </div>

                {/* SMS */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>📱 SMS</h4>
                  <div className="space-y-2">
                    <ToggleRow label={`${t('notif_big_sales')} (> ${fmt(100000)})`}
                      sub={t('notif_big_sales_desc')}
                      value={cfg.notifSmsSales} onChange={v => cfg.updateConfig({ notifSmsSales: v })} />
                    <ToggleRow label={t('notif_critical_stock')}
                      sub={t('notif_critical_stock_desc')}
                      value={cfg.notifSmsStock} onChange={v => cfg.updateConfig({ notifSmsStock: v })} />
                  </div>
                </div>

                {/* Push */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>🔔 Push</h4>
                  <div className="space-y-2">
                    <ToggleRow label={t('notif_push_all')}
                      sub={t('notif_push_all_desc')}
                      value={cfg.notifPushAll} onChange={v => cfg.updateConfig({ notifPushAll: v })} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="btn btn-primary gap-2" onClick={() => save()}>
                    <Save size={14} /> {t('btn_save')}
                  </button>
                </div>
              </div>
            </div>

            {/* WhatsApp automatiques */}
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head"><span className="panel-title">📱 Alertes WhatsApp automatiques</span></div>
              <div className="space-y-3">
                {[
                  {
                    icon: '🌅',
                    title: cfg.lang === 'fr' ? 'Alerte stock — 8h00' : 'Stock alert — 8:00 AM',
                    desc: cfg.lang === 'fr'
                      ? 'Reçoit une alerte WhatsApp si des produits sont en rupture'
                      : 'Receives a WhatsApp alert if products are out of stock',
                    key: 'morning' as const,
                  },
                  {
                    icon: '🌙',
                    title: cfg.lang === 'fr' ? 'Résumé des ventes — 20h00' : 'Sales summary — 8:00 PM',
                    desc: cfg.lang === 'fr'
                      ? 'Reçoit un résumé WhatsApp des ventes de la journée'
                      : 'Receives a WhatsApp sales summary for the day',
                    key: 'evening' as const,
                  },
                ].map(alert => (
                  <div key={alert.key} style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{alert.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{alert.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{alert.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="mini-btn"
                        onClick={async () => {
                          try {
                            if (alert.key === 'morning') await cronApi.testMorning()
                            else await cronApi.testEvening()
                            toast.success('📱 Message de test envoyé !')
                          } catch {
                            toast.error('Erreur envoi test')
                          }
                        }}>
                        🧪 Tester
                      </button>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--acc2)',
                        background: 'rgba(14,196,126,.12)',
                        borderRadius: 20, padding: '3px 10px',
                      }}>✅ Actif</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </>
          )}

          {/* ════ SÉCURITÉ ════ */}
          {tab === 'securite' && (
            <div className="space-y-4">
              {/* 2FA */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🔐 Authentification à deux facteurs (2FA)</span></div>
                <ToggleRow label={t('settings_2fa_active')}
                  sub={t('settings_2fa_desc')}
                  value={cfg.twoFAEnabled}
                  onChange={v => { cfg.updateConfig({ twoFAEnabled: v }); toast.success(v ? '2FA activé' : '2FA désactivé') }} />
                {cfg.twoFAEnabled && (
                  <div className="mt-4 flex items-start gap-5 p-4 rounded-xl"
                    style={{ background: 'rgba(14,196,126,.06)', border: '1px solid rgba(14,196,126,.2)' }}>
                    {/* Fake QR code */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 2,
                      width: 100, height: 100, padding: 6,
                      background: 'white', borderRadius: 8, flexShrink: 0,
                    }}>
                      {STATIC_QR.map((b, i) => (
                        <div key={i} style={{ background: b ? '#111' : 'transparent', borderRadius: 1 }} />
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                        Scannez ce QR code
                      </p>
                      <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>
                        Utilisez Google Authenticator, Authy ou toute app TOTP compatible
                      </p>
                      <code className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--bg4)', color: 'var(--p2)' }}>
                        HABA-XXXX-XXXX-XXXX
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Session */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">⏱️ Paramètres de session</span></div>
                <div className="space-y-4">
                  <div>
                    <Label>{t('settings_session_timeout')}</Label>
                    <select className="input text-sm" value={cfg.sessionTimeout}
                      onChange={e => cfg.updateConfig({ sessionTimeout: +e.target.value })}>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 heure</option>
                      <option value={240}>4 heures</option>
                      <option value={0}>Jamais</option>
                    </select>
                  </div>
                  <div>
                    <Label>{t('settings_max_attempts')}</Label>
                    <select className="input text-sm" value={cfg.maxLoginAttempts}
                      onChange={e => cfg.updateConfig({ maxLoginAttempts: +e.target.value })}>
                      <option value={3}>3 tentatives</option>
                      <option value={5}>5 tentatives</option>
                      <option value={10}>10 tentatives</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sessions actives */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🛡️ {t('settings_active_sessions')}</span></div>
                {[
                  { device: '💻 MacBook Pro', location: 'Dakar, Sénégal', time: 'Maintenant', current: true },
                  { device: '📱 iPhone 15',   location: 'Dakar, Sénégal', time: 'Il y a 2h',  current: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl mb-2"
                    style={{ background: 'var(--bg3)' }}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.device}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{s.location} · {s.time}</div>
                    </div>
                    {s.current
                      ? <span className="badge badge-green">{t('settings_current_session')}</span>
                      : <button className="mini-btn" style={{ color: 'var(--danger)' }}
                          onClick={() => toast.success('Session révoquée')}>{t('settings_revoke')}</button>
                    }
                  </div>
                ))}
              </div>

              {/* Export/Import */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">📁 Configuration</span></div>
                <div className="flex gap-3">
                  <button className="btn btn-ghost gap-2" onClick={handleExportConfig}>
                    <Download size={14} /> {t('settings_export_config')}
                  </button>
                  <button className="btn btn-ghost gap-2" onClick={() => importRef.current?.click()}>
                    <Upload size={14} /> {t('settings_import_config')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ AVANCÉ ════ */}
          {tab === 'avance' && (
            <div className="space-y-4">
              {/* Export / Import */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">📦 Configuration complète</span></div>
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>
                    {t('settings_export_config_desc')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn btn-ghost gap-2" onClick={handleExportConfig}>
                      <Download size={14} /> {t('settings_export_config')}
                    </button>
                    <button className="btn btn-ghost gap-2" onClick={() => importRef.current?.click()}>
                      <Upload size={14} /> {t('settings_import_config')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Réinitialiser */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">🔄 Réinitialisation</span></div>
                <div className="flex items-start gap-3 p-4 rounded-xl mb-4"
                  style={{ background: 'rgba(232,64,74,.07)', border: '1px solid rgba(232,64,74,.2)' }}>
                  <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Action irréversible</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      Toutes vos préférences seront remises aux valeurs par défaut. Vos données métier ne seront pas affectées.
                    </p>
                  </div>
                </div>
                <button className="btn gap-2"
                  style={{ background: 'rgba(232,64,74,.12)', color: 'var(--danger)', border: '1px solid rgba(232,64,74,.25)' }}
                  onClick={() => setShowReset(true)}>
                  <RefreshCw size={14} /> {t('settings_reset')}
                </button>
              </div>

              {/* Informations système */}
              <div className="panel">
                <div className="panel-head"><span className="panel-title">ℹ️ {t('settings_system_info')}</span></div>
                <div className="space-y-2">
                  {[
                    { label: t('settings_version'),     value: 'v1.0.0-beta' },
                    { label: t('settings_environment'), value: (import.meta as { env?: { MODE?: string } }).env?.MODE === 'production' ? 'Production' : t('settings_development') },
                    { label: t('settings_last_update'),  value: '14 mai 2026' },
                    { label: 'Navigateur',              value: navigator.userAgent.split(' ').slice(-1)[0] || '—' },
                    { label: 'Stockage utilisé',        value: `${(JSON.stringify(localStorage).length / 1024).toFixed(1)} Ko` },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-2"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="text-sm" style={{ color: 'var(--text2)' }}>{row.label}</span>
                      <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal confirmation reset ── */}
      {showReset && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowReset(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>⚠️ Confirmer la réinitialisation</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(false)}><X size={14} /></button>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--text2)' }}>
              {t('settings_reset_warning')}
              <br /><br />
              {t('settings_reset_desc')}
            </p>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1 justify-center" onClick={() => setShowReset(false)}>
                {t('btn_cancel')}
              </button>
              <button className="btn flex-1 justify-center"
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
                onClick={() => {
                  cfg.resetConfig()
                  setShowReset(false)
                  setShopForm({
                    shopName: cfg.shopName, shopSlogan: cfg.shopSlogan,
                    shopAddress: cfg.shopAddress, shopPhone: cfg.shopPhone,
                    shopEmail: cfg.shopEmail, shopCountry: cfg.shopCountry,
                    shopSiret: cfg.shopSiret, shopVatRate: cfg.shopVatRate,
                  })
                  toast.success(t('settings_config_reset'))
                }}>
                {t('settings_reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
