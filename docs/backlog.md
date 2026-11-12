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

- ~~**Quick pay records the current month** even when the overdue debt is an older month ("Registrar Pagamento" on an overdue card). Should pay the oldest owed month.~~ Fixed: pays the oldest owed month (else the next unpaid one); student page button is now "Registrar mensalidade".
- ~~**Family payment dialog over-suggests for partly paid months:** the pre-filled amount uses the whole month's Family Fee, including members who already paid individually; only unpaid members are charged.~~ Fixed: a partly paid month suggests only the unpaid members' fees (dialog and overdue card); a Family Agreed Price is kept as is.
- ~~**Configurações is empty for students** but still linked from Perfil.~~ Fixed: the row shows only for the owner.
- ~~**Owner's Histórico de Presença** shows the owner's own check-ins, not students'.~~ Fixed: the owner sees the academy's latest 200 check-ins with the student's name.
- **Owner cannot check in** (no Check-in button in the owner's Aulas view) — confirm if intended.
- **User guide screenshots are stale** (captured April 2026): regenerate with `npm run screenshots:capture` after updating `seed-guide` and the SHOTS list for families, modalities, fee card, phone menu, language page, camera retry. Delete `billing-plans.png`, `student-detail-plan.png`, `dashboard-instructor.png`.
- ~~**Some PUT routes accept arbitrary body fields** (e.g. class `instructorId`): add per-route field whitelists.~~ Fixed for classes. Products and seasons still spread the body but force `id`/`academyId` and have no other foreign keys.

## Found while updating the user guides (2026-09-27)

- ~~**Negative Point Adjustments read "+-N pts" for the student:** Meus resultados (`apps/web/src/pages/gamification/profile.tsx`) always prefixes `+`, so a −3 adjustment shows "Aprovado +-3 pts".~~ Fixed: signed points ("−3 pts").
- ~~**Every position-less entry is "Acumulado" for the student:** any Point Adjustment (not only Carried-over Points) shows as "Acumulado" in Meus resultados; the owner sees "Ajuste". Consider "Ajuste" for non-carried-over adjustments.~~ Fixed: all shown as "Ajuste" with their name.
- **Birth date wins over the Kids modality** for white belts (Ranking Category), and there is no way to edit a birth date in the app — the owner cannot move a white belt with a known birth date to the other category. _Partly fixed: the owner can now set or clear a birth date on the student page; whether birth date should still win over the Kids modality is open._
- **Ranking screenshots are stale:** `gamification-results-instructor.png` (status filter, Editar/Excluir, Ajustar pontos), `gamification-seasons.png` (Editar button), `student-join-form.png` (grouped belt list); missing: student points page (Ranking → aluno), compact result rows with ⋯ menu and inline delete confirmation, edit-result dialog, "Recalcular pontos" step, Faixa field on the student page, "Acumulado" entry in `gamification-profile.png`.

## Teacher Agreements (2026-11-12)

From a grilling session — glossary already updated in [[CONTEXT|Glossary]] (Teacher Agreement, Class Add-on, Recruited Student, Teacher Payout). Code still models the old shape (academy-wide add-on with fixed 5 € share, any active Student as Payout Teacher).

- **Teacher Agreement model:** Owner creates agreements (name, one or more teachers, one percentage, optional Class Add-on amount). "Angariado por" and the add-on mark pick an agreement, not a person; the list shows only agreements. One Teacher Payout per agreement per month.
- **Share is a percentage, not a fixed amount:** add-on share = agreement % × add-on amount.
- **Madiba's deal:** same shape per the Owner — academy Student pays the add-on, half to the teachers; Recruited Student, half to each side. Fits; just another agreement.
- **One % for both** recruited and add-on: confirmed by the Owner.
- **Teacher view (what the Owner really wants):** agreement teachers see, month by month, their Recruited Students and add-on Students with paid/pending and check-ins in the agreement's classes, plus the month's Teacher Payout total once the Owner confirmed it. Never per-Student amounts. "Came without being on the add-on" stays Owner-only. No separate "is teacher" flag: being on an agreement is the flag. Show phone mockups first.
- **A Student links to at most one agreement** (recruited or add-on, never both, never two agreements) — code allows both marks today; replace with one link. Rare double case: Owner corrects the payout.
- **Code contradiction:** `apps/api/src/routes/finance.ts` takes the recruited % of the whole payment, add-ons included; must use the Monthly Fee part only.
- **Recruited share is on the Monthly Fee only**, never on add-ons. Known gap: if the Owner raises a Recruited Student's Monthly Fee because they also train an academy class with no agreement, the agreement gets a share of the raise — Owner corrects the payout. **Trigger to revisit:** this happens regularly → add Class Add-ons with no agreement (100% academy).
