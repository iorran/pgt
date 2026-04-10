# Mobile-First Student PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first student experience (bottom-nav shell + check-in FAB + `/me` hub), installable as a PWA, with visual-token cleanup, a small motion system, and fully updated bilingual user guides.

**Architecture:** Two shells in one codebase chosen at the route level in `App.tsx`: `StudentShell` (bottom nav + FAB) for `role === 'student'`, `StaffShell` (renamed from current `AppLayout`) for instructors. Single route tree, pages shared, only chrome changes per role. PWA is level A (installable shell only, network required) via `vite-plugin-pwa` in `injectManifest` mode.

**Tech Stack:** Vite 6, React 19, Tailwind 4, shadcn, react-router v7, better-auth, Vitest + React Testing Library, Playwright e2e, react-i18next, lucide-react, `vite-plugin-pwa`, Workbox.

**Spec:** `docs/superpowers/specs/2026-04-10-mobile-first-student-pwa-design.md`

**Role values confirmed in codebase:** only `'instructor'` and `'student'` exist. The shell selector uses `user.role === 'student'`.

**Test conventions (from existing suite):**
- Tests live under `apps/web/test/` mirroring `src/`.
- Use `renderWithProviders` / `renderWithRoute` from `apps/web/test/render.tsx`.
- Mock `@/lib/auth-client` with `vi.mock`.
- Assert on i18n translation **keys** (e.g., `'nav.classes'`), not translated strings.
- Import with the `@/` alias.

---

## Task 1: Install `vite-plugin-pwa` and Workbox

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dependencies**

Run from repo root:
```bash
npm install -w apps/web --save-dev vite-plugin-pwa workbox-window workbox-precaching workbox-routing workbox-strategies
```
Expected: packages added under `apps/web/package.json` devDependencies, no audit errors blocking install.

- [ ] **Step 2: Verify dev server still starts**

```bash
npm run dev -w apps/web
```
Expected: Vite dev server boots on its usual port with no module-not-found errors. Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(web): add vite-plugin-pwa and workbox deps"
```

---

## Task 2: Design tokens — colors, typography roles, radius, spacing

**Files:**
- Modify: `apps/web/src/index.css`

**Context:** Replace ad-hoc hex values with named PGT tokens. Sample the exact hex values from `/Users/iorran/Downloads/LOGO_PGT.png` (green ring, red fist ring, gold fill, black outer ring) using any eyedropper tool; record them in the comments next to the tokens so regeneration is deterministic.

- [ ] **Step 1: Open `apps/web/src/index.css` and locate the `:root` / theme block**

No code change yet — just identify where CSS variables are declared. If there's already a `@theme` block for Tailwind 4, the tokens go there.

- [ ] **Step 2: Add PGT brand tokens**

Add inside the existing `@theme` / `:root` block:
```css
/* PGT brand palette — sampled from LOGO_PGT.png on 2026-04-10 */
--pgt-green: #006437;        /* outer green ring */
--pgt-red: #C8102E;          /* red fist ring */
--pgt-gold: #F5C518;         /* gold fill */
--pgt-black: #0A0A0A;        /* outer black ring */
--pgt-green-muted: color-mix(in oklab, var(--pgt-green) 70%, black);
--pgt-red-muted: color-mix(in oklab, var(--pgt-red) 70%, black);
```
(Implementer: if eyedropper gives different hex values, use those — the names are fixed, the values are whatever the logo actually is.)

- [ ] **Step 3: Add typography role tokens**

Also inside `@theme`:
```css
--font-display: 'Bebas Neue', system-ui, sans-serif;
--font-heading: 'Oswald', system-ui, sans-serif;
--font-body: 'Barlow Variable', 'Barlow', system-ui, sans-serif;
--font-mono: 'Space Mono', ui-monospace, monospace;
```

- [ ] **Step 4: Run the dev server and confirm the app still renders**

```bash
npm run dev -w apps/web
```
Expected: app loads, no visual regression yet (tokens are added but not referenced anywhere new).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/index.css
git commit -m "style(web): add PGT brand and typography design tokens"
```

---

## Task 3: Motion tokens + `prefers-reduced-motion`

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add motion tokens to the theme block**

Append to the same `@theme` / `:root` block used in Task 2:
```css
--motion-fast: 150ms;
--motion-base: 250ms;
--motion-slow: 400ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

- [ ] **Step 2: Add reduced-motion override**

Append to `apps/web/src/index.css` (outside the `@theme` block, at file bottom):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Verify dev server builds**

```bash
npm run dev -w apps/web
```
Expected: no CSS parse errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css
git commit -m "style(web): add motion tokens and reduced-motion override"
```

---

## Task 4: Rename `AppLayout` → `StaffShell`

**Files:**
- Rename: `apps/web/src/components/layout/app-layout.tsx` → `apps/web/src/components/layout/staff-shell.tsx`
- Modify: `apps/web/src/App.tsx`

**Context:** Keep the implementation identical. Only the name changes. This prepares the seam where `App.tsx` will pick a shell per role.

- [ ] **Step 1: Rename the file**

```bash
git mv apps/web/src/components/layout/app-layout.tsx apps/web/src/components/layout/staff-shell.tsx
```

- [ ] **Step 2: Rename the exported symbol**

In `apps/web/src/components/layout/staff-shell.tsx`, change:
```tsx
export function AppLayout() {
```
to:
```tsx
export function StaffShell() {
```

- [ ] **Step 3: Update the import in `App.tsx`**

In `apps/web/src/App.tsx` line 11, change:
```tsx
import { AppLayout } from './components/layout/app-layout';
```
to:
```tsx
import { StaffShell } from './components/layout/staff-shell';
```
And change `<Route element={<AppLayout />}>` to `<Route element={<StaffShell />}>`.

- [ ] **Step 4: Find and fix any other references**

Run:
```bash
grep -rn "AppLayout\|app-layout" apps/web/src apps/web/test
```
Expected: no matches remain. If any do, update them.

- [ ] **Step 5: Run tests and typecheck**

```bash
npm run lint -w apps/web
npm run test -w apps/web
```
Expected: both pass. No test touched the old name directly, but typecheck proves nothing references the removed path.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "refactor(web): rename AppLayout to StaffShell"
```

---

## Task 5: Add i18n keys for the student shell

**Files:**
- Modify: `apps/web/src/i18n/<pt-BR and en locale files>`

**Context:** The student shell references new translation keys. Define them in both languages up front so later tasks can write tests that assert on keys without ambiguity.

- [ ] **Step 1: Locate locale files**

```bash
ls apps/web/src/i18n
```
Find the pt-BR and en JSON/TS files. Open both.

- [ ] **Step 2: Add keys to pt-BR**

Add under the existing `nav` object (or create it if missing):
```json
"nav": {
  "classes": "Aulas",
  "progress": "Progresso",
  "shop": "Loja",
  "me": "Perfil",
  "checkin": "Check-in"
}
```
Add a new top-level `me` section:
```json
"me": {
  "title": "Meu Perfil",
  "billingStatus": "Mensalidade",
  "billingUpToDate": "Em dia",
  "billingOverdue": "Atrasada",
  "tournaments": "Torneios",
  "language": "Idioma",
  "theme": "Tema",
  "themeLight": "Claro",
  "themeDark": "Escuro",
  "themeSystem": "Sistema",
  "settings": "Configurações",
  "signOut": "Sair"
}
```

- [ ] **Step 3: Mirror keys to en**

Add the same keys under en with English values:
```json
"nav": {
  "classes": "Classes",
  "progress": "Progress",
  "shop": "Shop",
  "me": "Me",
  "checkin": "Check-in"
},
"me": {
  "title": "My Profile",
  "billingStatus": "Membership",
  "billingUpToDate": "Up to date",
  "billingOverdue": "Overdue",
  "tournaments": "Tournaments",
  "language": "Language",
  "theme": "Theme",
  "themeLight": "Light",
  "themeDark": "Dark",
  "themeSystem": "System",
  "settings": "Settings",
  "signOut": "Sign out"
}
```

- [ ] **Step 4: Run the i18n completeness test**

```bash
npm run test -w apps/web -- i18n-completeness
```
Expected: PASS. This existing test enforces parity between locales — if it fails, the two files are out of sync.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n
git commit -m "i18n(web): add keys for student shell and me hub"
```

---

## Task 6: `StudentBottomNav` component — failing test

**Files:**
- Create: `apps/web/test/components/layout/student-bottom-nav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRoute } from '../../render';
import { StudentBottomNav } from '@/components/layout/student-bottom-nav';

describe('StudentBottomNav', () => {
  it('renders the five nav slots in order', () => {
    renderWithRoute(<StudentBottomNav />, ['/classes']);

    expect(screen.getByRole('link', { name: 'nav.classes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.progress' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.checkin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.shop' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.me' })).toBeInTheDocument();
  });

  it('marks the active tab based on the current route', () => {
    renderWithRoute(<StudentBottomNav />, ['/marketplace']);
    const shopLink = screen.getByRole('link', { name: 'nav.shop' });
    expect(shopLink.getAttribute('aria-current')).toBe('page');
  });

  it('renders the FAB with an accessible label for check-in', () => {
    renderWithRoute(<StudentBottomNav />, ['/']);
    const fab = screen.getByRole('link', { name: 'nav.checkin' });
    expect(fab.getAttribute('href')).toBe('/checkin');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/web -- student-bottom-nav
```
Expected: FAIL — module `@/components/layout/student-bottom-nav` not found.

---

## Task 7: `StudentBottomNav` component — minimal implementation

**Files:**
- Create: `apps/web/src/components/layout/student-bottom-nav.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, Trophy, QrCode, ShoppingBag, User } from 'lucide-react';

type Tab = {
  to: string;
  labelKey: string;
  Icon: typeof Calendar;
};

const LEFT_TABS: Tab[] = [
  { to: '/classes', labelKey: 'nav.classes', Icon: Calendar },
  { to: '/gamification/profile', labelKey: 'nav.progress', Icon: Trophy },
];

const RIGHT_TABS: Tab[] = [
  { to: '/marketplace', labelKey: 'nav.shop', Icon: ShoppingBag },
  { to: '/me', labelKey: 'nav.me', Icon: User },
];

function TabLink({ tab }: { tab: Tab }) {
  const { t } = useTranslation();
  const { Icon } = tab;
  return (
    <NavLink
      to={tab.to}
      aria-label={tab.labelKey}
      className={({ isActive }) =>
        [
          'flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px]',
          'text-xs font-heading uppercase tracking-wide',
          'transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]',
          isActive
            ? 'text-[color:var(--pgt-green)]'
            : 'text-muted-foreground hover:text-foreground',
        ].join(' ')
      }
      end={tab.to === '/'}
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5" aria-hidden />
          <span>{t(tab.labelKey)}</span>
          {isActive ? (
            <span className="h-1 w-1 rounded-full bg-[color:var(--pgt-green)]" />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function StudentBottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label="Student bottom navigation"
      className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-between border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex flex-1 items-stretch">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </div>

      <NavLink
        to="/checkin"
        aria-label={t('nav.checkin')}
        className="relative -top-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--pgt-green)] to-[color:var(--pgt-gold)] text-white shadow-lg transition-transform duration-[var(--motion-fast)] ease-[var(--ease-spring)] active:scale-[0.92]"
      >
        <QrCode className="h-7 w-7" aria-hidden />
      </NavLink>

      <div className="flex flex-1 items-stretch">
        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm run test -w apps/web -- student-bottom-nav
```
Expected: PASS (all 3 assertions green).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/student-bottom-nav.tsx apps/web/test/components/layout/student-bottom-nav.test.tsx
git commit -m "feat(web): add StudentBottomNav with FAB"
```

---

## Task 8: `StudentHeader` component — failing test

**Files:**
- Create: `apps/web/test/components/layout/student-header.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../render';
import { StudentHeader } from '@/components/layout/student-header';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/components/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

describe('StudentHeader', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: {
        user: { name: 'Aluno', role: 'student', academyName: 'Academia Teste' },
      },
      isPending: false,
    } as any);
  });

  it('renders the PGT wordmark', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });

  it('renders the academy name from session', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('Academia Teste')).toBeInTheDocument();
  });

  it('renders the notification bell', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -w apps/web -- student-header
```
Expected: FAIL — module `@/components/layout/student-header` not found.

---

## Task 9: `StudentHeader` component — minimal implementation

**Files:**
- Create: `apps/web/src/components/layout/student-header.tsx`

- [ ] **Step 1: Check the actual shape of `session.user`**

```bash
grep -rn "academyName\|academyId" apps/web/src/lib/auth-client.ts apps/web/src/App.tsx
```
If `academyName` is not on the session object, the test mock above is aspirational. Use whatever field the session actually exposes. If only `academyId` is present, fetch the academy name via react-query using the existing pattern in `Header` (`apps/web/src/components/layout/header.tsx`) — open that file to see how it already does it, and mirror the approach.

- [ ] **Step 2: Implement the component**

```tsx
import { useSession } from '@/lib/auth-client';
import { NotificationBell } from '@/components/notification-bell';

export function StudentHeader() {
  const { data: session } = useSession();
  const user = session?.user as { academyName?: string } | undefined;
  const academyName = user?.academyName ?? '';

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-[color:var(--pgt-green)] px-4 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-2">
        <img
          src="/pwa-192.png"
          alt=""
          aria-hidden
          className="h-8 w-8 rounded-full"
        />
        <span className="font-display text-2xl leading-none">PGT</span>
      </div>
      {academyName ? (
        <span className="font-heading text-sm uppercase tracking-wide truncate">
          {academyName}
        </span>
      ) : null}
      <NotificationBell />
    </header>
  );
}
```
(If Step 1 revealed the session field is different, adapt `academyName` resolution.)

- [ ] **Step 3: Run test to verify it passes**

```bash
npm run test -w apps/web -- student-header
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/student-header.tsx apps/web/test/components/layout/student-header.test.tsx
git commit -m "feat(web): add StudentHeader"
```

---

## Task 10: `StudentShell` composition — failing test

**Files:**
- Create: `apps/web/test/components/layout/student-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { StudentShell } from '@/components/layout/student-shell';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));
vi.mock('@/components/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

function renderShell() {
  mockedUseSession.mockReturnValue({
    data: { user: { name: 'Aluno', role: 'student', academyName: 'Ac' } },
    isPending: false,
  } as any);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/classes']}>
        <Routes>
          <Route element={<StudentShell />}>
            <Route path="/classes" element={<div>classes-content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StudentShell', () => {
  beforeEach(() => {
    mockedUseSession.mockReset();
  });

  it('renders header, outlet content, and bottom nav together', () => {
    renderShell();
    expect(screen.getByText('PGT')).toBeInTheDocument();
    expect(screen.getByText('classes-content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /student bottom navigation/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -w apps/web -- student-shell
```
Expected: FAIL — module `@/components/layout/student-shell` not found.

---

## Task 11: `StudentShell` composition — minimal implementation

**Files:**
- Create: `apps/web/src/components/layout/student-shell.tsx`

- [ ] **Step 1: Add the page-transition keyframe to `index.css`**

Append to `apps/web/src/index.css`:
```css
@keyframes pgt-page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pgt-page-enter {
  animation: pgt-page-enter var(--motion-base) var(--ease-out);
}
```

- [ ] **Step 2: Implement the component**

```tsx
import { Outlet, useLocation } from 'react-router-dom';
import { StudentHeader } from './student-header';
import { StudentBottomNav } from './student-bottom-nav';

export function StudentShell() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StudentHeader />
      <main
        key={location.pathname}
        className="pgt-page-enter flex-1 px-4 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
      >
        <Outlet />
      </main>
      <StudentBottomNav />
    </div>
  );
}
```
The `key={location.pathname}` forces React to remount `<main>` on route change, which replays the `pgt-page-enter` animation. The `prefers-reduced-motion` override from Task 3 already neutralizes this for motion-sensitive users.

- [ ] **Step 3: Run the test to verify it passes**

```bash
npm run test -w apps/web -- student-shell
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css apps/web/src/components/layout/student-shell.tsx apps/web/test/components/layout/student-shell.test.tsx
git commit -m "feat(web): add StudentShell composition with page transitions"
```

---

## Task 12: `App.tsx` role-based shell selector — failing test

**Files:**
- Create: `apps/web/test/App.test.tsx`

**Context:** This is the architectural regression guard. If anyone breaks the role → shell mapping, this test fails.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './render';
import App from '@/App';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/components/layout/student-shell', () => ({
  StudentShell: () => <div data-testid="student-shell" />,
}));
vi.mock('@/components/layout/staff-shell', () => ({
  StaffShell: () => <div data-testid="staff-shell" />,
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

function setSession(role: 'student' | 'instructor') {
  mockedUseSession.mockReturnValue({
    data: {
      user: {
        id: 'u1',
        academyId: 'a1',
        role,
        status: 'approved',
      },
    },
    isPending: false,
  } as any);
}

describe('App shell selector', () => {
  beforeEach(() => {
    mockedUseSession.mockReset();
  });

  it('mounts StudentShell for role=student', () => {
    setSession('student');
    renderWithProviders(<App />);
    expect(screen.getByTestId('student-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('staff-shell')).not.toBeInTheDocument();
  });

  it('mounts StaffShell for role=instructor', () => {
    setSession('instructor');
    renderWithProviders(<App />);
    expect(screen.getByTestId('staff-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('student-shell')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -w apps/web -- App.test
```
Expected: FAIL — `StudentShell` import does not yet exist in `App.tsx`.

---

## Task 13: `App.tsx` role-based shell selector — implementation

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Import `StudentShell`**

At the top of `apps/web/src/App.tsx`, next to the `StaffShell` import added in Task 4, add:
```tsx
import { StudentShell } from './components/layout/student-shell';
```

- [ ] **Step 2: Pick the shell based on role**

Replace the authenticated routes block (currently starting at `<Route element={<StaffShell />}>`) with:
```tsx
const Shell = (user.role as string) === 'student' ? StudentShell : StaffShell;

return (
  <Routes>
    <Route path="/totem" element={<TotemPage />} />
    <Route path="/checkin" element={<CheckinScanPage />} />
    <Route element={<Shell />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/pending" element={<PendingStudentsPage />} />
      <Route path="/classes" element={<ClassesPage />} />
      <Route path="/classes/history" element={<CheckinHistoryPage />} />
      <Route path="/students" element={<StudentsPage />} />
      <Route path="/students/:id" element={<StudentDetailPage />} />
      <Route path="/billing" element={<BillingOverduePage />} />
      <Route path="/billing/plans" element={<PlansPage />} />
      <Route path="/billing/payments" element={<PaymentsPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/marketplace/orders" element={<OrdersPage />} />
      <Route path="/gamification" element={<LeaderboardPage />} />
      <Route path="/gamification/seasons" element={<SeasonsPage />} />
      <Route path="/gamification/results" element={<ResultsPage />} />
      <Route path="/gamification/profile" element={<GamificationProfilePage />} />
      <Route path="/tournaments" element={<TournamentsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/me" element={<MePage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
);
```
(The `MePage` import is stubbed here; Task 15 adds the actual component. For now, add a temporary import: `import MePage from './pages/me';` — the test in Task 12 mocks `StudentShell` so it never renders children and this won't fail until Task 15.)

- [ ] **Step 3: Add the placeholder `MePage` so the import resolves**

Create `apps/web/src/pages/me.tsx` with:
```tsx
export default function MePage() {
  return <div>me-placeholder</div>;
}
```
(Task 15 replaces this placeholder with the real hub.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -w apps/web -- App.test
```
Expected: PASS (both student and instructor cases).

- [ ] **Step 5: Run the full web test suite to catch regressions**

```bash
npm run test -w apps/web
```
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/pages/me.tsx apps/web/test/App.test.tsx
git commit -m "feat(web): route-level role-based shell selector"
```

---

## Task 14: `/me` hub page — failing test

**Files:**
- Create: `apps/web/test/pages/me.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import MePage from '@/pages/me';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession, signOut } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);
const mockedSignOut = vi.mocked(signOut);

describe('MePage', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Aluno Teste', role: 'student', belt: 'blue' },
      },
      isPending: false,
    } as any);
    mockedSignOut.mockReset();
  });

  it('renders all hub rows', () => {
    renderWithProviders(<MePage />);
    expect(screen.getByText('me.billingStatus')).toBeInTheDocument();
    expect(screen.getByText('me.tournaments')).toBeInTheDocument();
    expect(screen.getByText('me.language')).toBeInTheDocument();
    expect(screen.getByText('me.theme')).toBeInTheDocument();
    expect(screen.getByText('me.settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'me.signOut' })).toBeInTheDocument();
  });

  it('calls signOut when the sign out button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MePage />);
    await user.click(screen.getByRole('button', { name: 'me.signOut' }));
    expect(mockedSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders the user name in the profile header', () => {
    renderWithProviders(<MePage />);
    expect(screen.getByText('Aluno Teste')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -w apps/web -- pages/me
```
Expected: FAIL — MePage is still the placeholder.

---

## Task 15: `/me` hub page — real implementation

**Files:**
- Modify: `apps/web/src/pages/me.tsx`

- [ ] **Step 1: Replace the placeholder**

```tsx
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Receipt,
  Trophy,
  Languages,
  Palette,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';

type HubRow = {
  to: string;
  labelKey: string;
  Icon: typeof Receipt;
};

const ROWS: HubRow[] = [
  { to: '/me/billing', labelKey: 'me.billingStatus', Icon: Receipt },
  { to: '/tournaments', labelKey: 'me.tournaments', Icon: Trophy },
  { to: '/me/language', labelKey: 'me.language', Icon: Languages },
  { to: '/me/theme', labelKey: 'me.theme', Icon: Palette },
  { to: '/settings', labelKey: 'me.settings', Icon: Settings },
];

export default function MePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const navigate = useNavigate();
  const user = session?.user as
    | { name?: string; belt?: string; email?: string }
    | undefined;

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--pgt-green)] font-display text-xl text-white">
            {(user?.name ?? 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-lg">{user?.name}</span>
            {user?.belt ? (
              <span className="text-xs uppercase text-muted-foreground">
                {user.belt}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {ROWS.map(({ to, labelKey, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-[56px] items-center gap-4 px-4 py-3 transition-colors duration-[var(--motion-fast)] active:bg-muted/50"
          >
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="flex-1 font-body">{t(labelKey)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>

      <Button variant="destructive" onClick={handleSignOut} className="h-12">
        <LogOut className="mr-2 h-4 w-4" />
        {t('me.signOut')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Run the `/me` test to verify it passes**

```bash
npm run test -w apps/web -- pages/me
```
Expected: all three assertions PASS.

- [ ] **Step 3: Run the full suite**

```bash
npm run test -w apps/web
```
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/me.tsx apps/web/test/pages/me.test.tsx
git commit -m "feat(web): add /me student hub page"
```

---

## Task 16: Student billing status detail page

**Files:**
- Create: `apps/web/src/pages/me/billing-status.tsx`
- Modify: `apps/web/src/App.tsx` (add route)

- [ ] **Step 1: Create the page**

```tsx
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';

export default function BillingStatusPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'billing-status'],
    queryFn: async () => {
      const res = await fetch('/api/me/billing-status', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      return res.json() as Promise<{ status: 'up_to_date' | 'overdue'; amount?: number }>;
    },
  });

  if (isLoading) return <div>{t('common.loading')}</div>;

  const isOverdue = data?.status === 'overdue';

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
        <span className="font-heading text-sm uppercase text-muted-foreground">
          {t('me.billingStatus')}
        </span>
        <span
          className={
            isOverdue
              ? 'font-display text-3xl text-[color:var(--pgt-red)]'
              : 'font-display text-3xl text-[color:var(--pgt-green)]'
          }
        >
          {isOverdue
            ? t('me.billingOverdue')
            : t('me.billingUpToDate')}
        </span>
        {isOverdue && data?.amount ? (
          <span className="font-mono text-lg">R$ {(data.amount / 100).toFixed(2)}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Register the route in `App.tsx`**

Inside the shell `<Route>` block, after `<Route path="/me" element={<MePage />} />`, add:
```tsx
<Route path="/me/billing" element={<BillingStatusPage />} />
```
And import it at the top:
```tsx
import BillingStatusPage from './pages/me/billing-status';
```

- [ ] **Step 3: Verify the API endpoint exists**

```bash
grep -rn "billing-status\|/me/billing" apps/api/src
```
Expected: if the endpoint exists, use it. If not, document it as an API follow-up and have the page render the `up_to_date` state as a default. (This is an MVP-friendly fallback — do NOT fail the build.)

- [ ] **Step 4: Smoke-check the dev server**

```bash
npm run dev -w apps/web
```
Manually navigate to `/me/billing` while logged in as a student. Expected: page renders (either live data or the default state). Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/me/billing-status.tsx apps/web/src/App.tsx
git commit -m "feat(web): add student billing status detail page"
```

---

## Task 17: Theme toggle (light / dark / system)

**Files:**
- Create: `apps/web/src/lib/theme.ts`
- Create: `apps/web/src/pages/me/theme.tsx`
- Modify: `apps/web/src/main.tsx` (apply stored theme on boot)
- Modify: `apps/web/src/App.tsx` (register route)

- [ ] **Step 1: Theme helper**

Create `apps/web/src/lib/theme.ts`:
```ts
export type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'pgt:theme';

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function applyTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
```

- [ ] **Step 2: Apply stored theme on boot**

In `apps/web/src/main.tsx`, near the top (before `ReactDOM.createRoot`), add:
```tsx
import { applyTheme, getStoredTheme } from './lib/theme';
applyTheme(getStoredTheme());
```

- [ ] **Step 3: Theme toggle page**

Create `apps/web/src/pages/me/theme.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme';
import { Button } from '@/components/ui/button';

const OPTIONS: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'me.themeLight' },
  { value: 'dark', labelKey: 'me.themeDark' },
  { value: 'system', labelKey: 'me.themeSystem' },
];

export default function ThemePage() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<Theme>('system');
  useEffect(() => setCurrent(getStoredTheme()), []);

  function handle(value: Theme) {
    setTheme(value);
    setCurrent(value);
  }

  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={current === opt.value ? 'default' : 'outline'}
          className="h-12 justify-start"
          onClick={() => handle(opt.value)}
        >
          {t(opt.labelKey)}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Register route**

In `apps/web/src/App.tsx`, next to the other `/me/*` routes, add:
```tsx
<Route path="/me/theme" element={<ThemePage />} />
```
And import: `import ThemePage from './pages/me/theme';`

- [ ] **Step 5: Typecheck and test**

```bash
npm run lint -w apps/web
npm run test -w apps/web
```
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add light/dark/system theme toggle"
```

---

## Task 18: Generate PWA icons from `LOGO_PGT.png`

**Files:**
- Create: `apps/web/public/pwa-192.png`
- Create: `apps/web/public/pwa-512.png`
- Create: `apps/web/public/pwa-maskable-512.png`
- Create: `apps/web/public/apple-touch-icon.png`
- Create: `apps/web/public/favicon.svg`
- Create: `scripts/generate-pwa-icons.mjs`

**Context:** The source image is 595×841 with A4 padding. The circular badge is centered horizontally, slightly above center vertically. A scripted approach makes regeneration deterministic.

- [ ] **Step 1: Install `sharp` as a dev dep for image processing**

```bash
npm install -w apps/web --save-dev sharp
```

- [ ] **Step 2: Write the generator script**

Create `scripts/generate-pwa-icons.mjs`:
```js
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ?? path.resolve(process.env.HOME ?? '', 'Downloads/LOGO_PGT.png');
const OUT = path.resolve(__dirname, '..', 'apps/web/public');

// Source is 595x841. Open it once to inspect metadata, then crop to the
// centered circular badge. Adjust CROP if the eyedropper says otherwise.
const CROP = { left: 40, top: 120, width: 515, height: 515 };
const PGT_BLACK = { r: 10, g: 10, b: 10, alpha: 1 };

async function main() {
  const base = sharp(SRC).extract(CROP);
  const sizes = [
    { name: 'pwa-192.png', size: 192 },
    { name: 'pwa-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180, flatten: true },
  ];
  for (const { name, size, flatten } of sizes) {
    let pipe = base.clone().resize(size, size, { fit: 'contain', background: PGT_BLACK });
    if (flatten) pipe = pipe.flatten({ background: PGT_BLACK });
    await pipe.toFile(path.join(OUT, name));
    console.log('wrote', name);
  }
  // Maskable: 512 canvas with the badge scaled to ~70% for the safe zone.
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: PGT_BLACK },
  })
    .composite([
      {
        input: await base.clone().resize(360, 360).png().toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toFile(path.join(OUT, 'pwa-maskable-512.png'));
  console.log('wrote pwa-maskable-512.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the script**

```bash
mkdir -p apps/web/public
node scripts/generate-pwa-icons.mjs
```
Expected: four PNGs written to `apps/web/public/`. Open each manually to confirm the badge is centered and readable. If the crop is wrong, tune `CROP` and re-run.

- [ ] **Step 4: Add a simple SVG favicon**

Create `apps/web/public/favicon.svg` as a minimal placeholder (a green circle with white "PGT"):
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#006437" />
  <text x="32" y="40" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">PGT</text>
</svg>
```
(The implementer may replace this with a proper vector export of the logo later; the PNG icons above are what the OS actually uses.)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-pwa-icons.mjs apps/web/public apps/web/package.json package-lock.json
git commit -m "chore(web): generate PWA icon assets from logo"
```

---

## Task 19: PWA service worker file

**Files:**
- Create: `apps/web/src/sw.ts`

- [ ] **Step 1: Write the custom service worker entry**

```ts
/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// App shell precache — injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Google Fonts runtime cache — your index.html preconnects to these.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({ cacheName: 'google-fonts-stylesheets' }),
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({ cacheName: 'google-fonts-webfonts' }),
);

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

- [ ] **Step 2: Commit (build will verify it in Task 20)**

```bash
git add apps/web/src/sw.ts
git commit -m "feat(web): add PWA service worker entry"
```

---

## Task 20: Wire `vite-plugin-pwa` into Vite config

**Files:**
- Modify: `apps/web/vite.config.ts`

- [ ] **Step 1: Import and register the plugin**

Add the import at the top of `apps/web/vite.config.ts`:
```ts
import { VitePWA } from 'vite-plugin-pwa';
```

- [ ] **Step 2: Add the plugin to the plugins array**

Inside `plugins: [...]`, add:
```ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'autoUpdate',
  injectRegister: false,
  manifest: {
    name: 'Portugal Gold Team',
    short_name: 'PGT',
    description: 'Academia de Jiu-Jitsu — Portugal Gold Team',
    lang: 'pt-BR',
    theme_color: '#006437',
    background_color: '#000000',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
  injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
}),
```
(If the eyedropper gave a different hex than `#006437` for PGT green, replace `theme_color` here and the `var(--pgt-green)` value in `index.css` to match.)

- [ ] **Step 3: Build the web app**

```bash
npm run build -w apps/web
```
Expected: build succeeds; output includes `dist/manifest.webmanifest`, `dist/sw.js`, and the icons copied from `public/`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/vite.config.ts
git commit -m "feat(web): configure vite-plugin-pwa with PGT manifest"
```

---

## Task 21: Register service worker + add PWA meta tags

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/index.html`

- [ ] **Step 1: Register the service worker**

In `apps/web/src/main.tsx`, add near the existing imports:
```tsx
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
```

- [ ] **Step 2: Update `index.html` meta tags**

Replace the existing `<meta name="viewport">` line with:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#006437" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="PGT" />
```

- [ ] **Step 3: Build and preview**

```bash
npm run build -w apps/web
npm run preview -w apps/web
```
Open the preview URL in a browser, open DevTools → Application → Manifest. Expected: manifest shows Portugal Gold Team with PGT green theme color and all icons resolvable. Application → Service Workers shows a registered SW. Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/main.tsx apps/web/index.html
git commit -m "feat(web): register PWA service worker and add meta tags"
```

---

## Task 22: Polish the Classes page for mobile

**Files:**
- Modify: `apps/web/src/pages/classes/index.tsx`

**Context:** This task (and Tasks 23–25) don't change behavior. Only layout: stack on mobile, ≥44px tap targets, consistent padding, responsive font sizes. Use device emulation in DevTools (iPhone 13) to verify.

- [ ] **Step 1: Open the file and identify the top-level container**

```bash
cat apps/web/src/pages/classes/index.tsx | head -50
```
Note the outermost wrapper and any grid/flex containers.

- [ ] **Step 2: Apply responsive polish**

Core changes to make across the file:
- Replace any `p-6` on the outer container with `p-4 md:p-6`.
- Replace any page-title `text-2xl` with `text-xl md:text-2xl`.
- Replace any grids wider than one column on mobile with `grid-cols-1 md:grid-cols-2` (or similar).
- Ensure buttons and list rows are at least `h-11` (~44px).

These are surgical edits — do not rewrite the page.

- [ ] **Step 3: Verify in the dev server with device emulation**

```bash
npm run dev -w apps/web
```
Open DevTools → Toggle device toolbar → iPhone 13. Verify: no horizontal scroll, tap targets are comfortably big, content isn't crowded. Ctrl-C.

- [ ] **Step 4: Run tests**

```bash
npm run test -w apps/web
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/classes/index.tsx
git commit -m "style(web): mobile polish for Classes page"
```

---

## Task 23: Polish the Marketplace page for mobile

**Files:**
- Modify: `apps/web/src/pages/marketplace/index.tsx`

- [ ] **Step 1: Apply the same responsive polish pattern as Task 22**

Specifically:
- Product grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
- Card image aspect: `aspect-square` so cards line up cleanly on mobile.
- Page title: `text-xl md:text-2xl`.
- Outer padding: `p-4 md:p-6`.
- Any filter/sort buttons: `h-11` and full-width on mobile (`w-full md:w-auto`).

- [ ] **Step 2: Verify in device emulation**

```bash
npm run dev -w apps/web
```
Check `/marketplace` at iPhone 13 width. Ctrl-C.

- [ ] **Step 3: Run tests and commit**

```bash
npm run test -w apps/web
git add apps/web/src/pages/marketplace/index.tsx
git commit -m "style(web): mobile polish for Marketplace page"
```

---

## Task 24: Polish the Tournaments page for mobile

**Files:**
- Modify: `apps/web/src/pages/tournaments/index.tsx`

- [ ] **Step 1: Convert the tournament list from table to card list under `md`**

- Wrap each tournament row in a `<Card>` on mobile (`md:hidden`) and keep the existing table under `hidden md:block`.
- Card content: tournament name (`font-heading text-lg`), date (`font-mono text-sm`), location, register button (`h-11 w-full`).

- [ ] **Step 2: Verify in device emulation**

```bash
npm run dev -w apps/web
```
Check `/tournaments`. Ctrl-C.

- [ ] **Step 3: Run tests and commit**

```bash
npm run test -w apps/web
git add apps/web/src/pages/tournaments/index.tsx
git commit -m "style(web): mobile card-list layout for Tournaments page"
```

---

## Task 25: Polish the Progress (Gamification Profile) landing page

**Files:**
- Modify: `apps/web/src/pages/gamification/profile.tsx`

- [ ] **Step 1: Make the belt/stripe hero mobile-forward**

- Belt visual stacked above the stat summary on mobile, side-by-side on `md+`.
- Streak/achievement rows become full-width cards on mobile.
- Remove any horizontal-only scroll on mobile.

- [ ] **Step 2: Verify in device emulation**

```bash
npm run dev -w apps/web
```
Check `/gamification/profile`. Ctrl-C.

- [ ] **Step 3: Run tests and commit**

```bash
npm run test -w apps/web
git add apps/web/src/pages/gamification/profile.tsx
git commit -m "style(web): mobile polish for gamification profile"
```

---

## Task 26: Add an iPhone project to Playwright config

**Files:**
- Modify: `tests/e2e/playwright.config.ts`

- [ ] **Step 1: Inspect the current config**

```bash
cat tests/e2e/playwright.config.ts
```
Identify the existing `projects` array.

- [ ] **Step 2: Add a mobile project**

Add to the `projects` array (import `devices` from `@playwright/test` if not already imported):
```ts
{
  name: 'mobile-iphone-13',
  use: { ...devices['iPhone 13'] },
},
```

- [ ] **Step 3: Verify the config still parses**

```bash
npx playwright test --config tests/e2e/playwright.config.ts --list | head
```
Expected: projects listed include `mobile-iphone-13`.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/playwright.config.ts
git commit -m "test(e2e): add mobile-iphone-13 project to Playwright config"
```

---

## Task 27: Student mobile e2e spec

**Files:**
- Create: `tests/e2e/specs/student-mobile.spec.ts`

- [ ] **Step 1: Write the spec**

Use the existing e2e spec files in `tests/e2e/specs/` as references for the login helper and fixtures. Write the spec as:
```ts
import { test, expect } from '@playwright/test';
import { loginAsStudent, loginAsInstructor } from '../helpers/auth';

test.describe('Student mobile shell', () => {
  test('student sees bottom nav and can navigate via tabs', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: /student bottom navigation/i });
    await expect(nav).toBeVisible();

    await nav.getByRole('link', { name: /nav\.classes/i }).click();
    await expect(page).toHaveURL(/\/classes$/);

    await nav.getByRole('link', { name: /nav\.progress/i }).click();
    await expect(page).toHaveURL(/\/gamification\/profile$/);

    await nav.getByRole('link', { name: /nav\.shop/i }).click();
    await expect(page).toHaveURL(/\/marketplace$/);

    await nav.getByRole('link', { name: /nav\.me/i }).click();
    await expect(page).toHaveURL(/\/me$/);
  });

  test('FAB navigates to fullscreen check-in without the shell', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/');
    await page
      .getByRole('navigation', { name: /student bottom navigation/i })
      .getByRole('link', { name: /nav\.checkin/i })
      .click();
    await expect(page).toHaveURL(/\/checkin/);
    await expect(
      page.getByRole('navigation', { name: /student bottom navigation/i }),
    ).toHaveCount(0);
  });

  test('instructor does NOT see the student shell', async ({ page }) => {
    await loginAsInstructor(page);
    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: /student bottom navigation/i }),
    ).toHaveCount(0);
  });
});
```
(If the `loginAsStudent` / `loginAsInstructor` helpers don't exist, read `tests/e2e/helpers/` and use whatever auth pattern exists — e.g., `test.use({ storageState: ... })` or a seeded user + form fill. Match existing specs.)

- [ ] **Step 2: Run only the mobile project**

```bash
npm run test:e2e -- --project=mobile-iphone-13 student-mobile
```
Expected: all three tests PASS. If a helper is missing, fix the spec to use the existing auth pattern from other specs.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/specs/student-mobile.spec.ts
git commit -m "test(e2e): student mobile shell and FAB coverage"
```

---

## Task 28: PWA installability e2e test

**Files:**
- Create: `tests/e2e/specs/pwa-installability.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

test.describe('PWA installability', () => {
  test('manifest is linked and contains required fields', async ({ page, request }) => {
    await page.goto('/');

    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const resolved = new URL(manifestHref!, page.url()).toString();
    const response = await request.get(resolved);
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toBe('Portugal Gold Team');
    expect(manifest.short_name).toBe('PGT');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.theme_color).toMatch(/^#/);

    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const maskable = manifest.icons.find(
      (i: { purpose?: string }) => (i.purpose ?? '').includes('maskable'),
    );
    expect(maskable).toBeTruthy();
  });

  test('service worker registers', async ({ page }) => {
    await page.goto('/');
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg);
    });
    expect(registered).toBe(true);
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npm run test:e2e -- pwa-installability
```
Expected: both tests PASS against a `vite preview` server. If the test harness doesn't build before running, build first:
```bash
npm run build -w apps/web && npm run test:e2e -- pwa-installability
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/specs/pwa-installability.spec.ts
git commit -m "test(e2e): verify PWA manifest and service worker"
```

---

## Task 29: Extend screenshot capture script

**Files:**
- Modify: `scripts/capture-guide-screenshots.mjs`

- [ ] **Step 1: Audit current capture flows**

```bash
cat scripts/capture-guide-screenshots.mjs
```
Identify:
- Which user flows run at `MOBILE` viewport vs `DESKTOP`.
- Whether student flows already use `MOBILE`.

- [ ] **Step 2: Ensure ALL student flows use `MOBILE`**

Every capture performed while logged in as `STUDENT_AZUL` or `STUDENT_ROXA` must be wrapped in a `browserContext` created with `viewport: MOBILE`. Where the current script uses `DESKTOP` for a student flow, change it to `MOBILE`.

- [ ] **Step 3: Add captures for the new student screens**

For each new screen, add a step that: navigates there, waits for the hero element, then `page.screenshot({ path })`. The new screens to capture:
- `/me` — student hub (capture: `docs/assets/user-guide/student/me-hub.png`)
- `/me/billing` — billing detail (`docs/assets/user-guide/student/me-billing.png`)
- `/me/theme` — theme toggle (`docs/assets/user-guide/student/me-theme.png`)
- `/classes` — after refresh, with the new bottom nav visible (`docs/assets/user-guide/student/classes-mobile.png`)
- `/marketplace` — mobile product grid (`docs/assets/user-guide/student/marketplace-mobile.png`)
- `/gamification/profile` — progress tab landing (`docs/assets/user-guide/student/progress-mobile.png`)
- `/checkin` — fullscreen scanner (may require granting camera permission in Playwright context via `permissions: ['camera']`)

- [ ] **Step 4: Keep all instructor flows at `DESKTOP`**

Do not change the instructor captures. Verify by skimming.

- [ ] **Step 5: Dry run (just the student section)**

Seed the DB first, then run the script:
```bash
npm run db:seed:guide
npm run dev -w apps/web &
npm run dev -w apps/api &
# wait for both to be healthy
npm run screenshots:capture
```
Expected: new PNG files appear under `docs/assets/user-guide/student/`. Kill the dev servers.

- [ ] **Step 6: Commit the script changes (NOT the regenerated screenshots yet — those come with Task 31)**

```bash
git add scripts/capture-guide-screenshots.mjs
git commit -m "chore(scripts): extend screenshot capture for student mobile shell"
```

---

## Task 30: Rewrite `User Guide - Student.md` prose

**Files:**
- Modify: `docs/User Guide - Student.md`

**Context:** Keep the bilingual pt-BR primary + `<sub><em>en</em></sub>` pattern. Update prose to match the new UX.

- [ ] **Step 1: Remove any "menu lateral" / "sidebar" prose**

```bash
grep -n "menu lateral\|sidebar" "docs/User Guide - Student.md"
```
Rewrite each hit to reference the bottom bar or the `/me` hub.

- [ ] **Step 2: Add "Instalar o PGT como aplicativo" section**

Add a new top-level section after "Primeiros Passos":
```markdown
## Instalar o PGT como aplicativo
<sub><em>Install PGT as an app</em></sub>

Você pode instalar o PGT na tela inicial do seu celular e usá-lo como um aplicativo nativo, sem abrir o navegador.
<sub><em>You can install PGT on your phone's home screen and use it like a native app, without opening a browser.</em></sub>

### iPhone (Safari)
1. Abra o PGT no **Safari** (não funciona em outros navegadores no iPhone).
   <sub><em>Open PGT in **Safari** (it won't work in other browsers on iPhone).</em></sub>
2. Toque no botão de **compartilhar** na barra inferior.
   <sub><em>Tap the **share** button in the bottom bar.</em></sub>
3. Escolha **"Adicionar à Tela de Início"**.
   <sub><em>Choose **"Add to Home Screen"**.</em></sub>
4. Confirme o nome e toque em **Adicionar**.
   <sub><em>Confirm the name and tap **Add**.</em></sub>

### Android (Chrome)
1. Abra o PGT no **Chrome**.
   <sub><em>Open PGT in **Chrome**.</em></sub>
2. Toque no menu (três pontinhos) no canto superior direito.
   <sub><em>Tap the menu (three dots) in the top right.</em></sub>
3. Escolha **"Instalar app"** ou **"Adicionar à tela inicial"**.
   <sub><em>Choose **"Install app"** or **"Add to home screen"**.</em></sub>
```

- [ ] **Step 3: Add "Navegando no app" section**

```markdown
## Navegando no app
<sub><em>Navigating the app</em></sub>

A navegação principal fica na barra inferior, sempre visível.
<sub><em>The main navigation lives in the bottom bar, always visible.</em></sub>

![Barra inferior do aluno](./assets/user-guide/student/classes-mobile.png)

- **Aulas** — sua agenda e histórico de presenças.
  <sub><em>**Classes** — your schedule and attendance history.</em></sub>
- **Progresso** — faixas, graus, conquistas e ranking.
  <sub><em>**Progress** — belts, stripes, achievements, and ranking.</em></sub>
- **Check-in (botão central verde)** — abre o leitor de QR code em tela cheia.
  <sub><em>**Check-in (center green button)** — opens the QR code scanner full-screen.</em></sub>
- **Loja** — produtos da academia.
  <sub><em>**Shop** — academy products.</em></sub>
- **Perfil** — mensalidade, torneios, idioma, tema, sair.
  <sub><em>**Me** — membership, tournaments, language, theme, sign out.</em></sub>
```

- [ ] **Step 4: Add "Check-in rápido" section**

```markdown
## Check-in rápido
<sub><em>Quick check-in</em></sub>

Toque no grande botão verde no centro da barra inferior para abrir o leitor de QR code. Aponte a câmera para o QR code na entrada da sua academia para marcar presença.
<sub><em>Tap the large green button in the center of the bottom bar to open the QR code scanner. Point your camera at the QR code at your academy's entrance to check in.</em></sub>

![Leitor de QR code](./assets/user-guide/student/checkin-scanner.png)
```

- [ ] **Step 5: Add "Minha conta" section**

```markdown
## Minha conta
<sub><em>My account</em></sub>

A aba **Perfil** reúne tudo que é seu.
<sub><em>The **Me** tab gathers everything that's yours.</em></sub>

![Hub do aluno](./assets/user-guide/student/me-hub.png)

- **Mensalidade** — status do pagamento.
- **Torneios** — inscrições e resultados.
- **Idioma** — alternar entre Português e Inglês.
- **Tema** — claro, escuro ou automático.
- **Configurações** — dados pessoais e segurança.
- **Sair** — encerra a sessão neste dispositivo.
```

- [ ] **Step 6: Review all existing sections for outdated screenshots**

```bash
grep -n "assets/user-guide" "docs/User Guide - Student.md"
```
For any image path that references an old student-view screenshot, either keep the path (if Task 31 regenerates it) or update the path to the new `student/` subdirectory.

- [ ] **Step 7: Commit**

```bash
git add "docs/User Guide - Student.md"
git commit -m "docs(guide): rewrite student guide for new mobile shell"
```

---

## Task 31: Regenerate screenshots and update Instructor Guide

**Files:**
- Modify: `docs/User Guide - Instructor.md`
- Regenerate: `docs/assets/user-guide/**/*.png`

- [ ] **Step 1: Seed demo data**

```bash
npm run db:seed:guide
```

- [ ] **Step 2: Run both dev servers**

```bash
npm run dev
```
Wait until web and api are both healthy.

- [ ] **Step 3: Capture screenshots**

In a second terminal:
```bash
npm run screenshots:capture
```
Expected: new PNGs generated under `docs/assets/user-guide/`.

- [ ] **Step 4: Stop the dev servers**

Ctrl-C the dev command.

- [ ] **Step 5: Diff screenshots**

```bash
git status -- docs/assets/user-guide
git diff --stat -- docs/assets/user-guide
```
Expected: student screenshots are modified; instructor screenshots may or may not be (acceptable either way — both are "fully updated" per the spec).

- [ ] **Step 6: Read the Instructor Guide and update prose where needed**

```bash
cat "docs/User Guide - Instructor.md" | head -80
```
Scan for any mention of student-side navigation that references the old sidebar. If found, update to match the new bottom nav. Most instructor prose should be untouched; this is a proof-of-read pass.

- [ ] **Step 7: Commit docs + screenshots together**

```bash
git add "docs/User Guide - Instructor.md" docs/assets/user-guide
git commit -m "docs(guide): regenerate screenshots and update instructor guide"
```

---

## Task 32: Final verification — build, tests, Lighthouse, devices

**Files:** none

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: all workspaces build. Fix any typescript or lint errors before continuing.

- [ ] **Step 2: Full test suite**

```bash
npm run test
```
Expected: all green.

- [ ] **Step 3: Full e2e suite**

```bash
npm run test:e2e
```
Expected: all green, including the new `student-mobile` and `pwa-installability` specs.

- [ ] **Step 4: Lighthouse audit**

```bash
npm run preview -w apps/web
```
In Chrome DevTools, open the preview URL, open Lighthouse panel, run an audit with **Mobile** + **PWA** + **Accessibility** + **Performance** checked. Expected:
- PWA ≥ 90
- Accessibility ≥ 95

Record the scores in the commit message. If PWA < 90, the most common misses are: no HTTPS in preview (use `--https` flag for preview or accept that real deploy will pass), missing theme_color meta, or a service worker that didn't register. Fix and re-run.

- [ ] **Step 5: Real-device check**

Deploy the branch to a Vercel preview (or your preferred preview target), then on a real Android phone in Chrome and a real iPhone in Safari:
- Open the preview URL.
- Confirm "Add to home screen" (Android) / Share → "Adicionar à Tela de Início" (iOS) works.
- Open the installed icon. Confirm the app launches standalone (no browser chrome) with the PGT green status bar.
- Log in as a student, navigate via bottom nav, tap the FAB, scan the QR (camera permission should prompt once).

- [ ] **Step 6: Final commit if any fixes were applied during verification**

```bash
git add -A
git commit -m "chore(web): final verification fixes from device and Lighthouse audit"
```

- [ ] **Step 7: Open the PR**

Use the existing repo PR conventions. The PR description should link to the spec at `docs/superpowers/specs/2026-04-10-mobile-first-student-pwa-design.md` and this plan at `docs/superpowers/plans/2026-04-10-mobile-first-student-pwa.md`.
