# ---- Build stage ----
FROM node:22.23.1-alpine3.24 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22.23.1-alpine3.24 AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4180
# CRM agency UI requires session in production unless you explicitly set CRM_PUBLIC=true
ENV CRM_PUBLIC=false

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/server.js ./server.js
COPY --from=builder --chown=node:node /app/api ./api
COPY --from=builder --chown=node:node /app/core ./core
COPY --from=builder --chown=node:node /app/db ./db
COPY --from=builder --chown=node:node /app/config ./config
COPY --from=builder --chown=node:node /app/lib ./lib
COPY --from=builder --chown=node:node /app/styles ./styles
COPY --from=builder --chown=node:node /app/components ./components
COPY --from=builder --chown=node:node /app/apps ./apps
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 4180
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
