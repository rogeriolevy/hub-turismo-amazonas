FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && chown node:node /app

USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

ARG SITE_URL=http://127.0.0.1:3005
ENV SITE_URL=${SITE_URL}
RUN npm run build

# Remove only traced packages marked as development-only in the exact lockfile.
# `npm prune` expands standalone package traces to complete dependency packages.
RUN cp package-lock.json .next/standalone/package-lock.json \
    && node scripts/prepare-standalone-runtime.mjs .next/standalone

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
RUN chown node:node /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    AUTO_MIGRATE=true \
    CATALOG_MEDIA_STORAGE=postgres

USER node

# Keep only traced Next.js runtime dependencies plus files used by migration and data transfer.
COPY --from=build --chown=node:node /app/.next/standalone/ ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/docs ./docs

EXPOSE 3000

CMD ["npm", "start"]
