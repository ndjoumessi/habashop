/**
 * Types du moteur d'audit des classes (`classAudit.mjs`).
 *
 * ⚠️ Le moteur reste du JS ESM parce qu'il est chargé par `verify-classes.mjs`, un script
 * Node lancé APRÈS le build (la CI exécute `vitest` avant `build`, donc le verrou d'artefact
 * ne peut pas vivre dans la suite). Ce fichier existe pour que la suite, elle, puisse
 * l'importer sous `strict: true` — sans lui, `tsc` échoue en TS7016 et le BUILD échoue avec
 * lui, ce qui laisserait un `dist/` PÉRIMÉ derrière un « ✅ » : c'est arrivé pendant l'écriture
 * de ce verrou, et le sabotage est passé vert pour cette raison.
 */

export interface Absent {
  jeton: string
  sites: string[]
}

export interface Rapport {
  nbFichiersAtteignables: number
  nbFichiersArtefact: number
  octetsArtefact: number
  nbJetons: number
  absents: Absent[]
}

export function fichiersAtteignables(src: string, entree: string): string[]
export function fichiersDeProduction(src: string): string[]
export function codeSeul(source: string): string
export function jetonsDeClasse(brut: string): Set<string>
export function corpusLivre(dist: string): { fichiers: string[]; texte: string }
export function estDefini(jeton: string, texte: string): boolean
export function poigneesE2E(dirE2E: string): Set<string>
export function auditer(opts: { src: string; entree: string; dist: string; e2e: string }): Rapport
