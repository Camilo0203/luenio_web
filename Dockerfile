# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps first for layer caching -- this only re-runs when
# package.json/package-lock.json change, not on every source edit.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build the static frontend bundle.
# (.dockerignore keeps node_modules/dist/.env/.git out of this context, so
# this always produces a fresh dist/, never a stale local one.)
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

# Baked-in, non-overridable-by-mistake production posture:
#   NODE_ENV=production drives isProduction() -> forces Secure cookies,
#   serves from dist/ (the only frontend copy that exists in this stage),
#   and enables HSTS. HOST=0.0.0.0 is required for the app to be reachable
#   from outside the container at all.
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4180

# The server has zero runtime npm dependencies (node:http/node:fs/global
# fetch only) -- no npm ci / node_modules needed in this stage. Copy only
# the exact files the running server touches.
COPY --from=builder --chown=node:node /app/server.js ./server.js
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/api ./api
COPY --from=builder --chown=node:node /app/core ./core
COPY --from=builder --chown=node:node /app/db ./db
COPY --from=builder --chown=node:node /app/config ./config
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 4180
CMD ["node", "server.js"]
