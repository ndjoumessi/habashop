import React from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Employee {
  id: number
  name: string
  role: string
  dept: string
  salary: number
  type: 'CDI' | 'CDD'
  hiredAt: string
  endAt?: string
  avatar: string
  color: string
  active: boolean
  phone: string
  email: string
  perf?: number
  address?: string
  photoUrl?: string
}

export interface LeaveRequest {
  id: number
  empId: number
  empName?: string
  type: string
  from: string
  to: string
  days: number
  motif: string
  status: 'pending' | 'approved' | 'refused'
}

// ─── Static data ──────────────────────────────────────────────────────────────

export const STATIC_EMPLOYEES: Employee[] = [
  { id:1, name:'Marie Bakayoko',   role:'Caissière',   dept:'Ventes',     salary:350000, type:'CDI', hiredAt:'01/03/2023',                    avatar:'MB', color:'#6C3FD6', active:true,  phone:'+221 77 111 22 33', email:'marie@shop.com',   perf:5 },
  { id:2, name:'Kofi Diallo',      role:'Magasinier',  dept:'Stock',      salary:420000, type:'CDI', hiredAt:'15/06/2024',                    avatar:'KD', color:'#F59E0B', active:true,  phone:'+221 77 222 33 44', email:'kofi@shop.com',    perf:4 },
  { id:3, name:'Aminata Touré',    role:'Comptable',   dept:'Finance',    salary:280000, type:'CDD', hiredAt:'01/09/2025', endAt:'31/08/2026', avatar:'AT', color:'#10B981', active:true,  phone:'+221 77 333 44 55', email:'aminata@shop.com', perf:4 },
  { id:4, name:'Seydou Koné',      role:'Caissier',    dept:'Ventes',     salary:310000, type:'CDI', hiredAt:'10/05/2025',                    avatar:'SK', color:'#EF4444', active:true,  phone:'+221 77 444 55 66', email:'seydou@shop.com',  perf:3 },
  { id:5, name:'Fatoumata Ndiaye', role:'Responsable', dept:'Direction',  salary:480000, type:'CDI', hiredAt:'01/01/2022',                    avatar:'FN', color:'#3B82F6', active:true,  phone:'+221 77 555 66 77', email:'fatou@shop.com',   perf:5 },
  { id:6, name:'Ibrahim Sow',      role:'Livreur',     dept:'Logistique', salary:220000, type:'CDD', hiredAt:'01/02/2026', endAt:'31/07/2026', avatar:'IS', color:'#8B5CF6', active:false, phone:'+221 77 666 77 88', email:'ibrahim@shop.com', perf:2 },
]

export const POINTAGE: Record<number, Record<number, { status: 'present'|'retard'|'absent'|'conge'|'repos'; arrive?: string; depart?: string }>> = {
  1: { 0:{status:'present',arrive:'08:02',depart:'17:00'}, 1:{status:'present',arrive:'07:58',depart:'17:05'}, 2:{status:'retard',arrive:'09:35',depart:'17:00'}, 3:{status:'present',arrive:'08:01',depart:'17:02'}, 4:{status:'present',arrive:'07:55',depart:'17:00'}, 5:{status:'repos'}, 6:{status:'repos'} },
  2: { 0:{status:'present',arrive:'08:00',depart:'18:00'}, 1:{status:'present',arrive:'08:05',depart:'18:00'}, 2:{status:'present',arrive:'07:50',depart:'18:00'}, 3:{status:'present',arrive:'08:00',depart:'18:00'}, 4:{status:'present',arrive:'08:00',depart:'18:00'}, 5:{status:'present',arrive:'08:00',depart:'13:00'}, 6:{status:'repos'} },
  3: { 0:{status:'present',arrive:'08:30',depart:'17:00'}, 1:{status:'absent'}, 2:{status:'present',arrive:'08:25',depart:'17:00'}, 3:{status:'present',arrive:'08:30',depart:'17:00'}, 4:{status:'present',arrive:'08:28',depart:'17:00'}, 5:{status:'repos'}, 6:{status:'repos'} },
  4: { 0:{status:'present',arrive:'13:00',depart:'18:00'}, 1:{status:'present',arrive:'08:00',depart:'13:00'}, 2:{status:'present',arrive:'08:00',depart:'18:00'}, 3:{status:'retard',arrive:'14:20',depart:'18:00'}, 4:{status:'present',arrive:'08:00',depart:'13:00'}, 5:{status:'repos'}, 6:{status:'repos'} },
  5: { 0:{status:'conge'}, 1:{status:'conge'}, 2:{status:'conge'}, 3:{status:'conge'}, 4:{status:'conge'}, 5:{status:'repos'}, 6:{status:'repos'} },
  6: { 0:{status:'repos'}, 1:{status:'repos'}, 2:{status:'repos'}, 3:{status:'repos'}, 4:{status:'repos'}, 5:{status:'repos'}, 6:{status:'repos'} },
}

export const LEAVE_INIT: LeaveRequest[] = [
  { id:1, empId:5, empName:'Fatoumata Ndiaye', type:'Congé annuel',  from:'2026-05-11', to:'2026-05-17', days:5, motif:'Repos annuel planifié', status:'approved' },
  { id:2, empId:1, empName:'Marie Bakayoko',   type:'Congé maladie', from:'2026-04-02', to:'2026-04-03', days:2, motif:'Grippe',                status:'approved' },
  { id:3, empId:3, empName:'Aminata Touré',    type:'Congé annuel',  from:'2026-03-15', to:'2026-03-19', days:3, motif:'Voyage familial',       status:'approved' },
  { id:4, empId:2, empName:'Kofi Diallo',      type:'Congé annuel',  from:'2026-05-20', to:'2026-05-24', days:5, motif:'Vacances famille',      status:'pending'  },
  { id:5, empId:4, empName:'Seydou Koné',      type:'Congé maladie', from:'2026-05-16', to:'2026-05-16', days:1, motif:'Visite médicale',       status:'pending'  },
]

export const COLORS = ['#6C3FD6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#8B5CF6','#F472B6']
export const DEPT_COLORS: Record<string, string> = {
  'Ventes':     '#6C3FD6',
  'Stock':      '#F59E0B',
  'Finance':    '#10B981',
  'Direction':  '#3B82F6',
  'Logistique': '#8B5CF6',
  'Marketing':  '#EC4899',
  'RH':         '#EF4444',
}


export const STATUS_CFG = {
  present: { label:'Présent',  color:'var(--acc2)',    bg:'rgba(14,196,126,.12)'  },
  retard:  { label:'Retard',   color:'var(--acc)',     bg:'rgba(240,165,0,.12)'   },
  absent:  { label:'Absent',   color:'var(--danger)',  bg:'rgba(232,64,74,.12)'   },
  conge:   { label:'Congé',    color:'#60A5FA',        bg:'rgba(59,130,246,.12)'  },
  repos:   { label:'Repos',    color:'var(--text3)',   bg:'var(--bg3)'            },
}

export const LEAVE_STATUS_CFG = {
  pending:  { label:'En attente', color:'var(--acc)',    bg:'rgba(240,165,0,.12)'  },
  approved: { label:'Approuvé',   color:'var(--acc2)',   bg:'rgba(14,196,126,.12)' },
  refused:  { label:'Refusé',     color:'var(--danger)', bg:'rgba(232,64,74,.12)'  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toInputDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  try {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  } catch {}
  return ''
}

export function displayDate(dateStr: string | undefined | null, locale = 'fr-FR'): string {
  const iso = toInputDate(dateStr)
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale)
}

export function calcAnciennete(hiredAt: string): string {
  const iso = toInputDate(hiredAt)
  if (!iso) return '—'
  const months = Math.floor((new Date('2026-05-18').getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30))
  if (months < 0) return '—'
  const years = Math.floor(months / 12), rem = months % 12
  if (years >= 1) return `${years} an${years > 1 ? 's' : ''}${rem > 0 ? ` ${rem} mois` : ''}`
  return `${months} mois`
}

export function calcHeures(empId: number): string {
  let total = 0
  Object.values(POINTAGE[empId] ?? {}).forEach(p => {
    if (p.arrive && p.depart) {
      const [ah, am] = p.arrive.split(':').map(Number)
      const [dh, dm] = p.depart.split(':').map(Number)
      total += (dh * 60 + dm) - (ah * 60 + am)
    }
  })
  return `${Math.floor(total / 60)}h${total % 60 > 0 ? String(total % 60).padStart(2, '0') : ''}`
}

export function calcPonctualite(empId: number): number {
  let work = 0, ontime = 0
  Object.values(POINTAGE[empId] ?? {}).forEach(p => {
    if (['present','retard','absent'].includes(p.status)) { work++; if (p.status !== 'absent') ontime++ }
  })
  return work === 0 ? 100 : Math.round((ontime / work) * 100)
}


// ─── Avatar ───────────────────────────────────────────────────────────────────

export function EmpAvatar({ emp, size = 36 }: { emp: Employee; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${emp.color}, ${emp.color}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 800, color: '#fff', flexShrink: 0,
      boxShadow: `0 2px 8px ${emp.color}44`,
    }}>
      {emp.avatar}
    </div>
  )
}

// ─── Stars ────────────────────────────────────────────────────────────────────

export function Stars({ v = 0 }: { v: number }) {
  return (
    <span style={{ fontSize: 11 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < v ? '#F59E0B' : 'var(--border2)' }}>★</span>
      ))}
    </span>
  )
}

export const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.5px', color: 'var(--text3)', display: 'block', marginBottom: 6,
}
