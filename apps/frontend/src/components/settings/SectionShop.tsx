import type React from 'react'
import { useState, useEffect } from 'react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { COUNTRIES, countryLabel } from '@/utils/countryList'
import Skeleton from '@/components/ui/skeleton'
import toast from 'react-hot-toast'
import { useConfig, useAppStore } from '@/stores/appStore'
import { Store, Mail, Phone, Globe, MapPin, User, Users, Package, ShoppingCart, Check, Pencil, ScrollText, Landmark, ReceiptText } from 'lucide-react'
import { tenantApi, dashboardApi, customersApi } from '@/lib/api'
import { makeI, panel, Head } from '@/components/settings/settingsShared'

export default function SectionShop() {
  const cfg = useConfig()
  const lang = cfg.lang
  const i = makeI(lang)
  const [editMode, setEditMode] = useState(false)
  const [shopData, setShopData] = useState({
    name: cfg.shopName, email: cfg.shopEmail, phone: cfg.shopPhone,
    address: cfg.shopAddress, country: cfg.shopCountry, taxRate: cfg.shopVatRate,
  })
  const [stats, setStats] = useState({ users: 0, products: 0, customers: 0, sales: 0 })
  // Identifiants légaux (pied de facture/devis) — optionnels, bloc dédié.
  const [legalData, setLegalData] = useState({ ninea: '', rccm: '', vatNumber: '' })
  const [legalEdit, setLegalEdit] = useState(false)
  // Évite le flicker valeurs locales → valeurs serveur : skeleton tant que le tenant n'est pas chargé
  const [tenantLoaded, setTenantLoaded] = useState(false)

  useEffect(() => {
    tenantApi.get().then((d: any) => {
      if (d) {
        setShopData(s => ({
          name: d.name ?? s.name, email: d.email ?? s.email, phone: d.phone ?? s.phone,
          address: d.address ?? s.address, country: d.country ?? s.country, taxRate: d.vatRate ?? s.taxRate,
        }))
        setLegalData({ ninea: d.ninea ?? '', rccm: d.rccm ?? '', vatNumber: d.vatNumber ?? '' })
      }
    }).catch(() => {}).finally(() => setTenantLoaded(true))
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
      toast.success(i('Paramètres sauvegardés', 'Settings saved', 'Ajustes guardados', 'Impostazioni salvate'))
      setEditMode(false)
    } catch (e: any) { toast.error(e.message) }
  }

  const saveLegal = async () => {
    try {
      const payload = { ninea: legalData.ninea.trim(), rccm: legalData.rccm.trim(), vatNumber: legalData.vatNumber.trim() }
      await tenantApi.update(payload)
      // Reflète immédiatement dans le store tenant : le pied de facture/devis
      // (generateInvoice) lit tenant.ninea/rccm/vatNumber — pas d'attente de reload.
      const cur = useAppStore.getState().tenant
      if (cur) useAppStore.getState().setTenant({ ...cur, ninea: payload.ninea || null, rccm: payload.rccm || null, vatNumber: payload.vatNumber || null })
      setLegalData(payload)
      toast.success(i('Infos légales sauvegardées', 'Legal info saved', 'Información legal guardada', 'Informazioni legali salvate'))
      setLegalEdit(false)
    } catch (e: any) { toast.error(e.message) }
  }

  const LEGAL_FIELDS: { key: 'ninea' | 'rccm' | 'vatNumber'; icon: React.ReactNode; label: string; ph: string }[] = [
    { key: 'ninea',     icon: <ScrollText size={14} />,  label: 'NINEA',  ph: 'Ex : 00123456 2G3' },
    { key: 'rccm',      icon: <Landmark size={14} />,    label: 'RC',     ph: 'Ex : SN-DKR-2026-A-123' },
    { key: 'vatNumber', icon: <ReceiptText size={14} />, label: i('N° TVA', 'VAT NO.', 'N° IVA', 'P. IVA'), ph: 'Ex : SN012345678' },
  ]

  const FIELDS: { key: string; full: boolean; icon: React.ReactNode; type: string; label: string; ph: string }[] = [
    { key: 'name',    full: true,  icon: <Store size={14} />,  type: 'text',  label: i('NOM DE LA BOUTIQUE', 'SHOP NAME', 'NOMBRE TIENDA', 'NOME NEGOZIO'),  ph: i('Nom de votre boutique', 'Shop name', 'Nombre tienda', 'Nome negozio') },
    { key: 'email',   full: false, icon: <Mail size={14} />,   type: 'email', label: 'EMAIL', ph: 'email@boutique.com' },
    { key: 'phone',   full: false, icon: <Phone size={14} />,  type: 'tel',   label: i('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO'), ph: '+221 77 000 0000' },
    { key: 'country', full: false, icon: <Globe size={14} />,  type: 'text',  label: i('PAYS', 'COUNTRY', 'PAÍS', 'PAESE'), ph: i('Sénégal', 'Senegal', 'Senegal', 'Senegal') },
    { key: 'address', full: true,  icon: <MapPin size={14} />, type: 'text',  label: i('ADRESSE', 'ADDRESS', 'DIRECCIÓN', 'INDIRIZZO'), ph: i('Adresse complète', 'Full address', 'Dirección completa', 'Indirizzo completo') },
  ]

  if (!tenantLoaded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <Skeleton height={104} count={1} radius={14} />
          <Skeleton height={104} count={1} radius={14} />
          <Skeleton height={104} count={1} radius={14} />
          <Skeleton height={104} count={1} radius={14} />
        </div>
        <Skeleton height={320} count={1} radius={16} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp .3s ease both' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {([
          { label: i('Utilisateurs', 'Users', 'Usuarios', 'Utenti'), value: stats.users, icon: <User size={20} />, color: 'var(--p2)' },
          { label: i('Produits', 'Products', 'Productos', 'Prodotti'), value: stats.products, icon: <Package size={20} />, color: 'var(--acc3,#00B8FF)' },
          { label: i('Clients', 'Customers', 'Clientes', 'Clienti'), value: stats.customers, icon: <Users size={20} />, color: 'var(--acc)' },
          { label: i('Ventes (mois)', 'Sales (month)', 'Ventas (mes)', 'Vendite (mese)'), value: stats.sales, icon: <ShoppingCart size={20} />, color: 'var(--acc2)' },
        ] as { label: string; value: number; icon: React.ReactNode; color: string }[]).map(s => (
          <div key={s.label} style={{ ...panel, border: `1px solid color-mix(in srgb, ${s.color} 14%, transparent)`, borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center', color: s.color }}>{s.icon}</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', color: s.color, fontFamily: 'var(--mono)' }}>{s.value}</div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={panel}>
        <Head icon={<Store size={16} />} tint="rgba(108,71,255,.06)"
          title={i('Informations boutique', 'Shop information', 'Información de la tienda', 'Informazioni negozio')}
          sub={i('Nom, adresse et coordonnées', 'Name, address and contact', 'Nombre, dirección y contacto', 'Nome, indirizzo e contatti')}
          right={editMode ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary gap-1.5" style={{ padding: '8px 16px', fontSize: 'var(--fs-label)', cursor: 'pointer' }} onClick={save}><Check size={13} /> {i('Sauvegarder', 'Save', 'Guardar', 'Salva')}</button>
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 'var(--fs-label)', cursor: 'pointer' }} onClick={() => setEditMode(false)}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
            </div>
          ) : (
            <button className="btn btn-ghost gap-1.5" style={{ padding: '8px 14px', fontSize: 'var(--fs-label)', cursor: 'pointer' }} onClick={() => setEditMode(true)}><Pencil size={13} /> {i('Modifier', 'Edit', 'Editar', 'Modifica')}</button>
          )} />

        <ResponsiveGrid min={160} gap={16} style={{ padding: '20px 22px' }}>
          {FIELDS.map(f => (
            <div key={f.key} style={f.full ? { gridColumn: '1/-1' } : {}}>
              <label style={{ display: 'block', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>{f.label}</label>
              {editMode ? (
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--text3)', pointerEvents: 'none' }}>{f.icon}</span>
                  {f.key === 'country' ? (
                    /* ⚠️ Sélecteur, PAS un champ libre : l'API n'accepte que l'ISO-2 (cf. backend
                       `lib/country.ts`). Un texte libre laisserait taper « France » et rendrait
                       un 400 au commerçant — ou pire, remettrait un libellé en base. */
                    <select aria-label={f.label} className="input" style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
                      value={shopData.country ?? ''} onChange={e => setShopData(d => ({ ...d, country: e.target.value }))}>
                      <option value="">{i('Non renseigné', 'Not set', 'No especificado', 'Non impostato')}</option>
                      {COUNTRIES.map(c => <option key={c.iso} value={c.iso}>{c.flag} {c.name}</option>)}
                    </select>
                  ) : (
                    <input aria-label={f.label} type={f.type} className="input" style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} placeholder={f.ph}
                      value={(shopData as any)[f.key] ?? ''} onChange={e => setShopData(d => ({ ...d, [f.key]: e.target.value }))} />
                  )}
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-sm)', color: 'var(--text2)', fontWeight: 'var(--fw-regular)', display: 'flex', alignItems: 'center', gap: 8, minHeight: 42 }}>
                  <span style={{ opacity: .5, display: 'flex', flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(f.key === 'country' ? countryLabel(shopData.country) : (shopData as any)[f.key]) || <span style={{ color: 'var(--text4)', fontStyle: 'italic' }}>{i('Non renseigné', 'Not set', 'No especificado', 'Non impostato')}</span>}
                  </span>
                </div>
              )}
            </div>
          ))}
          <div>
            <label htmlFor="shop-vat-rate" style={{ display: 'block', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>{i('TAUX TVA', 'VAT RATE', 'TASA IVA', 'ALIQUOTA IVA')} (%)</label>
            {editMode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input id="shop-vat-rate" type="number" min={0} max={100} step={0.5} className="input" style={{ flex: 1 }} value={shopData.taxRate} onChange={e => setShopData(d => ({ ...d, taxRate: Number(e.target.value) }))} />
                <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-regular)', color: 'var(--acc)', width: 24 }}>%</span>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: 'var(--c-amber-bg)', border: '1px solid var(--c-amber-border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 }}>
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{i('Appliqué sur ventes', 'Applied on sales', 'Aplicado en ventas', 'Applicato sulle vendite')}</span>
                <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)', color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{shopData.taxRate}%</span>
              </div>
            )}
          </div>
        </ResponsiveGrid>
      </div>

      {/* ── Infos légales — affichées en pied de facture/devis dès que renseignées ── */}
      <div style={panel}>
        <Head icon={<ScrollText size={16} />} tint="rgba(255,176,32,.06)"
          title={i('Infos légales', 'Legal information', 'Información legal', 'Informazioni legali')}
          sub={i('NINEA, registre du commerce, N° TVA — affichés en pied de facture et devis', 'NINEA, trade register, VAT no. — shown on invoice and quote footer', 'NINEA, registro mercantil, N° IVA — mostrados al pie de factura y presupuesto', 'NINEA, registro imprese, P. IVA — mostrati a piè di fattura e preventivo')}
          right={legalEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary gap-1.5" style={{ padding: '8px 16px', fontSize: 'var(--fs-label)', cursor: 'pointer' }} onClick={saveLegal}><Check size={13} /> {i('Sauvegarder', 'Save', 'Guardar', 'Salva')}</button>
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 'var(--fs-label)', cursor: 'pointer' }} onClick={() => setLegalEdit(false)}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
            </div>
          ) : (
            <button className="btn btn-ghost gap-1.5" style={{ padding: '8px 14px', fontSize: 'var(--fs-label)', cursor: 'pointer' }} onClick={() => setLegalEdit(true)}><Pencil size={13} /> {i('Modifier', 'Edit', 'Editar', 'Modifica')}</button>
          )} />

        <ResponsiveGrid min={160} gap={16} style={{ padding: '20px 22px' }}>
          {LEGAL_FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>{f.label}</label>
              {legalEdit ? (
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--text3)', pointerEvents: 'none' }}>{f.icon}</span>
                  <input aria-label={f.label} type="text" maxLength={64} className="input" style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} placeholder={f.ph}
                    value={legalData[f.key]} onChange={e => setLegalData(d => ({ ...d, [f.key]: e.target.value }))} />
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-sm)', color: 'var(--text2)', fontWeight: 'var(--fw-regular)', display: 'flex', alignItems: 'center', gap: 8, minHeight: 42 }}>
                  <span style={{ opacity: .5, display: 'flex', flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {legalData[f.key] || <span style={{ color: 'var(--text4)', fontStyle: 'italic' }}>{i('Non renseigné', 'Not set', 'No especificado', 'Non impostato')}</span>}
                  </span>
                </div>
              )}
            </div>
          ))}
        </ResponsiveGrid>
      </div>
    </div>
  )
}
