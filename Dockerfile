FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    AUTO_MIGRATE=true \
    CATALOG_MEDIA_STORAGE=postgres

EXPOSE 3000

CMD ["npm", "start"]
