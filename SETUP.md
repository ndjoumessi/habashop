# HabaShop — Setup & déploiement

> **Node.js 20 requis.** Un Node trop ancien (ex. le `node` système) casse `tsc`, Vite et les CLIs Railway/Vercel. Utiliser nvm : `nvm use 20`.

> ⚠️ **Base de données** : le fichier `apps/backend/.env` committé pointe vers la **base PostgreSQL de PRODUCTION** (Railway). Il n'existe pas de base de dev séparée par défaut. **Ne jamais lancer `prisma migrate dev` / `migrate reset` / `db:seed` tant que `DATABASE_URL` pointe sur la prod** — ces commandes écrivent (et `migrate dev` peut réinitialiser) la base. Pour un vrai dev local, créer une base locale (ci-dessous) et faire pointer `.env` dessus **avant** toute migration.

## PostgreSQL local (macOS)

```bash
brew install postgresql@15
brew services start postgresql@15

psql postgres -c "CREATE USER habashop WITH PASSWORD 'habashop123';"
psql postgres -c "CREATE DATABASE habashop_dev OWNER habashop;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE habashop_dev TO habashop;"
```

Puis dans `apps/backend/.env` (pour le dev local uniquement) :

```env
DATABASE_URL="postgresql://habashop:habashop123@localhost:5432/habashop_dev"
JWT_SECRET="dev-secret"
PORT=3001
# Optionnels : ANTHROPIC_API_KEY (IA), TWILIO_* (WhatsApp)
```

## Backend setup

```bash
nvm use 20
cd apps/backend
npm install
npx prisma generate
npx prisma migrate dev --name init   # UNIQUEMENT sur la base LOCALE (voir l'avertissement ci-dessus)
npm run db:seed                      # crée les comptes démo (mot de passe demo1234)
npm run dev                          # API sur http://localhost:3001
```

> Comptes créés par le seed : `admin@habashop.com` (promu `SUPER_ADMIN` en prod), `manager@`, `cashier@`, `accountant@`, `hr@` (boutique Dakar) et `kone@habashop.com` (ADMIN, boutique Abidjan) — tous en `demo1234`.

## Frontend setup

```bash
nvm use 20
cd apps/frontend
npm install
npm run dev          # UI sur http://localhost:5173
```

`apps/frontend/.env` (optionnel — défaut = backend de prod) :

```env
VITE_API_URL=http://localhost:3001
```

## Mode démo (sans backend)

- Email : `admin@habashop.com` · Mot de passe : `demo1234`

Le login tente d'abord le backend réel ; en cas d'échec réseau, le frontend bascule en mode démo local pour les comptes seedés (token `demo-token-local`, données factices). Les appels API protégés restent indisponibles dans ce mode.

---

## Déploiement Railway (backend)

Builder **Dockerfile** (défini dans `railway.json`). Le `Dockerfile` compile depuis `src` (`tsc`) puis lance :
`prisma migrate deploy && node dist/server.js` — les migrations en attente sont donc **appliquées automatiquement à chaque déploiement**.

1. New Project → Deploy from GitHub → repo `habashop`, service backend = `apps/backend`
2. Add PostgreSQL service
3. Variables d'environnement :
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=secret-production
   FRONTEND_URL=https://habashop.vercel.app
   NODE_ENV=production
   PORT=3001
   ```
4. Premier déploiement : le `db:seed` peut être lancé une fois manuellement pour créer les comptes démo (`npm run db:seed`). Les migrations, elles, passent toutes seules via le `CMD`.

> Le `git push` ne redéploie pas toujours automatiquement — déclencher au besoin via `railway up` (depuis `apps/backend`) ou un *Redeploy* dans le dashboard. En cas d'échec, vérifier les **Deploy Logs** (runtime), pas seulement les Build Logs : si `prisma migrate deploy` échoue, le serveur ne démarre pas et l'ancien conteneur reste actif.

## Déploiement Vercel (frontend)

Projet `habashop`, **Root Directory = `apps/frontend`**, framework **Vite**.

```
VITE_API_URL=https://habashop-production.up.railway.app
```

> ⚠️ Le `git push` **ne déclenche pas** de déploiement automatique. Déployer manuellement avec `npx vercel --prod` **depuis `apps/frontend`** — un déploiement lancé depuis la racine du repo construit la mauvaise racine et renvoie un **404** sur `habashop.vercel.app`.
