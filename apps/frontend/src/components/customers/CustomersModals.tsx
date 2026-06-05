import { Users, X, StickyNote, ShoppingCart, FileText, Eye, Pencil, Trash2, UserPlus, CheckCircle, DollarSign, Star, Phone, Mail, MapPin, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { t, useAppStore } from '@/stores/appStore'
import { confirm } from '@/lib/confirm'
import { customersApi } from '@/lib/api'
import ViewField from '@/components/ui/ViewField'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import LoyaltyCard from '@/components/ui/LoyaltyCard'
import LoyaltyCardDigital from '@/components/ui/LoyaltyCardDigital'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type Customer, type ClientType, TYPE_CFG, typeLabel, LoyaltyBar, loyaltyNextThreshold } from '@/components/customers/customersShared'

interface CustomersModalsProps {
  viewCustomer: Customer | null; setViewCustomer: (c: any) => void
  fmt: (n: number) => string
  lang: string
  i: (...a: string[]) => string
  navigate: (path: string, opts?: any) => void
  setDetailCustomer: (c: any) => void; setShowDetailModal: (b: boolean) => void
  showEditCustModal: boolean; editCustomer: Customer | null; setShowEditCustModal: (b: boolean) => void
  custEditMode: boolean; setCustEditMode: (b: boolean) => void
  editCustForm: any; setEditCustForm: (v: any) => void
  setCustomers: (v: any) => void
  showCreate: boolean; setShowCreate: (b: boolean) => void
  form: any; setForm: (v: any) => void
  handleCreateCustomer: () => void; resetCustForm: () => void
  showDetailModal: boolean; detailCustomer: Customer | null
  setEditCustomer: (c: any) => void
  loyaltyCustomer: Customer | null; setLoyaltyCustomer: (c: any) => void
  digitalCardCustomerId?: string | null; setDigitalCardCustomerId?: (id: string | null) => void
}

export default function CustomersModals({ viewCustomer, setViewCustomer, fmt, lang, i, navigate, setDetailCustomer, setShowDetailModal, showEditCustModal, editCustomer, setShowEditCustModal, custEditMode, setCustEditMode, editCustForm, setEditCustForm, setCustomers, showCreate, setShowCreate, form, setForm, handleCreateCustomer, resetCustForm, showDetailModal, detailCustomer, setEditCustomer, loyaltyCustomer, setLoyaltyCustomer, digitalCardCustomerId, setDigitalCardCustomerId }: CustomersModalsProps) {
  const loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const tenant = useAppStore(s => s.tenant)
  return (
    <>
      {viewCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setViewCustomer(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Users size={15} style={{color:'var(--p2)',flexShrink:0}} /> {viewCustomer.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  {i('Depuis', 'Since', 'Desde', 'Dal')} {new Date(viewCustomer.since).toLocaleDateString(loc)} · {i('Dernière visite', 'Last visit', 'Última visita', 'Ultima visita')} {new Date(viewCustomer.lastPurchase).toLocaleDateString(loc)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${TYPE_CFG[viewCustomer.type].cls}`}>{typeLabel(viewCustomer.type, lang)}</span>
                <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} className="btn btn-ghost btn-sm" onClick={() => setViewCustomer(null)}><X size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: i('Téléphone', 'Phone', 'Teléfono', 'Telefono'),    value: viewCustomer.phone || '—' },
                { label: 'Email',        value: viewCustomer.email || '—' },
                { label: i('CA total', 'Total revenue', 'CA total', 'CA totale'),     value: fmt(viewCustomer.totalCA) },
                { label: i('Achats/mois', 'Purchases/mo', 'Compras/mes', 'Acquisti/mese'),  value: `${viewCustomer.purchasesPerMonth} ${i('commandes', 'orders', 'pedidos', 'ordini')}` },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--bg3)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>{i('Solde fidélité', 'Loyalty balance', 'Saldo fidelidad', 'Saldo fedeltà')}</span>
                <span className="text-sm font-black" style={{ color: 'var(--acc)' }}>{viewCustomer.loyaltyPoints} pts</span>
              </div>
              <LoyaltyBar points={viewCustomer.loyaltyPoints} />
              <p className="text-xs mt-2" style={{ color: 'var(--text3)' }}>
                {(() => {
                  const next = loyaltyNextThreshold(viewCustomer.loyaltyPoints, tenant?.bronzeThreshold, tenant?.silverThreshold)
                  return next
                    ? `${i('Prochain palier', 'Next tier', 'Próximo nivel', 'Prossimo livello')} : ${next} pts · ${i('Reste', 'Remaining', 'Quedan', 'Restano')} ${Math.max(0, next - viewCustomer.loyaltyPoints)} pts`
                    : `🥇 ${i('Palier Gold atteint', 'Gold tier reached', 'Nivel Gold alcanzado', 'Livello Gold raggiunto')}`
                })()}
              </p>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>{i('Historique achats', 'Purchase history', 'Historial compras', 'Storico acquisti')}</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{i('Référence', 'Reference', 'Referencia', 'Riferimento')}</th><th>{i('Date', 'Date', 'Fecha', 'Data')}</th><th>{i('Articles', 'Items', 'Artículos', 'Articoli')}</th><th>{i('Montant', 'Amount', 'Importe', 'Importo')}</th></tr></thead>
                  <tbody>
                    {viewCustomer.purchases.map(p => (
                      <tr key={p.ref}>
                        <td className="td-mono text-xs">{p.ref}</td>
                        <td className="td-mono text-xs">{new Date(p.date).toLocaleDateString(loc)}</td>
                        <td className="text-xs" style={{ color: 'var(--text2)' }}>{p.items} {i('art.', 'items', 'art.', 'art.')}</td>
                        <td className="td-num text-xs" style={{ color: 'var(--acc2)' }}>{fmt(p.total)}</td>
                      </tr>
                    ))}
                    {viewCustomer.purchases.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-4" style={{ color: 'var(--text3)' }}>{i('Aucun achat', 'No purchases', 'Sin compras', 'Nessun acquisto')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {viewCustomer.notes && (
              <div className="p-3 rounded-xl text-xs mb-4"
                style={{ background: 'rgba(91,78,232,0.08)', border: '1px solid rgba(91,78,232,0.2)', color: 'var(--p3)', display:'flex', alignItems:'flex-start', gap:6 }}>
                <StickyNote size={12} style={{flexShrink:0,marginTop:1}} /> {viewCustomer.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center"
                onClick={() => { setViewCustomer(null); navigate('/app/pos', { state: { customer: viewCustomer } }) }}
                style={{ cursor: 'pointer' }}>
                <ShoppingCart size={14} /> {i('Nouvelle vente', 'New sale', 'Nueva venta', 'Nuova vendita')}
              </button>
              <button className="btn btn-sm"
                onClick={() => { setDetailCustomer(viewCustomer); setShowDetailModal(true); setViewCustomer(null) }}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  background: 'linear-gradient(135deg,var(--p),var(--p2))',
                  border: 'none', cursor: 'pointer',
                  color: '#fff', fontSize: 12, fontWeight: 'var(--fw-semibold)',
                  fontFamily: 'var(--font)',
                  boxShadow: 'var(--sh-p)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <FileText size={13} /> {i('Détail', 'Detail', 'Detalle', 'Dettaglio')}
              </button>
              <button className="btn btn-ghost" onClick={() => setViewCustomer(null)}>{i('Fermer', 'Close', 'Cerrar', 'Chiudi')}</button>
            </div>
          </div>
        </div>
      )}

      {showEditCustModal && editCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowEditCustModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>👤 {editCustomer.name}</h3>
              <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} className="btn btn-ghost btn-sm" onClick={() => setShowEditCustModal(false)}><X size={14} /></button>
            </div>

            {/* Mode banner */}
            {!custEditMode
              ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                  <Eye size={13} style={{ color:'var(--acc3)', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:600 }}>
                    {lang === 'en' ? 'View mode — click Edit to make changes' : lang === 'es' ? 'Modo visualización — haz clic en Editar para modificar' : lang === 'it' ? 'Modalità visualizzazione — clicca su Modifica per modificare' : 'Mode visualisation — cliquez sur Modifier pour éditer'}
                  </span>
                </div>
              : <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                  <Pencil size={13} style={{ color:'var(--warn)', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--warn)', fontWeight:600 }}>
                    {lang === 'en' ? 'Edit mode — unsaved changes' : lang === 'es' ? 'Modo edición — cambios no guardados' : lang === 'it' ? 'Modalità modifica — modifiche non salvate' : 'Mode édition — modifications non sauvegardées'}
                  </span>
                </div>
            }

            <ResponsiveGrid min={160} gap={10}>
              <ViewField label={i('NOM / ENSEIGNE', 'NAME / BUSINESS', 'NOMBRE / EMPRESA', 'NOME / INSEGNA')} value={editCustForm.name} fullWidth editing={custEditMode}>
                <input className="input text-sm" value={editCustForm.name}
                  onChange={e => setEditCustForm(f => ({...f, name:e.target.value}))} />
              </ViewField>
              <ViewField label={i('TYPE', 'TYPE', 'TIPO', 'TIPO')} value={typeLabel(editCustForm.type, lang)} editing={custEditMode}>
                <select className="input text-sm" value={editCustForm.type}
                  onChange={e => setEditCustForm(f => ({...f, type:e.target.value as ClientType}))}>
                  <option value="Grossiste">{typeLabel('Grossiste', lang)}</option>
                  <option value="Semi-gros">{typeLabel('Semi-gros', lang)}</option>
                  <option value="Fidèle">{typeLabel('Fidèle', lang)}</option>
                  <option value="Détail">{typeLabel('Détail', lang)}</option>
                </select>
              </ViewField>
              <ViewField label={i('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO')} value={editCustForm.phone||''} icon="📞" editing={custEditMode}>
                <PhoneInputWithCountry value={editCustForm.phone} onChange={v => setEditCustForm(f => ({...f, phone:v}))} lang={lang} />
              </ViewField>
              <ViewField label="EMAIL" value={editCustForm.email||''} fullWidth editing={custEditMode}>
                <input className="input text-sm" type="email" placeholder={i('email@exemple.com', 'email@example.com', 'email@ejemplo.com', 'email@esempio.com')}
                  value={editCustForm.email}
                  onChange={e => setEditCustForm(f => ({...f, email:e.target.value}))} />
              </ViewField>
              <ViewField label={i('ADRESSE', 'ADDRESS', 'DIRECCIÓN', 'INDIRIZZO')} value={editCustForm.address||''} fullWidth editing={custEditMode}>
                <AddressAutocompleteInput value={editCustForm.address}
                  onChange={v => setEditCustForm(f => ({...f, address:v}))} lang={lang} />
              </ViewField>
              <ViewField label={i('NOTES', 'NOTES', 'NOTAS', 'NOTE')} value={editCustForm.notes||''} fullWidth editing={custEditMode}>
                <textarea className="input text-sm" rows={2} value={editCustForm.notes}
                  onChange={e => setEditCustForm(f => ({...f, notes:e.target.value}))} />
              </ViewField>
            </ResponsiveGrid>

            <div className="flex gap-2 mt-5">
              {!custEditMode ? (
                <>
                  <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:6 }} onClick={() => setCustEditMode(true)}><Pencil size={13} /> {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}</button>
                  <button className="btn btn-ghost" style={{ color:'var(--danger)', display:'flex', alignItems:'center', gap:6 }}
                    aria-label={i('Supprimer le client', 'Delete customer', 'Eliminar cliente', 'Elimina cliente')}
                    onClick={async () => {
                      if (!(await confirm({ title: i('Supprimer le client', 'Delete customer', 'Eliminar cliente', 'Elimina cliente'), message: i('Cette action est irréversible.', 'This action is irreversible.', 'Esta acción es irreversible.', 'Questa azione è irreversibile.'), danger: true }))) return
                      try {
                        await customersApi.delete(editCustomer.id)
                        setCustomers(prev => prev.filter(c => c.id !== editCustomer.id))
                        setShowEditCustModal(false)
                        toast.success(i('Client supprimé', 'Customer deleted', 'Cliente eliminado', 'Cliente eliminato'))
                      } catch (e: any) { toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore')) }
                    }}><Trash2 size={13} /> {i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}</button>
                  <button className="btn btn-ghost" onClick={() => setShowEditCustModal(false)}>{lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => {
                    setEditCustForm({ name:editCustomer.name, type:editCustomer.type, phone:editCustomer.phone, email:editCustomer.email??'', address:editCustomer.address??'', notes:editCustomer.notes??'' })
                    setCustEditMode(false)
                  }}>{t('btn_cancel')}</button>
                  <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer' }} onClick={async () => {
                    if (!editCustForm.name) { toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto')); return }
                    try { await customersApi.update(editCustomer.id, { name: editCustForm.name, phone: editCustForm.phone, email: editCustForm.email, address: editCustForm.address, notes: editCustForm.notes, type: editCustForm.type }) } catch {}
                    setCustomers(prev => prev.map(c =>
                      c.id === editCustomer.id ? { ...c, ...editCustForm } : c
                    ))
                    setShowEditCustModal(false)
                    toast.success(`${editCustForm.name} ${i('mis à jour', 'updated', 'actualizado', 'aggiornato')}`)
                  }}>{i('Enregistrer', 'Save', 'Guardar', 'Salva')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={{
            background:'var(--card)',
            border:'1px solid var(--border)',
            borderRadius:24, width:'100%', maxWidth:480,
            maxHeight:'90vh', overflow:'hidden',
            display:'flex', flexDirection:'column',
            boxShadow:'0 24px 80px var(--shadow, rgba(0,0,0,.8))',
            position:'relative',
          }}>
            <div style={{
              position:'absolute', top:0, left:'50%',
              transform:'translateX(-50%)',
              width:'40%', height:1,
              background:'linear-gradient(90deg,transparent,#F472B6,transparent)',
            }} />
            <div style={{
              padding:'20px 24px 16px',
              borderBottom:'1px solid var(--border)',
              flexShrink:0, display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{
                width:44, height:44, borderRadius:13,
                background:'linear-gradient(135deg,#F472B6,#EC4899)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 4px 14px rgba(244,114,182,.4)',
              }}><UserPlus size={22} color="#fff" /></div>
              <div style={{flex:1}}>
                <h3 style={{ fontSize:17, fontWeight:900, color:'var(--text)', margin:0, letterSpacing:'-.3px' }}>
                  {lang === 'en' ? '+ New customer' : lang === 'es' ? '+ Nuevo cliente' : lang === 'it' ? '+ Nuovo cliente' : '+ Nouveau client'}
                </h3>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
                  {lang === 'en' ? 'Add a customer to your CRM' : lang === 'es' ? 'Agregue un cliente a su CRM' : lang === 'it' ? 'Aggiungi un cliente al tuo CRM' : 'Ajoutez un client à votre CRM'}
                </div>
              </div>
              <button type="button" onClick={()=>setShowCreate(false)} style={{
                width:30, height:30, borderRadius:9,
                background:'var(--bg3)', border:'1px solid var(--border)',
                cursor:'pointer', fontSize:14, color:'var(--text3)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>✕</button>
            </div>

            <div style={{
              flex:1, overflowY:'auto', minHeight:0,
              padding:'20px 24px', display:'flex', flexDirection:'column', gap:14,
            }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                  {lang === 'en' ? 'NAME / COMPANY *' : lang === 'es' ? 'NOMBRE / EMPRESA *' : lang === 'it' ? 'NOME / INSEGNA *' : 'NOM / ENSEIGNE *'}
                </label>
                <input className="input" autoFocus
                  placeholder={lang === 'en' ? 'Customer name...' : lang === 'es' ? 'Nombre del cliente...' : lang === 'it' ? 'Nome del cliente...' : 'Nom du client...'}
                  value={form.name}
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
              </div>

              <ResponsiveGrid min={160} gap={12}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>{i('TYPE', 'TYPE', 'TIPO', 'TIPO')}</label>
                  <select aria-label={i('Type', 'Type', 'Tipo', 'Tipo')} className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value as ClientType}))}>
                    <option value="Détail">{lang === 'en' ? 'Retail' : lang === 'es' ? 'Minorista' : lang === 'it' ? 'Dettaglio' : 'Détail'}</option>
                    <option value="Grossiste">{lang === 'en' ? 'Wholesale' : lang === 'es' ? 'Mayorista' : lang === 'it' ? 'Grossista' : 'Grossiste'}</option>
                    <option value="Semi-gros">{lang === 'en' ? 'Semi-wholesale' : lang === 'es' ? 'Semi-mayor' : lang === 'it' ? 'Semi-ingrosso' : 'Semi-gros'}</option>
                    <option value="Fidèle">{lang === 'en' ? 'Loyal' : lang === 'es' ? 'Fiel' : lang === 'it' ? 'Fedele' : 'Fidèle'}</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <PhoneInputWithCountry
                    label={lang === 'en' ? 'PHONE' : lang === 'es' ? 'TELÉFONO' : lang === 'it' ? 'TELEFONO' : 'TÉLÉPHONE'}
                    value={form.phone}
                    onChange={v=>setForm(f=>({...f, phone:v}))}
                    lang={lang}
                  />
                </div>
              </ResponsiveGrid>

              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>EMAIL</label>
                <input aria-label="EMAIL" className="input" type="email" placeholder={i('email@exemple.com', 'email@example.com', 'email@ejemplo.com', 'email@esempio.com')}
                  value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>

              <div>
                <AddressAutocompleteInput
                  label={lang === 'en' ? 'ADDRESS' : lang === 'es' ? 'DIRECCIÓN' : lang === 'it' ? 'INDIRIZZO' : 'ADRESSE'}
                  value={form.address}
                  onChange={v=>setForm(f=>({...f,address:v}))}
                  lang={lang}
                />
              </div>
            </div>

            <div style={{
              padding:'16px 24px', borderTop:'1px solid var(--border)',
              flexShrink:0, display:'flex', gap:8,
            }}>
              <button onClick={handleCreateCustomer} style={{
                flex:1, padding:'13px',
                background:'linear-gradient(135deg,#F472B6,#EC4899)',
                border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:'var(--fw-bold)',
                cursor:'pointer', fontFamily:'var(--font)',
                boxShadow:'0 4px 16px rgba(244,114,182,.4)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
                <CheckCircle size={15} style={{flexShrink:0}} /> {lang === 'en' ? 'Add customer' : lang === 'es' ? 'Agregar el cliente' : lang === 'it' ? 'Aggiungi il cliente' : 'Ajouter le client'}
              </button>
              <button onClick={()=>{setShowCreate(false);resetCustForm()}} style={{
                padding:'13px 18px', background:'var(--bg3)',
                border:'1px solid var(--border)', borderRadius:12,
                cursor:'pointer', color:'var(--text2)', fontSize:13,
                fontFamily:'var(--font)', fontWeight:600,
              }}>
                {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && detailCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowDetailModal(false)}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 24, width: '100%', maxWidth: 600,
            maxHeight: '92vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px var(--shadow, rgba(0,0,0,.85))',
            position: 'relative',
          }}>
            {/* Bande déco */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: (() => {
                const colors: Record<string, string> = {
                  Grossiste: 'linear-gradient(90deg,#6C47FF,#A991FF)',
                  'Semi-gros': 'linear-gradient(90deg,#FF9500,#FFB800)',
                  Fidèle: 'linear-gradient(90deg,#00D084,#00B8A9)',
                  Détail: 'linear-gradient(90deg,#00B8FF,#6C47FF)',
                }
                return colors[detailCustomer.type] ?? 'linear-gradient(90deg,var(--p),var(--p2))'
              })(),
            }} />

            {/* Header */}
            <div style={{
              padding: '24px 24px 20px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              background: 'linear-gradient(135deg,rgba(108,71,255,.06),transparent)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 18, flexShrink: 0,
                  background: (() => {
                    const colors: Record<string, string> = {
                      Grossiste: 'linear-gradient(135deg,#6C47FF,#A991FF)',
                      'Semi-gros': 'linear-gradient(135deg,#FF9500,#FFB800)',
                      Fidèle: 'linear-gradient(135deg,#00D084,#00B8A9)',
                      Détail: 'linear-gradient(135deg,#00B8FF,#6C47FF)',
                    }
                    return colors[detailCustomer.type] ?? 'linear-gradient(135deg,#6C47FF,#A991FF)'
                  })(),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 900, color: '#fff',
                  boxShadow: '0 6px 20px rgba(108,71,255,.35)',
                }}>
                  {(detailCustomer.name ?? '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>
                      {detailCustomer.name}
                    </h2>
                    <span style={{
                      fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.4px',
                      padding: '3px 10px', borderRadius: 99,
                      background: ({ Grossiste: 'rgba(108,71,255,.15)', 'Semi-gros': 'rgba(255,149,0,.15)', Fidèle: 'rgba(0,208,132,.15)', Détail: 'rgba(0,184,255,.15)' } as Record<string,string>)[detailCustomer.type] ?? 'rgba(108,71,255,.15)',
                      color: ({ Grossiste: 'var(--p3)', 'Semi-gros': 'var(--acc)', Fidèle: 'var(--acc2)', Détail: 'var(--info)' } as Record<string,string>)[detailCustomer.type] ?? 'var(--p3)',
                    }}>
                      {typeLabel(detailCustomer.type, lang)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    {i('Depuis le', 'Since', 'Desde el', 'Dal')}{' '}
                    {new Date(detailCustomer.since).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'), { day: 'numeric', month: 'long', year: 'numeric' })}
                    {detailCustomer.lastPurchase && (
                      <span style={{ marginLeft: 10 }}>
                        · {i('Dernière visite', 'Last visit', 'Última visita', 'Ultima visita')}{' '}
                        {new Date(detailCustomer.lastPurchase).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setShowDetailModal(false)} style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  cursor: 'pointer', color: 'var(--text3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, flexShrink: 0,
                }}>✕</button>
              </div>
            </div>

            {/* Corps scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: i('CA Total', 'Total Revenue', 'Ingresos totales', 'Fatturato totale'), value: fmt(detailCustomer.totalCA), icon: <DollarSign size={20} />, color: 'var(--acc)', hex: 'var(--acc)' },
                  { label: i('Commandes/mois', 'Orders/month', 'Pedidos/mes', 'Ordini/mese'), value: `${detailCustomer.purchasesPerMonth}`, icon: <ShoppingCart size={20} />, color: 'var(--p2)', hex: 'var(--p)' },
                  { label: i('Points fidélité', 'Loyalty pts', 'Puntos fidelidad', 'Punti fedeltà'), value: `${detailCustomer.loyaltyPoints} pts`, icon: <Star size={20} />, color: 'var(--warn)', hex: 'var(--warn)' },
                ].map(k => (
                  <div key={k.label} style={{ background: `linear-gradient(135deg,${k.hex}15,${k.hex}05)`, border: `1px solid ${k.hex}25`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom: 6, color: k.color }}>{k.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: k.color, fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>{k.value}</div>
                    <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginTop: 4 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Coordonnées */}
              <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                <div style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={12} style={{color:'var(--text3)'}} />{i('COORDONNÉES', 'CONTACT INFO', 'CONTACTO', 'CONTATTI')}
                </div>
                <ResponsiveGrid min={160} gap={10}>
                  {[
                    { label: i('Téléphone', 'Phone', 'Teléfono', 'Telefono'), value: detailCustomer.phone || '—', icon: <Phone size={10} />, full: false },
                    { label: 'Email', value: detailCustomer.email || '—', icon: <Mail size={10} />, full: false },
                    { label: i('Adresse', 'Address', 'Dirección', 'Indirizzo'), value: detailCustomer.address || '—', icon: <MapPin size={10} />, full: true },
                  ].map(item => (
                    <div key={item.label} style={{
                      gridColumn: item.full ? '1 / -1' : 'auto',
                      background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text3)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {item.icon}{item.label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>{item.value}</div>
                    </div>
                  ))}
                </ResponsiveGrid>
                {detailCustomer.notes && (
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(91,78,232,.08)', border: '1px solid rgba(91,78,232,.2)', fontSize: 12, color: 'var(--p3)', display:'flex', alignItems:'flex-start', gap:6 }}>
                    <StickyNote size={12} style={{flexShrink:0,marginTop:1}} /> {detailCustomer.notes}
                  </div>
                )}
              </div>

              {/* Programme fidélité */}
              <div style={{ background: 'linear-gradient(135deg,rgba(255,184,0,.06),rgba(255,184,0,.02))', border: '1px solid rgba(255,184,0,.15)', borderRadius: 14, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={12} style={{color:'var(--warn)'}} /> {i('PROGRAMME FIDÉLITÉ', 'LOYALTY PROGRAM', 'PROGRAMA FIDELIDAD', 'PROGRAMMA FEDELTÀ')}
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--warn)', fontFamily: 'var(--mono)' }}>
                    {detailCustomer.loyaltyPoints} pts
                  </span>
                </div>
                {(() => {
                  const pts = detailCustomer.loyaltyPoints
                  const levels = [
                    { name: 'Bronze',   min: 0,    max: 499,  color: '#CD7F32' },
                    { name: 'Silver',   min: 500,  max: 999,  color: '#C0C0C0' },
                    { name: 'Gold',     min: 1000, max: 2499, color: '#FFD700' },
                    { name: 'Platinum', min: 2500, max: 9999, color: '#E5E4E2' },
                  ]
                  const current = [...levels].reverse().find(l => pts >= l.min) ?? levels[0]
                  const next    = levels.find(l => l.min > pts)
                  const pct     = next ? Math.round(((pts - current.min) / (next.min - current.min)) * 100) : 100
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <span style={{ fontWeight: 'var(--fw-semibold)', color: current.color, display:'inline-flex', alignItems:'center', gap:4 }}><Star size={11} style={{color:current.color}} /> {current.name}</span>
                        {next && <span style={{ color: 'var(--text3)' }}>{next.min - pts} pts → {next.name}</span>}
                      </div>
                      <div style={{ height: 8, background: 'var(--bg5,var(--bg4))', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg,${current.color},${next?.color ?? current.color})`, borderRadius: 99, transition: 'width .5s ease' }} />
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{pct}%</div>
                    </div>
                  )
                })()}
              </div>

              {/* Historique achats */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingBag size={12} style={{color:'var(--text3)'}} /> {i('HISTORIQUE DES ACHATS', 'PURCHASE HISTORY', 'HISTORIAL DE COMPRAS', 'STORICO ACQUISTI')}
                </div>
                {detailCustomer.purchases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)', fontSize: 13 }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}><ShoppingCart size={28} style={{color:'var(--text4)'}} /></div>
                    {i('Aucun achat enregistré', 'No purchases recorded', 'Sin compras registradas', 'Nessun acquisto registrato')}
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{i('RÉFÉRENCE', 'REF', 'REF', 'RIF')}</th>
                          <th>DATE</th>
                          <th>{i('ARTICLES', 'ITEMS', 'ARTÍCULOS', 'ARTICOLI')}</th>
                          <th>{i('MONTANT', 'AMOUNT', 'IMPORTE', 'IMPORTO')}</th>
                          <th>STATUT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailCustomer.purchases.map(p => (
                          <tr key={p.ref}>
                            <td className="td-mono" style={{ fontSize: 11, color: 'var(--p3)' }}>{p.ref}</td>
                            <td style={{ fontSize: 11, color: 'var(--text2)' }}>
                              {new Date(p.date).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text2)' }}>{p.items} art.</td>
                            <td className="td-mono" style={{ color: 'var(--acc2)', fontWeight: 'var(--fw-semibold)' }}>{fmt(p.total)}</td>
                            <td><span className="badge badge-ok">✓ {i('Payé', 'Paid', 'Pagado', 'Pagato')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8, background: 'var(--bg2)' }}>
              <button onClick={() => { setShowDetailModal(false); navigate('/app/pos', { state: { customer: detailCustomer } }) }} style={{
                flex: 1, padding: '12px',
                background: 'linear-gradient(135deg,var(--p),var(--p2))',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 13, fontWeight: 'var(--fw-bold)', cursor: 'pointer',
                fontFamily: 'var(--font)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: 'var(--sh-p)',
              }}>
                <ShoppingCart size={14} /> {i('Nouvelle vente', 'New sale', 'Nueva venta', 'Nuova vendita')}
              </button>
              <button onClick={() => {
                setShowDetailModal(false)
                setEditCustomer(detailCustomer)
                setEditCustForm({ name: detailCustomer.name, type: detailCustomer.type, phone: detailCustomer.phone, email: detailCustomer.email ?? '', address: detailCustomer.address ?? '', notes: detailCustomer.notes ?? '' })
                setCustEditMode(false)
                setShowEditCustModal(true)
              }} style={{
                padding: '12px 16px', background: 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 12,
                cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
                fontFamily: 'var(--font)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Pencil size={13} /> {i('Modifier', 'Edit', 'Editar', 'Modifica')}
              </button>
              <button onClick={() => setShowDetailModal(false)} style={{
                padding: '12px 16px', background: 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 12,
                cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
                fontFamily: 'var(--font)', fontWeight: 600,
              }}>
                {i('Fermer', 'Close', 'Cerrar', 'Chiudi')}
              </button>
            </div>
          </div>
        </div>
      )}

      {loyaltyCustomer && (
        <LoyaltyCard customer={loyaltyCustomer} onClose={() => setLoyaltyCustomer(null)} />
      )}

      {/* Carte fidélité numérique (si enableLoyalty) */}
      {digitalCardCustomerId && setDigitalCardCustomerId && tenant?.enableLoyalty && (
        <LoyaltyCardDigital customerId={digitalCardCustomerId} onClose={() => setDigitalCardCustomerId(null)} />
      )}
    </>
  )
}
