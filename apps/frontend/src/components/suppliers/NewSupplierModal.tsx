import { useConfig, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { Plus, X, Star, CheckCircle } from 'lucide-react'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import { STATUS_LIST, STATUS_COLOR, statusLabel } from './suppliersShared'
import type { SupplierStatus } from './suppliersShared'

interface NewForm {
  name: string; categories: string; phone: string; email: string; address: string
  contact: string; leadTime: number; rating: number; status: SupplierStatus; notes: string
}

interface Props {
  form: NewForm
  setForm: (fn: (p: NewForm) => NewForm) => void
  onClose: () => void
  onCreate: () => void
}

export default function NewSupplierModal({ form, setForm, onClose, onCreate }: Props) {
  const { lang } = useConfig()
  const { i } = useI18n()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540 }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Plus size={15}/> {i('Nouveau fournisseur', 'New supplier', 'Nuevo proveedor', 'Nuovo fornitore')}</h3>
          <button aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: i('Nom / Raison sociale', 'Name / Company', 'Nombre / Empresa', 'Nome / Azienda'),         key: 'name',       type: 'text',   span: true  },
            { label: i('Contact principal', 'Main contact', 'Contacto principal', 'Contatto principale'),             key: 'contact',    type: 'text',   span: false },
            { label: 'Email',                         key: 'email',      type: 'email',  span: false },
            { label: i('Catégories (séparées par , )', 'Categories (comma-separated)', 'Categorías (separadas por ,)', 'Categorie (separate da ,)'),  key: 'categories', type: 'text',   span: true  },
            { label: i('Délai livraison (jours)', 'Lead time (days)', 'Plazo entrega (días)', 'Tempo consegna (giorni)'),       key: 'leadTime',   type: 'number', span: false },
          ].map(f => (
            <div key={f.key} className={f.span ? 'col-span-2' : ''}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--text3)' }}>{f.label}</label>
              <input className="input text-sm" type={f.type}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? +e.target.value : e.target.value }))} />
            </div>
          ))}
          {/* Rating — clickable stars */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{i('Note (1-5)', 'Rating (1-5)', 'Valoración (1-5)', 'Valutazione (1-5)')}</label>
            <div style={{ display: 'flex', gap: 4, height: 38, alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button aria-label={`${i('Note', 'Rating', 'Valoración', 'Valutazione')} ${s}/5`} key={s} type="button" onClick={() => setForm(p => ({ ...p, rating: s }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', display: 'flex' }}>
                  <Star size={20} style={{ color: s <= form.rating ? '#F0A500' : 'var(--border2)', fill: s <= form.rating ? '#F0A500' : 'none', transition: 'all .15s' }} />
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <AddressAutocompleteInput
              label={i('ADRESSE', 'ADDRESS', 'DIRECCIÓN', 'INDIRIZZO')}
              value={form.address}
              onChange={v => setForm(p => ({ ...p, address: v }))}
              lang={lang}
            />
          </div>
          <div className="col-span-2">
            <PhoneInputWithCountry
              label={i('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO')}
              value={form.phone}
              onChange={v => setForm(p => ({ ...p, phone: v }))}
              lang={lang}
            />
          </div>
          {/* Statut — pill buttons */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>STATUT</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUS_LIST.map(s => {
                const active = form.status === s
                const color = STATUS_COLOR[s]
                return (
                  <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))}
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: `1px solid ${active ? color + '55' : 'var(--border)'}`, background: active ? color + '18' : 'transparent', color: active ? color : 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, transition: 'all .15s' }}>
                    {statusLabel(s, lang)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
            <textarea aria-label="Notes" className="input text-sm" rows={2} value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn btn-primary flex-1 justify-center" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={!form.name.trim()} onClick={onCreate}><CheckCircle size={13}/> {i('Créer le fournisseur', 'Create supplier', 'Crear proveedor', 'Crea fornitore')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
        </div>
      </div>
    </div>
  )
}
