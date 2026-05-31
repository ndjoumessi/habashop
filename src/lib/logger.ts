// Logger mobile léger — même pattern que le web (apps/frontend/src/lib/logger.ts).
// `log` est silencieux en production (gardé derrière __DEV__, faux dans les builds release) ;
// `warn`/`error` restent toujours actifs (et seront captés par un crash reporter type Sentry
// s'il est branché un jour). __DEV__ est un global injecté par React Native / Metro.
export const logger = {
  log:   (...args: unknown[]) => { if (__DEV__) console.log(...args) },
  warn:  (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
}
