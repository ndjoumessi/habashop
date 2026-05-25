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
  },
})
