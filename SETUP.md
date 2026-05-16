# HabaShop — Setup Sprint 5

## PostgreSQL local (macOS)

```bash
# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Create database
psql postgres -c "CREATE USER habashop WITH PASSWORD 'habashop123';"
psql postgres -c "CREATE DATABASE habashop_dev OWNER habashop;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE habashop_dev TO habashop;"
```

## Backend setup

```bash
cd apps/backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Frontend setup

```bash
cd apps/frontend
npm install
npm run dev
```

## Compte démo (sans backend)

- Email : `admin@habashop.com`
- Mot de passe : `demo1234`

Le frontend fonctionne entièrement en mode démo si le backend n'est pas disponible.

---

## Déploiement Railway (backend)

1. Crée un compte sur [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Sélectionne le repo `habashop`
4. Add PostgreSQL service
5. Variables d'environnement :
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=ton-secret-production
   FRONTEND_URL=https://habashop.vercel.app
   NODE_ENV=production
   PORT=3001
   ```
6. After deploy : `npx prisma migrate deploy && npm run db:seed`

## Déploiement Vercel (frontend)

1. Crée un compte sur [vercel.com](https://vercel.com)
2. Import GitHub repo
3. Framework : **Vite**
4. Root directory : `apps/frontend`
5. Variables d'environnement :
   ```
   VITE_API_URL=https://ton-backend.railway.app
   ```
