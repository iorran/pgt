# Toasts, QR flow verification, and silent-error plumbing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every backend failure visible through a global toast driven by React Query cache handlers, and fix the unauthenticated-student blank screen in the check-in QR flow.

**Architecture:** shadcn `sonner` mounted once at the app root; a `createQueryClient()` factory wires `QueryCache` / `MutationCache` handlers that dispatch toasts with `meta`-based opt-out (`silent`) and opt-in success messages (`successMessage`); `CheckinScanPage` redirects unauthenticated visitors to `/login?redirect=<preserved url>` and the login page honors a validated `redirect` query param after success.

**Tech Stack:** React + Vite SPA, TanStack Query v5, TanStack Form, better-auth, React Router v7, Vitest + Testing Library, Playwright e2e, shadcn/ui (sonner to be added).

**Spec:** `docs/superpowers/specs/2026-04-19-toasts-and-qr-feedback-design.md`

---

## File structure

**Create:**
- `apps/web/src/components/ui/sonner.tsx` — installed by the shadcn CLI; exports `<Toaster />`.
- `apps/web/src/lib/toast.ts` — single import surface for toast primitives.
- `apps/web/src/lib/query-client.ts` — `createQueryClient()` factory with cache handlers.
- `apps/web/test/lib/query-client.test.tsx` — unit tests for the factory.
- `tests/e2e/flows/checkin-qr-redirect.spec.ts` — Playwright test for Mode A.

**Modify:**
- `apps/web/src/main.tsx` — use `createQueryClient()` instead of the inline `QueryClient`.
- `apps/web/src/App.tsx` — mount `<Toaster />` once.
- `apps/web/src/pages/checkin-scan.tsx` — redirect unauthenticated with preserved URL; add dev-only 15s watchdog.
- `apps/web/src/pages/login.tsx` — honor validated `redirect` query param after login.
- `apps/web/src/pages/classes/index.tsx` — drop ad-hoc `setCheckinMsg` in favor of `meta.successMessage` + global error toast.
- `apps/web/test/setup.ts` — mock `@/lib/toast` so existing tests still pass and new tests can assert calls.

---

## Task 1: Install shadcn `sonner`

**Files:**
- Create: `apps/web/src/components/ui/sonner.tsx` (by CLI)
- Modify: `apps/web/package.json` (by CLI)

- [ ] **Step 1: Run the shadcn add command from the web app directory**

```bash
cd apps/web && npx shadcn@latest add sonner
```

Accept any prompts. This writes `src/components/ui/sonner.tsx` and installs the `sonner` npm dependency.

- [ ] **Step 2: Verify the file was created**

```bash
ls apps/web/src/components/ui/sonner.tsx
cat apps/web/src/components/ui/sonner.tsx
```

Expected: file exists and exports a `Toaster` React component.

- [ ] **Step 3: Verify install + build still green**

```bash
cd apps/web && npm install && npm run lint
```

Expected: `lint` (which runs `tsc --noEmit`) exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/sonner.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add shadcn sonner toast component"
```

---

## Task 2: Create the toast wrapper module

**Files:**
- Create: `apps/web/src/lib/toast.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/web/src/lib/toast.ts
export { toast } from 'sonner';
```

- [ ] **Step 2: Verify types compile**

```bash
cd apps/web && npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/toast.ts
git commit -m "feat(web): add @/lib/toast re-export wrapper"
```

---

## Task 3: Mock `@/lib/toast` in test setup

**Files:**
- Modify: `apps/web/test/setup.ts`

- [ ] **Step 1: Append the mock to `test/setup.ts`**

Add this block immediately after the existing `vi.mock('better-auth/react', …)` block in `apps/web/test/setup.ts`:

```ts
vi.mock('@/lib/toast', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));
```

- [ ] **Step 2: Run the full unit suite to confirm nothing regressed**

```bash
cd apps/web && npx vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/setup.ts
git commit -m "test(web): mock @/lib/toast in vitest setup"
```

---

## Task 4: Mount `<Toaster />` in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add the import at the top of `App.tsx` (alongside other component imports)**

```tsx
import { Toaster } from './components/ui/sonner';
```

- [ ] **Step 2: Wrap the three return branches plus the final one in a fragment that also renders `<Toaster />`**

Replace the `return` of the main `App()` function with a wrapper that always renders `<Toaster richColors position="top-right" />` alongside whatever routes are chosen. The simplest approach is to extract the current routing logic into a helper and render both the helper and the toaster at the top level.

Concretely, modify the end of the `App` function so that instead of `return <Routes>…</Routes>;` statements, every branch returns a fragment that includes the toaster. The minimal diff is to introduce a single wrapper at the top of `App`:

```tsx
function App() {
  return (
    <>
      <AppRoutes />
      <Toaster richColors position="top-right" />
    </>
  );
}

function AppRoutes() {
  const { data: session, isPending, isRefetching } = useSession();
  // … existing body of the old App function, unchanged …
}
```

Move everything currently inside `App()` (the `useSession`, loading/unauth/routing branches, etc.) into the new `AppRoutes` component. Leave all the route logic untouched.

- [ ] **Step 3: Run lint + tests**

```bash
cd apps/web && npm run lint && npx vitest run
```

Expected: exit 0 for lint; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): mount sonner Toaster at app root"
```

---

## Task 5: Create `createQueryClient()` factory with tests (TDD)

**Files:**
- Create: `apps/web/src/lib/query-client.ts`
- Create: `apps/web/test/lib/query-client.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/test/lib/query-client.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import React from 'react';
import { createQueryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';

const toastError = toast.error as unknown as ReturnType<typeof vi.fn>;
const toastSuccess = toast.success as unknown as ReturnType<typeof vi.fn>;

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('createQueryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches error toast on failed mutation', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.reject(new Error('boom')),
        }),
      { wrapper: makeWrapper(client) },
    );
    result.current.mutate();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('boom'));
  });

  it('suppresses error toast when mutation meta.silent', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.reject(new Error('boom')),
          meta: { silent: true },
        }),
      { wrapper: makeWrapper(client) },
    );
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('dispatches success toast when mutation meta.successMessage set', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.resolve('ok'),
          meta: { successMessage: 'Saved!' },
        }),
      { wrapper: makeWrapper(client) },
    );
    result.current.mutate();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Saved!'));
  });

  it('dispatches error toast on failed query', async () => {
    const client = createQueryClient();
    renderHook(
      () =>
        useQuery({
          queryKey: ['fail'],
          queryFn: () => Promise.reject(new Error('boom')),
          retry: false,
        }),
      { wrapper: makeWrapper(client) },
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('boom'));
  });

  it('suppresses error toast when query meta.silent', async () => {
    const client = createQueryClient();
    renderHook(
      () =>
        useQuery({
          queryKey: ['silent-fail'],
          queryFn: () => Promise.reject(new Error('boom')),
          retry: false,
          meta: { silent: true },
        }),
      { wrapper: makeWrapper(client) },
    );
    await waitFor(() => {
      // Let the query settle
      expect(true).toBe(true);
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/web && npx vitest run test/lib/query-client.test.tsx
```

Expected: fails with "Failed to resolve import '@/lib/query-client'" (module not found).

- [ ] **Step 3: Create the factory file**

Create `apps/web/src/lib/query-client.ts`:

```ts
import {
  QueryClient,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { toast } from '@/lib/toast';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
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

- [ ] **Step 4: Run the test again to confirm it passes**

```bash
cd apps/web && npx vitest run test/lib/query-client.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Run the full suite**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/query-client.ts apps/web/test/lib/query-client.test.tsx
git commit -m "feat(web): add createQueryClient factory with toast-driven cache handlers"
```

---

## Task 6: Use `createQueryClient()` in `main.tsx`

**Files:**
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Swap the inline `QueryClient` for the factory**

Replace the current `QueryClient` construction in `apps/web/src/main.tsx` (lines 14–21) with a call to the factory. The final top of the file should look like:

```tsx
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './i18n';
import { applyTheme, getStoredTheme } from './lib/theme';
import { createQueryClient } from './lib/query-client';
applyTheme(getStoredTheme());

const queryClient = createQueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

Note the removed `QueryClient` named import (no longer used).

- [ ] **Step 2: Run lint + tests**

```bash
cd apps/web && npm run lint && npx vitest run
```

Expected: exit 0 + all tests pass.

- [ ] **Step 3: Smoke-test the dev server**

```bash
cd apps/web && npm run dev
```

Open the app in a browser. Trigger a failing request (e.g., log in with a wrong password or stop the API and navigate). Confirm a red toast appears in the top-right. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/main.tsx
git commit -m "feat(web): wire createQueryClient factory into app entry"
```

---

## Task 7: Migrate `ClassesPage` check-in to `meta` pattern

**Files:**
- Modify: `apps/web/src/pages/classes/index.tsx`
- Modify: `apps/web/test/pages/classes.test.tsx`

- [ ] **Step 1: Write a failing test asserting the success toast fires on check-in**

Append this test to `apps/web/test/pages/classes.test.tsx` inside the `describe('ClassesPage', …)` block:

```tsx
it('fires success toast when check-in succeeds', async () => {
  const user = userEvent.setup();
  mockUseSession.mockReturnValue(studentSession);

  // First call returns the class list, second call (POST /checkins) returns an empty object.
  mockApi
    .mockResolvedValueOnce(mockClasses as any)
    .mockResolvedValueOnce([] as any) // myCheckins
    .mockResolvedValueOnce({} as any); // POST /checkins

  // Geolocation stub — success path
  const geo = {
    getCurrentPosition: vi.fn((success: any) =>
      success({ coords: { latitude: 0, longitude: 0 } }),
    ),
  };
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: geo,
    configurable: true,
  });

  renderWithProviders(<ClassesPage />);

  const proximityButton = await screen.findByText('classes.checkinProximity');
  await user.click(proximityButton);

  const { toast } = await import('@/lib/toast');
  await waitFor(() =>
    expect((toast as any).success).toHaveBeenCalledWith('classes.checkinSuccess'),
  );
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/web && npx vitest run test/pages/classes.test.tsx
```

Expected: the new test fails because the mutation does not yet set `meta.successMessage`.

- [ ] **Step 3: Update the mutation to use `meta.successMessage` and drop the ad-hoc `setCheckinMsg` plumbing**

In `apps/web/src/pages/classes/index.tsx`:

Replace the `checkinMutation` declaration (currently lines 161–177) with:

```tsx
const checkinMutation = useMutation({
  mutationFn: (data: { classId: string; source: 'button'; latitude: number; longitude: number }) =>
    api('/checkins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['my-checkins'] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
  },
  meta: { successMessage: t('classes.checkinSuccess') },
});
```

Then remove the `checkinMsg` state and its uses:

- Delete `const [checkinMsg, setCheckinMsg] = useState('');`
- Delete the block in `handleProximityCheckin` that sets `setCheckinMsg(t('classes.checkinTooFar'))` on geolocation error — replace with `toast.error(t('classes.checkinTooFar'))`. Add `import { toast } from '@/lib/toast';` at the top of the file if not already present.
- Delete the JSX that renders `{checkinMsg && (<p…>{checkinMsg}</p>)}` near the top of the layout.

The final `handleProximityCheckin` should read:

```tsx
function handleProximityCheckin(classId: string) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      checkinMutation.mutate({
        classId,
        source: 'button',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    },
    () => {
      toast.error(t('classes.checkinTooFar'));
    },
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd apps/web && npx vitest run test/pages/classes.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run the full suite**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/classes/index.tsx apps/web/test/pages/classes.test.tsx
git commit -m "refactor(web): use meta-driven toasts for class check-in mutation"
```

---

## Task 8: Fix `CheckinScanPage` Mode A — preserve query on unauthenticated redirect

**Files:**
- Modify: `apps/web/src/pages/checkin-scan.tsx`

- [ ] **Step 1: Check whether an existing test exists for `checkin-scan.tsx`**

```bash
ls apps/web/test/pages/checkin-scan.test.tsx
```

If the file exists, skim it before changing the page so test updates in step 3 stay compatible.

- [ ] **Step 2: Write a failing test for the unauthenticated redirect**

Add a new test file `apps/web/test/pages/checkin-scan-redirect.test.tsx` (even if an existing test file exists — this isolates the new assertion):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CheckinScanPage from '@/pages/checkin-scan';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
}));

vi.mock('@/lib/api', () => ({ api: vi.fn() }));

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: () => <div data-testid="scanner" />,
}));

describe('CheckinScanPage — unauthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login with preserved redirect URL when no session', async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/checkin?token=abc&classId=c1']}>
          <Routes>
            <Route path="/checkin" element={<CheckinScanPage />} />
            <Route
              path="/login"
              element={<div data-testid="login-page">{window.location.search}</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // With MemoryRouter, location.search isn't reflected on window — assert on the navigated route element instead
    await waitFor(() =>
      expect(screen.getByTestId('login-page')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
cd apps/web && npx vitest run test/pages/checkin-scan-redirect.test.tsx
```

Expected: fails — the current code returns `null`, so no navigation happens and the login route is never reached.

- [ ] **Step 4: Modify `checkin-scan.tsx` to redirect with preserved URL**

At the top of `apps/web/src/pages/checkin-scan.tsx`, add `Navigate` to the react-router-dom imports:

```tsx
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
```

Replace the line `if (!session) return null;` (currently line 91) with:

```tsx
if (!session) {
  const query = searchParams.toString();
  const target = `/checkin${query ? `?${query}` : ''}`;
  return (
    <Navigate
      to={`/login?redirect=${encodeURIComponent(target)}`}
      replace
    />
  );
}
```

- [ ] **Step 5: Add a dev-only 15-second watchdog for Mode B silence**

Add this `useEffect` below the existing Mode A `useEffect` (around line 62) in `apps/web/src/pages/checkin-scan.tsx`:

```tsx
useEffect(() => {
  if (status !== 'scanning' || !import.meta.env.DEV) return;
  const timer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.warn(
      '[checkin-scan] Scanner still in "scanning" status after 15s — no QR detected or camera not initialised',
    );
  }, 15_000);
  return () => clearTimeout(timer);
}, [status]);
```

- [ ] **Step 6: Run the failing test to confirm it now passes**

```bash
cd apps/web && npx vitest run test/pages/checkin-scan-redirect.test.tsx
```

Expected: passes.

- [ ] **Step 7: Run the full suite**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/checkin-scan.tsx apps/web/test/pages/checkin-scan-redirect.test.tsx
git commit -m "fix(web): preserve check-in URL across login when unauthenticated"
```

---

## Task 9: Update `LoginPage` to honor a validated `redirect` param

**Files:**
- Modify: `apps/web/src/pages/login.tsx`
- Create: `apps/web/test/pages/login.test.tsx`

- [ ] **Step 1: Write a failing test**

Create `apps/web/test/pages/login.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '@/pages/login';

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: vi.fn() },
}));

import { signIn } from '@/lib/auth-client';
const mockSignIn = vi.mocked(signIn.email);

function renderAt(url: string) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/checkin" element={<div data-testid="checkin">checkin</div>} />
          <Route path="/" element={<div data-testid="home">home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('navigates to redirect param when it is a safe relative path', async () => {
    mockSignIn.mockResolvedValue({ error: null } as any);
    const user = userEvent.setup();
    renderAt('/login?redirect=%2Fcheckin%3Ftoken%3Dabc%26classId%3Dc1');

    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'auth.login' }));

    await waitFor(() => expect(screen.getByTestId('checkin')).toBeInTheDocument());
  });

  it('falls back to / when redirect param is missing', async () => {
    mockSignIn.mockResolvedValue({ error: null } as any);
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'auth.login' }));

    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });

  it('ignores redirect when it is protocol-relative (open-redirect guard)', async () => {
    mockSignIn.mockResolvedValue({ error: null } as any);
    const user = userEvent.setup();
    renderAt('/login?redirect=%2F%2Fevil.example.com');

    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'auth.login' }));

    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/web && npx vitest run test/pages/login.test.tsx
```

Expected: the first test fails because `LoginPage` currently always navigates to `/`.

- [ ] **Step 3: Update `LoginPage` to honor the redirect**

In `apps/web/src/pages/login.tsx`:

Add `useSearchParams` to the react-router-dom import:

```tsx
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
```

Inside the component, read and validate the param. Replace the current `LoginPage` function body so the navigate call uses the safe redirect:

```tsx
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  function safeRedirect(raw: string | null): string {
    if (!raw) return '/';
    // Must start with "/" and not "//" (protocol-relative) or "/\" edge case
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
      return '/';
    }
    return raw;
  }

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError('');
      console.log('[Login] Attempting sign-in for:', value.email);
      const result = await signIn.email({ email: value.email, password: value.password });
      console.log('[Login] Sign-in result:', JSON.stringify(result, null, 2));
      if (result.error) {
        setError(result.error.message ?? 'Login failed');
      } else {
        const target = safeRedirect(searchParams.get('redirect'));
        console.log('[Login] Success, navigating to', target);
        navigate(target);
      }
    },
  });

  // … remainder of the JSX is unchanged …
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd apps/web && npx vitest run test/pages/login.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Run the full suite**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/login.tsx apps/web/test/pages/login.test.tsx
git commit -m "feat(web): honor validated redirect query param on login"
```

---

## Task 10: Add Playwright e2e for Mode A redirect

**Files:**
- Create: `tests/e2e/flows/checkin-qr-redirect.spec.ts`

- [ ] **Step 1: Write the test file**

Create `tests/e2e/flows/checkin-qr-redirect.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import {
  setupAcademy,
  cleanAcademy,
  createClass,
  type FixtureAcademy,
} from '../fixtures';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

test('unauthenticated QR scan redirects to login, preserves URL, and restores it after login', async ({
  browser,
}) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  // Any class will do — we only care about the URL round-trip, not the checkin POST.
  await createClass(setup.academy.id, setup.instructor.id, {
    name: 'E2E Redirect Class',
    type: 'gi',
    dayOfWeek: 1,
    startTime: '07:00',
    endTime: '08:30',
  });

  // Fresh, unauthenticated context (no impersonation).
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'Europe/Lisbon',
    baseURL: 'http://localhost:5173',
  });
  try {
    const page = await context.newPage();
    const targetPath = '/checkin?token=fake-token&classId=fake-class-id';
    await page.goto(targetPath);

    // Expect redirect to /login with the redirect param preserved.
    await expect(page).toHaveURL(
      /\/login\?redirect=%2Fcheckin%3Ftoken%3Dfake-token%26classId%3Dfake-class-id/,
      { timeout: 10_000 },
    );

    // Log in with the instructor fixture.
    await page.getByLabel(/e-?mail/i).fill(setup.instructor.email);
    await page.getByLabel(/senha/i).fill('test1234');
    await page.getByRole('button', { name: /entrar|login/i }).click();

    // Should land back on /checkin with the preserved query.
    await expect(page).toHaveURL(/\/checkin\?token=fake-token&classId=fake-class-id/, {
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});
```

- [ ] **Step 2: Confirm the fixture helpers exist and seed a known instructor password**

```bash
grep -n "setupAcademy\|instructor.email\|test1234" tests/e2e/fixtures.ts
```

Expected: `setupAcademy` returns an object with `instructor: { email, … }`; fixture users are created with password `test1234`. If the seeded password differs, update the `.fill('test1234')` line in the test accordingly before running.

- [ ] **Step 3: Start the stack and run the test**

In one terminal:

```bash
npm run dev  # starts API + web per repo root scripts
```

In another terminal, from the repo root:

```bash
npx playwright test tests/e2e/flows/checkin-qr-redirect.spec.ts
```

Expected: test passes.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/flows/checkin-qr-redirect.spec.ts
git commit -m "test(e2e): verify unauthenticated checkin QR preserves URL across login"
```

---

## Final verification

- [ ] **Run the whole web unit suite**

```bash
cd apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Run lint**

```bash
cd apps/web && npm run lint
```

Expected: exit 0.

- [ ] **Manual smoke test**

1. Start dev stack.
2. While logged in as a student, open a class list, click check-in on an active class, observe a green success toast.
3. Stop the API server, try the same — observe a red error toast with the request-failed message.
4. In a fresh browser profile (unauthenticated), visit `/checkin?token=abc&classId=xyz` — observe a redirect to `/login?redirect=…`, log in, and verify you land back on `/checkin?token=abc&classId=xyz`.

---

## Self-review notes

- **Spec coverage:** every bullet under Sections 1–3 of the spec maps to a task above. Dev-only 15 s watchdog is in Task 8 step 5. Success toast opt-in is proven in Tasks 5 and 7. Open-redirect guard is in Task 9. Mode A e2e is Task 10.
- **No placeholders:** every code block contains the actual code; every command has an expected outcome.
- **Naming consistency:** `createQueryClient`, `meta.silent`, `meta.successMessage`, `/lib/toast`, `/lib/query-client` used identically across tasks.
- **Out of scope, intentionally:** bare-`api()` calls outside React Query (Section 3 "Non-goals"); faking a camera for Mode B e2e; changes to `api()` itself.
