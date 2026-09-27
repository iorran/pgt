---
title: Backlog
tags:
  - backlog
  - roadmap
---

# Backlog

## Checkin System Enhancements

From [[2026-04-07-smart-checkin-design|Smart Checkin Design]] — out of scope items:

- Configurable proximity radius per academy
- Map-based location picker for academy setup
- External geocoding API (convert address to coordinates automatically)
- Offline checkin support
- Push notifications for class reminders

## User Guide Maintenance

From [[2026-04-09-user-guide-audit-design|User Guide Audit Design]] — deferred:

- ~~**Drift detection (PR-time):** CI job that warns when a PR touches `apps/web/src/pages/**` without also updating the guide files.~~ **Shipped:** `.github/workflows/user-guide-drift.yml`.
- **Scheduled audit issue:** periodic (weekly or per-release) GitHub Action that compares page labels/routes against the guide and opens/updates a drift issue.
- **Automated screenshot regeneration in CI:** tie to semantic-release success step to re-run `seed-guide` + Playwright capture and open a PR with refreshed PNGs. Deferred — likely too flaky/expensive at current scale.
- **Release-gated guide updates:** custom semantic-release check that fails releases if `feat:` commits touched pages without a corresponding guide bump. Consider after the baseline guide is in a known-good state.

## App Bugs Found During User Guide Audit (2026-04-09)

Discovered while writing [[2026-04-09-user-guide-audit-design|the user guide audit]]. Separate from the guide work — track and fix as bug tickets.

- **Missing i18n key `billing.week`**: Plan cards at `apps/web/src/pages/billing/plans.tsx` render `{classesPerWeek}x / {t('billing.week')}` but the key is absent from `pt-BR.json`. Results in a blank label.
- **Hardcoded English error string in Settings**: `apps/web/src/pages/settings.tsx` renders `"Geolocation unavailable"` as a literal string instead of using `t()`.
- **Accent omissions in `pt-BR.json`**: Several onboarding strings are missing accents — "comecar" (começar), "codigo" (código), "nao" (não), "Aprovacao" (Aprovação), "ira" (irá). Users see the unaccented versions.
- **Dashboard greeting bug**: Greeting renders as "Carregando, [name]" because of a `t('common.loading').replace('...', '')` call where the intended greeting key is wrong. Likely meant `t('common.hello')` or similar.

## Families

From [[2026-09-26-families-design|Families design]]:

- **Get the real plan list from the client** (modalities + list prices) to replace the 10 price-named seed plans; move students with a different price to an Agreed Price.
- Implementation plan for Families (pending).

## Found while updating the user guides (2026-09-26)

- **Quick pay records the current month** even when the overdue debt is an older month ("Registrar Pagamento" on an overdue card). Should pay the oldest owed month.
- **Family payment dialog over-suggests for partly paid months:** the pre-filled amount uses the whole month's Family Fee, including members who already paid individually; only unpaid members are charged.
- **Configurações is empty for students** but still linked from Perfil.
- **Owner's Histórico de Presença** shows the owner's own check-ins, not students'.
- **Owner cannot check in** (no Check-in button in the owner's Aulas view) — confirm if intended.
- **User guide screenshots are stale** (captured April 2026): regenerate with `npm run screenshots:capture` after updating `seed-guide` and the SHOTS list for families, modalities, fee card, phone menu, language page, camera retry. Delete `billing-plans.png`, `student-detail-plan.png`, `dashboard-instructor.png`.
- **Some PUT routes accept arbitrary body fields** (e.g. class `instructorId`): add per-route field whitelists.

## Found while updating the user guides (2026-09-27)

- ~~**Negative Point Adjustments read "+-N pts" for the student:** Meus resultados (`apps/web/src/pages/gamification/profile.tsx`) always prefixes `+`, so a −3 adjustment shows "Aprovado +-3 pts".~~ Fixed: signed points ("−3 pts").
- ~~**Every position-less entry is "Acumulado" for the student:** any Point Adjustment (not only Carried-over Points) shows as "Acumulado" in Meus resultados; the owner sees "Ajuste". Consider "Ajuste" for non-carried-over adjustments.~~ Fixed: all shown as "Ajuste" with their name.
- **Birth date wins over the Kids modality** for white belts (Ranking Category), and there is no way to edit a birth date in the app — the owner cannot move a white belt with a known birth date to the other category.
- **Ranking screenshots are stale:** `gamification-results-instructor.png` (status filter, Editar/Excluir, Ajustar pontos), `gamification-seasons.png` (Editar button), `student-join-form.png` (grouped belt list); missing: student points page (Ranking → aluno), compact result rows with ⋯ menu and inline delete confirmation, edit-result dialog, "Recalcular pontos" step, Faixa field on the student page, "Acumulado" entry in `gamification-profile.png`.
