import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import type { Lang } from '@/i18n'
import { fmtDate } from '@/lib/formatDate'
import {
  type IsoDate, type Period, type RangeIso,
  PERIOD_ORDER, presetRange, monthGrid, parseIso, isoOf, addMonths,
  sameDay, inRange, orderRange, parseMonthKey, monthKeyOf,
} from '@/lib/dateRange'

/**
 * SÉLECTEURS DE DATE — pastille + panneau maison, à la place du calendrier du navigateur.
 *
 * ─── CE QUI EST DÉLIBÉRÉ, ET QU'IL NE FAUT PAS « SIMPLIFIER » ────────────────
 *
 * ① LE PORTEUR DE VALEUR RESTE UN `<input type="date">` NATIF.
 *    On ne remplace que le CALENDRIER, jamais le champ. Trois raisons, toutes mesurées :
 *    — `hrContractDomain.test.ts` verrouille `type === 'date'` sur les dates d'embauche.
 *      Son intention écrite est d'interdire la SAISIE LIBRE (le champ l'était), pas
 *      d'interdire un calendrier maison. Garder l'input satisfait les deux.
 *    — le clavier et les lecteurs d'écran gardent le chemin qu'ils connaissent ; un
 *      `<button>` porteur de date les aurait forcés à passer par la grille.
 *    — sur mobile, taper le champ ouvre le sélecteur natif, meilleur au doigt que 42
 *      cases de 30 px. On ne lui prend pas ce chemin.
 *    L'indicateur natif (la petite icône du navigateur) est masqué en CSS : c'est LUI
 *    qui ouvrait le calendrier moche, et lui seul.
 *
 * ② LE PANNEAU EST EN PORTAIL, PAS EN `position:absolute`.
 *    `.modal-box` porte `overflow:hidden` + `overflow-y:auto` : un panneau absolu y
 *    serait ROGNÉ, et 9 des 11 champs de date de l'app vivent dans une modale. Un
 *    portail vers `document.body` échappe aussi aux ancêtres `transform`, qui cassent
 *    `position:fixed` (cf. § Pièges techniques).
 *
 * ③ « APPLIQUER » N'EST JAMAIS DÉSACTIVÉ PAR LA VALIDATION.
 *    Règle méta `landingClaims.test.ts` : un bouton éteint gronde avant l'erreur, ne dit
 *    pas ce qui manque, et n'affiche aucune infobulle au toucher. Sélection incomplète →
 *    on NOMME le jour manquant et on donne le focus à la grille.
 */

/* ── Libellés, dans les QUATRE langues ─────────────────────────────────────── */

const MOIS: Record<Lang, readonly string[]> = {
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
}

/** Initiales des jours, SEMAINE COMMENÇANT LUNDI (convention FR/ES/IT, et la plus lue ici). */
const JOURS: Record<Lang, readonly string[]> = {
  fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  it: ['L', 'M', 'M', 'G', 'V', 'S', 'D'],
}

/** Nom complet du jour, pour l'étiquette accessible de chaque case. */
const JOURS_LONGS: Record<Lang, readonly string[]> = {
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  es: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  it: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
}

export const PERIOD_LABELS: Record<Lang, Record<Period, string>> = {
  fr: { today: "Aujourd'hui", yesterday: 'Hier', '7days': '7 derniers jours', '30days': '30 derniers jours', thisMonth: 'Ce mois-ci', lastMonth: 'Mois dernier', '3months': '3 derniers mois', year: 'Cette année' },
  en: { today: 'Today', yesterday: 'Yesterday', '7days': 'Last 7 days', '30days': 'Last 30 days', thisMonth: 'This month', lastMonth: 'Last month', '3months': 'Last 3 months', year: 'This year' },
  es: { today: 'Hoy', yesterday: 'Ayer', '7days': 'Últimos 7 días', '30days': 'Últimos 30 días', thisMonth: 'Este mes', lastMonth: 'Mes pasado', '3months': 'Últimos 3 meses', year: 'Este año' },
  it: { today: 'Oggi', yesterday: 'Ieri', '7days': 'Ultimi 7 giorni', '30days': 'Ultimi 30 giorni', thisMonth: 'Questo mese', lastMonth: 'Mese scorso', '3months': 'Ultimi 3 mesi', year: "Quest'anno" },
}

const TXT = {
  ouvrir:    { fr: 'Ouvrir le calendrier', en: 'Open calendar', es: 'Abrir el calendario', it: 'Apri il calendario' },
  moisPrec:  { fr: 'Mois précédent', en: 'Previous month', es: 'Mes anterior', it: 'Mese precedente' },
  moisSuiv:  { fr: 'Mois suivant', en: 'Next month', es: 'Mes siguiente', it: 'Mese successivo' },
  anneePrec: { fr: 'Année précédente', en: 'Previous year', es: 'Año anterior', it: 'Anno precedente' },
  anneeSuiv: { fr: 'Année suivante', en: 'Next year', es: 'Año siguiente', it: 'Anno successivo' },
  effacer:   { fr: 'Effacer', en: 'Clear', es: 'Borrar', it: 'Cancella' },
  appliquer: { fr: 'Appliquer', en: 'Apply', es: 'Aplicar', it: 'Applica' },
  du:        { fr: 'Du', en: 'From', es: 'Desde', it: 'Dal' },
  au:        { fr: 'au', en: 'to', es: 'hasta', it: 'al' },
  choisir:   { fr: 'Choisir une période', en: 'Choose a period', es: 'Elegir un período', it: 'Scegli un periodo' },
  aucune:    { fr: 'Aucune date', en: 'No date', es: 'Sin fecha', it: 'Nessuna data' },
  manqueFin: { fr: 'Choisissez le jour de FIN de la période.', en: 'Pick the END day of the period.', es: 'Elija el día de FIN del período.', it: 'Scegli il giorno di FINE del periodo.' },
  manqueDeb: { fr: 'Choisissez le jour de DÉBUT de la période.', en: 'Pick the START day of the period.', es: 'Elija el día de INICIO del período.', it: 'Scegli il giorno di INIZIO del periodo.' },
  raccourcis:{ fr: 'Raccourcis de période', en: 'Period shortcuts', es: 'Atajos de período', it: 'Scorciatoie di periodo' },
}
const tr = (lang: Lang, k: keyof typeof TXT) => TXT[k][lang] ?? TXT[k].fr

/* ── Panneau flottant : portail + placement + fermeture ────────────────────── */

interface PanneauProps {
  ouvert: boolean
  ancre: HTMLElement | null
  onFermer: () => void
  label: string
  children: React.ReactNode
  largeur?: number
}

/**
 * ⚠️ Le panneau est TOUJOURS monté quand `ouvert`, d'abord invisible : il faut le
 * mesurer pour savoir s'il déborde. Le placer d'après une taille supposée puis corriger
 * ferait sauter le panneau sous le curseur au premier rendu.
 */
function Panneau({ ouvert, ancre, onFermer, label, children, largeur }: PanneauProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!ouvert || !ancre) { setPos(null); return }
    const placer = () => {
      const r = ancre.getBoundingClientRect()
      const el = ref.current
      const pw = el?.offsetWidth || largeur || 320
      const ph = el?.offsetHeight || 380
      const vw = window.innerWidth, vh = window.innerHeight
      let left = r.left
      let top = r.bottom + 8
      if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8)
      if (left < 8) left = 8
      // Débordement en bas → on bascule AU-DESSUS de l'ancre si la place y est.
      if (top + ph > vh - 8) {
        const dessus = r.top - ph - 8
        top = dessus >= 8 ? dessus : Math.max(8, vh - ph - 8)
      }
      setPos({ left, top })
    }
    placer()
    window.addEventListener('resize', placer)
    // `true` = phase de capture : un panneau ouvert au-dessus d'une modale doit suivre
    // le défilement de CETTE modale, pas seulement celui de la fenêtre.
    window.addEventListener('scroll', placer, true)
    return () => { window.removeEventListener('resize', placer); window.removeEventListener('scroll', placer, true) }
  }, [ouvert, ancre, largeur])

  useEffect(() => {
    if (!ouvert) return
    const surClic = (e: MouseEvent) => {
      const c = e.target as Node
      if (ref.current?.contains(c)) return
      if (ancre?.contains(c)) return
      onFermer()
    }
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onFermer() } }
    document.addEventListener('mousedown', surClic)
    document.addEventListener('keydown', surTouche, true)
    return () => { document.removeEventListener('mousedown', surClic); document.removeEventListener('keydown', surTouche, true) }
  }, [ouvert, ancre, onFermer])

  if (!ouvert) return null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      className="dp-panel"
      style={{
        position: 'fixed',
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        width: largeur,
      }}
    >{children}</div>,
    document.body,
  )
}

/* ── Grille d'un mois ──────────────────────────────────────────────────────── */

interface GrilleProps {
  lang: Lang
  curseur: Date                       // mois affiché
  setCurseur: (d: Date) => void
  estChoisi: (d: Date) => boolean
  estDansPlage?: (d: Date) => boolean
  estBorne?: (d: Date) => boolean
  onChoisir: (d: Date) => void
  min?: Date | null
  max?: Date | null
  aujourdhui: Date
}

function Grille({ lang, curseur, setCurseur, estChoisi, estDansPlage, estBorne, onChoisir, min, max, aujourdhui }: GrilleProps) {
  const cases = useMemo(() => monthGrid(curseur.getFullYear(), curseur.getMonth()), [curseur])
  // Case porteuse du focus clavier (tabindex tournant) : la sélection, sinon aujourd'hui,
  // sinon le 1er du mois. 42 cases tabulables rendraient la tabulation inutilisable.
  const [focusJour, setFocusJour] = useState<Date>(() => cases.find(estChoisi) ?? (cases.find(d => sameDay(d, aujourdhui)) ?? new Date(curseur.getFullYear(), curseur.getMonth(), 1)))
  const grilleRef = useRef<HTMLDivElement | null>(null)
  const doitFocus = useRef(false)

  useEffect(() => {
    if (!doitFocus.current) return
    doitFocus.current = false
    const el = grilleRef.current?.querySelector<HTMLButtonElement>('[data-dp-focus="1"]')
    el?.focus()
  })

  const horsBornes = (d: Date) =>
    (!!min && d.getTime() < min.getTime()) || (!!max && d.getTime() > max.getTime())

  const bouger = (delta: number) => {
    const n = new Date(focusJour.getFullYear(), focusJour.getMonth(), focusJour.getDate() + delta)
    setFocusJour(n)
    doitFocus.current = true
    if (n.getMonth() !== curseur.getMonth() || n.getFullYear() !== curseur.getFullYear()) setCurseur(new Date(n.getFullYear(), n.getMonth(), 1))
  }

  const surTouche = (e: React.KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowLeft') { e.preventDefault(); bouger(-1) }
    else if (k === 'ArrowRight') { e.preventDefault(); bouger(1) }
    else if (k === 'ArrowUp') { e.preventDefault(); bouger(-7) }
    else if (k === 'ArrowDown') { e.preventDefault(); bouger(7) }
    else if (k === 'PageUp') { e.preventDefault(); const n = addMonths(focusJour, -1); setFocusJour(n); doitFocus.current = true; setCurseur(new Date(n.getFullYear(), n.getMonth(), 1)) }
    else if (k === 'PageDown') { e.preventDefault(); const n = addMonths(focusJour, 1); setFocusJour(n); doitFocus.current = true; setCurseur(new Date(n.getFullYear(), n.getMonth(), 1)) }
  }

  return (
    <div>
      <div className="dp-nav">
        <button type="button" className="dp-nav-btn" aria-label={tr(lang, 'moisPrec')}
          onClick={() => setCurseur(addMonths(curseur, -1))}><ChevronLeft size={16} /></button>
        <div className="dp-nav-title" aria-live="polite">
          {MOIS[lang][curseur.getMonth()]} {curseur.getFullYear()}
        </div>
        <button type="button" className="dp-nav-btn" aria-label={tr(lang, 'moisSuiv')}
          onClick={() => setCurseur(addMonths(curseur, 1))}><ChevronRight size={16} /></button>
      </div>

      <div className="dp-weekdays" aria-hidden="true">
        {JOURS[lang].map((j, k) => <span key={k}>{j}</span>)}
      </div>

      <div ref={grilleRef} className="dp-grid" role="grid" onKeyDown={surTouche}>
        {cases.map((d) => {
          const dansLeMois = d.getMonth() === curseur.getMonth()
          const choisi = estChoisi(d)
          const borne = estBorne?.(d) ?? choisi
          const dedans = estDansPlage?.(d) ?? false
          const desactive = horsBornes(d)
          const porteFocus = sameDay(d, focusJour)
          const classes = ['dp-day']
          if (!dansLeMois) classes.push('dp-day-out')
          if (dedans && !borne) classes.push('dp-day-in')
          if (borne) classes.push('dp-day-on')
          if (sameDay(d, aujourdhui) && !borne) classes.push('dp-day-today')
          const jourSemaine = (d.getDay() + 6) % 7
          return (
            <button
              key={d.getTime()}
              type="button"
              role="gridcell"
              data-dp-focus={porteFocus ? '1' : undefined}
              tabIndex={porteFocus ? 0 : -1}
              className={classes.join(' ')}
              aria-current={sameDay(d, aujourdhui) ? 'date' : undefined}
              aria-pressed={borne}
              aria-disabled={desactive || undefined}
              aria-label={`${JOURS_LONGS[lang][jourSemaine]} ${d.getDate()} ${MOIS[lang][d.getMonth()]} ${d.getFullYear()}`}
              onClick={() => { if (desactive) return; setFocusJour(d); onChoisir(d) }}
            >{d.getDate()}</button>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   ① DATE UNIQUE — remplace `<input type="date">` nu
   ══════════════════════════════════════════════════════════════════════════════ */

export interface DateFieldProps {
  value: IsoDate
  onChange: (v: IsoDate) => void
  /** Étiquette accessible portée par l'INPUT — c'est lui que les tests interrogent. */
  ariaLabel: string
  min?: IsoDate
  max?: IsoDate
  className?: string
  style?: React.CSSProperties
  /**
   * Posé sur l'INPUT, pas sur la pastille. `e2e/subscriptions-modal.shot.mjs` fait
   * `locator('#sub-start-date').fill(…)` : le sélecteur doit désigner le champ qui
   * porte la valeur, sinon `.fill()` échoue sur un `<div>`.
   */
  id?: string
  /** `now` injectable — jamais de littéral de date (cf. § Pièges techniques). */
  now?: Date
}

export function DateField({ value, onChange, ariaLabel, min, max, className, style, id, now }: DateFieldProps) {
  const lang = useAppStore(s => s.lang) as Lang
  const [ouvert, setOuvert] = useState(false)
  const ancreRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const aujourdhui = useMemo(() => { const d = now ?? new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }, [now])
  const choisie = parseIso(value)
  const [curseur, setCurseur] = useState<Date>(() => choisie ?? aujourdhui)

  useEffect(() => { if (ouvert) setCurseur(parseIso(value) ?? aujourdhui) }, [ouvert, value, aujourdhui])

  const fermer = useCallback(() => { setOuvert(false); inputRef.current?.focus() }, [])

  return (
    <div className={`dp-pill ${className ?? ''}`} ref={ancreRef} style={style}>
      <input
        ref={inputRef}
        id={id}
        type="date"
        className="dp-pill-input"
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className="dp-pill-btn"
        aria-label={`${tr(lang, 'ouvrir')} — ${ariaLabel}`}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => setOuvert(o => !o)}
      ><CalendarIcon size={15} /></button>

      <Panneau ouvert={ouvert} ancre={ancreRef.current} onFermer={() => setOuvert(false)} label={ariaLabel} largeur={286}>
        <Grille
          lang={lang} curseur={curseur} setCurseur={setCurseur} aujourdhui={aujourdhui}
          estChoisi={d => sameDay(d, choisie)}
          min={parseIso(min)} max={parseIso(max)}
          onChoisir={d => { onChange(isoOf(d)); fermer() }}
        />
        <div className="dp-foot">
          <button type="button" className="dp-foot-clear" onClick={() => { onChange(''); fermer() }}>
            <X size={13} /> {tr(lang, 'effacer')}
          </button>
          <button type="button" className="dp-foot-apply" onClick={() => { onChange(isoOf(aujourdhui)); fermer() }}>
            <Check size={13} /> {PERIOD_LABELS[lang].today}
          </button>
        </div>
      </Panneau>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   ② MOIS — remplace `<input type="month">` (paie)
   ══════════════════════════════════════════════════════════════════════════════ */

export interface MonthFieldProps {
  value: string                        // 'YYYY-MM'
  onChange: (v: string) => void
  ariaLabel: string
  className?: string
  style?: React.CSSProperties
  now?: Date
}

export function MonthField({ value, onChange, ariaLabel, className, style, now }: MonthFieldProps) {
  const lang = useAppStore(s => s.lang) as Lang
  const [ouvert, setOuvert] = useState(false)
  const ancreRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const base = useMemo(() => now ?? new Date(), [now])
  const choisi = parseMonthKey(value)
  const [annee, setAnnee] = useState<number>(() => (choisi ?? base).getFullYear())

  useEffect(() => { if (ouvert) setAnnee((parseMonthKey(value) ?? base).getFullYear()) }, [ouvert, value, base])

  return (
    <div className={`dp-pill ${className ?? ''}`} ref={ancreRef} style={style}>
      <input
        ref={inputRef}
        type="month"
        className="dp-pill-input"
        value={value}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className="dp-pill-btn"
        aria-label={`${tr(lang, 'ouvrir')} — ${ariaLabel}`}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        onClick={() => setOuvert(o => !o)}
      ><CalendarIcon size={15} /></button>

      <Panneau ouvert={ouvert} ancre={ancreRef.current} onFermer={() => setOuvert(false)} label={ariaLabel} largeur={252}>
        <div className="dp-nav">
          <button type="button" className="dp-nav-btn" aria-label={tr(lang, 'anneePrec')}
            onClick={() => setAnnee(a => a - 1)}><ChevronLeft size={16} /></button>
          <div className="dp-nav-title">{annee}</div>
          <button type="button" className="dp-nav-btn" aria-label={tr(lang, 'anneeSuiv')}
            onClick={() => setAnnee(a => a + 1)}><ChevronRight size={16} /></button>
        </div>
        <div className="dp-months">
          {MOIS[lang].map((nom, idx) => {
            const cle = monthKeyOf(new Date(annee, idx, 1))
            const actif = cle === value
            return (
              <button key={idx} type="button"
                className={`dp-month ${actif ? 'dp-month-on' : ''}`}
                aria-pressed={actif}
                onClick={() => { onChange(cle); setOuvert(false); inputRef.current?.focus() }}
              >{nom.slice(0, 4)}</button>
            )
          })}
        </div>
      </Panneau>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   ③ PLAGE + RACCOURCIS — le sélecteur de période des Rapports
   ══════════════════════════════════════════════════════════════════════════════ */

export interface DateRangeFieldProps {
  from: IsoDate
  to: IsoDate
  /** Raccourci actif, ou `null` quand la plage a été saisie à la main. */
  preset: Period | null
  onChange: (next: { preset: Period | null; from: IsoDate; to: IsoDate }) => void
  /** Raccourci utilisé par « Effacer » — l'état par défaut de l'écran appelant. */
  presetParDefaut: Period
  ariaLabel?: string
  now?: Date
}

export function DateRangeField({ from, to, preset, onChange, presetParDefaut, ariaLabel, now }: DateRangeFieldProps) {
  const lang = useAppStore(s => s.lang) as Lang
  const [ouvert, setOuvert] = useState(false)
  const ancreRef = useRef<HTMLButtonElement | null>(null)
  const aujourdhui = useMemo(() => { const d = now ?? new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }, [now])

  // BROUILLON : rien n'est appliqué avant « Appliquer ». Un filtre qui se recalcule à
  // chaque clic ferait recharger le rapport deux fois pour une seule plage.
  const [dFrom, setDFrom] = useState<IsoDate>(from)
  const [dTo, setDTo] = useState<IsoDate>(to)
  const [dPreset, setDPreset] = useState<Period | null>(preset)
  const [manque, setManque] = useState<string>('')
  const [curseur, setCurseur] = useState<Date>(() => parseIso(from) ?? aujourdhui)

  useEffect(() => {
    if (!ouvert) return
    setDFrom(from); setDTo(to); setDPreset(preset); setManque('')
    setCurseur(parseIso(from) ?? aujourdhui)
  }, [ouvert, from, to, preset, aujourdhui])

  const libelle = from && to
    ? `${fmtDate(from)} — ${fmtDate(to)}`
    : (preset ? PERIOD_LABELS[lang][preset] : tr(lang, 'aucune'))

  const choisirPreset = (p: Period) => {
    const r = presetRange(p, aujourdhui)
    setDPreset(p); setDFrom(r.from); setDTo(r.to); setManque('')
    setCurseur(parseIso(r.from) ?? aujourdhui)
  }

  /** Clic sur un jour : 1er clic = début (et on repart de zéro), 2ᵉ = fin. */
  const choisirJour = (d: Date) => {
    const iso = isoOf(d)
    setManque('')
    setDPreset(null)
    if (!dFrom || (dFrom && dTo)) { setDFrom(iso); setDTo('') }
    else { const o = orderRange(dFrom, iso); setDFrom(o.from); setDTo(o.to) }
  }

  const plage: RangeIso = { from: dFrom, to: dTo }

  const appliquer = () => {
    // ⚠️ PAS de `disabled` sur ce bouton (règle méta) : on NOMME ce qui manque.
    if (!dFrom) { setManque(tr(lang, 'manqueDeb')); return }
    if (!dTo) { setManque(tr(lang, 'manqueFin')); return }
    onChange({ preset: dPreset, from: dFrom, to: dTo })
    setOuvert(false); ancreRef.current?.focus()
  }

  const effacer = () => {
    const r = presetRange(presetParDefaut, aujourdhui)
    onChange({ preset: presetParDefaut, from: r.from, to: r.to })
    setOuvert(false); ancreRef.current?.focus()
  }

  return (
    <>
      <button
        ref={ancreRef}
        type="button"
        className={`dp-range-trigger ${ouvert ? 'dp-range-trigger-on' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label={`${ariaLabel ?? tr(lang, 'choisir')} : ${libelle}`}
        onClick={() => setOuvert(o => !o)}
      >
        <CalendarIcon size={15} aria-hidden />
        <span className="dp-range-value">{libelle}</span>
      </button>

      <Panneau ouvert={ouvert} ancre={ancreRef.current} onFermer={() => setOuvert(false)}
        label={ariaLabel ?? tr(lang, 'choisir')} largeur={498}>
        <div className="dp-range-body">
          <div className="dp-presets" role="group" aria-label={tr(lang, 'raccourcis')}>
            {PERIOD_ORDER.map(p => (
              <button key={p} type="button"
                className={`dp-preset ${dPreset === p ? 'dp-preset-on' : ''}`}
                aria-pressed={dPreset === p}
                onClick={() => choisirPreset(p)}
              >{PERIOD_LABELS[lang][p]}</button>
            ))}
          </div>

          <div className="dp-range-cal">
            <Grille
              lang={lang} curseur={curseur} setCurseur={setCurseur} aujourdhui={aujourdhui}
              estChoisi={d => sameDay(d, parseIso(dFrom)) || sameDay(d, parseIso(dTo))}
              estBorne={d => sameDay(d, parseIso(dFrom)) || sameDay(d, parseIso(dTo))}
              estDansPlage={d => !!dFrom && !!dTo && inRange(d, plage)}
              onChoisir={choisirJour}
            />

            {/* Saisie clavier : deux champs NATIFS, pour ne pas obliger à passer par la grille. */}
            <div className="dp-range-inputs">
              <span className="dp-range-sep">{tr(lang, 'du')}</span>
              <input type="date" className="dp-mini-input" value={dFrom} max={dTo || undefined}
                aria-label={`${tr(lang, 'du')} — ${ariaLabel ?? tr(lang, 'choisir')}`}
                onChange={e => { setDFrom(e.target.value); setDPreset(null); setManque('') }} />
              <span className="dp-range-sep">{tr(lang, 'au')}</span>
              <input type="date" className="dp-mini-input" value={dTo} min={dFrom || undefined}
                aria-label={`${tr(lang, 'au')} — ${ariaLabel ?? tr(lang, 'choisir')}`}
                onChange={e => { setDTo(e.target.value); setDPreset(null); setManque('') }} />
            </div>
          </div>
        </div>

        {manque && <div className="dp-missing" role="status" aria-live="polite">{manque}</div>}

        <div className="dp-foot">
          <button type="button" className="dp-foot-clear" onClick={effacer}>
            <X size={13} /> {tr(lang, 'effacer')}
          </button>
          <button type="button" className="dp-foot-apply" onClick={appliquer}>
            <Check size={13} /> {tr(lang, 'appliquer')}
          </button>
        </div>
      </Panneau>
    </>
  )
}
