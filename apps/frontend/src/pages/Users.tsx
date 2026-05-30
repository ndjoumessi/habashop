import { useState, useEffect } from 'react'
import { useConfig } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { usersApi } from '@/lib/api'
import { confirm } from '@/lib/confirm'
import toast from 'react-hot-toast'
import {
  mapApiUser,
  type Role, type User,
} from '@/components/users/usersShared'
import UsersKpis from '@/components/users/UsersKpis'
import RolesMatrix from '@/components/users/RolesMatrix'
import UsersToolbar from '@/components/users/UsersToolbar'
import UserCard from '@/components/users/UserCard'
import EditUserModal from '@/components/users/EditUserModal'
import InviteUserModal from '@/components/users/InviteUserModal'

export default function Users() {
  const { lang } = useConfig()
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const currentUser = useAuthStore(s => s.user)
  const currentRole = String(currentUser?.role ?? '').toUpperCase()
  const isAdmin = currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN'
  const canToggle2FA = (uid: string) => isAdmin || uid === currentUser?.id

  const [users, setUsers]           = useState<User[]>([])
  const [search, setSearch]         = useState('')

  useEffect(() => {
    usersApi.list()
      .then((data: any[]) => { if (Array.isArray(data)) setUsers(data.map(mapApiUser)) })
      .catch(() => {})
  }, [])

  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState({ name:'', email:'', role:'CASHIER' as Role, password:'', confirm:'' })
  const [showPwd, setShowPwd]       = useState(false)
  const [editUser, setEditUser]     = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm]     = useState({ name:'', email:'', role:'CASHIER' as Role, active:true, twoFA:false })

  const filtered = users.filter(u =>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter)
  )

  const toggleActive = async (id: string) => {
    const u = users.find(x => x.id === id)
    if (!u) return
    const next = !u.active
    try {
      await usersApi.toggleActive(id, next)
      setUsers(prev => prev.map(x => x.id === id ? { ...x, active: next } : x))
      toast.success(next
        ? i('Compte activé', 'Account activated', 'Cuenta activada', 'Account attivato')
        : i('Compte désactivé', 'Account deactivated', 'Cuenta desactivada', 'Account disattivato')
      )
    } catch (e: any) {
      toast.error(`${i('Échec', 'Failed', 'Error', 'Errore')} : ${e?.message ?? ''}`)
    }
  }

  const toggle2FA = async (id: string) => {
    const u = users.find(x => x.id === id)
    if (!u) return
    const next = !u.twoFA
    try {
      await usersApi.toggle2FA(id, next)
      setUsers(prev => prev.map(x => x.id === id ? { ...x, twoFA: next } : x))
      toast.success(i('2FA mis à jour', '2FA updated', '2FA actualizado', '2FA aggiornato'))
    } catch (e: any) {
      toast.error(`${i('Échec', 'Failed', 'Error', 'Errore')} : ${e?.message ?? ''}`)
    }
  }

  const invite = async () => {
    if (!form.name || !form.email) {
      toast.error(i('Remplissez tous les champs', 'Fill in all fields', 'Complete todos los campos', 'Compila tutti i campi'))
      return
    }
    if (form.password !== form.confirm) {
      toast.error(i('Mots de passe différents', 'Passwords do not match', 'Las contraseñas no coinciden', 'Le password non corrispondono'))
      return
    }
    try {
      const created = await usersApi.invite({ name: form.name, email: form.email, role: form.role, password: form.password })
      setUsers(prev => [...prev, mapApiUser(created)])
      setShowModal(false)
      setForm({ name:'', email:'', role:'CASHIER', password:'', confirm:'' })
      toast.success(i(`${form.name} invité(e)`, `${form.name} invited`, `${form.name} invitado(a)`, `${form.name} invitato(a)`))
    } catch (e: any) {
      toast.error(`${i('Échec invitation', 'Invitation failed', 'Error de invitación', 'Invito fallito')} : ${e?.message ?? ''}`)
    }
  }

  const handleDelete = async (u: User) => {
    const ok = await confirm({
      title: i('Supprimer cet utilisateur ?', 'Delete this user?', '¿Eliminar este usuario?', 'Eliminare questo utente?'),
      message: i(
        `${u.name} (${u.email}) perdra l'accès immédiatement. Cette action peut être annulée par un administrateur.`,
        `${u.name} (${u.email}) will lose access immediately. This action can be reversed by an administrator.`,
        `${u.name} (${u.email}) perderá el acceso inmediatamente. Esta acción puede ser revertida por un administrador.`,
        `${u.name} (${u.email}) perderà l'accesso immediatamente. Questa azione può essere annullata da un amministratore.`,
      ),
      danger: true,
    })
    if (!ok) return
    try {
      await usersApi.delete(u.id)
      setUsers(prev => prev.filter(x => x.id !== u.id))
      toast.success(i('Utilisateur supprimé', 'User deleted', 'Usuario eliminado', 'Utente eliminato'))
    } catch (e: any) {
      toast.error(`${i('Échec suppression', 'Delete failed', 'Error al eliminar', 'Eliminazione fallita')} : ${e?.message ?? ''}`)
    }
  }

  const saveEdit = async () => {
    if (!editUser) return
    if (!editForm.name || !editForm.email) {
      toast.error(i('Nom et email requis', 'Name and email required', 'Nombre y email requeridos', 'Nome ed email richiesti'))
      return
    }
    try {
      const updated = await usersApi.update(editUser.id, { name: editForm.name, email: editForm.email, role: editForm.role })
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...mapApiUser(updated) } : u))
      // Toggles isActive / twoFA gérés séparément si l'utilisateur les a changés
      if (editForm.active !== editUser.active) {
        await usersApi.toggleActive(editUser.id, editForm.active)
      }
      if (editForm.twoFA !== editUser.twoFA) {
        await usersApi.toggle2FA(editUser.id, editForm.twoFA)
      }
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, active: editForm.active, twoFA: editForm.twoFA } : u))
      setShowEditModal(false)
      toast.success(i(`${editForm.name} mis à jour`, `${editForm.name} updated`, `${editForm.name} actualizado`, `${editForm.name} aggiornato`))
    } catch (e: any) {
      toast.error(`${i('Échec mise à jour', 'Update failed', 'Error al actualizar', 'Aggiornamento fallito')} : ${e?.message ?? ''}`)
    }
  }

  const stats = {
    total:   users.length,
    active:  users.filter(u => u.active).length,
    with2FA: users.filter(u => u.twoFA).length,
    admins:  users.filter(u => u.role === 'ADMIN').length,
  }

  return (
    <div className="space-y-5 animate-in">

      <UsersKpis stats={stats} />

      <RolesMatrix users={users} />

      <UsersToolbar
        search={search} setSearch={setSearch}
        roleFilter={roleFilter} setRoleFilter={setRoleFilter}
        isAdmin={isAdmin}
        onInvite={() => setShowModal(true)}
      />

      {/* ── Grid de cartes ── */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',
        gap:14,
      }}>
        {filtered.map(user => (
          <UserCard
            key={user.id}
            user={user}
            isAdmin={isAdmin}
            canToggle2FA={canToggle2FA(user.id)}
            onToggle2FA={() => toggle2FA(user.id)}
            onToggleActive={() => toggleActive(user.id)}
            onEdit={() => {
              setEditUser(user)
              setEditForm({ name:user.name, email:user.email, role:user.role, active:user.active, twoFA:user.twoFA })
              setShowEditModal(true)
            }}
            onDelete={() => handleDelete(user)}
          />
        ))}

        {filtered.length === 0 && (
          <div style={{
            gridColumn:'1/-1', textAlign:'center', padding:'60px 0',
            color:'var(--text3)', fontSize:14,
          }}>
            {lang === 'en' ? 'No users found' : lang === 'es' ? 'Sin usuarios encontrados' : lang === 'it' ? 'Nessun utente trovato' : 'Aucun utilisateur trouvé'}
          </div>
        )}
      </div>

      {showEditModal && editUser && (
        <EditUserModal
          editUser={editUser}
          editForm={editForm}
          setEditForm={setEditForm}
          onClose={() => setShowEditModal(false)}
          onSave={saveEdit}
        />
      )}

      {showModal && (
        <InviteUserModal
          form={form}
          setForm={setForm}
          showPwd={showPwd}
          setShowPwd={setShowPwd}
          onClose={() => setShowModal(false)}
          onInvite={invite}
        />
      )}
    </div>
  )
}
