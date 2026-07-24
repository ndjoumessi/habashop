/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Identifiant de build visible dans l'app (sidebar) → permet de voir d'un coup d'œil
// si on est sur la dernière version ou sur une copie en cache (service worker / PWA).
// Horodatage toujours présent (change à chaque build) + SHA court si dispo (git ou Vercel).
// execFileSync (pas de shell) + args fixes → aucune injection possible.
const BUILD_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim() } catch { return '' } })()
const BUILD_DATE = new Date()
const BUILD_ID = BUILD_DATE.toISOString().slice(0, 16).replace('T', ' ') + (BUILD_SHA ? ` · ${BUILD_SHA}` : '')
// Version PRODUIT = SOURCE UNIQUE = package.json RACINE du monorepo (jamais un littéral
// en dur — cf. méta-test versionSource). Résolu via import.meta.url (= apps/frontend/
// vite.config.ts) → `../../package.json` = racine, robuste quel que soit le cwd (build
// Vercel depuis la racine inclus). ⚠️ NE PAS lire apps/frontend/package.json (resté à 1.0.0).
const PKG_VERSION = (() => {
  try { return JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')).version as string }
  catch { return '' }
})()
// Forme COURTE et complète pour la sidebar (conçue pour tenir, pas tronquée) :
// « v<version> · JJ/MM ». Le détail complet (horodatage + SHA) reste dans le title au survol.
const BUILD_SHORT = `${PKG_VERSION ? `v${PKG_VERSION} · ` : ''}${String(BUILD_DATE.getUTCDate()).padStart(2, '0')}/${String(BUILD_DATE.getUTCMonth() + 1).padStart(2, '0')}`

export default defineConfig(({ mode }) => {
  // Charge TOUTES les variables (préfixe '') → récupère SENTRY_AUTH_TOKEN (.env.local en
  // local / variable de build Vercel) pour l'upload de source maps. Non exposé au bundle
  // (le token n'est pas préfixé VITE_, donc absent de import.meta.env côté client).
  const env = loadEnv(mode, process.cwd(), '')
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN

  return {
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __BUILD_SHORT__: JSON.stringify(BUILD_SHORT), __APP_VERSION__: JSON.stringify(PKG_VERSION) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: false, // use public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Handlers Web Push injectés dans le SW généré (workbox n'accepte pas de listeners
        // dans sa config) → script séparé public/push-sw.js chargé via importScripts.
        importScripts: ['/push-sw.js'],
        // Gros chunks lazy (recharts, @zxing/jsbarcode/qrcode, html2canvas, jspdf) : exclus
        // du precache (ils plombaient ~1 Mo) — servis à la demande via runtimeCaching ci-dessous.
        globIgnores: ['**/assets/charts-*.js', '**/assets/barcode-*.js', '**/assets/canvas-*.js', '**/assets/pdf-*.js', '**/push-sw.js'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Ne jamais servir index.html (navigateFallback) pour un fichier (asset/chunk) :
        // évite l'erreur "Expected a JS module but got text/html" quand un vieux hash
        // n'existe plus après un redéploiement.
        navigateFallbackDenylist: [/^\/assets\//, /\.[a-zA-Z0-9]+$/],
        runtimeCaching: [
          {
            // Chunks lazy hors precache (cf. globIgnores) : noms hashés → immuables,
            // CacheFirst = 1 seul fetch réseau puis servi depuis le cache (offline inclus).
            urlPattern: /\/assets\/(charts|barcode|canvas|pdf)-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-chunks-cache',
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            // TOUTES les requêtes d'API, quelle que soit l'ORIGINE. ⚠️ L'ancien motif codait
            // l'hôte Railway en dur : si l'API déménage (cf. .env.production qui pointe déjà
            // ailleurs), la règle cesse de matcher SANS BRUIT et le POS perd tout cache
            // hors-ligne. On matche donc le chemin, pas l'hôte.
            // ⚠️ Cette règle attrape aussi /api/products — c'était DÉJÀ le cas : une règle
            // `products-cache` (StaleWhileRevalidate, 7 j) vivait ici mais était enregistrée
            // APRÈS celle-ci, et workbox retourne le PREMIER match (workbox-routing/Router.js,
            // findMatchingRoute) → elle n'a JAMAIS tourné en production. Supprimée plutôt que
            // remontée : StaleWhileRevalidate servirait un prix périmé même en ligne et rapide,
            // alors que NetworkFirst n'y retombe qu'au-delà du délai réseau. Pour un prix de
            // caisse, la fraîcheur en ligne prime. Garde : scripts/verify-sw-routes.mjs.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
    // Upload des source maps vers Sentry (org haba-76 / projet habashop-web) — uniquement
    // si un token est présent (= builds prod : .env.local en local, env de build sur Vercel).
    // En dev / sans token : no-op (le build ne casse pas). Les .map sont supprimés de dist
    // après upload (jamais servis publiquement ; couplé à build.sourcemap:'hidden').
    ...(sentryAuthToken
      ? [sentryVitePlugin({
          org: 'haba-76',
          project: 'habashop-web',
          authToken: sentryAuthToken,
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
          telemetry: false,
        })]
      : []),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // 'hidden' : génère les source maps pour Sentry SANS ajouter le commentaire
    // sourceMappingURL aux bundles → maps non référencées publiquement.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor React — critique, toujours chargé
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
            return 'vendor'
          }
          // BarcodeScanner / @zxing + jsbarcode + qrcode — lourds, usages ponctuels
          // (scanner, étiquettes, carte fidélité) → chunk identifiable, hors precache PWA
          if (id.includes('node_modules/@zxing') || id.includes('node_modules/jsbarcode') || id.includes('node_modules/qrcode')) {
            return 'barcode'
          }
          // html2canvas — uniquement export PNG carte fidélité, hors precache PWA
          if (id.includes('node_modules/html2canvas')) {
            return 'canvas'
          }
          // jsPDF + ses deps lourdes (canvg 150 Ko, fast-png, fflate, dompurify) —
          // uniquement étiquettes thermiques 40×30 (import dynamique), hors precache PWA.
          if (
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/canvg') ||
            id.includes('node_modules/fast-png') ||
            id.includes('node_modules/fflate') ||
            id.includes('node_modules/dompurify')
          ) {
            return 'pdf'
          }
          // Recharts / d3 — lazy via les routes Dashboard/Reports uniquement
          if (id.includes('recharts') || id.includes('node_modules/d3-')) {
            return 'charts'
          }
          // UI helpers
          if (id.includes('lucide-react') || id.includes('react-hot-toast')) {
            return 'ui'
          }
        },
      },
    },
    // Les gros chunks (barcode/charts) sont volontairement lazy → on relève le seuil
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'], // exclut e2e/*.spec.ts (Playwright)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/hooks/**', 'src/stores/**'],
      exclude: ['src/tests/**'],
    },
  },
  }
})
