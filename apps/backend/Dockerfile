FROM node:20-alpine

WORKDIR /app

# Copie package.json
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copie le code source
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start avec migration
CMD npx prisma migrate deploy && node dist/server.js
