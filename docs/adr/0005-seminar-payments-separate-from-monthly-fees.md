---
title: "ADR 0005: Seminar payments live on Seminar Participants, not in the payment table"
tags:
  - adr
  - billing
date: 2026-11-10
---

# Seminar payments live on Seminar Participants, not in the payment table

A [[CONTEXT#Seminar|Seminar]]'s money is recorded on each [[CONTEXT#Seminar Participant|Seminar Participant]] (amount, pending/paid, paid date), not as rows in the `payment` table. We chose this because every `payment` row means "a Student paid a Monthly Fee for a month": `reference_month` is required, and the overdue list, student history, billing status and Family Payments ([[0001-family-payments-as-per-member-rows|ADR 0001]]) all read it that way. Seminar participants can also be outsiders with no user account, which `payment.student_id` cannot hold. Mixing seminar money into `payment` would have meant a fake reference month or a nullable student and a filter in every Monthly Fee query.

The cost: there is no single table of "all money received"; a revenue report has to add Monthly Fee payments and paid Seminar Participants together.
