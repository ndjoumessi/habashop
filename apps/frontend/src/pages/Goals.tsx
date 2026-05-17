import { useState, useEffect } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { dashboardApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Goal {
  id: string
  label: string
  target: number
  current: number
  unit: 'FCFA' | '%' | 'clients' | 'transactions'
  period: string
  color: string
  icon: string
  category: 'revenue' | 'stock' | 'customers' | 'team'
}

const DEFAULT_GOALS: Goal[] = [
  { id: '1', label: 'CA mensuel',        target: 3000000, current: 0, unit: 'FCFA',         period: 'Mai 2026', color: 'var(--p2)',    icon: '💰', category: 'revenue'   },
  { id: '2', label: 'Nb transactions',   target: 200,     current: 0, unit: 'transactions', period: 'Mai 2026', color: 'var(--acc2)', icon: '🛒', category: 'revenue'   },
  { id: '3', label: 'Panier moyen',      target: 15000,   current: 0, unit: 'FCFA',         period: 'Mai 2026', color: 'var(--acc)',  icon: '🧺', category: 'revenue'   },
  { id: '4', label: 'Marge brute',       target: 30,      current: 0, unit: '%',            period: 'Mai 2026', color: 'var(--p2)',   icon: '📊', category: 'revenue'   },
  { id: '5', label: 'Nouveaux clients',  target: 20,      current: 0, unit: 'clients',      period: 'Mai 2026', color: '#F472B6',     icon: '👥', category: 'customers' },
  { id: '6', label: 'Taux rupture',      target: 5,       current: 0, unit: '%',            period: 'Mai 2026', color: 'var(--danger)', icon: '📦', category: 'stock'   },
]

const BLANK_GOAL: Goal = {
  id: '',
  label: '', target: 0, current: 0,
  unit: 'FCFA', period: 'Mai 2026',
  color: 'var(--p2)', icon: '🎯', category: 'revenue',
}

export default function Goals() {
  const { lang } = useAppStore()
  const fmt = useFormatAmount()

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('habashop-goals')
      return saved ? JSON.parse(saved) : DEFAULT_GOALS
    } catch {
      return DEFAULT_GOALS
    }
  })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [goalForm, setGoalForm] = useState<Goal>(BLANK_GOAL)

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
  }, [])

  useEffect(() => {
    localStorage.setItem('habashop-goals', JSON.stringify(goals))
  }, [goals])

  const openModal = (goal: Goal | null) => {
    setEditGoal(goal)
    setGoalForm(goal ? { ...goal } : { ...BLANK_GOAL, id: Date.now().toString() })
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
    if (pct >= 70) return 'warning'
    return 'danger'
  }

  const getStatusColor = (status: string) => ({
    success: 'var(--acc2)',
    warning: 'var(--acc)',
    danger: 'var(--danger)',
  }[status] ?? 'var(--text3)')

  const achieved = goals.filter(g => getStatus(g) === 'success').length
  const globalPct = Math.round(achieved / goals.length * 100)

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: 0 }}>
            🎯 {lang === 'fr' ? 'Objectifs & KPIs' : lang === 'en' ? 'Goals & KPIs' : lang === 'es' ? 'Objetivos & KPIs' : 'Obiettivi & KPI'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>
            {lang === 'fr' ? 'Suivez vos objectifs mensuels en temps réel'
              : lang === 'en' ? 'Track your monthly goals in real time'
              : lang === 'es' ? 'Siga sus objetivos mensuales en tiempo real'
              : 'Monitora i tuoi obiettivi mensili in tempo reale'}
          </p>
        </div>
        <button className="topbar-btn" onClick={() => openModal(null)}>
          + {lang === 'fr' ? 'Nouvel objectif' : 'New goal'}
        </button>
      </div>

      {/* Score global */}
      <div className="panel" style={{
        background: 'linear-gradient(135deg,rgba(91,78,232,.1),rgba(124,111,240,.05))',
        border: '1px solid rgba(91,78,232,.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {lang === 'fr' ? '🏆 Score global du mois' : '🏆 Monthly score'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {achieved}/{goals.length} {lang === 'fr' ? 'objectifs atteints' : 'goals achieved'}
            </div>
          </div>
          <div style={{
            fontSize: 42, fontWeight: 900,
            color: globalPct >= 80 ? 'var(--acc2)' : globalPct >= 50 ? 'var(--acc)' : 'var(--danger)',
            fontFamily: 'var(--mono)', letterSpacing: '-2px',
          }}>
            {globalPct}%
          </div>
        </div>
        <div style={{ height: 10, background: 'var(--bg4)', borderRadius: 99, marginTop: 12, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${globalPct}%`,
            background: globalPct >= 80
              ? 'linear-gradient(90deg,var(--acc2),#059669)'
              : globalPct >= 50
                ? 'linear-gradient(90deg,var(--acc),#D97706)'
                : 'linear-gradient(90deg,var(--danger),#DC2626)',
            borderRadius: 99, transition: 'width .5s ease',
          }} />
        </div>
      </div>

      {/* Grille objectifs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))',
        gap: 12,
      }}>
        {goals.map(goal => {
          const pct = goal.target > 0
            ? Math.min(100, Math.round((goal.current / goal.target) * 100))
            : 0
          const status = getStatus(goal)
          const statusColor = getStatusColor(status)

          return (
            <div key={goal.id} style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14, padding: '18px',
              borderLeft: `4px solid ${statusColor}`,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{goal.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{goal.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{goal.period}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: statusColor,
                    background: `${statusColor}22`,
                    borderRadius: 20, padding: '2px 8px',
                  }}>
                    {status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '🔴'}
                    {' '}{pct}%
                  </span>
                  <button className="mini-btn"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => openModal(goal)}>✏️</button>
                </div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 10,
              }}>
                <div>
                  <div style={{
                    fontSize: 22, fontWeight: 900,
                    color: statusColor, fontFamily: 'var(--mono)',
                    letterSpacing: '-1px',
                  }}>
                    {goal.unit === 'FCFA' ? fmt(goal.current)
                      : goal.current + (goal.unit === '%' ? ' %' : '')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {lang === 'fr' ? 'Actuel' : 'Current'}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: 'var(--text3)' }}>→</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 18, fontWeight: 700,
                    color: 'var(--text2)', fontFamily: 'var(--mono)',
                  }}>
                    {goal.unit === 'FCFA' ? fmt(goal.target)
                      : goal.target + (goal.unit === '%' ? ' %' : ' ' + goal.unit)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {lang === 'fr' ? 'Objectif' : 'Target'}
                  </div>
                </div>
              </div>

              <div style={{ height: 8, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg, ${statusColor}, ${statusColor}88)`,
                  borderRadius: 99, transition: 'width .5s ease',
                }} />
              </div>

              {pct < 100 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  {lang === 'fr' ? 'Reste :' : 'Remaining:'}{' '}
                  <span style={{ color: statusColor, fontWeight: 600 }}>
                    {goal.unit === 'FCFA'
                      ? fmt(goal.target - goal.current)
                      : (goal.target - goal.current) + (goal.unit === '%' ? ' %' : ' ' + goal.unit)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal édition */}
      {showEditModal && (
        <div className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {editGoal
                  ? (lang === 'fr' ? "✏️ Modifier l'objectif" : '✏️ Edit goal')
                  : (lang === 'fr' ? '🎯 Nouvel objectif' : '🎯 New goal')}
              </h3>
              <button className="mini-btn" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                    Icône
                  </label>
                  <input className="input"
                    value={goalForm.icon}
                    onChange={e => setGoalForm(f => ({ ...f, icon: e.target.value }))}
                    style={{ textAlign: 'center', fontSize: 20 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                    Label
                  </label>
                  <input className="input"
                    placeholder={lang === 'fr' ? 'Ex: CA mensuel' : 'Ex: Monthly revenue'}
                    value={goalForm.label}
                    onChange={e => setGoalForm(f => ({ ...f, label: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                    {lang === 'fr' ? 'Objectif cible' : 'Target'}
                  </label>
                  <input className="input" type="number"
                    value={goalForm.target || ''}
                    onChange={e => setGoalForm(f => ({ ...f, target: +e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                    {lang === 'fr' ? 'Valeur actuelle' : 'Current value'}
                  </label>
                  <input className="input" type="number"
                    value={goalForm.current || ''}
                    onChange={e => setGoalForm(f => ({ ...f, current: +e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                    Unité
                  </label>
                  <select className="input"
                    value={goalForm.unit}
                    onChange={e => setGoalForm(f => ({ ...f, unit: e.target.value as Goal['unit'] }))}>
                    <option value="FCFA">FCFA</option>
                    <option value="%">%</option>
                    <option value="clients">Clients</option>
                    <option value="transactions">Transactions</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                    {lang === 'fr' ? 'Période' : 'Period'}
                  </label>
                  <input className="input"
                    placeholder="Mai 2026"
                    value={goalForm.period}
                    onChange={e => setGoalForm(f => ({ ...f, period: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className="topbar-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    if (!goalForm.label || !goalForm.target) {
                      toast.error(lang === 'fr' ? 'Label et objectif requis' : 'Label and target required')
                      return
                    }
                    if (editGoal) {
                      setGoals(prev => prev.map(g => g.id === editGoal.id ? goalForm : g))
                      toast.success('✅ Objectif modifié')
                    } else {
                      setGoals(prev => [...prev, goalForm])
                      toast.success('✅ Objectif créé')
                    }
                    setShowEditModal(false)
                  }}>
                  ✅ {editGoal ? (lang === 'fr' ? 'Modifier' : 'Update') : (lang === 'fr' ? 'Créer' : 'Create')}
                </button>
                {editGoal && (
                  <button className="mini-btn"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => {
                      setGoals(prev => prev.filter(g => g.id !== editGoal.id))
                      setShowEditModal(false)
                      toast.success('🗑 Objectif supprimé')
                    }}>
                    🗑
                  </button>
                )}
                <button className="mini-btn" style={{ padding: '10px 16px' }}
                  onClick={() => setShowEditModal(false)}>
                  {lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
