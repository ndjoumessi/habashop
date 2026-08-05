/**
 * Types du script de génération d'icônes, consommé par `src/tests/faviconMatchesMark.test.ts`.
 *
 * ⚠️ Le script reste en `.mjs` : il tourne sous `node` nu (aucun transpileur dans la chaîne),
 * et c'est LUI qui écrit les PNG livrés. Le test doit donc importer la MÊME fonction de rendu,
 * sinon le verrou compare le PNG à une seconde définition — c'est-à-dire à rien.
 */
export declare const ICONS: ReadonlyArray<{ file: string; size: number }>
export declare function renderIcon(svg: string, size: number): Promise<Buffer>
