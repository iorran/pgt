---
title: "ADR 0006: Teacher Payouts go to a Teacher Agreement, not to a teacher"
tags:
  - adr
  - billing
date: 2026-11-12
---

# Teacher Payouts go to a Teacher Agreement, not to a teacher

Money passed on to teachers is worked out per [[CONTEXT#Teacher Agreement|Teacher Agreement]] — a deal the Owner makes with one or more Class Teachers (e.g. "No Gi" with its two teachers) holding one percentage and an optional [[CONTEXT#Class Add-on|Class Add-on]] — not per teacher. [[CONTEXT#Recruited Student|Recruited Students]] and add-on marks point at the agreement, and each month there is a single [[CONTEXT#Teacher Payout|Teacher Payout]] per agreement; how its teachers divide it is theirs, outside the app. We chose this because that is how the academy works today: the No Gi teachers teach together, split equally between themselves, and it does not matter which of them brought a Student. It also replaces the earlier academy-wide settings (one add-on with a fixed 5 € share, one recruited percentage, any active Student selectable as teacher), so only teachers with an agreement appear in the lists and see their Students.

## Considered Options

- **Per-teacher payouts with a split inside the app** — rejected: forces the Owner to say which teacher recruited each Student and to keep a split ratio that the teachers already settle among themselves.
- **A separate "is teacher" flag** — rejected: being on an agreement already says who shares revenue and who may see the list; a second flag could disagree with it.

## Consequences

- The recruited percentage applies to the Monthly Fee only, never to Class Add-ons, so a Student recruited by one agreement who joins another's add-on pays each agreement its own share.
- If a Recruited Student's Monthly Fee is raised because they also train an academy class with no agreement, the agreement gets a share of the raise; the Owner corrects the payout before closing the month. Revisit (add-ons with no agreement) if this becomes regular.
- Existing marks that name a teacher must be migrated to an agreement.
