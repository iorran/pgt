FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
RUN echo "registry=https://registry.npmjs.org/" > .npmrc
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@pgt/api --workspace=@pgt/shared --include-workspace-root

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g tsx
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/src ./apps/api/src
COPY apps/api/drizzle ./apps/api/drizzle
COPY apps/api/package.json ./apps/api/
COPY packages/shared ./packages/shared
COPY package.json ./

EXPOSE 3000
CMD ["tsx", "apps/api/src/index.ts"]
