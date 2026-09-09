# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

# Dependency manifests are copied first to keep Docker's cache effective.
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci --no-audit --no-fund
RUN npm --prefix frontend ci --no-audit --no-fund

COPY . .

# The root build script builds Vue first and NestJS second.
RUN npm run build


FROM node:22-alpine AS production

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/frontend/dist ./frontend/dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
