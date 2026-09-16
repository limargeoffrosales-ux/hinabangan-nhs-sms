# syntax=docker/dockerfile:1
# Multi-stage build for MeridianEd (server/ + web/) — used by Coolify on Oracle
# Ampere (arm64) and any other Docker host. Produces a single runtime image that
# serves both the Express API (:4000) and the static React SPA.

# --- Stage 1: build the React SPA with Vite ----------------------------------
FROM node:22-bookworm-slim AS web-builder
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Stage 2: install server deps (prod only, no dev/devDeps) ----------------
FROM node:22-bookworm-slim AS server-builder
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./

# --- Stage 3: runtime --------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000
COPY database/ ./database/
COPY --from=server-builder /build/server ./server/
COPY --from=web-builder /build/web/dist ./web/dist
RUN mkdir -p /app/server/data && chown -R node:node /app/server
USER node
WORKDIR /app/server
EXPOSE 4000
VOLUME ["/app/server/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/v1/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "--env-file-if-exists=.env", "src/index.js"]