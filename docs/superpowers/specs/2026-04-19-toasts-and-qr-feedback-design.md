# Design — Toasts, QR flow verification, and silent-error plumbing

**Date:** 2026-04-19
**Author:** Iorran Castro (with Claude)

## Motivation

Two pain points were observed while using the app:

1. Scanning the academy totem QR via the in-app scanner (FAB) appeared to do nothing — no confirmation, no error. The "nothing happened" symptom needs verification and, if real, a fix. The native-camera flow (student scans totem with phone camera, URL opens the app) was never end-to-end tested and has a latent bug where unauthenticated users hit a blank screen.
2. Backend errors surface inconsistently: the HTTP client throws, but individual callers choose whether to render the error. Several mutations swallow errors entirely. The app needs a uniform, visible feedback mechanism.

This design tackles both concerns with a minimal, decoupled approach: a global toast system driven by React Query's cache hooks, plus targeted QR-flow fixes.

## Goals

- Every failed backend call in a React Query hook surfaces as a visible toast by default.
- Students scanning the totem QR from their phone's native camera land on a working flow, even when unauthenticated.
- Success toasts available opt-in for mutations that warrant confirmation.
- No changes to the low-level `api()` HTTP client — keep it UI-agnostic.

## Non-goals

- Global unhandled-rejection handler. Bare `await api()` calls outside React Query are left alone for now.
- Retry/backoff policy changes.
- Refactoring every ad-hoc error-display into toasts in this pass. Only the obvious duplications are cleaned up.
- e2e coverage for the in-app scanner (Mode B) — requires fake-camera injection, out of scope.

## Architecture

Three independent pieces, layered:

1. **Toast primitive.** shadcn `sonner` mounted once at the app root; callers import from `@/lib/toast`.
2. **React Query plumbing.** A `createQueryClient()` factory wires `QueryCache` and `MutationCache` handlers that dispatch toasts. Per-query opt-out (`meta.silent`) and per-mutation opt-in success message (`meta.successMessage`).
3. **QR flow hardening.** `CheckinScanPage` preserves `token` + `classId` across an unauthenticated redirect to login. Explicit "camera starting" state so the scanner tile is never inexplicably blank.

### Component diagram

```
Components / hooks
        │ useMutation / useQuery
        ▼
 React Query cache
 (QueryCache, MutationCache)
        │ onError / onSuccess
        ▼
    toast() ──► Sonner <Toaster />
        ▲
        │ direct calls (imperative)
        │
 non-query code (e.g., checkin-scan.tsx)
```

## Section 1 — QR flow verification

### Current behavior

- `apps/web/src/pages/checkin-scan.tsx` line 91: `if (!session) return null;` — renders a blank page when the phone browser is unauthenticated.
- `apps/web/src/pages/totem.tsx` line 60: QR encodes `${APP_URL}/checkin?token=...&classId=...`. Valid URL, but assumes the phone is logged into the same app origin.
- Mode B (FAB): every code path renders UI. True silence only possible if the scanner never fires `onScan`.

### Changes

1. **`CheckinScanPage`**
   - Replace `if (!session) return null;` with: redirect to `/login?redirect=<encoded current URL>`.
   - On the login page, after successful auth, honor the `redirect` query param (fall back to `/` if absent or unsafe — validate it starts with `/`).
   - Add a `cameraStarting` status shown until the scanner reports its first frame or emits an error, so users never see an empty tile.

2. **Diagnostics for Mode B**
   - Dev-only `setTimeout` that logs a console warning if `onScan` hasn't fired after 15 seconds in `scanning` status. Not user-visible; aids future debugging without shipping UI complexity.

3. **e2e coverage (Mode A)**
   - New Playwright test: unauthenticated visit to `/checkin?token=X&classId=Y`, verify redirect to login with the full URL preserved, log in, land back on `/checkin?token=X&classId=Y`, verify the success or error UI renders. Uses the test fixtures at `tests/e2e/fixtures.ts`.

### Out of scope

- Faking a camera feed for Mode B.
- Changing the totem token format or generation.

## Section 2 — Toast infrastructure

### Install

`npx shadcn@latest add sonner`

### Mount

Single `<Toaster />` inside `apps/web/src/App.tsx`, placed within existing providers so it inherits theme. Default position top-right; no custom styling in this pass.

### Wrapper module (`apps/web/src/lib/toast.ts`)

```ts
export { toast } from 'sonner';
```

Single import path gives us room to add i18n helpers or swap the toast engine later without touching call sites.

### Test mock

In `apps/web/test/setup.ts`, mirror the existing `react-i18next` mock:

```ts
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));
```

This keeps existing tests fast and lets new tests assert toast invocations.

## Section 3 — React Query cache handlers

### Factory (`apps/web/src/lib/query-client.ts`, new)

```ts
import {
  QueryClient,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { toast } from '@/lib/toast';

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => {
        if (query.meta?.silent) return;
        toast.error((err as Error).message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error((err as Error).message);
      },
      onSuccess: (_data, _vars, _ctx, mutation) => {
        const msg = mutation.meta?.successMessage as string | undefined;
        if (msg) toast.success(msg);
      },
    }),
  });
}
```

### Wire-up

- Swap `apps/web/src/main.tsx`'s current `QueryClient` construction to use `createQueryClient()`.
- The test helper `apps/web/test/render.tsx` already creates a fresh `QueryClient` per test — leave it unchanged (tests don't need the global toast behavior by default; specific tests can opt into it by calling the factory).

### Opt-outs and opt-ins (via `meta`)

- `meta: { silent: true }` — suppresses the global error toast. Apply to:
  - Session/auth probe queries (they fail by design when unauthenticated).
  - Form-level mutations that already render inline errors (e.g., login, signup).
- `meta: { successMessage: <already-translated string> }` — opt-in success toast. Caller translates.

### Migration touches

- `ClassesPage.checkinMutation`: drop the `setCheckinMsg` + timeout UX in favor of `meta.successMessage: t('classes.checkinSuccess')` and the automatic error toast. Keep the "CHECKED IN" inline badge driven by `myCheckins`.
- `ClassesPage.checkinMutation.onError`: remove.
- Audit `useApiQuery` for the session hook and mark it silent.
- No changes to `apps/web/src/lib/api.ts`.

## Error message contract

Backend errors already come through as localized, human-readable strings (via the existing `api()` extractor: `error.error || 'Request failed'`). Toasts display them verbatim. The toast layer does not i18n-map backend messages.

## Testing plan

- **Unit (`apps/web/test/lib/query-client.test.ts`, new):**
  - Failed mutation → `toast.error` called with the server message.
  - Failed mutation with `meta.silent` → `toast.error` NOT called.
  - Successful mutation with `meta.successMessage` → `toast.success` called.
  - Failed query → `toast.error` called.
  - Failed query with `meta.silent` → `toast.error` NOT called.

- **Unit (existing `ClassesPage` tests):**
  - Update the check-in tests to assert on the toast mock rather than inline message DOM.

- **e2e (new, Playwright):**
  - Mode A: unauthenticated visit to `/checkin?token=X&classId=Y` → redirect to login preserving URL → after login, check-in success UI renders.

## Risks

- **React Query cache handlers capture all errors.** Any code that currently relies on *silent* failures (there shouldn't be any, but session probes are the obvious case) must be migrated to `meta.silent`. Mitigation: audit is small — the app has a handful of query/mutation call sites.
- **Redirect handling on login.** Accepting a `redirect` query param is a classic open-redirect vector. Mitigation: validate that `redirect` starts with `/` and does not begin with `//` before using it.

## Rollout

Single PR. No feature flag needed — behavior change is uniformly better.
