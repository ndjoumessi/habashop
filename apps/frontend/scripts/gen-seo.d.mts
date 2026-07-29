/**
 * Types du script de génération SEO — il reste en `.mjs` (exécuté par node au build, comme
 * `gen-version.mjs` et `verify-sw-routes.mjs`), mais son méta-test l'importe et le front est
 * en `strict: true`. Ce fichier est la couture minimale entre les deux.
 */
export declare const DEFAULT_APP_URL: string
export declare function appUrl(env?: Record<string, string | undefined>): string
export declare function render(template: string, url: string): string
