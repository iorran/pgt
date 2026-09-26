---
title: Glossary
tags:
  - glossary
  - domain
---

# PGT Academy

Parent:: [[BJJ Academy App]]

Management app for a BJJ academy: who trains, who pays, and what the academy sells. This page is the canonical vocabulary; specs and code should use these words.

## Language

### People

**Owner**:
The person who runs the academy and uses the app to manage it. The only staff role; there is no separate instructor access for now.
_Avoid_: Instructor, professor, admin, staff

**Student**:
A person who trains at the academy and belongs to it, adult or kid.
_Avoid_: Aluno (in code/specs), member, athlete

**Family**:
A group of Students of the same household whose monthly fees are paid together. A Student belongs to at most one Family.
_Avoid_: Household, group, account

### Billing

**Plan**:
What a Student trains (a modality or combination, e.g. jiu-jitsu, kids, jiu-jitsu + MMA) and its list price per month. Every Student keeps their own Plan, in a Family or not.
_Avoid_: Package, subscription, membership (for the price)

**Agreed Price**:
A monthly price the Owner set for one Student that replaces their Plan's list price; the way individual and family discounts are given.
_Avoid_: Discount, custom plan, special price

**Monthly Fee**:
What a Student owes per month: their Agreed Price if set, otherwise their Plan's list price.
_Avoid_: Mensalidade (in code/specs), dues

**Family Contact**:
The member of a Family the Owner prefers to reach about its payments. Optional; a Family has no payer of its own, and any member can be contacted.
_Avoid_: Payer, responsible, guardian, head of family

**Waived Month**:
A month the Owner decided a Student does not owe (didn't train, injury, holidays). Applies to any Student, in a Family or not.
_Avoid_: Pause, freeze, exemption, skipped month

**Family Payment**:
A payment that settles whole months for every member of a Family at once; months are paid for everyone or no one.
_Avoid_: Group payment, split payment

**Family Agreed Price**:
A fixed monthly total the Owner set for a whole Family, replacing the sum of its members' Monthly Fees.
_Avoid_: Family plan, family discount

**Family Fee**:
What a Family owes per month: its Family Agreed Price if set, otherwise the sum of its members' Monthly Fees.
_Avoid_: Family total, family bill
