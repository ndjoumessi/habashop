import { defineConfig } from 'vitest/config'

// Tests d'intégration : appellent l'API prod en HTTP (lecture seule).
// Timeout réseau élargi. Lancés explicitement via `npm run test:integration`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: ['src/tests/integration.test.ts'],
  },
})
