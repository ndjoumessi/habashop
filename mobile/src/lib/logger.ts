// Logger mobile léger — même pattern que le web (apps/frontend/src/lib/logger.ts).
// `log` est silencieux en production (gardé derrière __DEV__, faux dans les builds release) ;
// `warn`/`error` restent toujours actifs (et seront captés par un crash reporter type Sentry
// s'il est branché un jour). __DEV__ est un global injecté par React Native / Metro.
//
// En release, les erreurs Axios sont réduites à { message, code, status, method, url } :
// l'objet complet embarque config.headers.Authorization (JWT) et le payload de la requête,
// qui finiraient en clair dans logcat / la console iOS.

function sanitize(arg: unknown): unknown {
  if (__DEV__) return arg
  if (arg && typeof arg === 'object') {
    const e = arg as any
    if (e.isAxiosError || e.config?.headers) {
      return {
        message: e.message,
        code: e.code,
        status: e.response?.status,
        method: e.config?.method,
        url: e.config?.url,
      }
    }
  }
  return arg
}

export const logger = {
  log:   (...args: unknown[]) => { if (__DEV__) console.log(...args) },
  warn:  (...args: unknown[]) => console.warn(...args.map(sanitize)),
  error: (...args: unknown[]) => console.error(...args.map(sanitize)),
}
