# HabaShop 🛒

**Logiciel de gestion commerciale SaaS tout-en-un pour les commerces d'Afrique francophone**

> Épiceries · Grossistes · Demi-grossistes — Sénégal, Côte d'Ivoire, Mali, Cameroun, RDC...

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite + Zustand |
| Backend | Node.js + Fastify + Prisma ORM |
| Base de données | PostgreSQL 16 + Redis 7 |
| Stockage | S3-compatible (MinIO / Cloudflare R2) |
| Infra | Docker + Kubernetes + GitHub Actions CI/CD |
| Monitoring | Sentry + Grafana |

---

## Démarrage rapide

### Prérequis
- Node.js >= 18
- Docker & Docker Compose
- npm >= 9

### Installation

```bash
# Cloner le projet
git clone https://github.com/ndjoumessi/habashop.git
cd habashop

# Installer les dépendances
npm install

# Copier les variables d'environnement
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Démarrer les services (PostgreSQL + Redis)
docker-compose up -d

# Lancer les migrations de base de données
npm run db:migrate --workspace=apps/backend

# Démarrer en développement
npm run dev
```

L'application sera disponible sur :
- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:3000
- **API Docs** : http://localhost:3000/docs

---

## Modules (16)

| # | Module | Priorité |
|---|--------|----------|
| 1 | Dashboard (KPIs, graphiques) | P0 |
| 2 | POS / Caisse (offline-ready) | P0 |
| 3 | Stock & inventaire | P0 |
| 4 | Commandes & facturation | P0 |
| 5 | Fournisseurs | P1 |
| 6 | Clients CRM | P1 |
| 7 | Rapports & exports | P1 |
| 8 | RH — Équipe | P1 |
| 9 | Planning | P1 |
| 10 | Paie | P1 |
| 11 | Dépenses | P1 |
| 12 | Prévisions | P2 |
| 13 | Utilisateurs & RBAC | P0 |
| 14 | Audit & activité | P2 |
| 15 | Notifications | P2 |
| 16 | Paramètres | P0 |

---

## Structure du projet

```
habashop/
├── apps/
│   ├── frontend/          # React 18 + TypeScript + Vite
│   └── backend/           # Node.js + Fastify + Prisma
├── packages/
│   └── shared/            # Types et utilitaires partagés
├── docker-compose.yml
└── .github/workflows/     # CI/CD GitHub Actions
```

---

## Variables d'environnement

### Backend (`apps/backend/.env`)
```env
DATABASE_URL="postgresql://habashop:password@localhost:5432/habashop"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=3000
NODE_ENV=development
```

### Frontend (`apps/frontend/.env`)
```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=HabaShop
```

---

## Licence

Propriétaire — © 2026 HabaShop. Tous droits réservés.
