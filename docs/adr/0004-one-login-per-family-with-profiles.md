---
title: "ADR 0004: One login per Family — the Responsible acts for Dependents through profiles"
tags:
  - adr
  - families
  - auth
date: 2026-11-07
---

# One login per Family — the Responsible acts for Dependents through profiles

Kids never log in, and households want to manage everyone in one place, so a [[CONTEXT#Family|Family]] now has exactly one login: its [[CONTEXT#Responsible|Responsible]]. Every other member is a [[CONTEXT#Dependent|Dependent]] with no password of their own (kids, and adults the household chose to manage, e.g. a spouse). After logging in, the Responsible picks a **profile** — themself (if they train) or any Dependent — and the app behaves exactly as if that Student were logged in: check-in, billing, ranking, tournaments, profile. The API does this centrally: the web sends the chosen profile in an `x-acting-as` header, and `requireAuth` swaps `request.user` for the Dependent after checking that the session user is that Dependent's Family Responsible, keeping the real user as `request.actor`. Every student endpoint keeps reading `request.user.id` and needs no change.

A Responsible who doesn't train is a user with the new role `responsible`: they log in and see only their Family's profiles, and never appear in student lists, ranking or billing. A Responsible who trains stays a `student`; being Responsible is the `family.responsible_user_id` link, not a role. Dependents keep a generated internal email (Better Auth v1 requires a unique email per user) that is never shown or emailed; all mail about any member — overdue notices, receipts — goes to the Responsible.

We chose a per-request header over storing the active profile in the session because it is stateless, works per browser tab, and is trivial to test; the cost is one extra lookup per request while acting as a Dependent. We rejected a separate guardian link per Student (two answers to "who pays for this kid?") and username logins with shared emails (Better Auth v1 keeps `user.email` unique and required; that only changes in v2).

Supersedes, from the [[2026-09-26-families-design|Families design]]: decision 7 (a Family has no payer; optional Family Contact) — the Responsible replaces the Family Contact — and decision 15 (students see nothing new). Spec: [[2026-11-07-family-account-profiles-design|Family account & profiles]].
