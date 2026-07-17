import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Contexte tenant par requête (defense-in-depth, item 8).
 *
 * Le store est ÉTABLI au plus tôt par un hook global `onRequest` (`server.ts`,
 * via `enterWith` dans le contexte racine de la requête → se propage au handler,
 * même pattern que `@fastify/request-context`). Il est MUTÉ par `authenticate`
 * dès que `request.tenantId` est résolu (`bindActiveTenant`).
 *
 * L'extension Prisma (`src/db.ts`) lit `tenantId` pour l'injecter automatiquement
 * sur les modèles tenant-scopés QUAND il est absent du `where`/`data` — filet de
 * sécurité si un handler oublie le filtre.
 *
 * ⚠️ `enterWith` posé dans un preHandler APRÈS un `await` ne remonte pas au
 * handler (async context ancêtre) → d'où l'établissement en `onRequest`.
 *
 * Les chemins SANS le hook (jamais le cas en prod : hook global) ou où
 * `authenticate`/`authenticateAdmin` ne pose pas de tenant (super-admin,
 * webhooks, crons, boutique non active) laissent `tenantId=null` → aucune
 * injection → accès non-scopé, ce qui est le comportement voulu pour eux.
 */
export const tenantCtx = new AsyncLocalStorage<{ tenantId: string | null }>()

/** Établit un store vide pour la requête courante (hook `onRequest`). */
export function initTenantStore(): void {
  tenantCtx.enterWith({ tenantId: null })
}

/** Renseigne la boutique active dans le store existant (depuis `authenticate`). */
export function bindActiveTenant(tenantId: string | null): void {
  const store = tenantCtx.getStore()
  if (store) store.tenantId = tenantId
}
