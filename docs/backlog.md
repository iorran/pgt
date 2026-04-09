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

- **Drift detection (PR-time):** CI job that warns when a PR touches `apps/web/src/pages/**` without also updating the guide files.
- **Scheduled audit issue:** periodic (weekly or per-release) GitHub Action that compares page labels/routes against the guide and opens/updates a drift issue.
- **Automated screenshot regeneration in CI:** tie to semantic-release success step to re-run `seed-guide` + Playwright capture and open a PR with refreshed PNGs. Deferred — likely too flaky/expensive at current scale.
- **Release-gated guide updates:** custom semantic-release check that fails releases if `feat:` commits touched pages without a corresponding guide bump. Consider after the baseline guide is in a known-good state.
