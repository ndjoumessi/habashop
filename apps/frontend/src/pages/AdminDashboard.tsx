import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/lib/api'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { lang } = useAppStore()
  const fmt = useFormatAmount()
  void lang
  const [tenants, setTenants] = useState<any[]>([])
  const [stats,   setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showNewTenant,  setShowNewTenant]  = useState(false)
  const [newTenantForm, setNewTenantForm] = useState({
    name:'', currency:'XOF', country:'SN',
    plan:'starter', adminEmail:'', adminPassword:'',
  })

  useEffect(() => {
    Promise.all([adminApi.tenants(), adminApi.stats()])
      .then(([t, s]) => { setTenants(t); setStats(s) })
      .catch(() => toast.error('Accès refusé — SUPER_ADMIN requis'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width:44, height:44, borderRadius:12,
            background:'linear-gradient(135deg,var(--p),var(--p2))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22, fontWeight:900, color:'#fff',
          }}>H</div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:900, color:'var(--text)', margin:0 }}>HabaShop Admin</h1>
            <div style={{ fontSize:12, color:'var(--text3)' }}>Console de gestion multi-boutiques</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="mini-btn" onClick={() => navigate('/app/dashboard')}>← Retour</button>
          <button className="topbar-btn" onClick={() => setShowNewTenant(true)}>+ Nouvelle boutique</button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:60, color:'var(--text3)' }}>⏳ Chargement…</div>
      )}

      {/* KPIs */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
          {[
            { label:'BOUTIQUES',    value:stats.totalTenants,           color:'var(--p2)',  icon:'🏪' },
            { label:'UTILISATEURS', value:stats.totalUsers,             color:'var(--acc2)',icon:'👥' },
            { label:'TRANSACTIONS', value:stats.totalSales,             color:'var(--acc)', icon:'💳' },
            { label:'CA TOTAL',     value:fmt(stats.totalRevenue ?? 0), color:'var(--p2)',  icon:'💰' },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span className="kpi-label">{k.label}</span>
                <span style={{ fontSize:20 }}>{k.icon}</span>
              </div>
              <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table boutiques */}
      {tenants.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">🏪 Boutiques ({tenants.length})</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Boutique</th><th>Plan</th><th>Devise</th><th>Pays</th>
                  <th>Users</th><th>Produits</th><th>Ventes</th><th>Créée le</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td className="td-bold">{t.name}</td>
                    <td>
                      <span style={{
                        background: t.plan === 'business' ? 'rgba(91,78,232,.12)' : 'rgba(14,196,126,.12)',
                        color: t.plan === 'business' ? 'var(--p2)' : 'var(--acc2)',
                        borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700, textTransform:'capitalize',
                      }}>{t.plan}</span>
                    </td>
                    <td>{t.currency}</td>
                    <td>{t.country}</td>
                    <td className="td-mono">{t._count?.users ?? 0}</td>
                    <td className="td-mono">{t._count?.products ?? 0}</td>
                    <td className="td-mono">{t._count?.sales ?? 0}</td>
                    <td style={{ fontSize:12, color:'var(--text3)' }}>
                      {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <span style={{ background:'rgba(14,196,126,.12)', color:'var(--acc2)', borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nouvelle boutique */}
      {showNewTenant && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowNewTenant(false)}>
          <div className="modal-box" style={{ maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>🏪 Nouvelle boutique</h3>
              <button className="mini-btn" onClick={() => setShowNewTenant(false)}>✕</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Nom de la boutique *</label>
                <input className="input" placeholder="Ex: Superette Kouassi"
                  value={newTenantForm.name} onChange={e => setNewTenantForm(f => ({...f, name:e.target.value}))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Plan</label>
                  <select className="input" value={newTenantForm.plan} onChange={e => setNewTenantForm(f => ({...f, plan:e.target.value}))}>
                    <option value="starter">Starter — 22 €/mois</option>
                    <option value="business">Business — 53 €/mois</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Devise</label>
                  <select className="input" value={newTenantForm.currency} onChange={e => setNewTenantForm(f => ({...f, currency:e.target.value}))}>
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="XAF">FCFA (XAF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar US (USD)</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Email administrateur</label>
                <input className="input" type="email" placeholder="admin@boutique.com"
                  value={newTenantForm.adminEmail} onChange={e => setNewTenantForm(f => ({...f, adminEmail:e.target.value}))} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Mot de passe admin</label>
                <input className="input" type="password" placeholder="Min. 8 caractères"
                  value={newTenantForm.adminPassword} onChange={e => setNewTenantForm(f => ({...f, adminPassword:e.target.value}))} />
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }}
                onClick={async () => {
                  if (!newTenantForm.name) { toast.error('Nom requis'); return }
                  try {
                    const created = await adminApi.createTenant(newTenantForm)
                    setTenants(prev => [created, ...prev])
                    setShowNewTenant(false)
                    toast.success(`✅ Boutique "${newTenantForm.name}" créée !`)
                  } catch {
                    toast.error('Erreur création boutique')
                  }
                }}>✅ Créer la boutique</button>
              <button className="mini-btn" style={{ padding:'10px 16px' }} onClick={() => setShowNewTenant(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
