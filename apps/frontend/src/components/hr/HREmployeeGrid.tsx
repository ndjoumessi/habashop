import { Search, LayoutGrid, AlignJustify, Star, Pencil } from 'lucide-react'
import Pagination from '@/components/ui/Pagination'
import { type Employee, DEPT_COLORS, EmpAvatar, Stars, calcAnciennete } from '@/components/hr/hrShared'

interface HREmployeeGridProps {
  search: string; setSearch: (v: string) => void
  deptFilter: string; setDeptFilter: (v: string) => void
  depts: string[]
  filterStatus: string; setFilterStatus: (v: string) => void
  viewMode: 'grid' | 'table'; setViewMode: (v: 'grid' | 'table') => void
  setSelectedEmp: (e: Employee | null) => void
  setShowModal: (b: boolean) => void
  loadingEmployees: boolean
  pg: { paginated: Employee[]; page: number; totalPages: number; total: number; pageSize: number; onPage: (n: number) => void; onSize: (n: number) => void }
  openEditModal: (emp: Employee) => void
  filtered: Employee[]
  fmt: (n: number) => string
  lang: string
}

export default function HREmployeeGrid({ search, setSearch, deptFilter, setDeptFilter, depts, filterStatus, setFilterStatus, viewMode, setViewMode, setSelectedEmp, setShowModal, loadingEmployees, pg, openEditModal, filtered, fmt, lang }: HREmployeeGridProps) {
  return (
        <>
          {/* Filtres compacts sur une ligne */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
            {/* Recherche */}
            <div style={{ position:'relative', flex:1, minWidth:180 }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none', display:'flex' }}><Search size={13}/></span>
              <input className="input"
                style={{ paddingLeft:32, height:36, fontSize:13 }}
                aria-label="Rechercher" placeholder={lang === 'en' ? 'Search...' : lang === 'es' ? 'Buscar...' : lang === 'it' ? 'Cerca...' : 'Rechercher...'}
                value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Filtre département */}
            <select className="input"
              style={{ width:'auto', height:36, fontSize:12 }}
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}>
              <option value="all">{lang === 'en' ? 'All depts' : lang === 'es' ? 'Todos los deptos' : lang === 'it' ? 'Tutti i reparti' : 'Tous les depts'}</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {/* Filtre statut */}
            <select className="input"
              style={{ width:'auto', height:36, fontSize:12 }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">{lang === 'en' ? 'All status' : lang === 'es' ? 'Todos los estados' : lang === 'it' ? 'Tutti gli stati' : 'Tous statuts'}</option>
              <option value="active">{lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif'}</option>
              <option value="inactive">{lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif'}</option>
            </select>
            {/* Toggle vue */}
            <div style={{ display:'flex', gap:2, background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, padding:3, flexShrink:0 }}>
              {[{id:'grid',icon:<LayoutGrid size={13}/>},{id:'table',icon:<AlignJustify size={13}/>}].map(v => (
                <button key={v.id} type="button"
                  onClick={() => setViewMode(v.id as any)}
                  style={{
                    width:28, height:28, borderRadius:6, border:'none', cursor:'pointer',
                    background: viewMode === v.id ? 'var(--p)' : 'transparent',
                    color: viewMode === v.id ? '#fff' : 'var(--text3)',
                    transition:'all .15s',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>{v.icon}</button>
              ))}
            </div>
            {/* Bouton ajouter */}
            <button className="topbar-btn"
              style={{ height:36, padding:'0 14px', flexShrink:0 }}
              onClick={() => { setSelectedEmp(null); setShowModal(true) }}>
              + {lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}
            </button>
          </div>

          {/* Grid view */}
          {viewMode === 'grid' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
              {loadingEmployees ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:16, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div className="skeleton" style={{ width:40, height:40, borderRadius:'50%', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div className="skeleton" style={{ width:'70%', height:13, borderRadius:4, marginBottom:6 }} />
                        <div className="skeleton" style={{ width:'50%', height:11, borderRadius:4 }} />
                      </div>
                    </div>
                    <div className="skeleton" style={{ width:'100%', height:8, borderRadius:4 }} />
                  </div>
                ))
              ) : pg.paginated.map(emp => {
                const deptColor = DEPT_COLORS[emp.dept] ?? 'var(--p)'
                const isActive  = emp.active
                return (
                  <div key={emp.id} style={{
                    background:'linear-gradient(160deg,#0D0D1C,#111125)',
                    border:'1px solid var(--border)',
                    borderRadius:14, padding:0,
                    overflow:'hidden', cursor:'pointer',
                    transition:'all .18s',
                    opacity: isActive ? 1 : .65,
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = deptColor + '50'
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = `0 8px 24px ${deptColor}18`
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'var(--border)'
                      el.style.transform = 'none'
                      el.style.boxShadow = 'none'
                    }}
                    onClick={() => openEditModal(emp)}
                  >
                    {/* Barre couleur dept */}
                    <div style={{ height:3, background:`linear-gradient(90deg,${deptColor},${deptColor}33)` }} />
                    <div style={{ padding:'14px 16px' }}>
                      {/* Avatar + Nom + Badge statut */}
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
                        <div style={{
                          width:44, height:44, borderRadius:12,
                          background:`linear-gradient(135deg,${emp.color??'var(--p)'},${emp.color??'var(--p)'}66)`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:14, fontWeight:900, color:'#fff', flexShrink:0,
                          boxShadow:`0 3px 10px ${emp.color??'var(--p)'}35`,
                        }}>
                          {emp.avatar}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.role}</div>
                        </div>
                        <span style={{
                          fontSize:9, fontWeight:700, textTransform:'uppercase',
                          background: isActive ? 'rgba(0,208,132,.1)' : 'rgba(255,59,92,.1)',
                          color: isActive ? 'var(--acc2)' : 'var(--danger)',
                          border:`1px solid ${isActive ? 'rgba(0,208,132,.2)' : 'rgba(255,59,92,.2)'}`,
                          borderRadius:20, padding:'2px 7px', flexShrink:0,
                        }}>
                          {isActive ? (lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif') : (lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif')}
                        </span>
                      </div>
                      {/* Métriques 2 cols */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 9px' }}>
                          <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>
                            {lang === 'en' ? 'Salary' : lang === 'es' ? 'Salario' : lang === 'it' ? 'Stipendio' : 'Salaire'}
                          </div>
                          <div style={{ fontSize:12, fontWeight:900, color:'var(--acc)', fontFamily:'var(--mono)' }}>{fmt(Number(emp.salary)||0)}</div>
                        </div>
                        <div style={{ background:`${deptColor}0D`, border:`1px solid ${deptColor}1A`, borderRadius:8, padding:'7px 9px' }}>
                          <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>Dept</div>
                          <div style={{ fontSize:11, fontWeight:700, color:deptColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.dept}</div>
                        </div>
                      </div>
                      {/* Footer card */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'var(--text3)', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:5, padding:'2px 7px' }}>{emp.type}</span>
                        <div style={{ display:'flex', gap:1, alignItems:'center' }}>
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={9} style={{ color:'#F59E0B', opacity: s<=(emp.perf??3) ? 1 : .2, fill: s<=(emp.perf??3) ? '#F59E0B' : 'none' }} />
                          ))}
                        </div>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); openEditModal(emp) }}
                          style={{
                            width:26, height:26, borderRadius:7,
                            background:'rgba(255,149,0,.1)', border:'1px solid rgba(255,149,0,.2)',
                            cursor:'pointer', color:'var(--acc)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}><Pencil size={11}/></button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!loadingEmployees && filtered.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:14 }}>
                  {lang === 'en' ? 'No employee found' : lang === 'es' ? 'Sin empleados encontrados' : lang === 'it' ? 'Nessun dipendente trovato' : 'Aucun employé trouvé'}
                </div>
              )}
            </div>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div className="panel" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Employé</th>
                      <th scope="col">Département</th>
                      <th scope="col">Contrat</th>
                      <th scope="col">Ancienneté</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Salaire</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Perf.</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pg.paginated.map(emp => (
                      <tr key={emp.id} onClick={() => { openEditModal(emp) }} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <EmpAvatar emp={emp} size={32} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.role}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: DEPT_COLORS[emp.dept] ?? 'var(--text2)' }}>
                            {emp.dept}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: emp.type === 'CDI' ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                            color: emp.type === 'CDI' ? 'var(--p2)' : 'var(--acc2)',
                          }}>{emp.type}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{calcAnciennete(emp.hiredAt)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(emp.salary)}</td>
                        <td style={{ textAlign: 'center' }}>{emp.perf != null && <Stars v={emp.perf} />}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                            background: emp.active ? 'rgba(14,196,126,.12)' : 'var(--bg3)',
                            color: emp.active ? 'var(--acc2)' : 'var(--text3)',
                          }}>
                            {emp.active ? '● Actif' : '○ Inactif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>Aucun employé trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
        </>
  )
}
