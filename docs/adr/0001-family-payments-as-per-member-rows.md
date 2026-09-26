---
title: "ADR 0001: Family payments are stored as per-member payment rows"
tags:
  - adr
  - billing
date: 2026-09-26
---

# Family payments are stored as per-member payment rows

A [[CONTEXT#Family Payment|Family Payment]] creates one `payment` row per member per month, each linked to a single family-payment record holding the total actually received; each row's amount is the member's Monthly Fee scaled so the rows sum to that total (rounding remainder on the last row). We chose this over a single family-level payment row because everything already computed per Student — overdue list, student history, the student's own billing status, individual payments — keeps working unchanged, and a Student who later leaves a Family keeps an unambiguous history. The cost is that per-member shares of a discounted or edited total are approximations (e.g. 100 € over 45/35/35 → 39.13 / 30.43 / 30.44); only the family total is exact.

Spec: [[2026-09-26-families-design|Families design]]
