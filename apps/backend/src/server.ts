import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { authRoutes } from './routes/auth'
import { productsRoutes } from './routes/products'
import { salesRoutes } from './routes/sales'
import { ordersRoutes } from './routes/orders'
import { customersRoutes } from './routes/customers'
import { suppliersRoutes } from './routes/suppliers'
import { dashboardRoutes } from './routes/dashboard'
import { reportsRoutes } from './routes/reports'

const app = Fastify({
  logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' }
})

async function bootstrap() {
  // CORS
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'habashop-dev-secret',
  })

  // Décorateur authenticate — doit être enregistré AVANT les routes
  app.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Token invalide ou expiré' })
    }
  })

  // Swagger docs
  await app.register(swagger, {
    openapi: {
      info: { title: 'HabaShop API', version: '2.0.0', description: 'API REST HabaShop SaaS' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    }
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() }))

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(productsRoutes, { prefix: '/api/products' })
  await app.register(salesRoutes, { prefix: '/api/sales' })
  await app.register(ordersRoutes, { prefix: '/api/orders' })
  await app.register(customersRoutes, { prefix: '/api/customers' })
  await app.register(suppliersRoutes, { prefix: '/api/suppliers' })
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
  await app.register(reportsRoutes, { prefix: '/api/reports' })

  // Start
  const port = parseInt(process.env.PORT || '3000')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`🚀 HabaShop API — http://localhost:${port}`)
  console.log(`📚 Swagger docs — http://localhost:${port}/docs`)
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
