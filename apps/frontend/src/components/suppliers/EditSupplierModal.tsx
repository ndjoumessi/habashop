import { useConfig, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { Factory, X, Eye, Pencil, Trash2 } from 'lucide-react'
import ViewField from '@/components/ui/ViewField'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import { STATUS_LIST, statusLabel } from './suppliersShared'
import type { Supplier, SupplierStatus } from './suppliersShared'

interface EditSuppForm {
  name: string; categories: string; phone: string; email: string; address: string
  contact: string; leadTime: number; rating: number; status: SupplierStatus; notes: string
}

interface Props {
  editSupplier: Supplier
  editSuppForm: EditSuppForm
  setEditSuppForm: (fn: (p: EditSuppForm) => EditSuppForm) => void
  suppEditMode: boolean
  setSuppEditMode: (v: boolean) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
}

export default function EditSupplierModal(props: Props) {
  const { editSupplier, editSuppForm, setEditSuppForm, suppEditMode, setSuppEditMode, onClose, onSave, onDelete } = props
  const { lang } = useConfig()
  const { i } = useI18n()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Factory size={15}/> {editSupplier.name}</h3>
          <button aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Mode banner */}
        {!suppEditMode
          ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
              <Eye size={13} style={{ color:'var(--acc3)', flexShrink:0 }} />
              <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:600 }}>
                {i('Mode visualisation — cliquez sur Modifier pour éditer', 'View mode — click Edit to make changes', 'Modo visualización — clic en Editar para cambiar', 'Modalità visualizzazione — clicca Modifica per cambiare')}
              </span>
            </div>
          : <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
              <Pencil size={13} style={{ color:'var(--warn)', flexShrink:0 }} />
              <span style={{ fontSize:12, color:'var(--warn)', fontWeight:600 }}>
                {i('Mode édition — modifications non sauvegardées', 'Edit mode — unsaved changes', 'Modo edición — cambios sin guardar', 'Modalità modifica — modifiche non salvate')}
              </span>
            </div>
        }

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <ViewField label={i('NOM / RAISON SOCIALE', 'NAME / COMPANY', 'NOMBRE / EMPRESA', 'NOME / AZIENDA')} value={editSuppForm.name} fullWidth editing={suppEditMode}>
            <input className="input text-sm" value={editSuppForm.name}
              onChange={e => setEditSuppForm(p => ({...p, name:e.target.value}))} />
          </ViewField>
          <ViewField label={i('CONTACT PRINCIPAL', 'MAIN CONTACT', 'CONTACTO PRINCIPAL', 'CONTATTO PRINCIPALE')} value={editSuppForm.contact||''} editing={suppEditMode}>
            <input className="input text-sm" value={editSuppForm.contact}
              onChange={e => setEditSuppForm(p => ({...p, contact:e.target.value}))} />
          </ViewField>
          <ViewField label="EMAIL" value={editSuppForm.email||''} editing={suppEditMode}>
            <input className="input text-sm" value={editSuppForm.email}
              onChange={e => setEditSuppForm(p => ({...p, email:e.target.value}))} />
          </ViewField>
          <ViewField label={i('CATÉGORIES (séparées par ,)', 'CATEGORIES (comma-separated)', 'CATEGORÍAS (separadas por ,)', 'CATEGORIE (separate da ,)')} value={editSuppForm.categories||''} fullWidth editing={suppEditMode}>
            <input className="input text-sm" value={editSuppForm.categories}
              onChange={e => setEditSuppForm(p => ({...p, categories:e.target.value}))} />
          </ViewField>
          <ViewField label={i('ADRESSE', 'ADDRESS', 'DIRECCIÓN', 'INDIRIZZO')} value={editSuppForm.address||''} fullWidth editing={suppEditMode}>
            <AddressAutocompleteInput value={editSuppForm.address}
              onChange={v => setEditSuppForm(p => ({...p, address:v}))} lang={lang} />
          </ViewField>
          <ViewField label={i('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO')} value={editSuppForm.phone||''} icon="📞" editing={suppEditMode}>
            <PhoneInputWithCountry value={editSuppForm.phone} onChange={v => setEditSuppForm(p => ({...p, phone:v}))} lang={lang} />
          </ViewField>
          <ViewField label={i('DÉLAI LIVRAISON', 'LEAD TIME', 'PLAZO ENTREGA', 'TEMPO CONSEGNA')} value={`${editSuppForm.leadTime} ${i('jours', 'days', 'días', 'giorni')}`} editing={suppEditMode}>
            <input className="input text-sm" type="number" value={editSuppForm.leadTime}
              onChange={e => setEditSuppForm(p => ({...p, leadTime:+e.target.value}))} />
          </ViewField>
          <ViewField label={i('NOTE', 'RATING', 'VALORACIÓN', 'VALUTAZIONE')} value={`${editSuppForm.rating}/5`} editing={suppEditMode}>
            <input className="input text-sm" type="number" min={1} max={5} value={editSuppForm.rating}
              onChange={e => setEditSuppForm(p => ({...p, rating:+e.target.value}))} />
          </ViewField>
          <ViewField label="STATUT" value={statusLabel(editSuppForm.status, lang)} editing={suppEditMode}>
            <select className="input text-sm" value={editSuppForm.status}
              onChange={e => setEditSuppForm(p => ({...p, status:e.target.value as SupplierStatus}))}>
              {STATUS_LIST.map(s => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
            </select>
          </ViewField>
          <ViewField label="NOTES" value={editSuppForm.notes||''} fullWidth editing={suppEditMode}>
            <textarea className="input text-sm" rows={2} value={editSuppForm.notes}
              onChange={e => setEditSuppForm(p => ({...p, notes:e.target.value}))} />
          </ViewField>
        </div>

        <div className="flex gap-2 mt-5">
          {!suppEditMode ? (
            <>
              <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:6 }} onClick={() => setSuppEditMode(true)}><Pencil size={13} /> {i('Modifier', 'Edit', 'Editar', 'Modifica')}</button>
              <button className="btn btn-ghost" style={{ color:'var(--danger)', display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}
                aria-label={i('Supprimer le fournisseur', 'Delete supplier', 'Eliminar proveedor', 'Elimina fornitore')}
                onClick={onDelete}><Trash2 size={13} /> {i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}</button>
              <button className="btn btn-ghost" onClick={onClose}>{i('Fermer', 'Close', 'Cerrar', 'Chiudi')}</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => {
                setEditSuppForm(() => ({ name:editSupplier.name, categories:editSupplier.categories.join(', '), phone:editSupplier.phone, email:editSupplier.email??'', address:editSupplier.address??'', contact:editSupplier.contact??'', leadTime:editSupplier.leadTime??3, rating:editSupplier.rating??3, status:editSupplier.status??'Actif', notes:editSupplier.notes??'' }))
                setSuppEditMode(false)
              }}>{t('btn_cancel')}</button>
              <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer' }} onClick={onSave}>{i('Enregistrer', 'Save', 'Guardar', 'Salva')}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
