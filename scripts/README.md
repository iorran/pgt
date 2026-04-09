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

### Adding a new shot

Edit the `SHOTS` array in `capture-guide-screenshots.mjs`. Each entry needs:
- `slug` — kebab-case file name (without extension).
- `role` — `instructor`, `student`, or `unauth` (lowercased in the output folder).
- `login` — demo user email from `apps/api/src/db/seed-guide.ts`, or `null` for unauthenticated pages.
- `path` — in-app URL to capture.
- `viewport` — `desktop` (1440×900) or `mobile` (390×844).
- `prep` — optional comment describing manual prep needed (not executed yet).
