FROM node:22-slim

# Installe OpenSSL et autres dépendances système
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copie les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installe les dépendances — `npm ci`, depuis `package-lock.json` (copié par `package*.json`).
# ⚠️ C'était `npm install` SANS lockfile dans ce contexte : chaque build résolvait les plages contre
# le registre DU JOUR. Le 2026-09-12, vite 8.3.0 a fait planter npm et bloqué le déploiement, et
# l'image tournait avec d'autres versions que celles testées par la CI (twilio 6.1.1 vs 6.0.2).
# Le lockfile est DÉRIVÉ du lockfile racine : `npm run lock:backend` ; `npm ci` refuse de
# construire s'il ne correspond plus au package.json — un échec BRUYANT au lieu d'une dérive.
RUN npm ci

# Génère le client Prisma
RUN npx prisma generate

# Copie le code source
COPY src ./src
COPY tsconfig.json ./
# scripts/ : requis par le hook `prebuild` (gen-version.mjs). Le contexte Docker = apps/backend
# seul (pas la racine du monorepo) → gen-version ne trouve pas le package.json racine et NO-OP
# proprement : la version BAKÉE = le `src/version.generated.ts` committé (copié via `COPY src`).
COPY scripts ./scripts/

# Build TypeScript (prebuild gen-version → tsc)
RUN npm run build

EXPOSE 3001

# Démarre avec migration puis serveur
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
