---
title: User Guide Full Audit + Screenshot Refresh
date: 2026-04-09
status: draft
---

# User Guide Full Audit + Screenshot Refresh

## Context

The `docs/User Guide - Instructor.md` and `docs/User Guide - Student.md` files are the
end-user documentation for the PGT BJJ academy app. They are bilingual (pt-BR primary,
English `<sub>` sub-captions) and currently live in an Obsidian vault under `docs/`.

Recent feature work has drifted the app ahead of the guides (multi-month overdue
detection, quick-pay current month, membership deactivation on plan assignment, etc.),
and a full audit is needed to close the gap — not just document the recent changes.

At the same time, the guides should become discoverable from GitHub so contributors
and users landing on the repo can find them without needing Obsidian.

This spec covers the **user guide update only**. A separate spec will plan Playwright
end-to-end test coverage for all flows.

## Goals

- Both user guides accurately reflect every user-facing flow in the current web app.
- Every flow section includes one pt-BR screenshot of a seeded demo academy.
- A reusable `seed:guide` script produces canonical "Academia Demo PGT" fixtures so
  screenshots are deterministic and can be regenerated after UI changes.
- Bilingual format preserved: pt-BR primary content with English `<sub>` sub-captions.
- Guides are discoverable from GitHub via a new "Documentation" section in root
  `README.md`.
- Guides render correctly on GitHub: Obsidian wikilinks converted to standard relative
  markdown links; screenshots embedded via relative paths that work in both Obsidian
  and GitHub.

## Non-Goals

- No Playwright e2e test harness, `*.spec.ts` files, or test runner setup — that is a
  separate follow-up spec.
- No GitHub Pages or static site generator. GitHub's native markdown rendering is
  sufficient for now.
- No restructuring of either guide's table of contents beyond what audit findings
  require.
- No English UI screenshots. The app stays in pt-BR for all captures.
- No GIFs, videos, or animated assets — still PNGs only.
- No refactoring of page components to make them easier to screenshot.
- No new features added to the app.
- No internationalization of the app UI.

## Deliverables

Five concrete artifacts with clear boundaries:

### 1. `apps/api/src/db/seed-guide.ts`

Dedicated fixture seed script for screenshot capture. Separate from the existing
`db:seed` so it won't interfere with dev seeds.

Creates a canonical story:

- **Academy:** "Academia Demo PGT" (Pontinha, Lisboa).
- **Instructor account:** `instrutor@demo.pgt` with a canonical password stored in
  the script as a constant.
- **Students (4, varied state):**
  - Faixa azul, 3 months paid up-to-date.
  - Faixa branca, pending approval (shows up in the Pending tab).
  - Faixa roxa, multi-month overdue billing.
  - Faixa branca, current month due with quick-pay button ready.
- **Classes:** 2–3 scheduled in the current week with mixed attendance.
- **Plans:** 1 active plan assignable to students.
- **Tournaments:** 1 tournament listing.
- **Marketplace:** 1 listed item.
- **Gamification:** a few entries so the gamification page isn't empty.

**Idempotent:** drops and reseeds only the `demo-pgt` academy, leaving all other
data in the local DB untouched.

**Exposed via:** `npm run db:seed:guide` in the root `package.json` (delegating to
the api workspace via turbo).

### 2. `scripts/capture-guide-screenshots.mjs`

Standalone Playwright script (not a `@playwright/test` spec file) that drives the
dev server and captures PNGs.

- Requires the dev server running at `http://localhost:5173` (documented in script
  comments and the README Phase 2 instructions).
- Uses `@playwright/test` as the launcher only — no test runner, no assertions.
  Installed as a root devDependency.
- Logs in as instructor or student as needed for each flow.
- Navigates each flow, waits for stable UI, captures PNG.
- Writes to `docs/assets/user-guide/{instructor,student}/<slug>.png`.
- **Viewport:** 1440×900 desktop for most flows. Mobile pass at 390×844 for
  check-in and totem flows only (those are mobile-first in production use).
- **Deterministic naming:** `<section-slug>.png` matching the guide section, e.g.,
  `approve-students.png`, `billing-overdue.png`, `checkin-scan.png`.
- Rerunnable: running the script again overwrites existing PNGs, enabling a
  one-command screenshot refresh after UI changes.

### 3. `docs/user-guide-audit.md` (temporary working document)

Phase 1 gap inventory. A structured table capturing what the audit finds:

```markdown
| Guide section | Role       | Current text (summary) | Actual app behavior | Action  | Screenshot slug   |
| ------------- | ---------- | ---------------------- | ------------------- | ------- | ----------------- |
| Approve Students | Instructor | ...                  | ...                 | Update  | approve-students  |
| Quick Pay        | Instructor | (not documented)     | ...                 | Add     | billing-quick-pay |
```

Committed during Phase 1 so the user can review it on a branch. **Deleted during
Phase 3** once all guide edits are applied — the audit doc is scaffolding, not
part of the final documentation.

### 4. Updated guide files

`docs/User Guide - Instructor.md` and `docs/User Guide - Student.md`:

- Inline edits based on the approved audit findings.
- Obsidian wikilinks converted to standard relative markdown links:
  - `[[User Guide - Student|Guia do Aluno]]` →
    `[Guia do Aluno](./User%20Guide%20-%20Student.md)`
- Screenshot embeds added per flow section using relative paths:
  - `![Dashboard](./assets/user-guide/instructor/dashboard.png)`
- Bilingual pt-BR + `<sub>`-wrapped English format preserved everywhere.
- Obsidian `> [!info]` callouts left as-is — GitHub renders them as native alerts.

### 5. Updated `README.md`

A new "Documentation" section near the top of the root README linking to both
guides with a one-line description each:

```markdown
## Documentation

- [Guia do Instrutor / Instructor Guide](./docs/User%20Guide%20-%20Instructor.md)
- [Guia do Aluno / Student Guide](./docs/User%20Guide%20-%20Student.md)
```

## Data Flow

```
seed-guide.ts
  ↓ populates canonical demo academy in local DB
capture-guide-screenshots.mjs
  ↓ logs in, navigates flows, writes PNGs
docs/assets/user-guide/{instructor,student}/*.png
  ↑ embedded via relative paths
docs/User Guide - Instructor.md
docs/User Guide - Student.md
  ↑ linked from
README.md
```

## Phased Execution

Three phases with a review gate between each. Each phase produces commits.

### Phase 1 — Gap Inventory (no destructive edits)

1. Read every page under `apps/web/src/pages/**` and extract: routes, visible
   labels (pt-BR), buttons, states (empty / loading / error), navigation in/out.
2. Cross-reference with the corresponding sections in both guides.
3. Produce `docs/user-guide-audit.md` as a structured gap table.
4. Commit: `docs: add user guide audit findings`.
5. **Review gate:** user reviews the audit doc and approves or requests changes.

### Phase 2 — Fixtures + Screenshots

1. Write `apps/api/src/db/seed-guide.ts`.
2. Add `db:seed:guide` npm script (root + api workspace).
3. Write a unit test for `seed-guide.ts` asserting idempotency and expected entity
   counts (per TDD rule).
4. Run `npm run db:seed:guide` against the local dev DB.
5. Add `@playwright/test` as a root devDependency.
6. Write `scripts/capture-guide-screenshots.mjs`.
7. Start dev server and run the capture script.
8. Commits:
   - `feat(api): add seed-guide script for documentation fixtures`
   - `chore(docs): add screenshot capture script and canonical images`
9. **Review gate:** user skims `docs/assets/user-guide/`, flags anything that
   looks wrong, script re-run if needed.

### Phase 3 — Guide Edits + README

1. Apply inline edits to both guide files based on the approved audit.
2. Convert wikilinks to standard relative markdown links in both guides.
3. Embed screenshots per section using relative paths.
4. Update root `README.md` with a "Documentation" section linking to both guides.
5. Delete `docs/user-guide-audit.md`.
6. Commit: `docs: refresh user guides with full flow audit and screenshots`.
7. Manual verification: open both guides via PR preview on GitHub to confirm
   rendering (wikilinks gone, images inline, callouts as alerts).

## Testing Strategy

Per the project's TDD feedback rule, all code written for this spec gets tested:

- **`seed-guide.ts`** — unit test asserting:
  - Running twice produces the same state (idempotency).
  - Expected entity counts: 1 academy, 1 instructor, 4 students, 2–3 classes,
    1 plan, 1 tournament, 1 marketplace item.
  - Dropping only affects the `demo-pgt` academy.
- **`capture-guide-screenshots.mjs`** — not unit-tested (one-shot doc generation
  script with no branching logic worth mocking). Validated by running it
  successfully and visually reviewing output during the Phase 2 review gate.
- **Guide `.md` files** — not tested; they are content. Rendering verified
  manually on GitHub during Phase 3.

## Open Risks

- **Screenshot determinism:** dates, times, and relative-time strings ("há 2
  dias") may shift between captures. Mitigation: the seed script uses fixed
  offsets from "now" so relative strings stay stable, and the capture script
  can freeze `Date.now()` via Playwright's `page.addInitScript` if needed.
- **Localized currency/date formatting:** the seed must produce values that
  render identically across locales. Mitigation: force `pt-BR` locale in the
  Playwright browser context.
- **Obsidian callout rendering on GitHub:** low risk — GitHub natively supports
  the `> [!info]` / `> [!note]` / `> [!warning]` alert syntax, so existing
  callouts should render correctly. Mitigation: verified during the Phase 3
  manual GitHub preview; adjusted if any unsupported callout variants appear.
- **Auth state between captures:** the capture script must handle logging out
  and logging in as different users. Mitigation: one browser context per role,
  sequential capture passes.

## Out of Scope (follow-up specs)

- Playwright e2e test harness and full flow test suite (separate spec).
- GitHub Pages / docs site with search and pretty URLs.
- Video walkthroughs or animated GIFs.
- Automated screenshot refresh in CI.
