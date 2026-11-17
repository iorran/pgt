---
title: "ADR 0007: Teacher Payout is a sheet the Owner fills by hand"
tags:
  - adr
  - billing
date: 2026-11-17
---

# Teacher Payout is a sheet the Owner fills by hand

Supersedes [[0006-teacher-payout-goes-to-the-agreement|ADR 0006]].

Each month the Owner gets one [[CONTEXT#Payout Sheet|Payout Sheet]] per class name, listing the Students who checked in to those classes, and types what is passed on for each one. The app keeps no rules: no Teacher Agreements, no percentages, no Class Add-ons, no Recruited Student marks. We chose this because keeping those rules per Student was too much to adopt, while the academy already works this way — the Owner fills a spreadsheet at the end of the month and sends it to the teachers to check. Teachers see their sheet read-only from the draft on, with who paid and each Payout Line, never the Monthly Fee.

## Considered Options

- **Keep agreements to pre-fill the sheet** — rejected for now: it keeps the per-Student setup the Owner found complicated. A default amount per class can pre-fill later if typing becomes a chore.
- **One sheet per teacher** — rejected: No Gi has two teachers who share one payout.
- **One sheet per month for all classes** — rejected: too long, and each class's teachers must see only theirs.

## Consequences

- A Student training an extra class pays it through a higher Monthly Fee; there is no separate add-on.
- Agreements, Recruited/add-on marks and the old Teacher Payouts were deleted, with no history kept.
- A Student who checks in to two classes appears on both sheets; the Owner decides where the payout goes.
