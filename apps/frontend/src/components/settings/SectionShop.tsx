import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { Store } from 'lucide-react'
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
        <Head icon={<Store size={16} />} tint="rgba(108,71,255,.06)"
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
                  <input aria-label={f.label} type={f.type} className="input" style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} placeholder={f.ph}
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
              <div style={{ padding: '10px 14px', background: 'var(--c-amber-bg)', border: '1px solid var(--c-amber-border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 }}>
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
