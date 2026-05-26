/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: false, // use public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Ne jamais servir index.html (navigateFallback) pour un fichier (asset/chunk) :
        // évite l'erreur "Expected a JS module but got text/html" quand un vieux hash
        // n'existe plus après un redéploiement.
        navigateFallbackDenylist: [/^\/assets\//, /\.[a-zA-Z0-9]+$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/habashop-production\.up\.railway\.app\/api\//,
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
          {
            urlPattern: /\/api\/products/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'products-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor React — critique, toujours chargé
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
            return 'vendor'
          }
          // BarcodeScanner / @zxing — lourd, chargé seulement à l'ouverture du scanner
          if (id.includes('@zxing')) {
            return 'barcode'
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
})
