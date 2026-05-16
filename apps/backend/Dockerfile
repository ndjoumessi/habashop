FROM node:20-slim

# Installe OpenSSL et autres dépendances système
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copie les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installe les dépendances
RUN npm install

# Génère le client Prisma
RUN npx prisma generate

# Copie le code source
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

EXPOSE 3001

# Démarre avec migration puis serveur
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
