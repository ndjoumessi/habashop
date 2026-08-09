import { SHIFT_TYPES } from './planningShared'
import type { ShiftType } from './planningShared'

/**
 * AGRÉGATS DU PLANNING — heures par employé, couverture par jour.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * La grille montrait QUI travaille QUAND, et ne répondait à aucune des deux
 * questions qu'un gérant se pose devant un planning : « combien d'heures pour
 * Marie cette semaine ? » et « qui couvre jeudi ? ». Les deux se lisaient en
 * comptant des pastilles à l'œil, sur 5 employés × 7 jours.
 *
 * ⚠️ MODULE PUR ET TESTÉ, pas un calcul en ligne dans le rendu. Deux agrégats
 * d'une même grandeur calculés à deux endroits n'ont aucune raison de rester
 * d'accord — c'est le défaut mesuré sur « Budget vs Réel » le 2026-08-08, où un
 * total et son écart décrivaient deux populations différentes.
 */

/**
 * Durée d'un shift, en heures.
 *
 * ⚠️ La NUIT franchit minuit (`20:00-06:00`) : une soustraction naïve rend −14.
 * On ajoute 24 h quand la fin précède le début. Repos et congé valent 0 — ce sont
 * des absences, pas des durées, et les additionner gonflerait le temps de travail.
 */
export function shiftHours(type: ShiftType): number {
  const plage = SHIFT_TYPES[type]?.hours ?? ''
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(plage)
  if (!m) return 0
  const debut = Number(m[1]) * 60 + Number(m[2])
  const fin = Number(m[3]) * 60 + Number(m[4])
  const minutes = fin >= debut ? fin - debut : fin + 24 * 60 - debut
  return minutes / 60
}

/** Un shift compte-t-il comme une PRÉSENCE (par opposition à repos/congé) ? */
export function estTravaille(type: ShiftType): boolean {
  return shiftHours(type) > 0
}

export interface TotauxPlanning {
  /** Heures planifiées sur la semaine, par identifiant d'employé. */
  heuresParEmploye: Record<string, number>
  /** Nombre d'employés RÉELLEMENT au travail, par index de jour (0..6). */
  couvertureParJour: number[]
  /** Total de la semaine — Σ des heures par employé, PAR CONSTRUCTION. */
  heuresTotal: number
  /**
   * Nombre de cases portant AU MOINS un shift, congé et repos COMPRIS.
   *
   * ⚠️ Sert à distinguer « pas encore planifié » de « planifié mais ce jour n'est
   * couvert par personne ». Sans cette distinction, une semaine vierge affiche SEPT
   * zéros rouges — et une alerte qui crie toujours n'alerte plus quand elle devient
   * vraie. On compte les congés ici (contrairement à la couverture) : poser un congé
   * EST un acte de planification, même s'il ne couvre pas la boutique.
   */
  nbAffectations: number
}

/**
 * ⚠️ `heuresTotal` est la somme de `heuresParEmploye`, jamais un second parcours :
 * un total recalculé indépendamment peut diverger de la colonne qui l'affiche.
 *
 * ⚠️ Une cellule peut porter PLUSIEURS shifts (le modèle l'autorise) : on somme,
 * on ne prend pas le premier. Un employé en Matin + Après-midi fait bien 10 h.
 */
export function calculerTotaux(
  employes: readonly { id: string }[],
  shifts: Record<string, Record<number, { type: ShiftType }[]>>,
  nbJours = 7,
): TotauxPlanning {
  const heuresParEmploye: Record<string, number> = {}
  const couvertureParJour = Array.from({ length: nbJours }, () => 0)
  let nbAffectations = 0

  for (const emp of employes) {
    const parJour = shifts[emp.id] ?? {}
    let total = 0
    for (let di = 0; di < nbJours; di++) {
      const cellule = parJour[di] ?? []
      if (cellule.length > 0) nbAffectations += cellule.length
      for (const s of cellule) total += shiftHours(s.type)
      if (cellule.some(s => estTravaille(s.type))) couvertureParJour[di] += 1
    }
    heuresParEmploye[emp.id] = total
  }

  return {
    heuresParEmploye,
    couvertureParJour,
    heuresTotal: employes.reduce((acc, e) => acc + (heuresParEmploye[e.id] ?? 0), 0),
    nbAffectations,
  }
}

/**
 * « 37 h » / « 7 h 30 ». ⚠️ Zéro rend une CHAÎNE VIDE, jamais « 0 h » : une colonne
 * de zéros sur une semaine vide se lit comme une donnée, alors que c'est l'absence
 * de planning. L'appelant décide de ce qu'il montre à la place.
 */
export function formatHeures(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return ''
  const entier = Math.floor(h)
  const minutes = Math.round((h - entier) * 60)
  return minutes === 0 ? `${entier} h` : `${entier} h ${String(minutes).padStart(2, '0')}`
}
