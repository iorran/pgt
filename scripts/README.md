# scripts/

Utility scripts for the PGT monorepo.

## `capture-guide-screenshots.mjs`

Captures canonical PNGs for the user guides by driving the local dev server with Playwright.

### Prerequisites

1. Dev Postgres running (e.g., `docker-compose up -d`).
2. Migrations applied: `npm run db:migrate`.
3. Guide fixtures seeded: `npm run db:seed:guide`.
4. API dev server with auth bypass enabled:
   ```bash
   DEV_AUTH_BYPASS=1 NODE_ENV=development npm run dev --workspace=@pgt/api
   ```
5. Web dev server at http://localhost:5173: `npm run dev --workspace=@pgt/web`.

### Run

```bash
node scripts/capture-guide-screenshots.mjs
```

Or via the root script:

```bash
npm run screenshots:capture
```

PNGs land in `docs/assets/user-guide/{role}/`, overwriting existing files with the same slug.

### Environment variables

- `PGT_WEB_URL` — override the web dev server URL (default: `http://localhost:5173`).
- `PGT_API_URL` — override the API URL (default: `http://localhost:3000`).
- `ONLY` — comma-separated slugs to capture just those shots.

Seed and capture on the same day: the seed puts a class "now" and dates relative to today. It runs with `TZ=Europe/Lisbon` (the academy's clock).

### Isolated stack (leaves your dev servers alone)

```bash
docker run -d --rm --name pgt-guide-db -p 5438:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pgt --tmpfs /var/lib/postgresql/data postgres:16-alpine
export DATABASE_URL=postgresql://postgres:postgres@localhost:5438/pgt
(cd apps/api && npm run db:migrate && npm run db:seed:guide)
(cd apps/api && NODE_ENV=development DEV_AUTH_BYPASS=1 PORT=3100 BETTER_AUTH_SECRET=any-long-secret \
  BETTER_AUTH_URL=http://localhost:5180 TRUSTED_ORIGINS=http://localhost:5180 TZ=Europe/Lisbon npx tsx src/index.ts) &
(cd apps/web && API_PROXY_TARGET=http://localhost:3100 npx vite --port 5180 --strictPort) &
PGT_WEB_URL=http://localhost:5180 PGT_API_URL=http://localhost:3100 npm run screenshots:capture
```

Every PNG in `docs/assets/user-guide/` should be referenced by a guide and listed in `SHOTS`.

### Adding a new shot

Edit the `SHOTS` array in `capture-guide-screenshots.mjs`. Each entry needs:
- `slug` — kebab-case file name (without extension).
- `role` — `instructor`, `student`, or `unauth` (lowercased in the output folder).
- `login` — demo user email from `apps/api/src/db/seed-guide.ts`, or `null` for unauthenticated pages.
- `path` — in-app URL to capture.
- `viewport` — `desktop` (1440×900) or `mobile` (390×844).
- `action` — optional `async (page) => {}` run before the screenshot (open a dialog, scroll).
- `stub` — optional `{ urlGlob: json }` API responses to fake (e.g. an empty totem).
- `permissions` — optional browser permissions (e.g. `['camera']`; Chromium's fake camera is on).
