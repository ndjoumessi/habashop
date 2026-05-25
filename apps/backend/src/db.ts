import { PrismaClient } from '@prisma/client'

/**
 * Client Prisma partagé (singleton) pour tout le backend.
 * Importé par les routes et middlewares ; évite les connexions multiples.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})
