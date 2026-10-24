# syntax=docker/dockerfile:1
# Multi-stage build for Hinabangan NHS SMS (server/ + web/) — npm workspaces monorepo.
# Produces a single runtime image serving both the Express API (:4000) and the static React SPA.

# --- Stage 1: install all workspace deps (root lockfile) -----------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /build
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci

# --- Stage 2: build the React SPA with Vite ----------------------------------
FROM deps AS web-builder
WORKDIR /build/web
COPY web/ ./
RUN npm run build

# --- Stage 3: prepare server production deps ---------------------------------
FROM deps AS server-builder
WORKDIR /build
# Prune dev dependencies for production runtime
RUN npm prune --omit=dev --workspace=server
WORKDIR /build/server
COPY server/ ./

# --- Stage 4: runtime --------------------------------------------------------
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
