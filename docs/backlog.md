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
