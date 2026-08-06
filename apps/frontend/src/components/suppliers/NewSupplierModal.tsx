import { useState } from 'react'
import { useConfig, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { useModalFocus } from '@/hooks/useModalFocus'
import { Plus, X, Star, CheckCircle } from 'lucide-react'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import IconButton from '@/components/ui/IconButton'
import { STATUS_LIST, STATUS_COLOR, statusLabel } from './suppliersShared'
import type { SupplierStatus } from './suppliersShared'

interface NewForm {
  name: string; categories: string; phone: string; email: string; address: string
  // `null` = non évalué. ⚠️ Un formulaire qui démarre à 4 écrit une note que personne
  // n'a donnée — c'est le `perf ?? 3` du serveur, déplacé dans l'interface.
  contact: string; leadTime: number; rating: number | null; status: SupplierStatus; notes: string
}

interface Props {
  form: NewForm
  setForm: (fn: (p: NewForm) => NewForm) => void
  onClose: () => void
  onCreate: () => void
}

export default function NewSupplierModal({ form, setForm, onClose, onCreate }: Props) {
  // ⚠️ Le CTA « Créer » n'est plus éteint par la validation : il nomme ce qui manque.
  const [showMissing, setShowMissing] = useState(false)
  const { lang } = useConfig()
  const { i } = useI18n()
  const boxRef = useModalFocus<HTMLDivElement>()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i('Nouveau fournisseur', 'New supplier', 'Nuevo proveedor', 'Nuovo fornitore')} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 540 }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Plus size={15}/> {i('Nouveau fournisseur', 'New supplier', 'Nuevo proveedor', 'Nuovo fornitore')}</h3>
          <IconButton label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} icon={<X size={14} />} onClick={onClose} variant="surface" />
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
                // ⚠️ Re-cliquer l'étoile courante REMET à « non évalué » : sans ce retour en
                // arrière, une note posée par erreur serait indéfectible et l'état vide
                // deviendrait inatteignable dès le premier clic.
                <button aria-label={`${i('Note', 'Rating', 'Valoración', 'Valutazione')} ${s}/5`} key={s} type="button"
                  onClick={() => setForm(p => ({ ...p, rating: p.rating === s ? null : s }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', display: 'flex' }}>
                  <Star size={20} style={{ color: form.rating != null && s <= form.rating ? '#F0A500' : 'var(--border2)', fill: form.rating != null && s <= form.rating ? '#F0A500' : 'none', transition: 'all .15s' }} />
                </button>
              ))}
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginLeft: 6, fontStyle: form.rating == null ? 'italic' : 'normal' }}>
                {form.rating == null ? i('Non évalué', 'Not rated', 'Sin evaluar', 'Non valutato') : `${form.rating}/5`}
              </span>
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
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: `1px solid ${active ? color + '55' : 'var(--border)'}`, background: active ? color + '18' : 'transparent', color: active ? color : 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', transition: 'all .15s' }}>
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
        {showMissing && (
          <div role="status" aria-live="polite" className="mt-4" style={{
            padding: '9px 12px', borderRadius: 9,
            background: 'var(--c-orange-bg)', border: '1px solid var(--c-orange-border)',
            color: 'var(--text2)', fontSize: 'var(--fs-sm)',
          }}>
            {i('Il manque encore : le nom / la raison sociale', 'Still missing: the name / company name', 'Todavía falta: el nombre / razón social', 'Manca ancora: il nome / ragione sociale')}
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button className="btn btn-primary flex-1 justify-center" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={() => { if (!form.name.trim()) { setShowMissing(true); return } setShowMissing(false); onCreate() }}><CheckCircle size={13}/> {i('Créer le fournisseur', 'Create supplier', 'Crear proveedor', 'Crea fornitore')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('btn_cancel')}</button>
        </div>
      </div>
    </div>
  )
}
