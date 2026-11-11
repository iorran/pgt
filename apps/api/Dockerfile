FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
RUN echo "registry=https://registry.npmjs.org/" > .npmrc
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@pgt/api --workspace=@pgt/shared --include-workspace-root
# Bundle to plain JS so the machine boots with node, not a runtime TS transpiler (tsx added ~6 s to cold starts).
# npm dependencies stay external; @pgt/shared (TS source) is bundled in.
COPY apps/api/src apps/api/src
COPY packages/shared packages/shared
RUN node_modules/.bin/esbuild apps/api/src/index.ts --bundle --platform=node --format=esm --target=node22 \
      --outfile=apps/api/dist/index.js \
      $(node -p "Object.keys(require('./apps/api/package.json').dependencies).filter(d => d !== '@pgt/shared').map(d => '--external:' + d + ' --external:' + d + '/*').join(' ')")

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/api/dist ./apps/api/dist
COPY apps/api/drizzle ./apps/api/drizzle
COPY apps/api/package.json ./apps/api/
COPY package.json ./

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
