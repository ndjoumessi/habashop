import { useState, useEffect } from 'react'
import Skeleton from '@/components/ui/skeleton'
import { useAppStore, useFormatAmount, useCurrencyInfo } from '@/stores/appStore'
import { dashboardApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Trophy, Pencil, X, Check, Trash2, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

interface Goal {
  id: string
  label: string
  target: number
  current: number
  unit: 'currency' | 'FCFA' | '%' | 'clients' | 'transactions'
  period: string
  color: string
  icon: string
  category: 'revenue' | 'stock' | 'customers' | 'team'
}

const BLANK_GOAL: Goal = { id:'', label:'', target:0, current:0, unit:'currency', period:'Mai 2026', color:'#6C47FF', icon:'🎯', category:'revenue' }

const isCurrency = (unit: string) => unit === 'currency' || unit === 'FCFA'

const CIRCUMFERENCE = 2 * Math.PI * 36

export default function Goals() {
  const { lang } = useAppStore()
  const fmt = useFormatAmount()
  const { symbol: currencySymbol } = useCurrencyInfo()

  const targetMonth = new Date().toLocaleDateString(
    lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR',
    { month: 'long', year: 'numeric' }
  )

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('habashop-goals')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editGoal, setEditGoal]           = useState<Goal | null>(null)
  const [goalForm, setGoalForm]           = useState<Goal>(BLANK_GOAL)
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    dashboardApi.stats()
      .then(data => {
        setGoals(prev => prev.map(g => {
          if (g.id === '1') return { ...g, current: data.salesMonth ?? 0 }
          if (g.id === '2') return { ...g, current: data.transactionsMonth ?? 0 }
          if (g.id === '3') return { ...g, current: data.transactionsMonth > 0 ? Math.round(data.salesMonth / data.transactionsMonth) : 0 }
          return g
        }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem('habashop-goals', JSON.stringify(goals))
  }, [goals])

  const openModal = (goal: Goal | null) => {
    setEditGoal(goal)
    setGoalForm(goal ? { ...goal } : { ...BLANK_GOAL, id: Date.now().toString(), period: targetMonth })
    setShowEditModal(true)
  }

  const getStatus = (goal: Goal) => {
    const pct = goal.target > 0 ? (goal.current / goal.target) * 100 : 0
    if (goal.id === '6') {
      if (goal.current <= goal.target) return 'success'
      if (goal.current <= goal.target * 1.5) return 'warning'
      return 'danger'
    }
    if (pct >= 100) return 'success'
    if (pct >= 70)  return 'warning'
    return 'danger'
  }

  const getStatusColor = (status: string) => ({
    success: 'var(--acc2)',
    warning: 'var(--acc)',
    danger:  'var(--danger)',
  }[status] ?? 'var(--text3)')

  const achieved  = goals.filter(g => getStatus(g) === 'success').length
  const globalPct = goals.length ? Math.round(achieved / goals.length * 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <Skeleton height={56} count={5} />
    </div>
  )

  return (
    <div className="animate-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {lang === 'fr' ? 'Objectifs & KPIs' : lang === 'en' ? 'Goals & KPIs' : lang === 'es' ? 'Objetivos & KPIs' : 'Obiettivi & KPI'}
          </h1>
          <p className="page-subtitle">
            {lang === 'fr' ? 'Suivez vos objectifs mensuels en temps réel' : lang === 'en' ? 'Track your monthly goals in real time' : lang === 'es' ? 'Siga sus objetivos mensuales' : 'Monitora i tuoi obiettivi mensili'}
          </p>
        </div>
        <button className="topbar-btn" onClick={() => openModal(null)}>
          <Plus size={14} /> {lang === 'en' ? 'New goal' : lang === 'es' ? 'Nuevo objetivo' : lang === 'it' ? 'Nuovo obiettivo' : 'Nouvel objectif'}
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="🎯"
            title={lang === 'en' ? 'No goals defined' : lang === 'es' ? 'Sin objetivos definidos' : lang === 'it' ? 'Nessun obiettivo definito' : 'Aucun objectif défini'}
            message={lang === 'en' ? 'Set your sales goals to track your progress.' : lang === 'es' ? 'Defina sus objetivos de ventas para seguir su progreso.' : lang === 'it' ? 'Definisci i tuoi obiettivi di vendita per monitorare i progressi.' : 'Définissez vos objectifs de vente pour suivre votre progression.'}
            action={{ label: lang === 'en' ? '+ Create a goal' : lang === 'es' ? '+ Crear un objetivo' : lang === 'it' ? '+ Crea un obiettivo' : '+ Créer un objectif', onClick: () => openModal(null) }}
          />
        </div>
      ) : (<>
      {/* ── Score global ── */}
      <div className="panel" style={{
        background:'linear-gradient(135deg,rgba(91,78,232,.1),rgba(124,111,240,.05))',
        border:'1px solid rgba(91,78,232,.2)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
              <Trophy size={14} style={{ color:'var(--acc)' }} />
              {lang === 'en' ? 'Monthly global score' : lang === 'es' ? 'Puntuación global del mes' : lang === 'it' ? 'Punteggio globale del mese' : 'Score global du mois'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>
              {achieved}/{goals.length} {lang === 'en' ? 'goals achieved' : lang === 'es' ? 'objetivos alcanzados' : lang === 'it' ? 'obiettivi raggiunti' : 'objectifs atteints'}
            </div>
          </div>

          {/* Gauge globale SVG */}
          <div style={{ position:'relative', width:80, height:80, flexShrink:0 }}>
            <svg width="80" height="80" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7"/>
              <circle cx="40" cy="40" r="30" fill="none"
                stroke={globalPct >= 80 ? 'var(--acc2)' : globalPct >= 50 ? 'var(--acc)' : 'var(--danger)'}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${(globalPct/100)*(2*Math.PI*30)} ${2*Math.PI*30}`}
                style={{ transition:'stroke-dasharray .6s ease', filter:'drop-shadow(0 0 4px currentColor)' }}
              />
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{
                fontSize:18, fontWeight:900, fontFamily:'var(--mono)',
                color: globalPct >= 80 ? 'var(--acc2)' : globalPct >= 50 ? 'var(--acc)' : 'var(--danger)',
              }}>{globalPct}%</span>
            </div>
          </div>
        </div>

        <div style={{ height:8, background:'var(--bg4)', borderRadius:99, marginTop:14, overflow:'hidden' }}>
          <div style={{
            height:'100%', width:`${globalPct}%`,
            background: globalPct >= 80
              ? 'linear-gradient(90deg,var(--acc2),#059669)'
              : globalPct >= 50
                ? 'linear-gradient(90deg,var(--acc),#D97706)'
                : 'linear-gradient(90deg,var(--danger),#DC2626)',
            borderRadius:99, transition:'width .5s ease',
          }} />
        </div>
      </div>

      {/* ── Grille objectifs avec gauge SVG ── */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',
        gap:14,
      }}>
        {goals.map(goal => {
          const pct         = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0
          const status      = getStatus(goal)
          const statusColor = getStatusColor(status)
          const strokeDash  = (pct / 100) * CIRCUMFERENCE
          const isOnTrack   = status === 'success' || status === 'warning'

          return (
            <div key={goal.id} style={{
              background:'var(--card)',
              border:`1px solid ${isOnTrack ? `${goal.color}30` : 'rgba(239,68,68,.2)'}`,
              borderRadius:20, padding:'20px',
              transition:'transform .2s, box-shadow .2s',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(-2px)'
                el.style.boxShadow = `0 8px 28px ${isOnTrack ? goal.color : 'var(--danger)'}18`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'none'
                el.style.boxShadow = 'none'
              }}
            >
              {/* Gauge circulaire SVG */}
              <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
                <div style={{ position:'relative', width:100, height:100 }}>
                  <svg width="100" height="100" style={{ transform:'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="36"
                      fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8"/>
                    <circle cx="50" cy="50" r="36"
                      fill="none"
                      stroke={isOnTrack ? goal.color : 'var(--danger)'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${strokeDash} ${CIRCUMFERENCE}`}
                      style={{
                        filter:`drop-shadow(0 0 6px ${isOnTrack ? goal.color : 'var(--danger)'}88)`,
                        transition:'stroke-dasharray .6s ease',
                      }}
                    />
                  </svg>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{
                      fontSize:20, fontWeight:900, lineHeight:1,
                      color: isOnTrack ? goal.color : 'var(--danger)',
                      fontFamily:'var(--mono)',
                    }}>
                      {pct}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Icône + label */}
              <div style={{ textAlign:'center', marginBottom:12 }}>
                <div style={{ fontSize:22, marginBottom:5 }}>{goal.icon}</div>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', marginBottom:5 }}>
                  {goal.label}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>
                  {isCurrency(goal.unit)
                    ? `${fmt(goal.current)} / ${fmt(goal.target)}`
                    : `${goal.current} / ${goal.target}${goal.unit === '%' ? ' %' : ' ' + goal.unit}`}
                </div>

                {/* Badge status */}
                <span style={{
                  fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:99,
                  background: status === 'success' ? 'rgba(0,208,132,.12)' : status === 'warning' ? 'rgba(240,165,0,.12)' : 'rgba(239,68,68,.1)',
                  color: statusColor,
                  border:`1px solid ${status === 'success' ? 'rgba(0,208,132,.25)' : status === 'warning' ? 'rgba(240,165,0,.2)' : 'rgba(239,68,68,.2)'}`,
                  display:'inline-flex', alignItems:'center', gap:4,
                }}>
                  {status === 'success'
                    ? <Check size={11} strokeWidth={3} />
                    : status === 'warning'
                      ? <ArrowUpRight size={11} strokeWidth={2.6} />
                      : <ArrowDownRight size={11} strokeWidth={2.6} />}
                  {status === 'success' ? (lang === 'en' ? 'Achieved' : lang === 'es' ? 'Alcanzado' : lang === 'it' ? 'Raggiunto' : 'Atteint') : status === 'warning' ? (lang === 'en' ? 'In progress' : lang === 'es' ? 'En curso' : lang === 'it' ? 'In corso' : 'En cours') : (lang === 'en' ? 'Behind' : lang === 'es' ? 'Atrasado' : lang === 'it' ? 'In ritardo' : 'En retard')}
                </span>
              </div>

              {/* Barre progression */}
              <div style={{ height:5, background:'rgba(255,255,255,.06)', borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                <div style={{
                  height:'100%', width:`${pct}%`,
                  background: isOnTrack
                    ? `linear-gradient(90deg,${goal.color},${goal.color}aa)`
                    : 'linear-gradient(90deg,var(--danger),var(--acc))',
                  borderRadius:99,
                  boxShadow:`0 0 8px ${isOnTrack ? goal.color : 'var(--danger)'}55`,
                  transition:'width .6s ease',
                }} />
              </div>

              {/* Période + Reste + actions */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
                <div style={{ fontSize:10, color:'var(--text3)' }}>
                  {lang === 'en' ? 'Target:' : lang === 'es' ? 'Objetivo:' : lang === 'it' ? 'Obiettivo:' : 'Objectif :'} {goal.period}
                </div>
                {pct < 100 && (
                  <div style={{ fontSize:10, color:'var(--text3)' }}>
                    {lang === 'en' ? 'Left:' : lang === 'es' ? 'Queda:' : lang === 'it' ? 'Resta:' : 'Reste :'}
                    {' '}<span style={{ color:statusColor, fontWeight:700 }}>
                      {isCurrency(goal.unit)
                        ? fmt(goal.target - goal.current)
                        : `${goal.target - goal.current}${goal.unit === '%' ? '%' : ' ' + goal.unit}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Edit button */}
              <button className="mini-btn"
                style={{ width:'100%', marginTop:10, justifyContent:'center', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
                onClick={() => openModal(goal)}>
                <Pencil size={11}/> {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}
              </button>
            </div>
          )
        })}
      </div>
      </>)}

      {/* ── Modal édition ── */}
      {showEditModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal-box" style={{ maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                {editGoal
                  ? <><Pencil size={14}/> {lang === 'en' ? 'Edit goal' : lang === 'es' ? 'Editar el objetivo' : lang === 'it' ? 'Modifica l\'obiettivo' : "Modifier l'objectif"}</>
                  : <><Target size={14}/> {lang === 'en' ? 'New goal' : lang === 'es' ? 'Nuevo objetivo' : lang === 'it' ? 'Nuovo obiettivo' : 'Nouvel objectif'}</>}
              </h3>
              <button className="mini-btn" onClick={() => setShowEditModal(false)} style={{ cursor:'pointer', display:'flex', alignItems:'center' }}><X size={14}/></button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'60px 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>Icône</label>
                  <input aria-label="Icône" className="input" value={goalForm.icon} onChange={e => setGoalForm(f => ({...f, icon:e.target.value}))} style={{ textAlign:'center', fontSize:20 }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>Label</label>
                  <input aria-label="Label" className="input" placeholder={lang === 'en' ? 'Ex: Monthly revenue' : lang === 'es' ? 'Ej: Ingresos mensuales' : lang === 'it' ? 'Es: Ricavi mensili' : 'Ex: CA mensuel'} value={goalForm.label} onChange={e => setGoalForm(f => ({...f, label:e.target.value}))} />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>
                    {lang === 'en' ? 'Target' : lang === 'es' ? 'Objetivo' : lang === 'it' ? 'Obiettivo' : 'Objectif cible'}
                  </label>
                  <input className="input" type="number" value={goalForm.target || ''} onChange={e => setGoalForm(f => ({...f, target:+e.target.value}))} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>
                    {lang === 'en' ? 'Current value' : lang === 'es' ? 'Valor actual' : lang === 'it' ? 'Valore attuale' : 'Valeur actuelle'}
                  </label>
                  <input className="input" type="number" value={goalForm.current || ''} onChange={e => setGoalForm(f => ({...f, current:+e.target.value}))} />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>Unité</label>
                  <select aria-label="Unité" className="input" value={goalForm.unit} onChange={e => setGoalForm(f => ({...f, unit:e.target.value as Goal['unit']}))}>
                    <option value="currency">{currencySymbol}</option>
                    <option value="%">%</option>
                    <option value="clients">Clients</option>
                    <option value="transactions">Transactions</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>
                    {lang === 'en' ? 'Period' : lang === 'es' ? 'Período' : lang === 'it' ? 'Periodo' : 'Période'}
                  </label>
                  <input className="input" placeholder={targetMonth} value={goalForm.period} onChange={e => setGoalForm(f => ({...f, period:e.target.value}))} />
                </div>
              </div>

              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }}
                  onClick={() => {
                    if (!goalForm.label || !goalForm.target) {
                      toast.error(lang === 'en' ? 'Label and target required' : lang === 'es' ? 'Etiqueta y objetivo requeridos' : lang === 'it' ? 'Etichetta e obiettivo richiesti' : 'Label et objectif requis')
                      return
                    }
                    if (editGoal) {
                      setGoals(prev => prev.map(g => g.id === editGoal.id ? goalForm : g))
                      toast.success(lang === 'en' ? 'Goal updated' : lang === 'es' ? 'Objetivo modificado' : lang === 'it' ? 'Obiettivo modificato' : 'Objectif modifié')
                    } else {
                      setGoals(prev => [...prev, goalForm])
                      toast.success(lang === 'en' ? 'Goal created' : lang === 'es' ? 'Objetivo creado' : lang === 'it' ? 'Obiettivo creato' : 'Objectif créé')
                    }
                    setShowEditModal(false)
                  }}>
                  <Check size={14}/> {editGoal ? (lang === 'en' ? 'Update' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier') : (lang === 'en' ? 'Create' : lang === 'es' ? 'Crear' : lang === 'it' ? 'Crea' : 'Créer')}
                </button>
                {editGoal && (
                  <button className="mini-btn" style={{ color:'var(--danger)', cursor:'pointer', display:'flex', alignItems:'center' }}
                    onClick={() => {
                      setGoals(prev => prev.filter(g => g.id !== editGoal.id))
                      setShowEditModal(false)
                      toast.success(lang === 'en' ? 'Goal deleted' : lang === 'es' ? 'Objetivo eliminado' : lang === 'it' ? 'Obiettivo eliminato' : 'Objectif supprimé')
                    }}>
                    <Trash2 size={12}/>
                  </button>
                )}
                <button className="mini-btn" style={{ padding:'10px 16px' }} onClick={() => setShowEditModal(false)}>
                  {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
