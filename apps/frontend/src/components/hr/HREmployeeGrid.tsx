import { Search, LayoutGrid, AlignJustify, Star, Pencil } from 'lucide-react'
import Pagination from '@/components/ui/Pagination'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type Employee, DEPT_COLORS, EmpAvatar, Stars, calcAnciennete, roleLabel, deptLabel, contractLabel, isOpenEnded } from '@/components/hr/hrShared'

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
                style={{ paddingLeft:32, height:36, fontSize:'var(--fs-sm)' }}
                aria-label="Rechercher" placeholder={lang === 'en' ? 'Search...' : lang === 'es' ? 'Buscar...' : lang === 'it' ? 'Cerca...' : 'Rechercher...'}
                value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Filtre département */}
            <select className="input"
              style={{ width:'auto', height:36, fontSize:'var(--fs-label)' }}
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}>
              <option value="all">{lang === 'en' ? 'All depts' : lang === 'es' ? 'Todos los deptos' : lang === 'it' ? 'Tutti i reparti' : 'Tous les depts'}</option>
              {depts.map(d => <option key={d} value={d}>{deptLabel(d, lang)}</option>)}
            </select>
            {/* Filtre statut */}
            <select className="input"
              style={{ width:'auto', height:36, fontSize:'var(--fs-label)' }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">{lang === 'en' ? 'All status' : lang === 'es' ? 'Todos los estados' : lang === 'it' ? 'Tutti gli stati' : 'Tous statuts'}</option>
              <option value="active">{lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif'}</option>
              <option value="inactive">{lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif'}</option>
            </select>
            {/* Toggle vue */}
            <div style={{ display:'flex', gap:2, background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, padding:3, flexShrink:0 }}>
              {[
                { id:'grid',  icon:<LayoutGrid size={13}/>,   label: lang === 'en' ? 'Grid view'  : lang === 'es' ? 'Vista cuadrícula' : lang === 'it' ? 'Vista griglia'  : 'Vue grille'  },
                { id:'table', icon:<AlignJustify size={13}/>, label: lang === 'en' ? 'Table view' : lang === 'es' ? 'Vista tabla'      : lang === 'it' ? 'Vista tabella' : 'Vue tableau' },
              ].map(v => (
                <button key={v.id} type="button"
                  aria-label={v.label} title={v.label}
                  aria-pressed={viewMode === v.id}
                  onClick={() => setViewMode(v.id as any)}
                  style={{
                    width:36, height:36, borderRadius:6, border:'none', cursor:'pointer',
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
            <ResponsiveGrid min={240} gap={12}>
              {loadingEmployees ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
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
                    background:'var(--bg2)',
                    border:'1px solid var(--border2)',
                    borderRadius:12, padding:0,
                    overflow:'hidden', cursor:'pointer',
                    transition:'all .15s ease',
                    opacity: isActive ? 1 : .65,
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = deptColor + '50'
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = 'var(--sh-sm)'
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
                          fontSize:'var(--fs-body)', fontWeight:'var(--fw-bold)', color:'#fff', flexShrink:0,
                          boxShadow:`0 3px 10px ${emp.color??'var(--p)'}35`,
                        }}>
                          {emp.avatar}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-bold)', color:'var(--text)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</div>
                          <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{roleLabel(emp.role, lang)}</div>
                        </div>
                        <span style={{
                          display:'inline-flex', alignItems:'center',
                          fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', textTransform:'uppercase',
                          background: isActive ? 'var(--c-green-bg)' : 'var(--bg3)',
                          color: isActive ? 'var(--acc2)' : 'var(--text2)',
                          border:`1px solid ${isActive ? 'var(--c-green-border)' : 'var(--border)'}`,
                          borderRadius:'var(--r-full)', padding:'3px 9px', flexShrink:0,
                        }}>
                          {isActive ? (lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif') : (lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif')}
                        </span>
                      </div>
                      {/* Métriques 2 cols */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 9px' }}>
                          <div style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>
                            {lang === 'en' ? 'Salary' : lang === 'es' ? 'Salario' : lang === 'it' ? 'Stipendio' : 'Salaire'}
                          </div>
                          <div style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-bold)', color:'var(--acc)', fontFamily:'var(--mono)' }}>{fmt(Number(emp.salary)||0)}</div>
                        </div>
                        <div style={{ background:`${deptColor}0D`, border:`1px solid ${deptColor}1A`, borderRadius:8, padding:'7px 9px' }}>
                          <div style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:3 }}>Dept</div>
                          <div style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:deptColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deptLabel(emp.dept, lang)}</div>
                        </div>
                      </div>
                      {/* Footer card */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:'var(--text3)', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:5, padding:'2px 7px' }}>{contractLabel(emp.type, lang)}</span>
                        {/* ⚠️ `emp.perf ?? 3` peignait TROIS étoiles pleines à un employé jamais
                            évalué — la valeur par défaut du schéma repeinte à l'écran. Non évalué
                            se DIT : une rangée d'étoiles éteintes se lirait « 0/5 », un jugement. */}
                        {emp.perf == null ? (
                          <span style={{ fontSize:'var(--fs-caption)', color:'var(--text3)', fontStyle:'italic' }}>
                            {lang === 'en' ? 'Not rated' : lang === 'es' ? 'Sin evaluar' : lang === 'it' ? 'Non valutato' : 'Non évalué'}
                          </span>
                        ) : (
                          <div style={{ display:'flex', gap:1, alignItems:'center' }}>
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={9} style={{ color:'#F59E0B', opacity: s<=emp.perf! ? 1 : .2, fill: s<=emp.perf! ? '#F59E0B' : 'none' }} />
                            ))}
                          </div>
                        )}
                        <button aria-label={lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'} type="button"
                          onClick={e => { e.stopPropagation(); openEditModal(emp) }}
                          style={{
                            width:36, height:36, borderRadius:8,
                            background:'var(--c-orange-bg)', border:'1px solid var(--c-orange-border)',
                            cursor:'pointer', color:'var(--acc)', transition:'all .15s ease',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}><Pencil size={14}/></button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!loadingEmployees && filtered.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:'var(--fs-body)' }}>
                  {lang === 'en' ? 'No employee found' : lang === 'es' ? 'Sin empleados encontrados' : lang === 'it' ? 'Nessun dipendente trovato' : 'Aucun employé trouvé'}
                </div>
              )}
            </ResponsiveGrid>
          )}

          {/* Table view */}
          {viewMode === 'table' && (
            <div className="panel" style={{ padding: 0 }}>
              <div className="table-wrap data-table">
                <table aria-label={lang === 'en' ? 'Employees' : lang === 'es' ? 'Empleados' : lang === 'it' ? 'Dipendenti' : 'Employés'}>
                  <thead>
                    <tr>
                      <th scope="col">{lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}</th>
                      <th scope="col">{lang === 'en' ? 'Department' : lang === 'es' ? 'Departamento' : lang === 'it' ? 'Dipartimento' : 'Département'}</th>
                      <th scope="col">{lang === 'en' ? 'Contract' : lang === 'es' ? 'Contrato' : lang === 'it' ? 'Contratto' : 'Contrat'}</th>
                      <th scope="col">{lang === 'en' ? 'Seniority' : lang === 'es' ? 'Antigüedad' : lang === 'it' ? 'Anzianità' : 'Ancienneté'}</th>
                      <th scope="col" style={{ textAlign: 'right' }}>{lang === 'en' ? 'Salary' : lang === 'es' ? 'Salario' : lang === 'it' ? 'Stipendio' : 'Salaire'}</th>
                      <th scope="col" style={{ textAlign: 'center' }}>{lang === 'en' ? 'Perf.' : lang === 'es' ? 'Rend.' : lang === 'it' ? 'Perf.' : 'Perf.'}</th>
                      <th scope="col" style={{ textAlign: 'center' }}>{lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEmployees && (
                      /* Skeleton vue table (n'existait qu'en vue grille) — pattern OrdersListPanel */
                      <tr><td colSpan={7} style={{ padding: 12 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="skeleton" style={{ height: 34, borderRadius: 8, marginBottom: i < 5 ? 8 : 0 }} />
                        ))}
                      </td></tr>
                    )}
                    {!loadingEmployees && pg.paginated.map(emp => (
                      <tr key={emp.id} tabIndex={0}
                        aria-label={emp.name}
                        onClick={() => { openEditModal(emp) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditModal(emp) } }}
                        style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <EmpAvatar emp={emp} size={32} />
                            <div>
                              <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)' }}>{emp.name}</div>
                              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{roleLabel(emp.role, lang)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: DEPT_COLORS[emp.dept] ?? 'var(--text2)' }}>
                            {deptLabel(emp.dept, lang)}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', padding: '3px 9px', borderRadius: 'var(--r-full)',
                            background: isOpenEnded(emp.type) ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                            color: isOpenEnded(emp.type) ? 'var(--p2)' : 'var(--acc2)',
                          }}>{contractLabel(emp.type, lang)}</span>
                        </td>
                        <td style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)' }}>{calcAnciennete(emp.hiredAt, lang)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 'var(--fw-semibold)' }}>{fmt(emp.salary)}</td>
                        <td style={{ textAlign: 'center' }}>{emp.perf != null && <Stars v={emp.perf} />}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', padding: '3px 9px', borderRadius: 'var(--r-full)',
                            background: emp.active ? 'var(--c-green-bg)' : 'var(--bg3)',
                            border: `1px solid ${emp.active ? 'var(--c-green-border)' : 'var(--border)'}`,
                            color: emp.active ? 'var(--acc2)' : 'var(--text2)',
                          }}>
                            {emp.active ? `● ${lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : lang === 'it' ? 'Attivo' : 'Actif'}` : `○ ${lang === 'en' ? 'Inactive' : lang === 'es' ? 'Inactivo' : lang === 'it' ? 'Inattivo' : 'Inactif'}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!loadingEmployees && filtered.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>{lang === 'en' ? 'No employee found' : lang === 'es' ? 'Sin empleados encontrados' : lang === 'it' ? 'Nessun dipendente trovato' : 'Aucun employé trouvé'}</td></tr>
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
