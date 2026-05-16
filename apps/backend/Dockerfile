FROM node:20-alpine
WORKDIR /app
COPY apps/backend/package*.json ./
RUN npm ci --production
COPY apps/backend/dist ./dist
COPY apps/backend/prisma ./prisma
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "dist/server.js"]
