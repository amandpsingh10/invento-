# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- Dependencies (full monorepo, so workspace linking resolves) ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY database/package.json ./database/package.json
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci

# ---- Build ----
FROM deps AS build
COPY database ./database
COPY backend ./backend
RUN npm run db:generate -w database
RUN npm run build -w database
RUN npm run build -w backend

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package.json package-lock.json* ./
COPY database/package.json ./database/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --omit=dev --workspace=@parts-inventory-system/database --workspace=@parts-inventory-system/backend --include-workspace-root

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/database/dist ./database/dist
COPY --from=build /app/database/prisma ./database/prisma
COPY --from=build /app/database/package.json ./database/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json

# Prisma Client is generated into node_modules/.prisma during db:generate —
# copy it explicitly since it lives outside database/dist.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

RUN addgroup -S parts_inventory && adduser -S parts_inventory -G parts_inventory
USER parts_inventory

EXPOSE 4000
WORKDIR /app/backend
CMD ["node", "dist/server.js"]
