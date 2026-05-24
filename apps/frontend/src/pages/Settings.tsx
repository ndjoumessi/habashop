import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  useConfig, useFormatAmount, useConvertToXOF, useConvertFromXOF, useCurrencyInfo, ACCENT_PAIRS, THEMES,
  type Currency, type Lang, type Theme,
} from '@/stores/appStore'
import { tenantApi, dashboardApi, customersApi } from '@/lib/api'

// ─── helpers ──────────────────────────────────────────────────────────────────

type L4 = 'fr' | 'en' | 'es' | 'it'
const makeI = (lang: string) => (fr: string, en: string, es: string, it: string) =>
  lang === 'fr' ? fr : lang === 'en' ? en : lang === 'es' ? es : it
const pick = (lang: string, o: Record<L4, string>) => o[lang as L4] ?? o.fr

const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg,#0D0D1C,#111128)',
  border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, overflow: 'hidden',
}

function Switch({ on, onClick, color, disabled }: { on: boolean; onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on} style={{
      width: 48, height: 26, borderRadius: 99, flexShrink: 0,
      background: on ? color : 'rgba(255,255,255,.1)', border: 'none',
      cursor: disabled ? 'default' : 'pointer', transition: 'all .25s', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .25s', boxShadow: '0 2px 6px rgba(0,0,0,.3)' }} />
    </button>
  )
}

function ToggleCard({ icon, color, label, desc, on, onChange, disabled }: {
  icon: string; color: string; label: string; desc: string; on: boolean; onChange: () => void; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,.03)', border: `1px solid ${disabled ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)'}`, borderRadius: 14, transition: 'border-color .2s' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{desc}</div>
      </div>
      <Switch on={on} onClick={onChange} color={color} disabled={disabled} />
    </div>
  )
}

function Head({ emoji, title, sub, tint, right }: { emoji: string; title: string; sub?: string; tint: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.06)', background: `linear-gradient(135deg,${tint},transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: sub ? 3 : 0 }}>{emoji} {title}</h2>
        {sub && <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

// ─── navigation sections ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'shop',     icon: '🏪', color: 'var(--p2)',    label: { fr: 'Boutique', en: 'Shop', es: 'Tienda', it: 'Negozio' },                          desc: { fr: 'Infos générales', en: 'General info', es: 'Info general', it: 'Info generali' } },
  { id: 'pos',      icon: '🛒', color: 'var(--acc2)',  label: { fr: 'Config POS', en: 'POS Config', es: 'Config TPV', it: 'Config POS' },           desc: { fr: 'Caisse & TVA', en: 'Cashier & VAT', es: 'Caja & IVA', it: 'Cassa & IVA' } },
  { id: 'lang',     icon: '🌍', color: 'var(--acc3,#00B8FF)', label: { fr: 'Langue & Devise', en: 'Language & Currency', es: 'Idioma & Divisa', it: 'Lingua & Valuta' }, desc: { fr: 'Localisation & thème', en: 'Localization & theme', es: 'Localización & tema', it: 'Localizzazione & tema' } },
  { id: 'notif',    icon: '🔔', color: 'var(--warn)',  label: { fr: 'Notifications', en: 'Notifications', es: 'Notificaciones', it: 'Notifiche' },  desc: { fr: 'Alertes & rapports', en: 'Alerts & reports', es: 'Alertas & reportes', it: 'Avvisi & rapporti' } },
  { id: 'security', icon: '🔒', color: 'var(--danger)', label: { fr: 'Sécurité', en: 'Security', es: 'Seguridad', it: 'Sicurezza' },               desc: { fr: 'Accès & sessions', en: 'Access & sessions', es: 'Acceso & sesiones', it: 'Accesso & sessioni' } },
  { id: 'docs',     icon: '📋', color: 'var(--acc)',   label: { fr: 'Documents', en: 'Documents', es: 'Documentos', it: 'Documenti' },              desc: { fr: 'Exports & config', en: 'Exports & config', es: 'Exportar & config', it: 'Esporta & config' } },
]

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const [activeSection, setActiveSection] = useState('shop')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
      {/* ── Navigation ── */}
      <div style={{ ...panel, position: 'sticky', top: 24 }}>
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'linear-gradient(135deg,rgba(108,71,255,.08),transparent)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--text3)', marginBottom: 3 }}>
            {i('Configuration', 'Configuration', 'Configuración', 'Configurazione')}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-.3px' }}>
            {i('Paramètres', 'Settings', 'Ajustes', 'Impostazioni')}
          </div>
        </div>
        <div style={{ padding: 8 }}>
          {SECTIONS.map(s => {
            const active = activeSection === s.id
            return (
              <button key={s.id} type="button" onClick={() => setActiveSection(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${active ? `${s.color}44` : 'transparent'}`, background: active ? `${s.color}12` : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .15s', marginBottom: 2 }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? `${s.color}20` : 'rgba(255,255,255,.05)', border: `1px solid ${active ? `${s.color}33` : 'rgba(255,255,255,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0, transition: 'all .15s' }}>{s.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? s.color : 'var(--text2)', transition: 'color .15s' }}>{pick(lang, s.label)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{pick(lang, s.desc)}</div>
                </div>
                {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: `0 0 6px ${s.color}` }} />}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6C47FF,#8B6FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🛒</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>HabaShop v2.0</div>
            <div style={{ fontSize: 9, color: 'var(--text4)' }}>Production · Railway + Vercel</div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {activeSection === 'shop'     && <SectionShop />}
        {activeSection === 'pos'      && <SectionPOS />}
        {activeSection === 'lang'     && <SectionLang />}
        {activeSection === 'notif'    && <SectionNotif />}
        {activeSection === 'security' && <SectionSecurity />}
        {activeSection === 'docs'     && <SectionDocs />}
      </div>
    </div>
  )
}

// ─── 🏪 Shop ─────────────────────────────────────────────────────────────────────

function SectionShop() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const [editMode, setEditMode] = useState(false)
  const [shopData, setShopData] = useState({
    name: cfg.shopName, email: cfg.shopEmail, phone: cfg.shopPhone,
    address: cfg.shopAddress, country: cfg.shopCountry, taxRate: cfg.shopVatRate,
  })
  const [stats, setStats] = useState({ users: 0, products: 0, customers: 0, sales: 0 })

  useEffect(() => {
    tenantApi.get().then((d: any) => {
      if (d) setShopData(s => ({
        name: d.name ?? s.name, email: d.email ?? s.email, phone: d.phone ?? s.phone,
        address: d.address ?? s.address, country: d.country ?? s.country, taxRate: d.vatRate ?? s.taxRate,
      }))
    }).catch(() => {})
    Promise.all([
      dashboardApi.stats().catch(() => ({} as any)),
      customersApi.list().catch(() => [] as any[]),
      tenantApi.users().catch(() => [] as any[]),
    ]).then(([st, cust, usr]: any[]) => setStats({
      products: st?.totalProducts ?? 0,
      sales: st?.transactionsMonth ?? 0,
      customers: Array.isArray(cust) ? cust.length : 0,
      users: Array.isArray(usr) ? usr.length : 0,
    }))
  }, [])

  const save = async () => {
    try {
      await tenantApi.update({ name: shopData.name, email: shopData.email, phone: shopData.phone, address: shopData.address, country: shopData.country, vatRate: shopData.taxRate })
      cfg.updateConfig({ shopName: shopData.name, shopEmail: shopData.email, shopPhone: shopData.phone, shopAddress: shopData.address, shopCountry: shopData.country, shopVatRate: shopData.taxRate })
      toast.success(i('✅ Paramètres sauvegardés', '✅ Settings saved', '✅ Ajustes guardados', '✅ Impostazioni salvate'))
      setEditMode(false)
    } catch (e: any) { toast.error(e.message) }
  }

  const FIELDS = [
    { key: 'name',    full: true,  icon: '🏪', type: 'text',  label: i('NOM DE LA BOUTIQUE', 'SHOP NAME', 'NOMBRE TIENDA', 'NOME NEGOZIO'),  ph: i('Nom de votre boutique', 'Shop name', 'Nombre tienda', 'Nome negozio') },
    { key: 'email',   full: false, icon: '📧', type: 'email', label: 'EMAIL', ph: 'email@boutique.com' },
    { key: 'phone',   full: false, icon: '📞', type: 'tel',   label: i('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO'), ph: '+221 77 000 0000' },
    { key: 'country', full: false, icon: '🌍', type: 'text',  label: i('PAYS', 'COUNTRY', 'PAÍS', 'PAESE'), ph: i('Sénégal', 'Senegal', 'Senegal', 'Senegal') },
    { key: 'address', full: true,  icon: '📍', type: 'text',  label: i('ADRESSE', 'ADDRESS', 'DIRECCIÓN', 'INDIRIZZO'), ph: i('Adresse complète', 'Full address', 'Dirección completa', 'Indirizzo completo') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp .3s ease both' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: i('Utilisateurs', 'Users', 'Usuarios', 'Utenti'), value: stats.users, icon: '👤', color: 'var(--p2)' },
          { label: i('Produits', 'Products', 'Productos', 'Prodotti'), value: stats.products, icon: '📦', color: 'var(--acc3,#00B8FF)' },
          { label: i('Clients', 'Customers', 'Clientes', 'Clienti'), value: stats.customers, icon: '👥', color: 'var(--acc)' },
          { label: i('Ventes (mois)', 'Sales (month)', 'Ventas (mes)', 'Vendite (mese)'), value: stats.sales, icon: '🛒', color: 'var(--acc2)' },
        ].map(s => (
          <div key={s.label} style={{ ...panel, border: `1px solid ${s.color}22`, borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: 'var(--mono)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={panel}>
        <Head emoji="🏪" tint="rgba(108,71,255,.06)"
          title={i('Informations boutique', 'Shop information', 'Información de la tienda', 'Informazioni negozio')}
          sub={i('Nom, adresse et coordonnées', 'Name, address and contact', 'Nombre, dirección y contacto', 'Nome, indirizzo e contatti')}
          right={editMode ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12, cursor: 'pointer' }} onClick={save}>✅ {i('Sauvegarder', 'Save', 'Guardar', 'Salva')}</button>
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer' }} onClick={() => setEditMode(false)}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
            </div>
          ) : (
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer' }} onClick={() => setEditMode(true)}>✏️ {i('Modifier', 'Edit', 'Editar', 'Modifica')}</button>
          )} />

        <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {FIELDS.map(f => (
            <div key={f.key} style={f.full ? { gridColumn: '1/-1' } : {}}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>{f.label}</label>
              {editMode ? (
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text3)', pointerEvents: 'none' }}>{f.icon}</span>
                  <input type={f.type} className="input" style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} placeholder={f.ph}
                    value={(shopData as any)[f.key] ?? ''} onChange={e => setShopData(d => ({ ...d, [f.key]: e.target.value }))} />
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, fontSize: 13, color: 'var(--text2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, minHeight: 42 }}>
                  <span style={{ opacity: .5 }}>{f.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(shopData as any)[f.key] || <span style={{ color: 'var(--text4)', fontStyle: 'italic' }}>{i('Non renseigné', 'Not set', 'No especificado', 'Non impostato')}</span>}
                  </span>
                </div>
              )}
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>{i('TAUX TVA', 'VAT RATE', 'TASA IVA', 'ALIQUOTA IVA')} (%)</label>
            {editMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={0} max={100} step={0.5} className="input" style={{ flex: 1 }} value={shopData.taxRate} onChange={e => setShopData(d => ({ ...d, taxRate: Number(e.target.value) }))} />
                <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--acc)', width: 24 }}>%</span>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: 'rgba(255,149,0,.06)', border: '1px solid rgba(255,149,0,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Appliqué sur ventes', 'Applied on sales', 'Aplicado en ventas', 'Applicato sulle vendite')}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{shopData.taxRate}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 🛒 POS ──────────────────────────────────────────────────────────────────────

function SectionPOS() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const fmt = useFormatAmount()
  const toXOF = useConvertToXOF()
  const fromXOF = useConvertFromXOF()
  const { symbol, decimals } = useCurrencyInfo()
  const [editMode, setEditMode] = useState(false)
  const snapshot = () => ({
    posVatIncluded: cfg.posVatIncluded, posAutoprint: cfg.posAutoprint, autoWhatsApp: cfg.autoWhatsApp,
    enableLoyalty: cfg.enableLoyalty, requireCashier: cfg.requireCashier, enableScanner: cfg.enableScanner,
    priceMode: cfg.priceMode, posTaxRate: cfg.posTaxRate,
  })
  const [draft, setDraft] = useState(snapshot())
  const [fundInput, setFundInput] = useState(fromXOF(cfg.posDefaultFund).toFixed(decimals))
  const v = editMode ? draft : snapshot()
  const startEdit = () => { setDraft(snapshot()); setFundInput(fromXOF(cfg.posDefaultFund).toFixed(decimals)); setEditMode(true) }
  const toggle = (key: keyof ReturnType<typeof snapshot>) => { if (!editMode) return; setDraft(p => ({ ...p, [key]: !(p as any)[key] })) }

  const TOGGLES: { key: any; icon: string; color: string; label: Record<L4, string>; desc: Record<L4, string> }[] = [
    { key: 'posVatIncluded', icon: '💰', color: 'var(--acc2)', label: { fr: 'TVA incluse', en: 'VAT included', es: 'IVA incluido', it: 'IVA inclusa' }, desc: { fr: 'Prix affichés TVA comprise', en: 'Prices shown VAT-inclusive', es: 'Precios con IVA', it: 'Prezzi IVA inclusa' } },
    { key: 'posAutoprint', icon: '🖨️', color: 'var(--p2)', label: { fr: 'Impression auto', en: 'Auto print', es: 'Impresión auto', it: 'Stampa auto' }, desc: { fr: 'Imprime le ticket après vente', en: 'Print receipt after sale', es: 'Imprimir ticket tras venta', it: 'Stampa ricevuta dopo vendita' } },
    { key: 'autoWhatsApp', icon: '💬', color: '#25D366', label: { fr: 'Ticket WhatsApp', en: 'WhatsApp receipt', es: 'Ticket WhatsApp', it: 'Ricevuta WhatsApp' }, desc: { fr: 'Envoie le ticket par WhatsApp', en: 'Send receipt via WhatsApp', es: 'Enviar ticket por WhatsApp', it: 'Invia ricevuta via WhatsApp' } },
    { key: 'enableLoyalty', icon: '⭐', color: 'var(--warn)', label: { fr: 'Programme fidélité', en: 'Loyalty program', es: 'Programa fidelidad', it: 'Programma fedeltà' }, desc: { fr: 'Active les points de fidélité', en: 'Enable loyalty points', es: 'Activar puntos de fidelidad', it: 'Abilita punti fedeltà' } },
    { key: 'requireCashier', icon: '🔐', color: 'var(--acc3,#00B8FF)', label: { fr: 'Ouverture de caisse', en: 'Cashier open required', es: 'Apertura de caja', it: 'Apertura cassa' }, desc: { fr: 'Exiger l\'ouverture avant les ventes', en: 'Require opening before sales', es: 'Exigir apertura antes de ventas', it: 'Richiedi apertura prima delle vendite' } },
    { key: 'enableScanner', icon: '📷', color: 'var(--p3)', label: { fr: 'Scanner codes-barres', en: 'Barcode scanner', es: 'Escáner de códigos', it: 'Scanner codici' }, desc: { fr: 'Active le scanner intégré', en: 'Enable built-in scanner', es: 'Activar escáner integrado', it: 'Abilita scanner integrato' } },
  ]

  const PRICE_MODES: { id: 'TTC' | 'HT'; title: string; sub: string }[] = [
    { id: 'TTC', title: 'TTC', sub: i('Taxes incluses', 'Tax included', 'Impuestos incluidos', 'Tasse incluse') },
    { id: 'HT', title: 'HT', sub: i('Hors taxes', 'Excl. tax', 'Sin impuestos', 'Tasse escluse') },
  ]

  const save = () => {
    cfg.updateConfig({ ...draft, posDefaultFund: toXOF(Number(fundInput) || 0) })
    toast.success(i('✅ Config POS sauvegardée', '✅ POS config saved', '✅ Config TPV guardada', '✅ Config POS salvata'))
    setEditMode(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp .3s ease both' }}>
      <div style={panel}>
        <Head emoji="🛒" tint="rgba(0,208,132,.05)"
          title={i('Configuration POS', 'POS Configuration', 'Configuración TPV', 'Configurazione POS')}
          sub={i('Caisse, TVA et paiements', 'Cashier, VAT and payments', 'Caja, IVA y pagos', 'Cassa, IVA e pagamenti')}
          right={editMode
            ? <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12, cursor: 'pointer' }} onClick={save}>✅ {i('Sauvegarder', 'Save', 'Guardar', 'Salva')}</button>
                <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer' }} onClick={() => setEditMode(false)}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
              </div>
            : <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer' }} onClick={startEdit}>✏️ {i('Modifier', 'Edit', 'Editar', 'Modifica')}</button>} />

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TOGGLES.map(t => (
            <ToggleCard key={t.key} icon={t.icon} color={t.color} label={pick(lang, t.label)} desc={pick(lang, t.desc)}
              on={!!(v as any)[t.key]} disabled={!editMode} onChange={() => toggle(t.key as any)} />
          ))}

          {/* Price mode (TTC / HT) */}
          <div style={{ display: 'flex', gap: 10 }}>
            {PRICE_MODES.map(m => (
              <button key={m.id} type="button" disabled={!editMode} onClick={() => editMode && setDraft(p => ({ ...p, priceMode: m.id }))}
                style={{ flex: 1, padding: 14, borderRadius: 12, cursor: editMode ? 'pointer' : 'default', opacity: editMode ? 1 : .7, textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .15s', background: v.priceMode === m.id ? 'rgba(108,71,255,.1)' : 'rgba(255,255,255,.02)', border: `2px solid ${v.priceMode === m.id ? 'var(--p)' : 'rgba(255,255,255,.06)'}` }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: v.priceMode === m.id ? 'var(--p3)' : 'var(--text)' }}>{m.title}{v.priceMode === m.id ? ' ✓' : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          {/* VAT rate */}
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,149,0,.12)', border: '1px solid rgba(255,149,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{i('Taux de TVA', 'VAT Rate', 'Tasa IVA', 'Aliquota IVA')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Appliqué sur les ventes POS', 'Applied on POS sales', 'Aplicado en ventas TPV', 'Applicato sulle vendite POS')}</div>
              </div>
            </div>
            {editMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={0} max={100} step={0.5} className="input" style={{ width: 80, textAlign: 'right' }} value={draft.posTaxRate} onChange={e => setDraft(p => ({ ...p, posTaxRate: Math.max(0, Math.min(100, +e.target.value)) }))} />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--acc)', width: 20 }}>%</span>
              </div>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{cfg.posTaxRate}%</div>
            )}
          </div>

          {/* Opening fund — currency dynamic */}
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,208,132,.1)', border: '1px solid rgba(0,208,132,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💵</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{i('Fond de caisse', 'Opening fund', 'Fondo de caja', 'Fondo cassa')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Montant initial en caisse', 'Initial cash amount', 'Monto inicial en caja', 'Importo iniziale in cassa')}</div>
              </div>
            </div>
            {editMode ? (
              <div style={{ position: 'relative' }}>
                <input type="number" min={0} step={1} className="input" style={{ width: 150, textAlign: 'right', paddingRight: 44 }} value={fundInput} onChange={e => setFundInput(e.target.value)} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 11, pointerEvents: 'none', fontWeight: 700 }}>{symbol}</span>
              </div>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>{fmt(cfg.posDefaultFund)}</div>
            )}
          </div>

          {editMode && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,184,0,.06)', border: '1px solid rgba(255,184,0,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--warn)' }}>
              <span>⚠️</span>
              <span>{i('Modifications non sauvegardées — cliquez sur Sauvegarder', 'Unsaved changes — click Save to apply', 'Cambios sin guardar — haga clic en Guardar', 'Modifiche non salvate — clicca Salva')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 🌍 Language, Currency & Appearance ─────────────────────────────────────────

function SectionLang() {
  const cfg = useConfig()
  const lang = cfg.lang
  const currency = cfg.currency
  const fmt = useFormatAmount()
  const i = makeI(lang)

  const LANGS = [
    { code: 'fr', flag: '🇫🇷', name: 'Français', native: 'Français' },
    { code: 'en', flag: '🇬🇧', name: 'English', native: 'English' },
    { code: 'es', flag: '🇪🇸', name: 'Spanish', native: 'Español' },
    { code: 'it', flag: '🇮🇹', name: 'Italian', native: 'Italiano' },
  ]
  const CURRENCIES: { code: Currency; flag: string; name: Record<L4, string> }[] = [
    { code: 'XOF', flag: '🇸🇳', name: { fr: 'Franc CFA Ouest', en: 'West African CFA', es: 'Franco CFA Oeste', it: 'Franco CFA Ovest' } },
    { code: 'XAF', flag: '🇨🇲', name: { fr: 'Franc CFA Centre', en: 'Central African CFA', es: 'Franco CFA Centro', it: 'Franco CFA Centro' } },
    { code: 'EUR', flag: '🇪🇺', name: { fr: 'Euro', en: 'Euro', es: 'Euro', it: 'Euro' } },
    { code: 'USD', flag: '🇺🇸', name: { fr: 'Dollar US', en: 'US Dollar', es: 'Dólar US', it: 'Dollaro US' } },
    { code: 'CAD', flag: '🇨🇦', name: { fr: 'Dollar CA', en: 'Canadian Dollar', es: 'Dólar CA', it: 'Dollaro CA' } },
    { code: 'GBP', flag: '🇬🇧', name: { fr: 'Livre Sterling', en: 'British Pound', es: 'Libra Esterlina', it: 'Sterlina' } },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp .3s ease both' }}>
      {/* Language */}
      <div style={panel}>
        <Head emoji="🌍" tint="rgba(0,184,255,.05)"
          title={i("Langue de l'interface", 'Interface language', 'Idioma de la interfaz', "Lingua dell'interfaccia")}
          sub={i('4 langues — changement immédiat', '4 languages — instant change', '4 idiomas — cambio inmediato', '4 lingue — cambio immediato')} />
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LANGS.map(l => {
            const active = lang === l.code
            return (
              <button key={l.code} type="button" onClick={() => cfg.setLang(l.code as Lang)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: active ? 'rgba(108,71,255,.12)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'rgba(108,71,255,.35)' : 'rgba(255,255,255,.07)'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .2s' }}>
                <span style={{ fontSize: 28 }}>{l.flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--p3)' : 'var(--text)' }}>{l.native}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{l.name}</div>
                </div>
                {active && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--p2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 900 }}>✓</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Currency */}
      <div style={panel}>
        <Head emoji="💱" tint="rgba(255,184,0,.05)"
          title={i("Devise d'affichage", 'Display currency', 'Divisa de visualización', 'Valuta di visualizzazione')}
          sub={i('6 devises — conversion automatique des montants', '6 currencies — automatic conversion of amounts', '6 divisas — conversión automática de importes', '6 valute — conversione automatica degli importi')} />
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {CURRENCIES.map(c => {
            const active = currency === c.code
            return (
              <button key={c.code} type="button" onClick={() => cfg.setCurrency(c.code)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '16px 10px', borderRadius: 14, background: active ? 'rgba(255,184,0,.1)' : 'rgba(255,255,255,.03)', border: `1.5px solid ${active ? 'rgba(255,184,0,.4)' : 'rgba(255,255,255,.07)'}`, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s', position: 'relative' }}>
                {active && <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 900 }}>✓</div>}
                <span style={{ fontSize: 26 }}>{c.flag}</span>
                <div style={{ fontSize: 14, fontWeight: 900, color: active ? 'var(--warn)' : 'var(--text)', fontFamily: 'var(--mono)' }}>{c.code}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.3 }}>{pick(lang, c.name)}</div>
              </button>
            )
          })}
        </div>
        <div style={{ margin: '0 22px 20px', padding: 16, background: 'rgba(255,184,0,.05)', border: '1px solid rgba(255,184,0,.15)', borderRadius: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--warn)', marginBottom: 12 }}>
            {i('APERÇU — Conversion temps réel', 'PREVIEW — Real-time conversion', 'VISTA PREVIA — Conversión en tiempo real', 'ANTEPRIMA — Conversione in tempo reale')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[100000, 500000, 1000000].map(xof => (
              <div key={xof} style={{ textAlign: 'center', padding: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>{xof.toLocaleString('fr-FR')} XOF</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--warn)', fontFamily: 'var(--mono)' }}>{fmt(xof)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance (theme + accent) */}
      <div style={panel}>
        <Head emoji="🎨" tint="rgba(108,71,255,.05)"
          title={i('Apparence', 'Appearance', 'Apariencia', 'Aspetto')}
          sub={i('Thème et couleur d\'accent', 'Theme and accent color', 'Tema y color de acento', 'Tema e colore d\'accento')} />
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10 }}>{i('Thème', 'Theme', 'Tema', 'Tema')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 10 }}>
              {(Object.entries(THEMES) as [Theme, typeof THEMES[Theme]][]).map(([key, th]) => {
                const active = cfg.theme === key
                const tbg = th.vars['--bg']; const tp = th.vars['--p']; const tacc = th.vars['--acc2']; const ttext = th.vars['--text']
                return (
                  <button key={key} type="button" onClick={() => cfg.updateConfig({ theme: key })}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', borderRadius: 14, background: active ? `${tp}18` : 'rgba(255,255,255,.03)', border: `2px solid ${active ? tp + '66' : 'rgba(255,255,255,.07)'}`, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .2s', position: 'relative' }}>
                    {active && <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: tp, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900 }}>✓</div>}
                    <div style={{ width: 72, height: 46, borderRadius: 9, background: tbg, border: '1px solid rgba(255,255,255,.1)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: tp + '33', borderRight: `1px solid ${tp}22` }} />
                      <div style={{ position: 'absolute', left: 20, top: 6, right: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ height: 4, borderRadius: 99, background: tp, width: '60%' }} />
                        <div style={{ height: 3, borderRadius: 99, background: ttext + '44', width: '80%' }} />
                        <div style={{ marginTop: 2, height: 10, borderRadius: 4, background: tacc + '44' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, marginBottom: 1 }}>{th.emoji}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--p3)' : 'var(--text2)' }}>{pick(lang, th.label)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10 }}>{i('Couleur d\'accent', 'Accent color', 'Color de acento', 'Colore d\'accento')}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.keys(ACCENT_PAIRS).map(hex => (
                <button key={hex} type="button" onClick={() => cfg.updateConfig({ accentColor: hex })} aria-label={hex}
                  style={{ width: 36, height: 36, borderRadius: 10, background: hex, border: 'none', cursor: 'pointer', outline: cfg.accentColor === hex ? `3px solid ${hex}` : '3px solid transparent', outlineOffset: 2, boxShadow: cfg.accentColor === hex ? `0 0 0 2px rgba(255,255,255,.25)` : 'none', transition: 'all .15s', transform: cfg.accentColor === hex ? 'scale(1.12)' : 'none' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 🔔 Notifications ────────────────────────────────────────────────────────────

function SectionNotif() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)

  const NOTIFS: { key: any; icon: string; color: string; label: Record<L4, string>; desc: Record<L4, string> }[] = [
    { key: 'notifEmailStock', icon: '⚠️', color: 'var(--danger)', label: { fr: 'Alertes rupture stock', en: 'Stock shortage alerts', es: 'Alertas de stock', it: 'Avvisi scorte' }, desc: { fr: 'Email quand un produit est en rupture', en: 'Email when a product runs out', es: 'Email cuando un producto se agota', it: 'Email quando un prodotto si esaurisce' } },
    { key: 'notifEmailSales', icon: '📊', color: 'var(--p2)', label: { fr: 'Rapport ventes par email', en: 'Sales report by email', es: 'Reporte de ventas por email', it: 'Report vendite via email' }, desc: { fr: 'Résumé des ventes par email', en: 'Sales summary by email', es: 'Resumen de ventas por email', it: 'Riepilogo vendite via email' } },
    { key: 'notifSmsSales', icon: '🛒', color: 'var(--acc2)', label: { fr: 'SMS ventes', en: 'Sales SMS', es: 'SMS de ventas', it: 'SMS vendite' }, desc: { fr: 'SMS pour les nouvelles ventes', en: 'SMS on new sales', es: 'SMS en nuevas ventas', it: 'SMS sulle nuove vendite' } },
    { key: 'notifSmsStock', icon: '📦', color: 'var(--acc)', label: { fr: 'SMS stock', en: 'Stock SMS', es: 'SMS de stock', it: 'SMS magazzino' }, desc: { fr: 'SMS pour les alertes stock', en: 'SMS for stock alerts', es: 'SMS para alertas de stock', it: 'SMS per avvisi scorte' } },
    { key: 'notifEmailPayroll', icon: '💼', color: 'var(--warn)', label: { fr: 'Email paie', en: 'Payroll email', es: 'Email de nómina', it: 'Email stipendi' }, desc: { fr: 'Notifie la génération des bulletins', en: 'Notify payslip generation', es: 'Notificar generación de nóminas', it: 'Notifica generazione buste paga' } },
    { key: 'notifPushAll', icon: '🔔', color: 'var(--p3)', label: { fr: 'Notifications push', en: 'Push notifications', es: 'Notificaciones push', it: 'Notifiche push' }, desc: { fr: 'Toutes les notifications dans l\'app', en: 'All in-app notifications', es: 'Todas las notificaciones en la app', it: 'Tutte le notifiche in-app' } },
  ]

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head emoji="🔔" tint="rgba(255,59,92,.04)"
        title={i('Notifications', 'Notifications', 'Notificaciones', 'Notifiche')}
        sub={i('Gérez vos alertes et rapports automatiques', 'Manage your alerts and automatic reports', 'Gestiona tus alertas y reportes automáticos', 'Gestisci i tuoi avvisi e report automatici')} />
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {NOTIFS.map(n => (
          <ToggleCard key={n.key} icon={n.icon} color={n.color} label={pick(lang, n.label)} desc={pick(lang, n.desc)}
            on={!!(cfg as any)[n.key]} onChange={() => cfg.updateConfig({ [n.key]: !(cfg as any)[n.key] } as any)} />
        ))}
      </div>
    </div>
  )
}

// ─── 🔒 Security ─────────────────────────────────────────────────────────────────

function SectionSecurity() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const navigate = useNavigate()
  const locked = cfg.settingsLocked

  const token = localStorage.getItem('habashop_token')
  const tokenInfo = token && token.split('.').length === 3 ? (() => {
    try {
      const p = JSON.parse(atob(token.split('.')[1]))
      const exp = new Date(p.exp * 1000)
      return { role: p.role, exp: exp.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }), daysLeft: Math.ceil((exp.getTime() - Date.now()) / 86400000) }
    } catch { return null }
  })() : null

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head emoji="🔒" tint="rgba(255,59,92,.04)" title={i('Sécurité & Accès', 'Security & Access', 'Seguridad & Acceso', 'Sicurezza & Accesso')} />
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Lock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: locked ? 'rgba(255,59,92,.08)' : 'rgba(0,208,132,.05)', border: `1px solid ${locked ? 'rgba(255,59,92,.2)' : 'rgba(0,208,132,.15)'}`, borderRadius: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: locked ? 'rgba(255,59,92,.15)' : 'rgba(0,208,132,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{locked ? '🔒' : '🔓'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: locked ? 'var(--danger)' : 'var(--acc2)' }}>{locked ? i('Paramètres verrouillés', 'Settings locked', 'Ajustes bloqueados', 'Impostazioni bloccate') : i('Paramètres déverrouillés', 'Settings unlocked', 'Ajustes desbloqueados', 'Impostazioni sbloccate')}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Verrouille langue & devise dans le header', 'Locks language & currency in the header', 'Bloquea idioma y divisa en el encabezado', 'Blocca lingua e valuta nell\'header')}</div>
          </div>
          <button type="button" onClick={() => locked ? cfg.unlockSettings() : cfg.lockSettings()}
            style={{ padding: '8px 16px', borderRadius: 10, background: locked ? 'rgba(255,59,92,.15)' : 'rgba(0,208,132,.1)', border: `1px solid ${locked ? 'rgba(255,59,92,.3)' : 'rgba(0,208,132,.25)'}`, cursor: 'pointer', fontFamily: 'var(--font)', color: locked ? 'var(--danger)' : 'var(--acc2)', fontSize: 12, fontWeight: 700, transition: 'all .15s' }}>
            {locked ? i('Déverrouiller', 'Unlock', 'Desbloquear', 'Sblocca') : i('Verrouiller', 'Lock', 'Bloquear', 'Blocca')}
          </button>
        </div>

        {/* JWT session */}
        {tokenInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(108,71,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔑</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>JWT · {i('Rôle', 'Role', 'Rol', 'Ruolo')}: {tokenInfo.role}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{i('Expire le', 'Expires on', 'Expira el', 'Scade il')} {tokenInfo.exp}</span><span>·</span>
                <span style={{ color: tokenInfo.daysLeft > 3 ? 'var(--acc2)' : 'var(--danger)' }}>● {i('Actif', 'Active', 'Activo', 'Attivo')} ({tokenInfo.daysLeft}j)</span>
              </div>
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 11, cursor: 'pointer' }}
              onClick={() => { localStorage.removeItem('habashop_token'); cfg.clearTenant?.(); navigate('/login') }}>
              {i('Déconnecter', 'Log out', 'Cerrar sesión', 'Disconnetti')}
            </button>
          </div>
        )}

        {/* Change password (stub) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,184,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔐</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{i('Changer le mot de passe', 'Change password', 'Cambiar contraseña', 'Cambia password')}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Bientôt disponible', 'Coming soon', 'Próximamente', 'Prossimamente')}</div>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 11, cursor: 'pointer' }} onClick={() => toast(i('Bientôt disponible', 'Coming soon', 'Próximamente', 'Prossimamente'))}>✏️ {i('Modifier', 'Change', 'Cambiar', 'Modifica')}</button>
        </div>
      </div>
    </div>
  )
}

// ─── 📋 Documents & config ──────────────────────────────────────────────────────

function SectionDocs() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const importRef = useRef<HTMLInputElement>(null)

  const exportConfig = () => {
    const blob = new Blob([cfg.exportConfig()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `habashop-config-${new Date().toISOString().split('T')[0]}.json`; a.click()
    URL.revokeObjectURL(url)
    toast.success(i('📥 Configuration exportée', '📥 Configuration exported', '📥 Configuración exportada', '📥 Configurazione esportata'))
  }
  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { cfg.importConfig(ev.target?.result as string); toast.success(i('✅ Configuration importée', '✅ Configuration imported', '✅ Configuración importada', '✅ Configurazione importata')) }
    reader.readAsText(file)
  }

  const DOCS: { icon: string; color: string; label: Record<L4, string>; desc: Record<L4, string>; action: () => void }[] = [
    { icon: '📥', color: 'var(--p2)', label: { fr: 'Exporter la configuration', en: 'Export configuration', es: 'Exportar configuración', it: 'Esporta configurazione' }, desc: { fr: 'Sauvegarde tous vos paramètres (JSON)', en: 'Back up all your settings (JSON)', es: 'Respalda todos tus ajustes (JSON)', it: 'Backup di tutte le impostazioni (JSON)' }, action: exportConfig },
    { icon: '📤', color: 'var(--acc3,#00B8FF)', label: { fr: 'Importer la configuration', en: 'Import configuration', es: 'Importar configuración', it: 'Importa configurazione' }, desc: { fr: 'Restaure depuis un fichier JSON', en: 'Restore from a JSON file', es: 'Restaurar desde un archivo JSON', it: 'Ripristina da un file JSON' }, action: () => importRef.current?.click() },
    { icon: '💰', color: 'var(--warn)', label: { fr: 'Rapport comptable', en: 'Accounting report', es: 'Reporte contable', it: 'Report contabile' }, desc: { fr: 'Dépenses et revenus du mois', en: 'Monthly expenses and revenue', es: 'Gastos e ingresos del mes', it: 'Spese e ricavi del mese' }, action: () => toast(i('Bientôt disponible', 'Coming soon', 'Próximamente', 'Prossimamente')) },
    { icon: '📋', color: 'var(--p3)', label: { fr: 'Documentation', en: 'Documentation', es: 'Documentación', it: 'Documentazione' }, desc: { fr: 'Dépôt GitHub HabaShop', en: 'HabaShop GitHub repo', es: 'Repo GitHub HabaShop', it: 'Repo GitHub HabaShop' }, action: () => window.open('https://github.com/ndjoumessi/habashop', '_blank') },
    { icon: '🖨️', color: 'var(--text2)', label: { fr: 'Imprimer la configuration', en: 'Print configuration', es: 'Imprimir configuración', it: 'Stampa configurazione' }, desc: { fr: 'Imprime les paramètres actuels', en: 'Print current settings', es: 'Imprimir ajustes actuales', it: 'Stampa impostazioni correnti' }, action: () => window.print() },
    { icon: '♻️', color: 'var(--danger)', label: { fr: 'Réinitialiser', en: 'Reset', es: 'Restablecer', it: 'Ripristina' }, desc: { fr: 'Restaure les paramètres par défaut', en: 'Restore default settings', es: 'Restaurar ajustes por defecto', it: 'Ripristina impostazioni predefinite' }, action: () => { cfg.resetConfig(); toast.success(i('♻️ Paramètres réinitialisés', '♻️ Settings reset', '♻️ Ajustes restablecidos', '♻️ Impostazioni ripristinate')) } },
  ]

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head emoji="📋" tint="rgba(255,149,0,.04)"
        title={i('Documents & Configuration', 'Documents & Configuration', 'Documentos & Configuración', 'Documenti & Configurazione')}
        sub={i('Exportez vos données et votre configuration', 'Export your data and configuration', 'Exporta tus datos y configuración', 'Esporta i tuoi dati e la configurazione')} />
      <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importConfig} />
      <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {DOCS.map(d => (
          <button key={pick(lang, d.label)} type="button" onClick={d.action}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .2s' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.06)'; el.style.borderColor = 'rgba(255,255,255,.12)'; el.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.03)'; el.style.borderColor = 'rgba(255,255,255,.07)'; el.style.transform = 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${d.color}15`, border: `1px solid ${d.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{d.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{pick(lang, d.label)}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pick(lang, d.desc)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}