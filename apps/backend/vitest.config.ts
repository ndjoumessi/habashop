import { defineConfig } from 'vitest/config'

// Tests unitaires (par défaut) — hors ligne, n'appellent pas l'API prod.
// Les tests d'intégration (réseau) sont exclus ici et lancés via
// `npm run test:integration` (config dédiée vitest.integration.config.ts).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'src/tests/integration.test.ts'],
    // Filet global : aucun test unitaire ne parle à un SDK payant (Anthropic/Twilio/
    // Resend). Un `vi.mock` local reste prioritaire. La config d'intégration ne le
    // charge PAS (elle appelle réellement le réseau, par conception).
    setupFiles: ['src/tests/setup/mockPaidSdks.ts'],
    // Couverture rapportée (sans seuil bloquant) : les routes sont surtout
    // exercées par les tests d'intégration (API prod distante, non instrumentée).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/routes/**', 'src/middleware/**'],
      exclude: ['src/tests/**', 'src/db.ts'],
    },
  },
})
