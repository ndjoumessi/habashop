import { Clock, CheckCircle, XCircle, AlertTriangle, CheckCheck, Download, Umbrella, Coffee } from 'lucide-react'
import { type Employee, type AttendUiStatus, roleLabel, attendStatusLabel, EmpAvatar } from '@/components/hr/hrShared'
import { sanitizeCsv } from '@/lib/csv'
import { DateField } from '@/components/ui/DatePicker'

type AttendEntry = { in: string | null; out: string | null; status: AttendUiStatus }
interface Props {
  employees: Employee[]
  lang: string
  attendance: Record<string, AttendEntry>
  // Phase 2 : persistance backend (upsert) gérée par le parent ; ce tab fournit l'entrée complète.
  onSaveAttendance: (empId: string, date: string, entry: AttendEntry) => void
  attendanceDate: string; setAttendanceDate: (v: string) => void
}

export default function HRAttendanceTab({ employees, lang, attendance, onSaveAttendance, attendanceDate, setAttendanceDate }: Props) {
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
    present: { label: lang === 'en' ? 'Present' : lang === 'es' ? 'Presente' : lang === 'it' ? 'Presente' : 'Présent',  color:'var(--acc2)', bg:'rgba(0,208,132,.1)',  icon:<CheckCircle size={16}/> },
    late:    { label: lang === 'en' ? 'Late' : lang === 'es' ? 'Retraso' : lang === 'it' ? 'Ritardo' : 'Retard',      color:'#F59E0B', bg:'rgba(245,158,11,.1)', icon:<Clock size={16}/> },
    absent:  { label: lang === 'en' ? 'Absent' : lang === 'es' ? 'Ausente' : lang === 'it' ? 'Assente' : 'Absent',    color:'#EF4444', bg:'rgba(239,68,68,.1)',  icon:<XCircle size={16}/> },
    half:    { label: lang === 'en' ? 'Half' : lang === 'es' ? 'Media jornada' : lang === 'it' ? 'Mezza giornata' : 'Mi-temps',    color:'#3B82F6', bg:'rgba(59,130,246,.1)', icon:<AlertTriangle size={16}/> },
    leave:   { label: lang === 'en' ? 'Leave' : lang === 'es' ? 'Permiso' : lang === 'it' ? 'Congedo' : 'Congé',  color:'#14B8A6', bg:'rgba(20,184,166,.12)', icon:<Umbrella size={16}/> },
    rest:    { label: lang === 'en' ? 'Rest' : lang === 'es' ? 'Descanso' : lang === 'it' ? 'Riposo' : 'Repos',   color:'#64748B', bg:'rgba(100,116,139,.14)', icon:<Coffee size={16}/> },
  }

  const dayEmp = employees.filter(e => e.active !== false)
  const todayKey = attendanceDate

  const countByStatus = (s: string) => dayEmp.filter(e => (attendance[`${String(e.id)}_${todayKey}`]?.status ?? 'absent') === s).length
  const presentCount = countByStatus('present') + countByStatus('late') + countByStatus('half')

  const exportAttendanceCSV = () => {
    const rows = dayEmp.map(e => {
      const key = `${String(e.id)}_${todayKey}`
      const a = attendance[key]
      return [e.name, roleLabel(e.role, lang), attendStatusLabel(a?.status ?? 'absent', lang), a?.in ?? '—', a?.out ?? '—']
    })
    const header = [
      lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé',
      lang === 'en' ? 'Role' : lang === 'es' ? 'Puesto' : lang === 'it' ? 'Ruolo' : 'Poste',
      lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut',
      lang === 'en' ? 'Arrival' : lang === 'es' ? 'Llegada' : lang === 'it' ? 'Arrivo' : 'Arrivée',
      lang === 'en' ? 'Departure' : lang === 'es' ? 'Salida' : lang === 'it' ? 'Uscita' : 'Départ',
    ]
    const lines = [header, ...rows]
    // ⚠️ `sanitizeCsv` sur chaque cellule : sans lui, un nom saisi par l'utilisateur
    // et commençant par `=`/`+`/`-`/`@` s'exécute comme formule à l'ouverture (#173).
    const csv = lines.map(r => r.map(sanitizeCsv).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const fname = lang === 'en' ? 'attendance' : lang === 'es' ? 'asistencia' : lang === 'it' ? 'presenze' : 'pointage'
    a.href = url; a.download = `${fname}_${todayKey}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const markAllPresent = () => {
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    dayEmp.forEach(e => onSaveAttendance(String(e.id), todayKey, { in: hhmm, out: null, status: 'present' }))
  }

  const setEmpField = (empId: string, field: 'in'|'out'|'status', value: string) => {
    const prevEntry = attendance[`${empId}_${todayKey}`] ?? { in: null, out: null, status: 'absent' as AttendUiStatus }
    onSaveAttendance(empId, todayKey, { ...prevEntry, [field]: value } as AttendEntry)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Header toolbar */}
      <div className="panel" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <span style={{ fontSize:'var(--fs-md)', fontWeight:'var(--fw-bold)', color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
          <Clock size={16}/> {lang === 'en' ? 'Attendance sheet' : lang === 'es' ? 'Hoja de asistencia' : lang === 'it' ? 'Foglio presenze' : 'Feuille de présence'}
        </span>
        <DateField
          ariaLabel={lang === 'en' ? 'Attendance date' : lang === 'es' ? 'Fecha de asistencia' : lang === 'it' ? 'Data presenze' : 'Date de la feuille de présence'}
          value={attendanceDate}
          onChange={setAttendanceDate}
          style={{ width:178 }} />
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn btn-sm" onClick={markAllPresent} style={{display:'flex',alignItems:'center',gap:5}}>
            <CheckCheck size={13}/> {lang === 'en' ? 'All present' : lang === 'es' ? 'Todos presentes' : lang === 'it' ? 'Tutti presenti' : 'Tous présents'}
          </button>
          <button className="btn btn-sm" onClick={exportAttendanceCSV} style={{display:'flex',alignItems:'center',gap:5}}>
            <Download size={13}/> CSV
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          // hex LITTÉRAL (concaténé `${k.hex}28`/`18`) comme les 3 sœurs ci-dessous : un var(--x) casserait le bord/dégradé en silence.
          { icon:<CheckCircle size={20}/>, label:lang === 'en' ? 'Present' : lang === 'es' ? 'Presentes' : lang === 'it' ? 'Presenti' : 'Présents',  count:presentCount,          color:'#22C77A', hex:'#22C77A' },
          { icon:<Clock size={20}/>,       label:lang === 'en' ? 'Late' : lang === 'es' ? 'Retrasos' : lang === 'it' ? 'Ritardi' : 'Retards',      count:countByStatus('late'), color:'#F59E0B', hex:'#F59E0B' },
          { icon:<XCircle size={20}/>,     label:lang === 'en' ? 'Absent' : lang === 'es' ? 'Ausentes' : lang === 'it' ? 'Assenti' : 'Absents',    count:countByStatus('absent'),color:'#EF4444', hex:'#EF4444' },
          { icon:<AlertTriangle size={20}/>,label:lang === 'en' ? 'Half-day' : lang === 'es' ? 'Media jornada' : lang === 'it' ? 'Mezza giornata' : 'Mi-temps', count:countByStatus('half'), color:'#3B82F6', hex:'#3B82F6' },
        ].map(k => (
          <div key={k.label} className="panel" style={{ padding:'12px 14px', position:'relative', overflow:'hidden', background:`linear-gradient(135deg,${k.hex}18,${k.hex}06)`, border:`1px solid ${k.hex}28` }}>
            <div style={{ position:'absolute', top:-16, right:-16, width:64, height:64, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}20 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div style={{ color:k.color, marginBottom:6, display:'flex' }}>{k.icon}</div>
            <div style={{ fontSize:'var(--fs-2xl)', fontWeight:'var(--fw-bold)', color:k.color, fontFamily:'var(--mono)' }}>{k.count}</div>
            <div style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', textTransform:'uppercase', color:'var(--text3)', marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Employee rows */}
      <div className="panel" style={{ overflow:'hidden', padding:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 88px 80px 96px 248px', gap:0, padding:'10px 16px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', fontSize:'var(--fs-caption)', fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)' }}>
          <span>{lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}</span>
          <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'}</span>
          <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Arrival' : lang === 'es' ? 'Llegada' : lang === 'it' ? 'Arrivo' : 'Arrivée'}</span>
          <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Departure' : lang === 'es' ? 'Salida' : lang === 'it' ? 'Uscita' : 'Départ'}</span>
          <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Actions' : lang === 'es' ? 'Acciones' : lang === 'it' ? 'Azioni' : 'Actions'}</span>
        </div>

        {/* ⚠️ LÉGENDE — c'est ELLE le correctif, pas le style des boutons. Six icônes
            muettes exigeaient six survols pour être comprises, et l'infobulle n'existe
            pas au toucher. La légende les enseigne UNE fois, en haut, et le coût est
            payé une seule fois par le lecteur. */}
        <div className="att-legend">
          {(['present','late','absent','half','leave','rest'] as const).map(st => (
            <span key={st} className="att-legend-item">
              <span className="att-legend-dot" style={{ color: STATUS_CONFIG[st].color, background: STATUS_CONFIG[st].bg }}>
                {STATUS_CONFIG[st].icon}
              </span>
              {STATUS_CONFIG[st].label}
            </span>
          ))}
        </div>
        {dayEmp.map((emp, i) => {
          const key = `${String(emp.id)}_${todayKey}`
          const a = attendance[key] ?? { in: null, out: null, status: 'absent' as const }
          const sc = STATUS_CONFIG[a.status]
          return (
            <div key={emp.id} style={{
              display:'grid', gridTemplateColumns:'1fr 88px 80px 96px 248px',
              alignItems:'center', gap:0,
              padding:'10px 16px',
              borderBottom: i < dayEmp.length-1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'var(--bg4)',
            }}>
              {/* Employé */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {/* ⚠️ Troisième copie du même avatar, la seule à teinte plate. En laisser
                    une seule en ligne rouvrirait la dérive qu'on ferme : c'est précisément
                    ainsi que la photo s'affichait dans la fiche et nulle part ailleurs.
                    Le dessin s'harmonise sur les autres écrans — assumé, et dit. */}
                <EmpAvatar emp={emp} size={32} radius={8} />
                <div>
                  <div style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>{emp.name.split(' ')[0]}</div>
                  <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)' }}>{roleLabel(emp.role, lang)}</div>
                </div>
              </div>
              {/* Statut badge */}
              <div style={{ display:'flex', justifyContent:'center' }}>
                <span style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', padding:'3px 9px', borderRadius:'var(--r-full)', background:sc.bg, color:sc.color, display:'inline-flex', alignItems:'center', gap:4 }}>
                  {sc.icon} {attendStatusLabel(a.status, lang)}
                </span>
              </div>
              {/* Heure arrivée */}
              <div style={{ display:'flex', justifyContent:'center' }}>
                <input type="time" className="input" value={a.in ?? ''}
                  onChange={e => setEmpField(String(emp.id), 'in', e.target.value)}
                  style={{ width:80, height:30, fontSize:'var(--fs-label)', textAlign:'center', padding:'0 4px' }} />
              </div>
              {/* Heure départ */}
              <div style={{ display:'flex', justifyContent:'center' }}>
                <input type="time" className="input" value={a.out ?? ''}
                  onChange={e => setEmpField(String(emp.id), 'out', e.target.value)}
                  style={{ width:80, height:30, fontSize:'var(--fs-label)', textAlign:'center', padding:'0 4px' }} />
              </div>
              {/* Boutons statut */}
              {/* ⚠️ CONTRÔLE SEGMENTÉ, pas six boutons. Six carrés détachés se lisent
                  « six actions » ; ici c'est UNE décision — le statut de la journée — et
                  la forme doit le dire. `role="radiogroup"` porte cette sémantique aux
                  lecteurs d'écran, que six <button> ne donnaient pas.
                  ⚠️ `aria-label` EN PLUS de `title` : l'infobulle n'apparaît JAMAIS au
                  toucher, et c'est sur mobile qu'un gérant fait l'appel. */}
              <div className="att-seg" role="radiogroup"
                aria-label={`${lang === 'en' ? 'Attendance status' : lang === 'es' ? 'Estado de asistencia' : lang === 'it' ? 'Stato presenza' : 'Statut de présence'} — ${emp.name}`}>
                {(['present','late','absent','half','leave','rest'] as const).map(st => {
                  const actif = a.status === st
                  return (
                    <button key={st} type="button"
                      role="radio" aria-checked={actif}
                      onClick={() => setEmpField(String(emp.id), 'status', st)}
                      title={STATUS_CONFIG[st].label}
                      aria-label={`${STATUS_CONFIG[st].label} — ${emp.name}`}
                      className={`att-seg-btn${actif ? ' att-seg-on' : ''}`}
                      style={{
                        // La couleur du statut porte l'identité de chaque segment, même
                        // inactif : autrement les six ne se distinguent qu'une fois cliqués.
                        color: STATUS_CONFIG[st].color,
                        background: actif ? STATUS_CONFIG[st].bg : undefined,
                        boxShadow: actif ? `inset 0 0 0 1.5px ${STATUS_CONFIG[st].color}` : undefined,
                      }}>
                      {STATUS_CONFIG[st].icon}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary footer */}
      <div className="panel" style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <span style={{ fontSize:'var(--fs-label)', color:'var(--text3)' }}>
          {lang === 'en' ? 'Day of' : lang === 'es' ? 'Día del' : lang === 'it' ? 'Giornata del' : 'Journée du'} <strong style={{ color:'var(--text)' }}>{new Date(attendanceDate + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { weekday:'long', day:'numeric', month:'long' })}</strong>
        </span>
        <span style={{ fontSize:'var(--fs-label)', color:'var(--text3)', marginLeft:'auto' }}>
          {presentCount}/{dayEmp.length} {lang === 'en' ? 'present' : lang === 'es' ? 'presentes' : lang === 'it' ? 'presenti' : 'présents'} · {dayEmp.length > 0 ? Math.round(presentCount/dayEmp.length*100) : 0}% {lang === 'en' ? 'attendance rate' : lang === 'es' ? 'de asistencia' : lang === 'it' ? 'di presenza' : 'de présence'}
        </span>
      </div>
    </div>
  )
}
