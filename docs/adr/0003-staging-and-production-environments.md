---
title: "ADR 0003: Staging and production environments"
tags:
  - adr
  - infra
date: 2026-11-07
---

# Staging and production environments

The Owner needs a place to test before changes reach the academy, so every piece of infra is duplicated: Vercel project `pgt-staging`, Fly app `pgt-api-staging`, and a Neon `staging` branch. A merge to `main` deploys to staging automatically. Production is updated only by running the **Deploy** workflow manually (Actions → Deploy → Run workflow → `production`), which deploys everything from `main` and then cuts the semantic-release version. Per-environment values (`DATABASE_URL`, `VERCEL_PROJECT_ID`, a staging-only `FLY_API_TOKEN`, vars `FLY_APP`, `VITE_APP_URL`) live in GitHub Environments of the same name (repo-level secrets act as the production fallback), so one workflow serves both. The web `/api` rewrite in `apps/web/vercel.json` names the prod Fly app and is rewritten in CI for staging. Trade-off: production gets whatever is on `main` at click time, so promote right after the Owner approves staging, before merging anything new.

## Why a second Vercel project

Staging is its own Vercel project rather than an environment of the production one. The deploy always runs `vercel pull --environment=production` and `vercel deploy --prod`; swapping `VERCEL_PROJECT_ID` per GitHub Environment gives staging its own fixed domain and its own variables (`VITE_APP_URL`, `ORIGIN_SECRET`) with no branching in the workflow. Considered and rejected:

- **Preview deployments of the same project:** a new URL per deploy unless aliased, one set of Preview variables shared by every preview, and Deployment Protection (Vercel login) on by default, which gets in the way of testing as a normal user.
- **Vercel Custom Environments** (a real `staging` environment inside one project): the closest fit, but only on paid plans.

Cost: Vercel does not charge per project, so the second project only adds its own (small) usage. The price is keeping two projects' settings in step, such as environment variables and domains.
