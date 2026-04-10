# Mobile-First Student PWA — Design

**Date:** 2026-04-10
**Status:** Draft — pending user review
**Scope:** `apps/web` — student-facing UX redesign + installable PWA + visual refinement
**Primary audience:** BJJ students using phones at the academy

## Problem

Today the web app renders a single `AppLayout` (sidebar + header) for every authenticated route regardless of role (`apps/web/src/components/layout/app-layout.tsx`). On phones this layout is cramped, navigation is buried behind a hamburger, and touch targets are desktop-sized. Students — who use the app every time they walk into the academy — deserve an experience that feels like the apps they already use on their phones. The app is also not installable: there is no manifest, no service worker, no PWA metadata. Students who want a home-screen icon can't get one.

## Goals

1. Students get a **mobile-first, app-like shell** with bottom navigation and a prominent check-in action.
2. Staff keep their current desktop-oriented sidebar layout (polished, not redesigned).
3. The app is **installable as a PWA** (level A: installable shell only, network required).
4. The visual identity — already established via Bebas Neue / Oswald / Barlow / Space Mono fonts, a dark theme, and PGT green/red/gold/black palette — is applied **consistently and with discipline** across the student shell.
5. Documentation (`docs/User Guide - Student.md` and `docs/User Guide - Instructor.md`) is fully updated to match.

## Non-Goals

- ❌ Push notifications — deferred to a separate brainstorm.
- ❌ Offline support beyond the installable shell (no cached API, no offline queue, no IndexedDB).
- ❌ Role-based separate route trees — single route tree, role picks the shell only.
- ❌ Staff shell layout redesign — visual tokens apply globally, but layout stays the same.
- ❌ New pages beyond `/me` — no new features, just a hub page.
- ❌ New fonts / new color palette / new component library.
- ❌ Multi-academy switcher on mobile.
- ❌ Onboarding tour or coach marks.
- ❌ A/B rollout — ships to 100% at once.
- ❌ Native app wrappers (Capacitor, React Native). PWA only.
- ❌ Motion beyond the scoped system in Section 4b (no scroll-driven animations, no gestures, no confetti).

## Architecture

### Two shells, one codebase, chosen at the route level

The seam is `apps/web/src/App.tsx`. Today a single `<Route element={<AppLayout />}>` wraps every authenticated route. We replace that with a role-aware shell selector:

```tsx
const isStudent = user.role === 'student';
const Shell = isStudent ? StudentShell : StaffShell;
// <Route element={<Shell />}> ...authenticated routes... </Route>
```

- `StaffShell` = the existing `AppLayout` renamed (no behavioral change).
- `StudentShell` = the new bottom-nav + FAB layout (Section 1).

Pages themselves are shared. Where a page already distinguishes student vs staff content internally (e.g., the billing area), that logic stays as-is. Only the *chrome* changes per role.

`/checkin` and `/totem` remain top-level routes **outside** any shell — they render fullscreen.

## Section 1 — Student shell anatomy

**New file:** `apps/web/src/components/layout/student-shell.tsx`

Structure:

```
┌─────────────────────────┐
│  [PGT]   Academia    🔔 │  ← student-header (56px)
├─────────────────────────┤
│                         │
│      <Outlet />         │  ← route content
│                         │
├─────────────────────────┤
│  🗓️   🏆  ⬤   🛒  👤  │  ← student-bottom-nav (64px + safe-area)
└─────────────────────────┘
```

### Student header (`student-header.tsx`)
- Height: 56px, sticky top, `theme_color` background (PGT green).
- Left: circular PGT badge (cropped from `LOGO_PGT.png`).
- Center: current academy name (read from session).
- Right: notification bell (existing `notification-bell.tsx`).
- No hamburger. No sidebar.

### Student bottom nav (`student-bottom-nav.tsx`)
- Sticky bottom, 64px tall + `env(safe-area-inset-bottom)` padding.
- 4 tabs + 1 centered FAB:
  | Slot  | Icon        | Label    | Route                     |
  |-------|-------------|----------|---------------------------|
  | 1     | Calendar    | Classes  | `/classes`                |
  | 2     | Trophy      | Progress | `/gamification/profile`   |
  | FAB   | QR          | (none)   | `/checkin`                |
  | 3     | Bag         | Shop     | `/marketplace`            |
  | 4     | User        | Me       | `/me`                     |
- Active tab: filled icon + accent color + small indicator pill under the icon.
- Inactive: outline icon + muted color.
- Icons from `lucide-react` (already a dep).
- Localization via `react-i18next` (already a dep).

### Check-in FAB
- 64px circular, elevated -24px above the bottom nav.
- PGT green → PGT gold gradient; QR icon.
- Tapping navigates to `/checkin`, which renders the existing `CheckinScanPage` fullscreen (no shell).
- Press feedback: spring scale to `0.92` on `:active`, 150ms (Section 4b).

### Me hub page (`apps/web/src/pages/me.tsx`)
New lightweight page. List of big tappable rows:

1. Profile header card (avatar, name, belt/stripes summary).
2. **Mensalidade** — status card (green "Em dia" / red "Atrasada — R$ X"). Routes to a read-only detail.
3. **Torneios** — routes to `/tournaments`.
4. **Idioma** — toggles between pt-BR / en via i18next.
5. **Tema** — light / dark / system toggle (Section 4).
6. **Configurações** — routes to `/settings` (student-relevant fields only).
7. **Sair** — calls `signOut()` and navigates to `/login`.

Supporting component: `apps/web/src/pages/me/billing-status.tsx` — read-only student billing detail (the student view of their own mensalidade). Separate from the staff-focused `pages/billing/index.tsx`.

## Section 2 — Pages impact

**Light touch (layout polish only — stack on mobile, 44px tap targets, consistent padding):**
- `pages/classes/index.tsx`
- `pages/marketplace/index.tsx` (grid: 2 cols mobile, 3 cols `md`, 4+ cols `lg`)
- `pages/tournaments/index.tsx` (card list on mobile; table reserved for `md+`)
- `pages/gamification/profile.tsx` (landing page for the Progress tab)

**New pages:**
- `pages/me.tsx` (hub)
- `pages/me/billing-status.tsx` (student billing read-only detail)

**Untouched (staff surfaces — keep desktop bias, visual tokens still apply):**
- `pages/students/*`, `pages/pending-students.tsx`, `pages/billing/plans.tsx`, `pages/billing/payments.tsx`, `pages/billing/index.tsx` (staff view), `pages/settings.tsx` (staff settings), `pages/totem.tsx`.

**Fullscreen routes (no shell):**
- `/checkin` (`CheckinScanPage`)
- `/totem` (`TotemPage`)

## Section 3 — PWA setup (level A)

**Tooling:** `vite-plugin-pwa` with `injectManifest` mode — chosen over `generateSW` so future push-notification work can extend the service worker without a rebuild of the setup.

### Files added
- `apps/web/public/` (new folder) — icon assets generated from `LOGO_PGT.png` by cropping the A4 padding to the circular badge:
  - `favicon.svg` (or `.ico`)
  - `apple-touch-icon.png` (180×180, PGT black background)
  - `pwa-192.png`, `pwa-512.png` (transparent)
  - `pwa-maskable-512.png` (PGT black background with safe-zone padding for Android adaptive icons)
- `apps/web/src/sw.ts` — minimal custom service worker entry consumed by `injectManifest`. Precaches the app shell via Workbox; no API caching; `CacheFirst` strategy for Google Fonts.

### `vite.config.ts` additions
- Add `VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', registerType: 'autoUpdate', manifest: { ... } })`.
- Manifest fields:
  - `name: 'Portugal Gold Team'`
  - `short_name: 'PGT'`
  - `description` (pt-BR)
  - `lang: 'pt-BR'`
  - `theme_color: '<PGT green hex>'` — exact hex sampled from `LOGO_PGT.png` during implementation and committed as the `--pgt-green` token (see Risks)
  - `background_color: '#000000'`
  - `display: 'standalone'`
  - `orientation: 'portrait'`
  - `start_url: '/'`
  - `icons` array referencing the files in `public/`.

### `index.html` additions
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` (adds `viewport-fit=cover` for safe-area support).
- `<meta name="theme-color" content="var(--pgt-green)">`.
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.
- `<meta name="apple-mobile-web-app-capable" content="yes">`.
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`.

### `main.tsx` additions
- `import { registerSW } from 'virtual:pwa-register'` and call `registerSW({ immediate: true })`. Silent auto-apply on next navigation — no toast, no user prompt.

### Installability acceptance
- Android Chrome: "Add to home screen" prompt available.
- iOS Safari: Share sheet → "Adicionar à Tela de Início" produces a full-screen icon with PGT splash.
- Lighthouse PWA score ≥ 90.

## Section 4 — Visual refinement

The existing identity is correct; execution is uneven. This section tightens execution without redesigning anything.

### Design tokens (`apps/web/src/index.css`)
- **Colors:** Pin the palette to named tokens — `pgt-green`, `pgt-red`, `pgt-gold`, `pgt-black`, plus muted and contrast variants. Replace ad-hoc hex values in components with these tokens.
- **Typography roles:**
  | Role         | Font          | Use                                         |
  |--------------|---------------|---------------------------------------------|
  | `font-display` | Bebas Neue    | Hero numerals, "PGT" wordmarks              |
  | `font-heading` | Oswald        | Section titles, button labels               |
  | `font-body`    | Barlow        | Body copy, list rows, forms                 |
  | `font-mono`    | Space Mono    | Join codes, QR data, monospace numerals     |
- **Spacing:** Tailwind default 4px scale. Kill any one-off `p-[13px]` style values. Cards: `p-4` mobile, `p-6` desktop.
- **Radius:** `rounded-xl` for cards, `rounded-full` for pills, FAB, and avatars.

### Mobile typography pass
Responsive scale for page titles and headings — e.g., `text-xl md:text-2xl` for page titles, `text-lg md:text-xl` for section headings.

### Touch target + density pass
Every interactive element ≥ 44×44 px. Audit: buttons, list rows, nav icons, notification bell, form inputs. Inputs get `h-12` on mobile.

### shadcn component polish
- `Card`: border + `bg-card` + consistent inner padding. No decorative `arena-stripes` *inside* cards (page-level background only).
- `Button`: `variant="default"` = PGT green, `destructive` = PGT red, `outline` has clear contrast on dark bg.
- `Input`: `h-12` on mobile, clearer focus ring.
- **Empty states:** every list page gets icon + one-line explanation + primary action.

### Theme toggle
- Light / dark / system, persisted in `localStorage`, applied via `data-theme` attribute on `<html>`. Control lives in `/me` for students; staff can gain the same control later via a small header button (not part of this project).
- Default: `system`.

## Section 4b — Motion system

Small, tokenized. No new libraries — uses Tailwind 4 + the existing `tw-animate-css` dep.

### Motion tokens (`index.css`)
- Durations: `--motion-fast: 150ms`, `--motion-base: 250ms`, `--motion-slow: 400ms`.
- Easings:
  - `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` — default for entrances.
  - `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` — position changes.
  - `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` — FAB press.

### Concrete applications
1. **FAB press feedback** — `scale(0.92)` on `:active`, `--ease-spring`, `--motion-fast`.
2. **Bottom nav active indicator** — small pill under the active tab icon, slides horizontally on tab change, `--motion-base` `--ease-in-out`.
3. **Page transition** — fade + 8px translate-up on forward navigation, `--motion-base` `--ease-out`. Skipped on browser back.
4. **List row tap** — background fades to `bg-muted/50` on `:active`, `--motion-fast`.
5. **Sheet / dialog** — shadcn defaults retuned to use motion tokens instead of hard-coded durations.
6. **Update toast** — slide-in from bottom with `--ease-spring`, slide-out with `--ease-in-out`. (Used by the `registerSW` auto-update banner if we later decide to surface it.)

### Accessibility
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Out of scope within motion
Scroll-driven animations, parallax, hero animations, shimmering skeletons, gesture-driven transitions (swipe-back, pull-to-refresh), number tickers, confetti.

## Section 5 — Testing plan

### Unit / component tests (Vitest + React Testing Library)
- `student-shell.test.tsx` — renders header + bottom nav + outlet; 5 nav slots in correct order.
- `student-bottom-nav.test.tsx` — active state matches current route; clicking a tab navigates; FAB navigates to `/checkin`.
- `me.test.tsx` — renders all hub rows; each row navigates to the expected route; logout calls `signOut` and navigates to `/login`.
- `App.test.tsx` — **critical architectural regression guard**: session with `role: 'student'` mounts `StudentShell`; session with a staff role mounts `StaffShell`.

### Playwright e2e (new spec file)
`tests/e2e/specs/student-mobile.spec.ts`:
- Runs under an iPhone 13 viewport project (add to `playwright.config.ts` if not already present).
- Student happy path: log in → land on dashboard → bottom nav visible → tap each tab in sequence → URLs match → tap FAB → URL is `/checkin` and the shell chrome is not visible (fullscreen scanner) → browser back returns to the prior tab.
- Safe-area: bottom nav has `padding-bottom > 0`.
- Staff regression: log in as staff → sidebar visible, bottom nav NOT visible.

### PWA installability test
Lightweight Playwright test:
- `<link rel="manifest">` present in `<head>`.
- Fetch manifest JSON and assert required fields (`name`, `short_name`, `start_url`, `display: 'standalone'`, `theme_color` matches PGT green, one 192px icon, one 512px icon, one maskable icon).
- Service worker registers successfully in the test browser.

### Manual verification
- Visual tokens, typography hierarchy, touch target sizes — DevTools device emulation.
- Lighthouse: PWA ≥ 90, Accessibility ≥ 95.
- Real-device install check on an Android Chrome and iOS Safari device before shipping.

### TDD order
Per user preference (memory: TDD enforcement):
1. Write failing test for `App.tsx` role split → implement.
2. Write failing tests for `StudentShell`, bottom nav, FAB → implement components.
3. Write failing test for `me.tsx` hub → implement page.
4. Write failing e2e mobile spec → implement until green.
5. Visual + PWA work against the running dev server, manually verified.

## Section 6 — Documentation updates

### Scope
- **`docs/User Guide - Student.md`** — full update.
- **`docs/User Guide - Instructor.md`** — full update.
- **`scripts/capture-guide-screenshots.mjs`** — verify/extend to drive student flows at `MOBILE` viewport and capture the new `/me` hub, bottom nav, and FAB.

### Bilingual format
Preserved — pt-BR primary content with `<sub><em>en translation</em></sub>` sub-italic lines, matching the existing pattern.

### New content in `User Guide - Student.md`
1. **"Instalar o PGT como aplicativo"** — two subsections:
   - iOS (Safari): Share sheet → "Adicionar à Tela de Início". Screenshot of the share sheet step.
   - Android (Chrome): Install prompt or menu → "Instalar app". Screenshot of the prompt.
2. **"Navegando no app"** — explains the bottom bar and what each tab does. Replaces any prose that references the sidebar.
3. **"Check-in rápido"** — the green FAB, the fullscreen scanner.
4. **"Minha conta"** — the `/me` hub: mensalidade status, torneios, idioma, tema, configurações, sair.

### Content rewritten or removed
- Any "menu lateral" / "in the sidebar menu" prose in student flows.
- Screenshots that show the old sidebar in a student context.

### Workflow during implementation
1. Ship the code changes (shell, pages, PWA, visual, motion).
2. Run `npm run db:seed:guide`.
3. Start `apps/web` and `apps/api` dev servers.
4. Run `npm run screenshots:capture`.
5. Diff the screenshots folder.
6. Update the prose in both guide Markdown files.
7. Commit docs + screenshots together in one commit.

## Risks & open questions

- **`LOGO_PGT.png` to PWA icons:** the source is 595×841 with A4 padding. Icon generation needs a manual crop to the circular badge; the crop bounds should be recorded in a tiny script or README so we can regenerate deterministically.
- **Exact PGT green hex:** the `--pgt-green` token value is sampled from `LOGO_PGT.png` at implementation time (eyedropper on the green ring of the badge) and committed alongside the design tokens in `index.css`. Same applies to `--pgt-red`, `--pgt-gold`, `--pgt-black` variants.
- **Role values in `session.user.role`:** the design assumes `'student'` is the exact value. Implementation must confirm from better-auth + the seed files. If role values differ, the shell picker condition adapts; this is a grep-and-verify step, not a design change.
- **`playwright.config.ts` mobile project:** may or may not already exist. If not, add it as part of Section 5.
- **shadcn component versions:** the polish pass may reveal components that need updating. Handle case-by-case; not a blocker.
- **Google Fonts `CacheFirst` strategy** assumes the existing preconnect remains. If we later self-host fonts, the service worker cache config adjusts.

## Acceptance criteria

1. A user with `role: 'student'` logs in → sees the new bottom-nav shell with FAB → can navigate to Classes, Progress, Shop, Me, and check-in via FAB.
2. A user with a staff role logs in → sees the unchanged sidebar layout (no visual regression beyond token cleanup).
3. The deployed URL is installable on Android Chrome and iOS Safari with a PGT icon and PGT green theme color.
4. Lighthouse PWA ≥ 90, Accessibility ≥ 95 on the student dashboard.
5. `npm run test` and `npm run test:e2e` both pass.
6. Both user guides are fully updated: bilingual prose matches the new UX, all student-facing screenshots show the new shell, the "Instalar como aplicativo" section exists.
7. No regressions in existing staff flows (students mgmt, pending-students, billing staff views, totem).

## Files touched (summary)

### New
- `apps/web/src/components/layout/student-shell.tsx`
- `apps/web/src/components/layout/student-header.tsx`
- `apps/web/src/components/layout/student-bottom-nav.tsx`
- `apps/web/src/pages/me.tsx`
- `apps/web/src/pages/me/billing-status.tsx`
- `apps/web/src/sw.ts`
- `apps/web/public/` (icon assets, manifest generated)
- `tests/e2e/specs/student-mobile.spec.ts`
- `apps/web/src/components/layout/__tests__/student-shell.test.tsx`
- `apps/web/src/components/layout/__tests__/student-bottom-nav.test.tsx`
- `apps/web/src/pages/__tests__/me.test.tsx`

### Modified
- `apps/web/src/App.tsx` — role-aware shell selector.
- `apps/web/src/components/layout/app-layout.tsx` — renamed to `StaffShell` (or re-exported).
- `apps/web/vite.config.ts` — add `VitePWA` plugin.
- `apps/web/index.html` — viewport, theme-color, apple-touch-icon, iOS meta tags.
- `apps/web/src/main.tsx` — `registerSW({ immediate: true })`.
- `apps/web/src/index.css` — design tokens, motion tokens, reduced-motion rule, typography roles.
- `apps/web/package.json` — add `vite-plugin-pwa`, `workbox-window`.
- `apps/web/src/pages/classes/index.tsx` — mobile layout polish.
- `apps/web/src/pages/marketplace/index.tsx` — mobile grid.
- `apps/web/src/pages/tournaments/index.tsx` — mobile card list.
- `apps/web/src/pages/gamification/profile.tsx` — Progress tab landing polish.
- `tests/e2e/playwright.config.ts` — add mobile project if missing.
- `scripts/capture-guide-screenshots.mjs` — extend student flow captures.
- `docs/User Guide - Student.md` — full update.
- `docs/User Guide - Instructor.md` — full update.
- `docs/assets/user-guide/**` — regenerated screenshots.
