import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { suppliersApi, ordersApi } from '@/lib/api'
import { Plus } from 'lucide-react'
import { confirm } from '@/lib/confirm'
import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import { exportCSV, openPDF, htmlTable } from '@/utils/export'
import { usePagination } from '@/hooks/usePagination'
import {
  statusLabel, mapApiSupplier,
  type Supplier, type SupplierStatus,
} from '@/components/suppliers/suppliersShared'
import SuppliersKpis from '@/components/suppliers/SuppliersKpis'
import { summarizeRatings } from '@/lib/ratingSummary'
import SuppliersTable from '@/components/suppliers/SuppliersTable'
import SupplierViewModal from '@/components/suppliers/SupplierViewModal'
import EditSupplierModal from '@/components/suppliers/EditSupplierModal'
import NewSupplierModal from '@/components/suppliers/NewSupplierModal'

export default function Suppliers() {
  const navigate = useNavigate()
  const { lang } = useConfig()
  const { i } = useI18n()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  // KPI « commandes en cours » : compté sur les VRAIES commandes (#214). Il se calculait
  // avant sur `supplier.orders`, un tableau toujours vide → le KPI affichait 0 en
  // permanence, y compris avec des commandes en transit. `null` = pas encore su (l'écran
  // montre « — »), jamais un 0 qui affirmerait « aucune commande en cours ».
  const [pendingOrders, setPendingOrders] = useState<number | null>(null)

  useEffect(() => {
    suppliersApi.list()
      .then(data => setSuppliers(data.map(mapApiSupplier)))
      .catch(() => toast.error(i('Impossible de charger les fournisseurs — réessayer', 'Could not load suppliers — please retry', 'No se pudieron cargar los proveedores — reintenta', 'Impossibile caricare i fornitori — riprova')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Statuts du FIL ('SENT'/'CONFIRMED'/'IN_TRANSIT'), pas les libellés d'écran : filtrer
    // sur 'ENVOYÉE'/'CONFIRMÉE' ici ne matcherait jamais rien.
    ordersApi.list()
      .then(list => setPendingOrders((list ?? []).filter(o => ['SENT', 'CONFIRMED', 'IN_TRANSIT'].includes(o.status)).length))
      .catch(() => setPendingOrders(null))
  }, [])

  useEffect(() => {
    const handler = () => setShowCreate(true)
    window.addEventListener('habashop:new-supplier', handler)
    return () => window.removeEventListener('habashop:new-supplier', handler)
  }, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | ''>('')
  const [catFilter, setCatFilter] = useState('')
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '', categories: '', phone: '', email: '', address: '',
    contact: '', leadTime: 5, rating: null as number | null, status: 'Actif' as SupplierStatus, notes: '',
  })
  const [editSupplier,     setEditSupplier]     = useState<Supplier | null>(null)
  const [showEditSuppModal, setShowEditSuppModal] = useState(false)
  const [suppEditMode,     setSuppEditMode]     = useState(false)
  const [editSuppForm,     setEditSuppForm]     = useState({
    name: '', categories: '', phone: '', email: '', address: '',
    contact: '', leadTime: 5, rating: null as number | null, status: 'Actif' as SupplierStatus, notes: '',
  })

  const allCats = Array.from(new Set(suppliers.flatMap(s => s.categories)))

  const filtered = suppliers.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.contact.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || s.status === statusFilter) &&
    (!catFilter || s.categories.includes(catFilter))
  )
  const pg = usePagination(filtered, 15)
  useEffect(() => { pg.reset() }, [search, statusFilter, catFilter])

  const actifs    = suppliers.filter(s => s.status === 'Actif').length
  const enCours   = pendingOrders
  /**
   * ⚠️ JUMEAU EXACT de la performance RH (`HRStatsBar`) — même défaut, corrigé en même temps.
   * Avant : `Number(sup.rating) || 0` sur TOUS les fournisseurs, divisé par `suppliers.length`.
   * Un fournisseur non noté comptait donc pour **0** dans la moyenne (et non « pas compté »),
   * ce qui tirait le chiffre vers le bas d'autant plus qu'il y avait de non-évalués. Le
   * dénominateur était l'effectif TOTAL, pas l'effectif ÉVALUÉ.
   */
  const ratingSummary = summarizeRatings(suppliers.map(s => s.rating))

  const printSuppliersPDF = () => {
    const body = `
      <h2>${t('suppliers_pdf_title')}</h2>
      ${htmlTable(
        [t('col_name'), t('col_category'), t('col_phone'), t('col_delivery'), t('col_rating'), t('col_status')],
        suppliers.map(s => [
          s.name,
          s.categories.join(', '),
          s.phone,
          s.leadTime + ' j',
          // ⚠️ Note absente = « Non évalué », jamais 0 étoile ni « null/5 ».
          s.rating == null ? t('rating_not_rated') : '⭐'.repeat(s.rating) + ' (' + s.rating + '/5)',
          s.status === 'Actif'
            ? `<span class="badge badge-green">${t('status_active')}</span>`
            : s.status === 'Pause'
            ? `<span class="badge badge-amber">${t('status_pending')}</span>`
            : `<span class="badge badge-red">${t('status_inactive')}</span>`,
        ])
      )}
    `
    openPDF(t('suppliers_pdf_title'), body)
  }

  const exportSuppliersCSV = () => {
    exportCSV('habashop_fournisseurs',
      [t('col_name'), t('col_category'), t('col_phone'), t('col_delivery'), t('col_rating'), t('col_status')],
      suppliers.map(s => [s.name, s.categories.join(', '), s.phone, s.leadTime + 'j', s.rating == null ? t('rating_not_rated') : s.rating + '/5', statusLabel(s.status, lang)])
    )
    toast.success(i('Export CSV téléchargé !', 'CSV export downloaded!', 'Exportación CSV descargada!', 'Esportazione CSV scaricata!'))
  }

  const addSupplier = async () => {
    const newS: Supplier = {
      id: String(Date.now()),
      name: form.name,
      categories: form.categories.split(',').map(c => c.trim()).filter(Boolean),
      phone: form.phone, email: form.email, address: form.address,
      contact: form.contact, leadTime: form.leadTime, rating: form.rating,
      status: form.status, notes: form.notes,
    }
    try {
      const created = await suppliersApi.create({ name: form.name, categories: form.categories, phone: form.phone, email: form.email, address: form.address, leadTime: form.leadTime, rating: form.rating, status: form.status, notes: form.notes })
      newS.id = created.id
    } catch {
      toast.error(i('Échec de la création — réessayer', 'Creation failed — please retry', 'Error al crear — reintenta', 'Creazione non riuscita — riprova'))
      return
    }
    setSuppliers(prev => [newS, ...prev])
    setShowCreate(false)
    setForm({ name: '', categories: '', phone: '', email: '', address: '', contact: '', leadTime: 5, rating: null, status: 'Actif', notes: '' })
    toast.success(i(`Fournisseur ${newS.name} ajouté !`, `Supplier ${newS.name} added!`, `Proveedor ${newS.name} añadido!`, `Fornitore ${newS.name} aggiunto!`))
    announce(i('Fournisseur ajouté', 'Supplier added', 'Proveedor añadido', 'Fornitore aggiunto'))
  }

  const handleDeleteSupplier = async (s: Supplier) => {
    const ok = await confirm({
      title: i('Supprimer le fournisseur', 'Delete supplier', 'Eliminar proveedor', 'Elimina fornitore'),
      message: i(`Supprimer définitivement « ${s.name} » ? Cette action est irréversible.`, `Permanently delete "${s.name}"? This action is irreversible.`, `¿Eliminar definitivamente "${s.name}"? Esta acción es irreversible.`, `Eliminare definitivamente "${s.name}"? Questa azione è irreversibile.`),
      danger: true,
    })
    if (!ok) return
    try {
      await suppliersApi.delete(s.id)
      setSuppliers(prev => prev.filter(x => x.id !== s.id))
      if (editSupplier?.id === s.id) setShowEditSuppModal(false)
      toast.success(i('Fournisseur supprimé', 'Supplier deleted', 'Proveedor eliminado', 'Fornitore eliminato'))
      announce(i('Fournisseur supprimé', 'Supplier deleted', 'Proveedor eliminado', 'Fornitore eliminato'))
    } catch {
      toast.error(i('Échec de la suppression — réessayer', 'Delete failed — please retry', 'Error al eliminar — reintenta', 'Eliminazione fallita — riprova'))
    }
  }

  const openEdit = (s: Supplier) => {
    setEditSupplier(s)
    setEditSuppForm({
      name: s.name, categories: s.categories.join(', '), phone: s.phone,
      email: s.email ?? '', address: s.address ?? '', contact: s.contact ?? '',
      leadTime: s.leadTime ?? 3, rating: s.rating ?? null,
      status: s.status ?? 'Actif', notes: s.notes ?? '',
    })
    setSuppEditMode(false)
    setShowEditSuppModal(true)
  }

  const saveEditSupplier = async () => {
    if (!editSupplier) return
    if (!editSuppForm.name) { toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto')); return }
    try { await suppliersApi.update(editSupplier.id, { name: editSuppForm.name, categories: editSuppForm.categories, phone: editSuppForm.phone, email: editSuppForm.email, address: editSuppForm.address, leadTime: editSuppForm.leadTime, rating: editSuppForm.rating, status: editSuppForm.status, notes: editSuppForm.notes }) } catch {
      toast.error(i('Échec de la sauvegarde — réessayer', 'Save failed — please retry', 'Error al guardar — reintenta', 'Salvataggio non riuscito — riprova'))
      return
    }
    setSuppliers(prev => prev.map(s =>
      s.id === editSupplier.id
        ? { ...s, ...editSuppForm, categories: editSuppForm.categories.split(',').map(c => c.trim()).filter(Boolean) }
        : s
    ))
    setShowEditSuppModal(false)
    toast.success(i(`${editSuppForm.name} mis à jour`, `${editSuppForm.name} updated`, `${editSuppForm.name} actualizado`, `${editSuppForm.name} aggiornato`))
    announce(i('Fournisseur mis à jour', 'Supplier updated', 'Proveedor actualizado', 'Fornitore aggiornato'))
  }

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_suppliers')}</h1>
          <p className="page-subtitle">{suppliers.length} {i('fournisseurs enregistrés', 'registered suppliers', 'proveedores registrados', 'fornitori registrati')}</p>
        </div>
        <button className="topbar-btn" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> {i('Nouveau fournisseur', 'New supplier', 'Nuevo proveedor', 'Nuovo fornitore')}
        </button>
      </div>

      <SuppliersKpis total={suppliers.length} actifs={actifs} enCours={enCours} ratingSummary={ratingSummary} lang={lang} />

      <SuppliersTable
        loading={loading}
        filtered={filtered}
        pg={pg}
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        catFilter={catFilter} setCatFilter={setCatFilter}
        allCats={allCats}
        onExportCSV={exportSuppliersCSV}
        onPrintPDF={() => { printSuppliersPDF(); toast.success(i('PDF ouvert !', 'PDF opened!', 'PDF abierto!', 'PDF aperto!')) }}
        onAdd={() => setShowCreate(true)}
        onView={setViewSupplier}
        onEdit={openEdit}
        onDelete={handleDeleteSupplier}
        onCall={(s) => toast.success(`${s.phone}`)}
        onOrder={() => navigate('/app/orders')}
      />

      {viewSupplier && (
        <SupplierViewModal
          supplier={viewSupplier}
          onClose={() => setViewSupplier(null)}
          onNewOrder={() => { setViewSupplier(null); navigate('/app/orders') }}
        />
      )}

      {showEditSuppModal && editSupplier && (
        <EditSupplierModal
          editSupplier={editSupplier}
          editSuppForm={editSuppForm}
          setEditSuppForm={setEditSuppForm}
          suppEditMode={suppEditMode}
          setSuppEditMode={setSuppEditMode}
          onClose={() => setShowEditSuppModal(false)}
          onSave={saveEditSupplier}
          onDelete={() => editSupplier && handleDeleteSupplier(editSupplier)}
        />
      )}

      {showCreate && (
        <NewSupplierModal
          form={form}
          setForm={setForm}
          onClose={() => setShowCreate(false)}
          onCreate={addSupplier}
        />
      )}
    </div>
  )
}
