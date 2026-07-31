import { useState, useEffect } from 'react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { TrendingUp, TrendingDown, FileText, Users, DollarSign, Calendar, Trash2 } from 'lucide-react'
import { type Employee, roleLabel, deptLabel } from '@/components/hr/hrShared'

// Couleur de badge selon la raison d'augmentation salariale (bg + text pour badge pilule)
function raiseReasonColor(reason: string): { bg: string; border: string; text: string } {
  const r = (reason || '').toLowerCase()
  if (r.includes('promotion') || r.includes('promoción') || r.includes('promozione')) return { bg: 'rgba(108,71,255,.12)', border: 'rgba(108,71,255,.25)', text: 'var(--p)' }
  if (r.includes('ancien') || r.includes('senior') || r.includes('antigü') || r.includes('anzian')) return { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.25)', text: '#F59E0B' }
  if (r.includes('ajust') || r.includes('adjust')) return { bg: 'rgba(99,102,241,.12)', border: 'rgba(99,102,241,.25)', text: '#6366F1' }
  if (r.includes('augment') || r.includes('aumento') || r.includes('increase') || r.includes('raise')) return { bg: 'rgba(0,200,83,.12)', border: 'rgba(0,200,83,.25)', text: '#00C853' }
  return { bg: 'var(--bg3)', border: 'var(--border)', text: 'var(--text2)' }
}

interface Props {
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  salaryHistory: any[]
  onDeleteSalaryHistory?: (id: string) => void
  setSalaryTarget: (v: any) => void; setShowSalaryModal: (b: boolean) => void
}

export default function PayrollHistory({ employees, fmt, lang, salaryHistory, onDeleteSalaryHistory, setSalaryTarget, setShowSalaryModal }: Props) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' && window.innerWidth < 880)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setIsMobile(window.innerWidth < 880)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {salaryHistory.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', textAlign:'center', background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:20 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'rgba(108,71,255,.1)', border:'1px solid rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}><TrendingUp size={32} style={{color:'var(--p2)'}}/></div>
          <div style={{ fontSize:'var(--fs-md)', fontWeight:'var(--fw-bold)', color:'var(--text)', marginBottom:8 }}>
            {lang === 'en' ? 'No salary revisions yet' : lang === 'es' ? 'Sin revisiones salariales' : lang === 'it' ? 'Nessuna revisione salariale' : 'Aucune révision salariale'}
          </div>
          <div style={{ fontSize:'var(--fs-sm)', color:'var(--text3)', maxWidth:300, lineHeight:1.6 }}>
            {lang === 'en' ? 'Salary increases and revisions will appear here with their complete history.' : lang === 'es' ? 'Los aumentos y revisiones salariales aparecerán aquí con su historial completo.' : lang === 'it' ? 'Gli aumenti e le revisioni salariali appariranno qui con la cronologia completa.' : 'Les augmentations et révisions salariales apparaîtront ici avec leur historique complet.'}
          </div>
          <button className="topbar-btn"
            style={{ marginTop:20, display:'flex', alignItems:'center', gap:6 }}
            onClick={() => {
              if (employees.length > 0) {
                setSalaryTarget({ ...employees[0], mode:'raise' })
                setShowSalaryModal(true)
              }
            }}>
            <TrendingUp size={14}/> {lang === 'en' ? 'First salary revision' : lang === 'es' ? 'Primera revisión salarial' : lang === 'it' ? 'Prima revisione salariale' : 'Première révision salariale'}
          </button>
        </div>
      ) : (
        <>
          {/* Timeline zigzag — cards alternées gauche/droite (colonne unique sur mobile) */}
          <div style={{ position:'relative', padding:'20px 0', paddingLeft: isMobile ? 20 : 0 }}>
            {/* Axe central */}
            <div style={{
              position:'absolute',
              left: isMobile ? 12 : '50%',
              top:0, bottom:0,
              width:2, background:'var(--border)',
              transform: isMobile ? 'none' : 'translateX(-50%)',
            }}/>

            {(() => {
              const sorted = salaryHistory
                .slice()
                .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
              return sorted.map((h, idx) => {
              const emp   = employees.find(e => String(e.id) === (h.empId ?? (h as any).employeeId))
              const diff  = (h.newSalary ?? 0) - (h.oldSalary ?? 0)
              const pct   = Number(h.oldSalary) > 0
                ? ((diff / Number(h.oldSalary)) * 100) : 0
              const isUp  = diff >= 0
              const date  = h.date || (h as any).createdAt
                ? new Date(h.date || (h as any).createdAt).toLocaleDateString(
                    lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR',
                    { day:'numeric', month:'long', year:'numeric' }
                  )
                : '—'
              const reasonClr = raiseReasonColor(h.reason ?? '')
              const isLeft = !isMobile && idx % 2 === 0
              const initials = emp?.avatar ?? (emp ? emp.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() : '?')

              return (
                <div key={h.id ?? idx} style={{
                  display:'flex',
                  justifyContent: isMobile ? 'flex-start' : (isLeft ? 'flex-end' : 'flex-start'),
                  paddingLeft:  isMobile ? 12 : (isLeft ? 0 : 'calc(50% + 24px)'),
                  paddingRight: isMobile ? 0  : (isLeft ? 'calc(50% + 24px)' : 0),
                  marginBottom: 32,
                  position:'relative',
                }}>
                  {/* Point sur l'axe */}
                  <div style={{
                    position:'absolute',
                    left: isMobile ? 12 : '50%',
                    top: 24,
                    transform:'translate(-50%, 0)',
                    width:14, height:14,
                    borderRadius:'50%',
                    background: isUp ? '#00C853' : 'var(--danger)',
                    border:'3px solid var(--bg)',
                    zIndex:1,
                    boxShadow: `0 0 0 3px ${isUp ? 'rgba(0,200,83,.2)' : 'rgba(255,59,92,.2)'}`,
                  }}/>

                  {/* Card */}
                  <div style={{
                    background:'var(--card)',
                    border:'1px solid var(--border)',
                    borderRadius:16,
                    padding:'16px 20px',
                    width:'calc(100% - 16px)',
                    maxWidth: 380,
                    boxShadow:'var(--sh-xs)',
                    position:'relative',
                  }}>
                    {/* Flèche vers l'axe */}
                    <div style={{
                      position:'absolute',
                      top: 20,
                      ...(isMobile
                        ? { left: -19, borderRight: '8px solid var(--border)' }
                        : isLeft
                          ? { right: -8, borderLeft: '8px solid var(--border)' }
                          : { left: -8, borderRight: '8px solid var(--border)' }
                      ),
                      width: 0, height: 0,
                      borderTop: '8px solid transparent',
                      borderBottom: '8px solid transparent',
                    }}/>

                    {/* Header : avatar + nom + badge type */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{
                        width:36, height:36, borderRadius:'50%',
                        background: emp?.color ?? 'var(--p)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'var(--fs-sm)', fontWeight:'var(--fw-semibold)', color:'#fff',
                        flexShrink:0,
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          fontWeight:'var(--fw-semibold)', fontSize:'var(--fs-body)',
                          color:'var(--text)',
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        }}>
                          {emp?.name ?? i('Employé inconnu', 'Unknown', 'Desconocido', 'Sconosciuto')}
                        </div>
                        {emp && (emp.role || emp.dept) && (
                          <div style={{ fontSize:'var(--fs-caption)', color:'var(--text2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {emp.role ? roleLabel(emp.role, lang) : ''}
                            {emp.role && emp.dept ? ' · ' : ''}
                            {emp.dept ? deptLabel(emp.dept, lang) : ''}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)',
                        padding:'3px 8px', borderRadius:99,
                        background: reasonClr.bg,
                        color: reasonClr.text,
                        border: `1px solid ${reasonClr.border}`,
                        flexShrink:0,
                        whiteSpace:'nowrap',
                      }}>
                        {h.reason || i('Augmentation', 'Increase', 'Aumento', 'Aumento')}
                      </span>
                    </div>

                    {/* Date */}
                    <div style={{
                      fontSize:'var(--fs-caption)', color:'var(--text3)',
                      marginBottom:10,
                      display:'flex', alignItems:'center', gap:4,
                    }}>
                      <Calendar size={11} />
                      {date}
                    </div>

                    {/* Salaires ancien → nouveau */}
                    <div style={{
                      display:'flex', alignItems:'center',
                      gap:8, marginBottom:10,
                      fontSize:'var(--fs-body)',
                    }}>
                      <span style={{
                        color:'var(--text3)',
                        textDecoration:'line-through',
                        fontFamily:'var(--mono)',
                      }}>
                        {fmt(h.oldSalary)}
                      </span>
                      <span style={{ color:'var(--text2)' }}>→</span>
                      <span style={{
                        fontWeight:'var(--fw-bold)', color:'var(--text)',
                        fontFamily:'var(--mono)',
                        fontSize:'var(--fs-md)',
                      }}>
                        {fmt(h.newSalary)}
                      </span>
                    </div>

                    {/* Delta */}
                    <div style={{
                      display:'flex', alignItems:'center',
                      gap:6, marginBottom: h.reason ? 8 : 0,
                    }}>
                      {isUp
                        ? <TrendingUp size={14} color="#00C853" />
                        : <TrendingDown size={14} color="var(--danger)" />}
                      <span style={{
                        fontSize:'var(--fs-sm)', fontWeight:'var(--fw-semibold)',
                        color: isUp ? '#00C853' : 'var(--danger)',
                        fontFamily:'var(--mono)',
                      }}>
                        {isUp ? '+' : ''}{fmt(diff)} ({isUp ? '+' : ''}{pct.toFixed(1)}%)
                      </span>
                    </div>

                    {/* Raison en italique */}
                    {h.reason && (
                      <div style={{
                        fontSize:'var(--fs-label)', color:'var(--text2)',
                        fontStyle:'italic', marginBottom:8,
                      }}>
                        "{h.reason}"
                      </div>
                    )}

                    {/* Bouton supprimer */}
                    {onDeleteSalaryHistory && h.id && (
                      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
                        <button
                          type="button"
                          onClick={() => onDeleteSalaryHistory(h.id!)}
                          title={i('Supprimer la révision salariale', 'Delete salary revision', 'Eliminar revisión salarial', 'Elimina revisione salariale')}
                          aria-label={i('Supprimer la révision salariale', 'Delete salary revision', 'Eliminar revisión salarial', 'Elimina revisione salariale')}
                          style={{
                            color:'var(--danger)', cursor:'pointer',
                            background:'none', border:'none',
                            display:'flex', alignItems:'center', gap:4,
                            fontSize:'var(--fs-caption)', opacity:0.7,
                            padding:'8px 12px', minHeight:44,
                            borderRadius:8,
                            fontFamily:'var(--font)',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                        >
                          <Trash2 size={11} />
                          {i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
            })()}
          </div>

          {/* Stats résumé en bas */}
          <ResponsiveGrid min={150} gap={10} style={{ marginTop: 4 }}>
            {[
              {
                label: lang === 'en' ? 'Revisions' : lang === 'es' ? 'Revisiones' : lang === 'it' ? 'Revisioni' : 'Révisions',
                value: salaryHistory.length,
                icon: <FileText size={16} />, color:'var(--p2)',
              },
              {
                label: lang === 'en' ? 'Employees' : lang === 'es' ? 'Empleados' : lang === 'it' ? 'Dipendenti' : 'Employés',
                value: new Set(salaryHistory.map(h => h.empId)).size,
                icon: <Users size={16} />, color:'var(--acc3)',
              },
              {
                label: lang === 'en' ? 'Avg raise' : lang === 'es' ? 'Aumento medio' : lang === 'it' ? 'Aumento medio' : 'Hausse moy.',
                value: (() => {
                  const pcts = salaryHistory.map(h =>
                    Number(h.oldSalary) > 0
                      ? ((h.newSalary - h.oldSalary) / h.oldSalary) * 100
                      : 0
                  )
                  const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length
                  return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`
                })(),
                icon: <TrendingUp size={16} />, color:'var(--acc2)',
              },
              {
                label: lang === 'en' ? 'Total impact' : lang === 'es' ? 'Impacto total' : lang === 'it' ? 'Impatto totale' : 'Impact total',
                value: fmt(salaryHistory.reduce((s, h) => s + (h.newSalary - h.oldSalary), 0)),
                icon: <DollarSign size={16} />, color:'var(--warn)',
              },
            ].map(k => (
              <div key={k.label} style={{
                background:'var(--grad-card)',
                border:'1px solid var(--border)',
                borderRadius:12, padding:'12px 14px',
                display:'flex', alignItems:'center', gap:10,
                transition:'all .15s',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'none'
                }}
              >
                <div style={{
                  width:34, height:34, borderRadius:10,
                  background:'var(--bg3)',
                  display:'flex', alignItems:'center',
                  justifyContent:'center', color:k.color,
                  flexShrink:0,
                }}>{k.icon}</div>
                <div>
                  <div style={{
                    fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)',
                    textTransform:'uppercase', letterSpacing:'.5px',
                    color:'var(--text3)', marginBottom:2,
                  }}>{k.label}</div>
                  <div style={{
                    fontSize:'var(--fs-md)', fontWeight:'var(--fw-bold)',
                    color:k.color, fontFamily:'var(--mono)',
                    letterSpacing:'-.5px',
                  }}>{k.value}</div>
                </div>
              </div>
            ))}
          </ResponsiveGrid>
        </>
      )}
    </div>
  )
}
