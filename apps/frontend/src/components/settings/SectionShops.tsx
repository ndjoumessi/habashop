import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { authApi, type AccessibleTenant } from '@/lib/api'
import { Store, Plus, UserPlus, Check, Loader2, X } from 'lucide-react'
import { makeI, panel, Head } from '@/components/settings/settingsShared'
import { DEFAULT_MARKET } from '@/lib/defaultMarket'

const CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'CAD', 'GBP'] as const
const LANGS = [['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['it', 'Italiano']] as const
const ROLES = ['CASHIER', 'MANAGER', 'ACCOUNTANT', 'HR', 'ADMIN'] as const

const cardBase: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }

export default function SectionShops() {
  const cfg = useConfig()
  const i = makeI(cfg.lang)
  const { tenants, activeTenantId } = useAuthStore()

  const [list, setList] = useState<AccessibleTenant[]>(tenants)
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [busy, setBusy] = useState(false)

  const [shop, setShop] = useState({ name: '', currency: DEFAULT_MARKET.currency as string, lang: 'fr', address: '' })
  const [invite, setInvite] = useState({ tenantId: '', name: '', email: '', password: '', role: 'CASHIER' })

  const refresh = () => { authApi.tenants().then(setList).catch(() => {}) }
  useEffect(() => { refresh() }, [])

  const handleCreate = async () => {
    if (!shop.name.trim()) { toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto')); return }
    setBusy(true)
    try {
      const { tenant } = await authApi.createTenant(shop)
      // MAJ store : la nouvelle boutique devient accessible immédiatement (switcher).
      const next = [...useAuthStore.getState().tenants, { id: tenant.id, name: tenant.name, currency: tenant.currency, plan: tenant.plan, logo: tenant.logo ?? null, address: tenant.address ?? null, role: 'ADMIN' }]
      useAuthStore.setState({ tenants: next })
      setList(next)
      setShop({ name: '', currency: DEFAULT_MARKET.currency, lang: 'fr', address: '' })
      setShowCreate(false)
      toast.success(i('Boutique créée', 'Shop created', 'Tienda creada', 'Negozio creato'))
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally { setBusy(false) }
  }

  const handleInvite = async () => {
    if (!invite.tenantId) { toast.error(i('Choisissez une boutique', 'Choose a shop', 'Elige una tienda', 'Scegli un negozio')); return }
    if (!invite.email.trim()) { toast.error(i('Email requis', 'Email required', 'Email requerido', 'Email richiesto')); return }
    setBusy(true)
    try {
      const res = await authApi.inviteToTenant(invite.tenantId, { name: invite.name, email: invite.email, password: invite.password, role: invite.role })
      setInvite({ tenantId: '', name: '', email: '', password: '', role: 'CASHIER' })
      setShowInvite(false)
      toast.success(res.linked
        ? i('Employé rattaché à la boutique', 'Employee linked to the shop', 'Empleado vinculado a la tienda', 'Dipendente collegato al negozio')
        : i('Employé invité', 'Employee invited', 'Empleado invitado', 'Dipendente invitato'))
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally { setBusy(false) }
  }

  return (
    <div style={{ ...panel, animation: 'slideUp .3s ease both' }}>
      <Head icon={<Store size={16} />} tint="rgba(108,71,255,.05)"
        title={i('Mes boutiques', 'My shops', 'Mis tiendas', 'I miei negozi')}
        sub={i('Gérez vos boutiques et invitez des employés', 'Manage your shops and invite employees', 'Gestione sus tiendas e invite empleados', 'Gestisci i tuoi negozi e invita dipendenti')}
        right={(
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { setShowInvite(false); setShowCreate(s => !s) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--p)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-label)', fontWeight: 700 }}>
              <Plus size={14} /> {i('Ajouter', 'Add', 'Añadir', 'Aggiungi')}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setShowInvite(s => !s) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-label)', fontWeight: 700 }}>
              <UserPlus size={14} /> {i('Inviter', 'Invite', 'Invitar', 'Invita')}
            </button>
          </div>
        )} />

      <div style={{ padding: '20px 22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Formulaire : ajouter une boutique */}
        {showCreate && (
          <div style={cardBase}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text)' }}>{i('Nouvelle boutique', 'New shop', 'Nueva tienda', 'Nuovo negozio')}</span>
              <button type="button" onClick={() => setShowCreate(false)} aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>{i('Nom de la boutique', 'Shop name', 'Nombre de la tienda', 'Nome del negozio')} *</label>
                <input className="input" value={shop.name} onChange={e => setShop({ ...shop, name: e.target.value })} placeholder={i('Ex: Boutique Plateau', 'Ex: Downtown shop', 'Ej: Tienda Centro', 'Es: Negozio Centro')} />
              </div>
              <div>
                <label style={lbl}>{i('Devise', 'Currency', 'Divisa', 'Valuta')}</label>
                <select className="input" value={shop.currency} onChange={e => setShop({ ...shop, currency: e.target.value })}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{i('Langue', 'Language', 'Idioma', 'Lingua')}</label>
                <select className="input" value={shop.lang} onChange={e => setShop({ ...shop, lang: e.target.value })}>
                  {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>{i('Adresse (optionnel)', 'Address (optional)', 'Dirección (opcional)', 'Indirizzo (opzionale)')}</label>
                <input className="input" value={shop.address} onChange={e => setShop({ ...shop, address: e.target.value })} />
              </div>
            </div>
            <button type="button" disabled={busy} onClick={handleCreate} style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: 11, borderRadius: 10, border: 'none', background: 'var(--p)', color: '#fff', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-body)', fontWeight: 800 }}>
              {busy ? <Loader2 size={15} style={{ animation: 'spin .6s linear infinite' }} /> : <Plus size={15} />}
              {i('Créer la boutique', 'Create shop', 'Crear tienda', 'Crea negozio')}
            </button>
          </div>
        )}

        {/* Formulaire : inviter un employé */}
        {showInvite && (
          <div style={cardBase}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text)' }}>{i('Inviter un employé', 'Invite an employee', 'Invitar empleado', 'Invita dipendente')}</span>
              <button type="button" onClick={() => setShowInvite(false)} aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>{i('Boutique', 'Shop', 'Tienda', 'Negozio')} *</label>
                <select className="input" value={invite.tenantId} onChange={e => setInvite({ ...invite, tenantId: e.target.value })}>
                  <option value="">{i('Choisir…', 'Choose…', 'Elegir…', 'Scegli…')}</option>
                  {list.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{i('Rôle', 'Role', 'Rol', 'Ruolo')}</label>
                <select className="input" value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{i('Nom', 'Name', 'Nombre', 'Nome')}</label>
                <input className="input" value={invite.name} onChange={e => setInvite({ ...invite, name: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Email *</label>
                <input className="input" type="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>{i('Mot de passe temporaire (nouvel employé)', 'Temp password (new employee)', 'Contraseña temporal (nuevo)', 'Password temporanea (nuovo)')}</label>
                <input className="input" type="text" value={invite.password} onChange={e => setInvite({ ...invite, password: e.target.value })} placeholder={i('Laisser vide si déjà inscrit', 'Leave empty if already registered', 'Vacío si ya registrado', 'Vuoto se già registrato')} />
              </div>
            </div>
            <button type="button" disabled={busy} onClick={handleInvite} style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: 11, borderRadius: 10, border: 'none', background: 'var(--p)', color: '#fff', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-body)', fontWeight: 800 }}>
              {busy ? <Loader2 size={15} style={{ animation: 'spin .6s linear infinite' }} /> : <UserPlus size={15} />}
              {i('Envoyer l’invitation', 'Send invitation', 'Enviar invitación', 'Invia invito')}
            </button>
          </div>
        )}

        {/* Liste des boutiques */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(t => {
            const isActive = t.id === activeTenantId
            return (
              <div key={t.id} style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--p) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--p2)' }}>
                  <Store size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.name}
                    {isActive && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 800, color: 'var(--p2)' }}><Check size={11} /> {i('active', 'active', 'activa', 'attiva')}</span>}
                  </div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>{t.currency} · {t.plan} · {t.role}</div>
                </div>
              </div>
            )
          })}
          {list.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>{i('Aucune boutique', 'No shop', 'Sin tiendas', 'Nessun negozio')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
