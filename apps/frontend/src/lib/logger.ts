const isDev = import.meta.env.DEV

/**
 * Logger frontend léger : `log` silencieux en production,
 * `warn`/`error` toujours actifs (et captés par Sentry s'il est configuré).
 */
export const logger = {
  log:   (...args: unknown[]) => { if (isDev) console.log(...args) },
  warn:  (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
}
