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

**Modality**:
A discipline the academy teaches (e.g. Jiu-Jitsu, MMA, Kids, Funcional, Feminino), from a short list the Owner maintains. A Student is tagged with the Modalities they train; this is informational and never sets the price or restricts check-in.
_Avoid_: Plan, class type, turma, category

**Ranking Category**:
Whether a Student is ranked with Kids or Adultos. Adult belt → Adultos; kids belt → Kids; white belt → Kids if under 16 (when the birth date is known) or tagged with the Kids Modality, otherwise Adultos. Teenagers on adult or white belts rank with Adultos.
_Avoid_: Division, age group, adolescente/juvenil (as separate rankings)

**Carried-over Points**:
Points a Student earned before the app was used, entered as one approved ranking entry with no podium position.
_Avoid_: Bonus, manual points, adjustment (in the UI: "Pontos acumulados")

**Training Note**:
Free text on a Student for what Modalities don't capture (e.g. "trânsito livre", "turma das 7h").
_Avoid_: Observations, comments

### Billing

**Monthly Fee**:
The amount the Owner set for a Student to pay per month. There are no plans: the Owner types each Student's fee (the academy's usual amounts are only suggestions). A Student without a Monthly Fee is not billed.
_Avoid_: Plan, agreed price, mensalidade (in code/specs), dues, package

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
