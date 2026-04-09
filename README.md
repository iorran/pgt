# PGT BJJ Academy Management

A multi-tenant web application for Brazilian Jiu-Jitsu academies. PGT covers class scheduling, student check-ins, membership and billing management, a marketplace for academy products, tournament tracking, and gamification. The interface is Portuguese-primary with English sub-captions.

## Documentation

User guides for the PGT BJJ academy management app (Portuguese primary, English sub-captions):

- [Guia do Instrutor — Instructor Guide](./docs/User%20Guide%20-%20Instructor.md)
- [Guia do Aluno — Student Guide](./docs/User%20Guide%20-%20Student.md)

## Tech Stack

**Monorepo**

- npm workspaces + Turbo 2

**API** (`apps/api` — `@pgt/api`)

- Fastify 5
- Drizzle ORM 0.39 + drizzle-kit 0.30
- BetterAuth 1
- PostgreSQL 16 (via `postgres` driver)
- Resend (transactional email)
- Zod 3

**Web** (`apps/web` — `@pgt/web`)

- Vite 6 + React 19
- react-router-dom 7
- TanStack Query 5
- Tailwind CSS 4
- shadcn 4 + Base UI
- i18next / react-i18next 15

**Testing**

- Vitest 3 (both apps)
- Testing Library (web)
- MSW 2 (API mocking, web)

## Prerequisites

- Node.js 20 or later (the package manager field declares `npm@11.11.0`)
- npm 11 (bundled with the Node version above; used as the workspace package manager)
- Docker and Docker Compose (for the development Postgres instance)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/iorran/pgt.git
   cd pgt
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development database**

   ```bash
   docker-compose up -d
   ```

   This starts Postgres 16 on port `5432` (dev) and port `5433` (test, in-memory via tmpfs).

4. **Configure environment variables**

   Create `apps/api/.env` with the following variables:

   ```dotenv
   # Required
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/pgt
   BETTER_AUTH_SECRET=<random-secret-at-least-32-chars>

   # Optional — defaults shown
   BETTER_AUTH_URL=http://localhost:3000
   TRUSTED_ORIGINS=http://localhost:5173
   PORT=3000
   NODE_ENV=development
   RESEND_API_KEY=
   EMAIL_FROM=PGT <onboarding@resend.dev>
   ```

5. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

6. **Seed the database**

   For a minimal seed:

   ```bash
   npm run db:seed
   ```

   For canonical demo data (used by the instructor guide screenshots):

   ```bash
   npm run db:seed:guide
   ```

7. **Start the dev servers** (two terminals)

   ```bash
   # Terminal 1 — API on http://localhost:3000
   npm run dev --workspace=@pgt/api

   # Terminal 2 — Web on http://localhost:5173
   npm run dev --workspace=@pgt/web
   ```

   The Vite dev server proxies `/api/*` to `http://localhost:3000`, so no CORS configuration is needed during local development.

8. **Open the app**

   Navigate to [http://localhost:5173](http://localhost:5173).

## Development

**Workspace layout**

```
apps/
  api/      — Fastify REST API (@pgt/api)
  web/      — Vite + React SPA (@pgt/web)
packages/
  shared/   — shared types and utilities (@pgt/shared)
scripts/    — utility scripts (see scripts/README.md)
docs/       — user guides and Obsidian vault
```

**Common scripts** (run from repo root)

| Script | Description |
|---|---|
| `npm run dev` | Start all apps in dev mode via Turbo |
| `npm run build` | Production build for all apps |
| `npm test` | Run all test suites via Turbo |
| `npm run lint` | TypeScript type-check all apps |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed with base data |
| `npm run db:seed:guide` | Seed with demo data for the user guide |
| `npm run screenshots:capture` | Capture guide screenshots (see `scripts/README.md`) |

Turbo caches build and test outputs. The `dev` task is persistent (never cached). Pass `--filter=<workspace>` to scope any task to a single app.

## Testing

```bash
npm test
```

Turbo runs `vitest run` in both `@pgt/api` and `@pgt/web`. Both suites require the services declared in `docker-compose.yml` to be running. The test database (`pgt_test`) is served on port `5433` and uses a tmpfs volume so it resets on container restart.

To run tests in watch mode for a single app:

```bash
npm run test:watch --workspace=@pgt/api
npm run test:watch --workspace=@pgt/web
```

## Deployment

The web app deploys to Vercel (configured in `apps/web/vercel.json`). In production the Vite SPA rewrites all non-asset routes to `index.html`, and API calls are proxied to the hosted API server. The API is deployed separately (see `apps/api/fly.toml`).

## Releases

Versioning is automated by [semantic-release](https://github.com/semantic-release/semantic-release) driven by conventional commits. Every merge to the main branch that contains a `feat:` or `fix:` commit produces a new version and updates [CHANGELOG.md](./CHANGELOG.md) automatically.

The current release is **v1.2.1**.
