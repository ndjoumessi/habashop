import { describe, it, expect, beforeEach } from 'vitest'
import { doitTourner, FENETRE_MINUTES, PAS_MS, _viderMarqueurs } from '../lib/cronWindow'

/**
 * FENÊTRE D'EXÉCUTION DES CRONS — le défaut est MESURÉ ici, pas supposé.
 *
 * ⚠️ Les cinq crons du dépôt se gardaient par `getMinutes() > 5` tout en étant enregistrés
 * avec un `setInterval` d'UNE HEURE. Un `setInterval` horaire déclenche toujours à la MÊME
 * minute que son enregistrement — la minute de démarrage du conteneur. Si Railway démarre à la
 * minute 37, chaque tick voit `getMinutes() === 37`, donc `> 5`, donc la garde retourne
 * TOUJOURS : le rapport hebdomadaire, le balayage PII des démos, les alertes de stock et le
 * récap de paie ne s'exécutent JAMAIS. Et rien ne le signale — c'est la famille de
 * « l'alarme qui ne peut pas sonner ».
 */

/** Minutes atteintes par un `setInterval` de `pasMs` enregistré à `minuteDepart`, sur `heures`. */
function minutesAtteintes(minuteDepart: number, pasMs: number, heures: number): { h: number; m: number }[] {
  const ticks: { h: number; m: number }[] = []
  const depart = Date.UTC(2026, 9, 1, 0, minuteDepart, 0)
  const fin = depart + heures * 3600_000
  for (let t = depart + pasMs; t <= fin; t += pasMs) {
    const d = new Date(t)
    ticks.push({ h: d.getUTCHours(), m: d.getUTCMinutes() })
  }
  return ticks
}

/** L'ANCIENNE garde, telle qu'elle était écrite. */
const ancienneGarde = (m: number) => m <= 5

beforeEach(() => { _viderMarqueurs() })

describe('LE DÉFAUT — garde de minute + pas horaire', () => {
  it('⚠️ un conteneur démarré à la minute 37 n’exécute JAMAIS la tâche', () => {
    const ticks = minutesAtteintes(37, 3600_000, 48)
    expect(ticks.length).toBeGreaterThan(40) // le cron tourne bien, il est juste toujours refusé
    expect(ticks.filter(t => ancienneGarde(t.m))).toEqual([])
  })

  it('⚠️ et ce n’est pas un cas isolé : 54 minutes de démarrage sur 60 sont perdantes', () => {
    const perdantes = [...Array(60).keys()].filter(m0 =>
      minutesAtteintes(m0, 3600_000, 48).every(t => !ancienneGarde(t.m)))
    expect(perdantes.length).toBe(54)
    // Seules les minutes 0 à 5 fonctionnaient — par pure chance du moment du déploiement.
    expect(perdantes).not.toContain(0)
    expect(perdantes).toContain(37)
  })
})

/**
 * ⚠️ DATES LOCALES, pas UTC. `doitTourner` lit `getHours()`/`getDay()` — l'heure LOCALE du
 * conteneur —, exactement comme le faisaient les gardes d'origine. Changer de fuseau en
 * passant par ce module aurait déplacé l'heure d'envoi des e-mails des commerçants sans que
 * personne ne le demande. Les tests doivent donc construire des dates locales.
 */
const local = (a: number, mo: number, j: number, h: number, mi: number) => new Date(a, mo - 1, j, h, mi, 0)

describe('LA CORRECTION — pas de 5 minutes + marqueur', () => {
  it('⚠️ quelle que soit la minute de démarrage, la fenêtre est atteinte CHAQUE heure', () => {
    for (let m0 = 0; m0 < 60; m0++) {
      const parHeure = new Map<number, number>()
      for (const t of minutesAtteintes(m0, PAS_MS, 24)) {
        if (t.m <= FENETRE_MINUTES) parHeure.set(t.h, (parHeure.get(t.h) ?? 0) + 1)
      }
      // 24 heures parcourues, chacune touchée au moins une fois.
      expect(parHeure.size, `minute de départ ${m0} : seules ${parHeure.size} heures touchées`).toBeGreaterThanOrEqual(23)
      for (const [h, n] of parHeure) expect(n, `heure ${h} touchée ${n} fois`).toBeGreaterThanOrEqual(1)
    }
  })

  it('⚠️ DEUX ticks dans la fenêtre ne produisent QU’UNE exécution — le marqueur', () => {
    const t0 = local(2026, 10, 5, 7, 0)
    const t5 = local(2026, 10, 5, 7, 5)
    expect(doitTourner('alertes-stock', t0, { heure: 7 })).toBe(true)
    expect(doitTourner('alertes-stock', t5, { heure: 7 }), 'second tick de la même heure').toBe(false)
  })

  it('l’heure SUIVANTE du jour suivant tourne de nouveau', () => {
    expect(doitTourner('alertes-stock', local(2026, 10, 5, 7, 2), { heure: 7 })).toBe(true)
    expect(doitTourner('alertes-stock', local(2026, 10, 6, 7, 2), { heure: 7 })).toBe(true)
  })

  it('deux crons DIFFÉRENTS ne se bloquent pas l’un l’autre', () => {
    const t = local(2026, 10, 5, 8, 1)
    expect(doitTourner('rapport-hebdo', t, { heure: 8 })).toBe(true)
    expect(doitTourner('recap-paie', t, { heure: 8 })).toBe(true)
  })

  it('hors de l’heure cible, rien ne tourne', () => {
    expect(doitTourner('alertes-stock', local(2026, 10, 5, 6, 2), { heure: 7 })).toBe(false)
  })

  it('hors de la fenêtre de minutes, rien ne tourne', () => {
    expect(doitTourner('alertes-stock', local(2026, 10, 5, 7, 37), { heure: 7 })).toBe(false)
  })

  it('le jour de la SEMAINE est respecté (lundi = 1)', () => {
    // Le jour est DÉRIVÉ, pas affirmé : un littéral « lundi » se périmerait au changement
    // de date de référence, et un test qui affirme le mauvais jour échoue pour la mauvaise
    // raison.
    const lundi = local(2026, 10, 5, 8, 2)
    expect(lundi.getDay(), 'la date de référence doit être un lundi en heure locale').toBe(1)
    const lendemain = local(2026, 10, 6, 8, 2)
    expect(doitTourner('hebdo-a', lundi, { heure: 8, jourDeSemaine: 1 })).toBe(true)
    expect(doitTourner('hebdo-b', lendemain, { heure: 8, jourDeSemaine: 1 })).toBe(false)
  })

  it('le jour du MOIS est respecté', () => {
    expect(doitTourner('paie-a', local(2026, 10, 1, 8, 2), { heure: 8, dateDuMois: 1 })).toBe(true)
    expect(doitTourner('paie-b', local(2026, 10, 2, 8, 2), { heure: 8, dateDuMois: 1 })).toBe(false)
  })

  it('⚠️ TOLÉRANCE À LA DÉRIVE : un décalage de ±1 min par heure laisse la fenêtre atteinte', () => {
    // `setInterval` dérive. On simule un retard d'une minute par heure écoulée.
    for (let m0 = 0; m0 < 60; m0++) {
      const touchees = new Set<number>()
      const depart = Date.UTC(2026, 9, 1, 0, m0, 0)
      for (let k = 1; k * PAS_MS <= 24 * 3600_000; k++) {
        const derive = Math.floor((k * PAS_MS) / 3600_000) * 60_000
        const d = new Date(depart + k * PAS_MS + derive)
        if (d.getUTCMinutes() <= FENETRE_MINUTES) touchees.add(d.getUTCHours() + d.getUTCDate() * 100)
      }
      expect(touchees.size, `minute de départ ${m0} sous dérive`).toBeGreaterThanOrEqual(20)
    }
  })

  it('la fenêtre et le pas sont COHÉRENTS — la fenêtre doit couvrir au moins un pas', () => {
    // ⚠️ C'est l'invariant qui fait tenir tout le reste : si le pas devenait plus grand que
    // la fenêtre, on retomberait exactement dans le défaut mesuré en haut de ce fichier.
    expect(PAS_MS).toBeLessThanOrEqual((FENETRE_MINUTES + 1) * 60_000)
  })
})
