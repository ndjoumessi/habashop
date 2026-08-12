import { Users, X, StickyNote, ShoppingCart, FileText, Eye, Pencil, Trash2, UserPlus, CheckCircle, DollarSign, Star, Phone, Mail, MapPin, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { t, useAppStore } from '@/stores/appStore'
import { confirm } from '@/lib/confirm'
import { customersApi } from '@/lib/api'
import ViewField from '@/components/ui/ViewField'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react'
// Lazy : LoyaltyCardDigital embarque html2canvas + qrcode (~45 Ko gz) — hors du chunk Customers
const LoyaltyCardDigital = lazy(() => import('@/components/ui/LoyaltyCardDigital'))
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type Customer, type ClientType, type CustomerForm, type EditCustomerForm, TYPE_CFG, typeLabel, LoyaltyBar, loyaltyNextThreshold, usePurchaseHistory, purchaseRateLabel, clientTypeToValue } from '@/components/customers/customersShared'
import { useModalFocus } from '@/hooks/useModalFocus'
import { announce } from '@/lib/announce'
import { fmtDate } from '@/lib/formatDate'
import { saved } from '@/lib/saved'

interface CustomersModalsProps {
  viewCustomer: Customer | null; setViewCustomer: (c: any) => void
  fmt: (n: number) => string
  lang: string
  i: (...a: string[]) => string
  navigate: (path: string, opts?: any) => void
  setDetailCustomer: (c: any) => void; setShowDetailModal: (b: boolean) => void
  showEditCustModal: boolean; editCustomer: Customer | null; setShowEditCustModal: (b: boolean) => void
  custEditMode: boolean; setCustEditMode: (b: boolean) => void
  editCustForm: EditCustomerForm; setEditCustForm: Dispatch<SetStateAction<EditCustomerForm>>
  setCustomers: Dispatch<SetStateAction<Customer[]>>
  showCreate: boolean; setShowCreate: (b: boolean) => void
  form: CustomerForm; setForm: Dispatch<SetStateAction<CustomerForm>>
  handleCreateCustomer: () => void; resetCustForm: () => void
  showDetailModal: boolean; detailCustomer: Customer | null
  setEditCustomer: (c: any) => void
  digitalCardCustomerId?: string | null; setDigitalCardCustomerId?: (id: string | null) => void
}

export default function CustomersModals({ viewCustomer, setViewCustomer, fmt, lang, i, navigate, setDetailCustomer, setShowDetailModal, showEditCustModal, editCustomer, setShowEditCustModal, custEditMode, setCustEditMode, editCustForm, setEditCustForm, setCustomers, showCreate, setShowCreate, form, setForm, handleCreateCustomer, resetCustForm, showDetailModal, detailCustomer, setEditCustomer, digitalCardCustomerId, setDigitalCardCustomerId }: CustomersModalsProps) {
  const loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const tenant = useAppStore(s => s.tenant)
  // Pièges à focus des 4 modales (focus initial + Tab bouclé + restauration)
  const viewBoxRef   = useModalFocus<HTMLDivElement>(!!viewCustomer)
  const editBoxRef   = useModalFocus<HTMLDivElement>(showEditCustModal && !!editCustomer)
  const createBoxRef = useModalFocus<HTMLDivElement>(showCreate)
  const detailBoxRef = useModalFocus<HTMLDivElement>(showDetailModal && !!detailCustomer)
  // Historique d'achats de la fiche OUVERTE (#214). Les deux modales n'étant jamais
  // ouvertes ensemble — « Voir fiche complète » ferme l'aperçu — une seule requête suffit,
  // et passer de l'une à l'autre sur le MÊME client ne refait rien (l'id ne change pas).
  const openCustomerId = viewCustomer?.id ?? (showDetailModal ? detailCustomer?.id ?? null : null)
  const purchases = usePurchaseHistory(openCustomerId)
  // Message d'état : « on n'a pas pu demander » ≠ « il n'a rien acheté ».
  const purchasesEmptyLabel = purchases.loading
    ? i('Chargement de l’historique…', 'Loading history…', 'Cargando el historial…', 'Caricamento dello storico…')
    : purchases.failed
      ? i('Historique indisponible', 'History unavailable', 'Historial no disponible', 'Storico non disponibile')
      : null
  return (
    <>
      {viewCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={viewCustomer.name} onClick={e => e.target === e.currentTarget && setViewCustomer(null)}>
          <div ref={viewBoxRef} className="modal-box" style={{ maxWidth: 560 }}>
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
                { label: i('Achats/mois', 'Purchases/mo', 'Compras/mes', 'Acquisti/mese'),  value: purchaseRateLabel(viewCustomer.purchasesPerMonth, lang) },
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
                <table aria-label={i('Historique achats', 'Purchase history', 'Historial compras', 'Storico acquisti')}>
                  <thead><tr><th scope="col">{i('Référence', 'Reference', 'Referencia', 'Riferimento')}</th><th scope="col">{i('Date', 'Date', 'Fecha', 'Data')}</th><th scope="col">{i('Articles', 'Items', 'Artículos', 'Articoli')}</th><th scope="col" className="th-num">{i('Montant', 'Amount', 'Importe', 'Importo')}</th></tr></thead>
                  <tbody>
                    {purchases.rows.map(p => (
                      <tr key={p.ref}>
                        <td className="td-mono text-xs">
                          {p.ref}
                          {p.refunded && (
                            <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 'var(--fs-caption)' }}>
                              {i('Remboursé', 'Refunded', 'Reembolsado', 'Rimborsato')}
                            </span>
                          )}
                        </td>
                        <td className="td-mono text-xs">{fmtDate(p.date)}</td>
                        <td className="text-xs" style={{ color: 'var(--text2)' }}>{p.items} {i('art.', 'items', 'art.', 'art.')}</td>
                        <td className="td-num text-xs" style={{ color: p.refunded ? 'var(--text3)' : 'var(--acc2)', textDecoration: p.refunded ? 'line-through' : undefined }}>{fmt(p.total)}</td>
                      </tr>
                    ))}
                    {purchases.rows.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-4" style={{ color: 'var(--text3)' }} role={purchasesEmptyLabel ? 'status' : undefined}>
                        {purchasesEmptyLabel ?? i('Aucun achat', 'No purchases', 'Sin compras', 'Nessun acquisto')}
                      </td></tr>
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
                  color: '#fff', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editCustomer.name} onClick={e => e.target === e.currentTarget && setShowEditCustModal(false)}>
          <div ref={editBoxRef} className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>👤 {editCustomer.name}</h3>
              <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} className="btn btn-ghost btn-sm" onClick={() => setShowEditCustModal(false)}><X size={14} /></button>
            </div>

            {/* Mode banner */}
            {!custEditMode
              ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                  <Eye size={13} style={{ color:'var(--acc3)', flexShrink:0 }} />
                  <span style={{ fontSize:'var(--fs-label)', color:'var(--acc3)', fontWeight:'var(--fw-regular)' }}>
                    {lang === 'en' ? 'View mode — click Edit to make changes' : lang === 'es' ? 'Modo visualización — haz clic en Editar para modificar' : lang === 'it' ? 'Modalità visualizzazione — clicca su Modifica per modificare' : 'Mode visualisation — cliquez sur Modifier pour éditer'}
                  </span>
                </div>
              : <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                  <Pencil size={13} style={{ color:'var(--warn)', flexShrink:0 }} />
                  <span style={{ fontSize:'var(--fs-label)', color:'var(--warn)', fontWeight:'var(--fw-regular)' }}>
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
                        announce(i('Client supprimé', 'Customer deleted', 'Cliente eliminado', 'Cliente eliminato'))
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
                    // `notes` est de nouveau envoyé : la colonne existe (migration
                    // `20260805233000_add_customer_notes`), le zod l'accepte ET le `data:` du
                    // handler PUT l'écrit. Les trois étaient nécessaires — la colonne seule, ou
                    // le zod seul, auraient laissé le champ être jeté exactement comme avant.
                    // ⚠️ Un refus serveur fermait la modale, mutait la liste et affichait
                    // « mis à jour » : nom, téléphone, e-mail, adresse et notes semblaient
                    // enregistrés et revenaient à leur ancienne valeur au prochain chargement.
                    // On revient sans rien toucher — la saisie reste à l'écran.
                    const ok = await saved(
                      customersApi.update(editCustomer.id, { name: editCustForm.name, phone: editCustForm.phone, email: editCustForm.email, address: editCustForm.address, notes: editCustForm.notes, type: clientTypeToValue(editCustForm.type) }),
                      i('le client', 'the customer', 'el cliente', 'il cliente'),
                    )
                    if (!ok) return
                    setCustomers(prev => prev.map(c =>
                      c.id === editCustomer.id ? { ...c, ...editCustForm } : c
                    ))
                    setShowEditCustModal(false)
                    toast.success(`${editCustForm.name} ${i('mis à jour', 'updated', 'actualizado', 'aggiornato')}`)
                    announce(`${i('Client', 'Customer', 'Cliente', 'Cliente')} ${editCustForm.name} ${i('mis à jour', 'updated', 'actualizado', 'aggiornato')}`)
                  }}>{i('Enregistrer', 'Save', 'Guardar', 'Salva')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          aria-label={lang === 'en' ? 'New customer' : lang === 'es' ? 'Nuevo cliente' : lang === 'it' ? 'Nuovo cliente' : 'Nouveau client'}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div ref={createBoxRef} style={{
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
              background:'linear-gradient(90deg,transparent,var(--p2),transparent)',
            }} />
            <div style={{
              padding:'20px 24px 16px',
              borderBottom:'1px solid var(--border)',
              flexShrink:0, display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{
                width:44, height:44, borderRadius:13,
                background:'linear-gradient(135deg,var(--p),var(--p2))',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'var(--sh-p)',
              }}><UserPlus size={22} color="#fff" /></div>
              <div style={{flex:1}}>
                <h3 style={{ fontSize:17, fontWeight:'var(--fw-semibold)', color:'var(--text)', margin:0, letterSpacing:'-.3px' }}>
                  {lang === 'en' ? '+ New customer' : lang === 'es' ? '+ Nuevo cliente' : lang === 'it' ? '+ Nuovo cliente' : '+ Nouveau client'}
                </h3>
                <div style={{fontSize:'var(--fs-caption)',color:'var(--text3)',marginTop:2}}>
                  {lang === 'en' ? 'Add a customer to your CRM' : lang === 'es' ? 'Agregue un cliente a su CRM' : lang === 'it' ? 'Aggiungi un cliente al tuo CRM' : 'Ajoutez un client à votre CRM'}
                </div>
              </div>
              <button type="button" aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={()=>setShowCreate(false)} style={{
                width:30, height:30, borderRadius:9,
                background:'var(--bg3)', border:'1px solid var(--border)',
                cursor:'pointer', fontSize:'var(--fs-body)', color:'var(--text3)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>✕</button>
            </div>

            <div style={{
              flex:1, overflowY:'auto', minHeight:0,
              padding:'20px 24px', display:'flex', flexDirection:'column', gap:14,
            }}>
              <div>
                <label style={{ display:'block', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                  {lang === 'en' ? 'NAME / COMPANY *' : lang === 'es' ? 'NOMBRE / EMPRESA *' : lang === 'it' ? 'NOME / INSEGNA *' : 'NOM / ENSEIGNE *'}
                </label>
                <input className="input" autoFocus
                  placeholder={lang === 'en' ? 'Customer name...' : lang === 'es' ? 'Nombre del cliente...' : lang === 'it' ? 'Nome del cliente...' : 'Nom du client...'}
                  value={form.name}
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
              </div>

              <ResponsiveGrid min={160} gap={12}>
                <div>
                  <label style={{ display:'block', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>{i('TYPE', 'TYPE', 'TIPO', 'TIPO')}</label>
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
                <label style={{ display:'block', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>EMAIL</label>
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
                background:'linear-gradient(135deg,var(--p),var(--p2))',
                border:'none', borderRadius:12, color:'#fff', fontSize:'var(--fs-body)', fontWeight:'var(--fw-bold)',
                cursor:'pointer', fontFamily:'var(--font)',
                boxShadow:'var(--sh-p)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
                <CheckCircle size={15} style={{flexShrink:0}} /> {lang === 'en' ? 'Add customer' : lang === 'es' ? 'Agregar el cliente' : lang === 'it' ? 'Aggiungi il cliente' : 'Ajouter le client'}
              </button>
              <button onClick={()=>{setShowCreate(false);resetCustForm()}} style={{
                padding:'13px 18px', background:'var(--bg3)',
                border:'1px solid var(--border)', borderRadius:12,
                cursor:'pointer', color:'var(--text2)', fontSize:'var(--fs-sm)',
                fontFamily:'var(--font)', fontWeight:'var(--fw-regular)',
              }}>
                {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && detailCustomer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={detailCustomer.name} onClick={e => e.target === e.currentTarget && setShowDetailModal(false)}>
          <div ref={detailBoxRef} style={{
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
              background: 'linear-gradient(135deg,color-mix(in srgb, var(--p) 6%, transparent),transparent)',
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
                    return colors[detailCustomer.type] ?? 'linear-gradient(135deg,var(--p),var(--p2))'
                  })(),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)', color: '#fff',
                  boxShadow: '0 6px 20px rgba(108,71,255,.35)',
                }}>
                  {(detailCustomer.name ?? '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>
                      {detailCustomer.name}
                    </h2>
                    <span style={{
                      fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.4px',
                      padding: '3px 10px', borderRadius: 99,
                      background: ({ Grossiste: 'rgba(108,71,255,.15)', 'Semi-gros': 'rgba(255,149,0,.15)', Fidèle: 'rgba(0,208,132,.15)', Détail: 'rgba(0,184,255,.15)' } as Record<string,string>)[detailCustomer.type] ?? 'rgba(108,71,255,.15)',
                      color: ({ Grossiste: 'var(--p3)', 'Semi-gros': 'var(--acc)', Fidèle: 'var(--acc2)', Détail: 'var(--info)' } as Record<string,string>)[detailCustomer.type] ?? 'var(--p3)',
                    }}>
                      {typeLabel(detailCustomer.type, lang)}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginTop: 4 }}>
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
                <button type="button" aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={() => setShowDetailModal(false)} style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  cursor: 'pointer', color: 'var(--text3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-title)', flexShrink: 0,
                }}>✕</button>
              </div>
            </div>

            {/* Corps scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  // `hex` = HEX LITTÉRAL (concaténé `${k.hex}25`/`15`/`05` pour bord + dégradé) : un
                  // var(--x) s'y casse en silence. `color` reste un token (usage direct `color:k.color`).
                  { label: i('CA Total', 'Total Revenue', 'Ingresos totales', 'Fatturato totale'), value: fmt(detailCustomer.totalCA), icon: <DollarSign size={20} />, color: 'var(--acc)', hex: '#FFB020' },
                  { label: i('Commandes/mois', 'Orders/month', 'Pedidos/mes', 'Ordini/mese'), value: purchaseRateLabel(detailCustomer.purchasesPerMonth, lang), icon: <ShoppingCart size={20} />, color: 'var(--p2)', hex: '#6C47FF' },
                  { label: i('Points fidélité', 'Loyalty pts', 'Puntos fidelidad', 'Punti fedeltà'), value: `${detailCustomer.loyaltyPoints} pts`, icon: <Star size={20} />, color: 'var(--warn)', hex: '#FFC53D' },
                ].map(k => (
                  <div key={k.label} style={{ background: `linear-gradient(135deg,${k.hex}15,${k.hex}05)`, border: `1px solid ${k.hex}25`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom: 6, color: k.color }}>{k.icon}</div>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', color: k.color, fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>{k.value}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginTop: 4 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Coordonnées */}
              <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text3)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {item.icon}{item.label}
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-regular)', color: 'var(--text)', wordBreak: 'break-all' }}>{item.value}</div>
                    </div>
                  ))}
                </ResponsiveGrid>
                {detailCustomer.notes && (
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(91,78,232,.08)', border: '1px solid rgba(91,78,232,.2)', fontSize: 'var(--fs-label)', color: 'var(--p3)', display:'flex', alignItems:'flex-start', gap:6 }}>
                    <StickyNote size={12} style={{flexShrink:0,marginTop:1}} /> {detailCustomer.notes}
                  </div>
                )}
              </div>

              {/* Programme fidélité */}
              <div style={{ background: 'linear-gradient(135deg,color-mix(in srgb, var(--warn) 6%, transparent),color-mix(in srgb, var(--warn) 2%, transparent))', border: '1px solid color-mix(in srgb, var(--warn) 15%, transparent)', borderRadius: 14, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={12} style={{color:'var(--warn)'}} /> {i('PROGRAMME FIDÉLITÉ', 'LOYALTY PROGRAM', 'PROGRAMA FIDELIDAD', 'PROGRAMMA FEDELTÀ')}
                  </div>
                  <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--warn)', fontFamily: 'var(--mono)' }}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-caption)', marginBottom: 6 }}>
                        <span style={{ fontWeight: 'var(--fw-semibold)', color: current.color, display:'inline-flex', alignItems:'center', gap:4 }}><Star size={11} style={{color:current.color}} /> {current.name}</span>
                        {next && <span style={{ color: 'var(--text3)' }}>{next.min - pts} pts → {next.name}</span>}
                      </div>
                      <div style={{ height: 8, background: 'var(--bg5,var(--bg4))', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg,${current.color},${next?.color ?? current.color})`, borderRadius: 99, transition: 'width .5s ease' }} />
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginTop: 4 }}>{pct}%</div>
                    </div>
                  )
                })()}
              </div>

              {/* Historique achats */}
              <div>
                <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingBag size={12} style={{color:'var(--text3)'}} /> {i('HISTORIQUE DES ACHATS', 'PURCHASE HISTORY', 'HISTORIAL DE COMPRAS', 'STORICO ACQUISTI')}
                </div>
                {purchases.rows.length === 0 ? (
                  <div role={purchasesEmptyLabel ? 'status' : undefined} style={{ textAlign: 'center', padding: '28px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom: 8 }}><ShoppingCart size={28} style={{color:'var(--text4)'}} /></div>
                    {purchasesEmptyLabel ?? i('Aucun achat enregistré', 'No purchases recorded', 'Sin compras registradas', 'Nessun acquisto registrato')}
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table aria-label={i('Historique des achats', 'Purchase history', 'Historial de compras', 'Storico acquisti')}>
                      <thead>
                        <tr>
                          <th scope="col">{i('RÉFÉRENCE', 'REF', 'REF', 'RIF')}</th>
                          <th scope="col">DATE</th>
                          <th scope="col">{i('ARTICLES', 'ITEMS', 'ARTÍCULOS', 'ARTICOLI')}</th>
                          <th scope="col">{i('MONTANT', 'AMOUNT', 'IMPORTE', 'IMPORTO')}</th>
                          <th scope="col">STATUT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.rows.map(p => (
                          <tr key={p.ref}>
                            <td className="td-mono" style={{ fontSize: 'var(--fs-caption)', color: 'var(--p3)' }}>{p.ref}</td>
                            <td style={{ fontSize: 'var(--fs-caption)', color: 'var(--text2)' }}>{fmtDate(p.date)}</td>
                            <td style={{ fontSize: 'var(--fs-caption)', color: 'var(--text2)' }}>{p.items} art.</td>
                            <td className="td-mono" style={{ color: p.refunded ? 'var(--text3)' : 'var(--acc2)', fontWeight: 'var(--fw-semibold)', textDecoration: p.refunded ? 'line-through' : undefined }}>{fmt(p.total)}</td>
                            {/* Le statut était le littéral « ✓ Payé » — vrai tant que la table
                                était vide, faux dès la 1ʳᵉ vente remboursée qui s'y affiche.
                                ⚠️ Le vert était écrit `badge-ok`, classe qui n'existe dans aucune
                                feuille livrée : le « Payé » se rendait en badge NEUTRE à côté d'un
                                « Remboursé » rouge. La classe verte du système s'appelle
                                `badge-green` — définir `badge-ok` aurait créé un second nom pour
                                la même règle. */}
                            <td>{p.refunded
                              ? <span className="badge badge-red">{i('Remboursé', 'Refunded', 'Reembolsado', 'Rimborsato')}</span>
                              : <span className="badge badge-green">✓ {i('Payé', 'Paid', 'Pagado', 'Pagato')}</span>}</td>
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
                fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', cursor: 'pointer',
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
                cursor: 'pointer', color: 'var(--text2)', fontSize: 'var(--fs-sm)',
                fontFamily: 'var(--font)', fontWeight: 'var(--fw-regular)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Pencil size={13} /> {i('Modifier', 'Edit', 'Editar', 'Modifica')}
              </button>
              <button onClick={() => setShowDetailModal(false)} style={{
                padding: '12px 16px', background: 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 12,
                cursor: 'pointer', color: 'var(--text2)', fontSize: 'var(--fs-sm)',
                fontFamily: 'var(--font)', fontWeight: 'var(--fw-regular)',
              }}>
                {i('Fermer', 'Close', 'Cerrar', 'Chiudi')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carte fidélité numérique — le gate programme actif vit AU CLIC (Customers.tsx
          openLoyaltyCard : toast si désactivé) ; ici on rend dès qu'un id est posé,
          la carte fetch la donnée serveur autoritaire. Un gate supplémentaire sur
          tenant?.enableLoyalty rendait le clic MORT (tenant périmé/absent → rien). */}
      {digitalCardCustomerId && setDigitalCardCustomerId && (
        <Suspense fallback={null}>
          <LoyaltyCardDigital customerId={digitalCardCustomerId} onClose={() => setDigitalCardCustomerId(null)} />
        </Suspense>
      )}
    </>
  )
}
