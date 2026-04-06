# Deployment Design — Neon + Fly.io + Vercel

## Overview

Deploy the PGT BJJ Academy app on free tiers across 3 platforms, with GitHub Actions for CI/CD.

| Service | Platform | What |
|---|---|---|
| PostgreSQL | Neon | Serverless Postgres, free tier, auto-suspend |
| Fastify API | Fly.io | Containerized Node.js, free tier, auto-stop |
| React Frontend | Vercel | Static site on edge CDN, free tier |

## Architecture

```
[Vercel CDN] → static React app (apps/web/dist)
     ↓ API calls to VITE_API_URL
[Fly.io] → Fastify API (apps/api) via Dockerfile
     ↓ SQL via Neon serverless driver
[Neon] → PostgreSQL (serverless, auto-suspend)
```

## Environment Strategy

All URLs are env-driven. No hardcoded domains.

### Local Development (unchanged)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pgt
BETTER_AUTH_SECRET=dev-secret
BETTER_AUTH_URL=http://localhost:3000
VITE_API_URL=            # empty — Vite proxy handles /api
```

### Production
```
DATABASE_URL=<neon-connection-string>
BETTER_AUTH_SECRET=<random-32-chars>
BETTER_AUTH_URL=https://pgt-api.fly.dev
VITE_API_URL=https://pgt-api.fly.dev
```

## Changes Required

### 1. Neon Serverless Driver

Replace `postgres` (TCP) with `@neondatabase/serverless` for production compatibility. Neon's free tier prefers HTTP/WebSocket connections.

Approach: use `@neondatabase/serverless` with `drizzle-orm/neon-http` for production, keep `postgres` for local dev. Switch based on `DATABASE_URL` containing `neon.tech`.

### 2. Dynamic CORS / Auth Config

`apps/api/src/auth/index.ts`:
- `trustedOrigins` reads from env: `TRUSTED_ORIGINS=http://localhost:5173,https://pgt.vercel.app`
- `baseURL` reads from `BETTER_AUTH_URL` env (already does this)

`apps/api/src/routes/auth.ts`:
- `ALLOWED_ORIGIN` reads from env instead of hardcoded `http://localhost:5173`

### 3. Frontend API Base URL

`apps/web/src/lib/api.ts`:
- Use `import.meta.env.VITE_API_URL` as base (empty string for dev = relative URLs via proxy)

`apps/web/src/lib/auth-client.ts`:
- Use `import.meta.env.VITE_API_URL || ''` for baseURL

### 4. Fly.io Dockerfile

`apps/api/Dockerfile`:
- Multi-stage build: install deps → build TypeScript → slim runtime image
- Run migrations on startup before starting the server

### 5. GitHub Actions Workflow

`.github/workflows/deploy.yml`:
- Trigger: push to main
- Steps: test → detect changes → migrate DB → deploy API → deploy Web
- Secrets: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `FLY_API_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

### 6. Vercel Config

`apps/web/vercel.json`:
- SPA rewrites: all routes → index.html
- Build command: from monorepo root

## CI/CD Pipeline

```
push to main
  ├── Run API tests (vitest)
  ├── Run Web tests (vitest)
  ├── Detect changed paths
  ├── Run DB migrations (drizzle-kit migrate against Neon)
  ├── Deploy API to Fly.io (if apps/api changed)
  └── Deploy Web to Vercel (if apps/web changed)
```

## Free Tier Limits

| Platform | Limit | Impact |
|---|---|---|
| Neon | 0.5GB storage, auto-suspend after 5min idle | Cold start ~1-2s on first query |
| Fly.io | 3 shared VMs, 256MB RAM, auto-stop | Cold start ~3-5s on first request |
| Vercel | 100GB bandwidth/month | More than enough for MVP |
