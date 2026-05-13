import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { Store, User, Globe, Palette, Bell, Shield, Save } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'boutique' | 'compte' | 'langue' | 'apparence' | 'notifications' | 'securite'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'boutique',       label: 'Boutique',       icon: <Store size={15} />    },
  { id: 'compte',         label: 'Mon compte',     icon: <User size={15} />     },
  { id: 'langue',         label: 'Langue & Devise', icon: <Globe size={15} />   },
  { id: 'apparence',      label: 'Apparence',      icon: <Palette size={15} />  },
  { id: 'notifications',  label: 'Notifications',  icon: <Bell size={15} />     },
  { id: 'securite',       label: 'Sécurité',       icon: <Shield size={15} />   },
]

const CURRENCIES = [
  { code: 'XOF', label: 'Franc CFA (XOF)', symbol: 'F CFA' },
  { code: 'EUR', label: 'Euro (EUR)',        symbol: '€'     },
  { code: 'USD', label: 'Dollar US (USD)',   symbol: '$'     },
  { code: 'CAD', label: 'Dollar CA (CAD)',   symbol: 'CA$'   },
]

export default function Settings() {
  const { theme, setTheme, lang, setLang, currency, setCurrency } = useAppStore()
  const { user, updateUser } = useAuthStore()
  const [tab, setTab] = useState<Tab>('boutique')

  // Boutique
  const [shop, setShop] = useState({
    name: user?.shopName || 'Mon Commerce',
    email: 'contact@moncommerce.sn',
    phone: '+221 77 000 00 00',
    address: 'Dakar, Sénégal',
    vatRate: '18',
    siret: 'SN-2026-001234',
  })

  // Compte
  const [account, setAccount] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    currentPwd: '',
    newPwd: '',
    confirmPwd: '',
  })

  // Notifs
  const [notifs, setNotifs] = useState({
    emailSales: true, emailStock: true, emailPayroll: false,
    smsSales: false,  smsStock: true,   smsPayroll: false,
    pushAll: true,
  })

  const save = (section: string) => toast.success(`✅ ${section} sauvegardé`)

  return (
    <div className="animate-in">
      <div className="flex gap-5">
        {/* Sidebar tabs */}
        <div className="w-52 flex-shrink-0">
          <div className="panel p-2">
            {TABS.map(t => (
              <button key={t.id}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5"
                style={{
                  background: tab === t.id ? 'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(20,184,166,0.12))' : 'transparent',
                  color: tab === t.id ? 'var(--text)' : 'var(--text2)',
                  border: tab === t.id ? '1px solid rgba(20,184,166,0.25)' : '1px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
                onClick={() => setTab(t.id)}
              >
                <span style={{ color: tab === t.id ? 'var(--primary2)' : 'var(--text3)' }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">

          {/* ── Boutique ── */}
          {tab === 'boutique' && (
            <div className="panel space-y-4">
              <div className="panel-head">
                <span className="panel-title">🏪 Informations boutique</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Nom de la boutique', key: 'name',    type: 'text' },
                  { label: 'Email',               key: 'email',   type: 'email' },
                  { label: 'Téléphone',           key: 'phone',   type: 'text' },
                  { label: 'N° SIRET / RCCM',     key: 'siret',   type: 'text' },
                  { label: 'Taux TVA (%)',         key: 'vatRate', type: 'number' },
                ].map(f => (
                  <div key={f.key} className={f.key === 'name' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{f.label}</label>
                    <input className="input text-sm" type={f.type}
                      value={(shop as any)[f.key]}
                      onChange={e => setShop(s => ({ ...s, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Adresse</label>
                  <textarea className="input text-sm" rows={2} value={shop.address}
                    onChange={e => setShop(s => ({ ...s, address: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end">
                <button className="btn btn-primary gap-2" onClick={() => { updateUser({ shopName: shop.name }); save('Boutique') }}>
                  <Save size={14} /> Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* ── Compte ── */}
          {tab === 'compte' && (
            <div className="space-y-4">
              <div className="panel space-y-4">
                <div className="panel-head"><span className="panel-title">👤 Informations personnelles</span></div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="avatar w-16 h-16 text-2xl">{user?.name?.charAt(0)}</div>
                  <div>
                    <div className="font-bold" style={{ color: 'var(--text)' }}>{user?.name}</div>
                    <div className="text-sm" style={{ color: 'var(--text3)' }}>{user?.email}</div>
                    <span className="badge badge-red mt-1">Administrateur</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Nom complet', key: 'name',  type: 'text'  },
                    { label: 'Téléphone',   key: 'phone', type: 'text'  },
                    { label: 'Email',       key: 'email', type: 'email' },
                  ].map(f => (
                    <div key={f.key} className={f.key === 'email' ? 'col-span-2' : ''}>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{f.label}</label>
                      <input className="input text-sm" type={f.type}
                        value={(account as any)[f.key]}
                        onChange={e => setAccount(a => ({ ...a, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button className="btn btn-primary gap-2" onClick={() => { updateUser({ name: account.name, email: account.email }); save('Compte') }}>
                    <Save size={14} /> Sauvegarder
                  </button>
                </div>
              </div>
              <div className="panel space-y-4">
                <div className="panel-head"><span className="panel-title">🔑 Changer le mot de passe</span></div>
                {[
                  { label: 'Mot de passe actuel', key: 'currentPwd' },
                  { label: 'Nouveau mot de passe', key: 'newPwd' },
                  { label: 'Confirmer',            key: 'confirmPwd' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{f.label}</label>
                    <input className="input text-sm" type="password" placeholder="••••••••"
                      value={(account as any)[f.key]}
                      onChange={e => setAccount(a => ({ ...a, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="flex justify-end">
                  <button className="btn btn-primary gap-2" onClick={() => save('Mot de passe')}>
                    <Save size={14} /> Mettre à jour
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Langue & Devise ── */}
          {tab === 'langue' && (
            <div className="panel space-y-6">
              <div className="panel-head"><span className="panel-title">🌍 Langue & Devise</span></div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text3)' }}>Langue de l'interface</label>
                <div className="flex gap-3">
                  {[{ code: 'fr', flag: '🇫🇷', label: 'Français' }, { code: 'en', flag: '🇬🇧', label: 'English' }].map(l => (
                    <div key={l.code}
                      className="flex items-center gap-3 p-4 rounded-xl cursor-pointer flex-1 transition-all"
                      style={{
                        background: lang === l.code ? 'rgba(99,102,241,0.1)' : 'var(--bg3)',
                        border: `1px solid ${lang === l.code ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                      }}
                      onClick={() => { setLang(l.code as any); save('Langue') }}
                    >
                      <span className="text-2xl">{l.flag}</span>
                      <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{l.label}</span>
                      {lang === l.code && <span className="badge badge-teal ml-auto">Actif</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text3)' }}>Devise principale</label>
                <div className="grid grid-cols-2 gap-3">
                  {CURRENCIES.map(c => (
                    <div key={c.code}
                      className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: currency === c.code ? 'rgba(20,184,166,0.1)' : 'var(--bg3)',
                        border: `1px solid ${currency === c.code ? 'rgba(20,184,166,0.3)' : 'var(--border)'}`,
                      }}
                      onClick={() => { setCurrency(c.code as any); save('Devise') }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                        style={{ background: 'var(--bg4)', color: 'var(--primary2)' }}>{c.symbol}</div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.label}</div>
                      </div>
                      {currency === c.code && <span className="badge badge-teal ml-auto">Actif</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Apparence ── */}
          {tab === 'apparence' && (
            <div className="panel space-y-6">
              <div className="panel-head"><span className="panel-title">🎨 Apparence</span></div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text3)' }}>Thème</label>
                <div className="flex gap-3">
                  {[
                    { id: 'dark',  label: '🌙 Sombre', desc: 'Thème sombre — recommandé' },
                    { id: 'light', label: '☀️ Clair',   desc: 'Thème clair' },
                  ].map(t => (
                    <div key={t.id}
                      className="flex-1 p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: theme === t.id ? 'rgba(99,102,241,0.1)' : 'var(--bg3)',
                        border: `1px solid ${theme === t.id ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                      }}
                      onClick={() => setTheme(t.id as any)}
                    >
                      <div className="text-2xl mb-2">{t.id === 'dark' ? '🌙' : '☀️'}</div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{t.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{t.desc}</div>
                      {theme === t.id && <span className="badge badge-teal mt-2">Actif</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === 'notifications' && (
            <div className="panel space-y-5">
              <div className="panel-head"><span className="panel-title">🔔 Préférences de notifications</span></div>
              {[
                { section: 'Email', items: [
                  { key: 'emailSales', label: 'Récapitulatif ventes journalier' },
                  { key: 'emailStock', label: 'Alertes rupture de stock' },
                  { key: 'emailPayroll', label: 'Rappels bulletins de paie' },
                ]},
                { section: 'SMS', items: [
                  { key: 'smsSales', label: 'Ventes importantes (> 100k F CFA)' },
                  { key: 'smsStock', label: 'Ruptures critiques' },
                  { key: 'smsPayroll', label: 'Validation paie' },
                ]},
              ].map(group => (
                <div key={group.section}>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>{group.section}</h4>
                  <div className="space-y-3">
                    {group.items.map(item => (
                      <div key={item.key} className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: 'var(--bg3)' }}>
                        <span className="text-sm" style={{ color: 'var(--text)' }}>{item.label}</span>
                        <button
                          className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
                          style={{
                            background: (notifs as any)[item.key] ? 'var(--teal)' : 'var(--bg4)',
                            border: 'none', cursor: 'pointer',
                          }}
                          onClick={() => setNotifs(n => ({ ...n, [item.key]: !(n as any)[item.key] }))}
                        >
                          <div className="absolute w-4 h-4 rounded-full bg-white transition-all top-1"
                            style={{ left: (notifs as any)[item.key] ? '24px' : '4px' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <button className="btn btn-primary gap-2" onClick={() => save('Notifications')}>
                  <Save size={14} /> Sauvegarder
                </button>
              </div>
            </div>
          )}

          {/* ── Sécurité ── */}
          {tab === 'securite' && (
            <div className="space-y-4">
              <div className="panel space-y-4">
                <div className="panel-head"><span className="panel-title">🔐 Authentification à deux facteurs (2FA)</span></div>
                <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)' }}>
                  <div className="text-3xl">🔐</div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>2FA via TOTP activé</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Google Authenticator ou Authy — codes de 6 chiffres</div>
                  </div>
                  <span className="badge badge-green">Actif</span>
                </div>
                <button className="btn btn-ghost gap-2 w-full justify-center"
                  onClick={() => toast('📱 QR Code affiché — scannez avec votre app')}>
                  🔄 Reconfigurer le 2FA
                </button>
              </div>
              <div className="panel space-y-4">
                <div className="panel-head"><span className="panel-title">🛡️ Sessions actives</span></div>
                {[
                  { device: '💻 MacBook Pro', location: 'Dakar, Sénégal', time: 'Maintenant', current: true },
                  { device: '📱 iPhone 15',    location: 'Dakar, Sénégal', time: 'Il y a 2h',  current: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.device}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{s.location} · {s.time}</div>
                    </div>
                    {s.current
                      ? <span className="badge badge-green">Session actuelle</span>
                      : <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                          onClick={() => toast.success('Session révoquée')}>Révoquer</button>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
