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
The person who owns the academy and configures everything in the app. The only role with management access.
_Avoid_: Admin, staff, manager

**Professor**:
A black belt who teaches classes at the academy. Teaching gives no management access.
_Avoid_: Mestre, coach, teacher (as a title)

**Instructor**:
A purple or brown belt who teaches classes at the academy. Teaching gives no management access.
_Avoid_: Assistant, monitor, coach

**Class Teacher**:
Who teaches a given class: a Student or the Owner chosen by the Owner, or a Guest Teacher. Shown as Professor or Instructor by their belt, or by name only when the belt says neither.
_Avoid_: Instructor (as the generic word), coach, responsável da aula

**Guest Teacher**:
Someone from outside the academy who teaches a Seminar; known only by the name the Owner typed, never a user of the app (in the UI: "Professor convidado").
_Avoid_: Visitor, external instructor

**Seminar**:
A one-off class on a single date, usually with a Guest Teacher, open to people outside the academy and paid separately from the Monthly Fee. Students may check in; outside attendees are not tracked.
_Avoid_: Event (that word is for tournaments), workshop, aulão

**Seminar Participant**:
A person on a Seminar's list: a Student, or an outsider known only by name (and optionally a phone). Each has their own payment status for that Seminar, separate from Monthly Fees.
_Avoid_: Attendee, registrant, inscrito (in code/specs), guest (for outsiders)

**Seminar Price**:
What a Seminar Participant is asked to pay: the Seminar's Student price or its outsider price, which the Owner may change per participant (discount, free place). A participant is either pending or paid in full; there are no partial or Family payments for Seminars.
_Avoid_: Fee, Monthly Fee, ticket

**Student**:
A person who trains at the academy and belongs to it, adult or kid.
_Avoid_: Aluno (in code/specs), member, athlete

**Family**:
A group of Students of the same household whose monthly fees are paid together, managed through one login — its Responsible's. A Student belongs to at most one Family.
_Avoid_: Household, group

**Responsible**:
The one person who logs in for a Family and acts for all its members (in the UI: "Responsável"). May train (then also a Student) or not (login only). Every Family has exactly one. See [[0004-one-login-per-family-with-profiles|ADR 0004]].
_Avoid_: Guardian, parent, payer, head of family, Family Contact

**Dependent**:
A Family member who is not its Responsible: has no login of their own and is managed by the Responsible — usually a kid, sometimes an adult (in the UI: "Dependente").
_Avoid_: Child, minor, sub-account

**Profile**:
Whose eyes the Responsible is using the app through — themself or one Dependent — chosen after login ("Quem vai usar?").
_Avoid_: Account, user switch, impersonation

**Modality**:
A discipline the academy teaches (e.g. Jiu-Jitsu, MMA, Kids, Funcional, Feminino), from a short list the Owner maintains. A Student is tagged with the Modalities they train; this is informational and never sets the price or restricts check-in.
_Avoid_: Plan, class type, turma, category

**Ranking Category**:
Whether a Student is ranked with Kids or Adultos. Adult belt → Adultos; kids belt → Kids; white belt → Kids if under 16 (when the birth date is known) or tagged with the Kids Modality, otherwise Adultos. Teenagers on adult or white belts rank with Adultos.
_Avoid_: Division, age group, adolescente/juvenil (as separate rankings)

**Point Adjustment**:
Points the Owner adds to or removes from a Student's ranking (+N or −N) with a reason, entered as an approved ranking entry with no podium position.
_Avoid_: Bonus, penalty entry, manual result (in the UI: "Ajuste de pontos")

**Carried-over Points**:
A Point Adjustment for points a Student earned before the app was used (in the UI: "Pontos acumulados").
_Avoid_: Bonus, manual points

**Training Note**:
Free text on a Student for what Modalities don't capture (e.g. "trânsito livre", "turma das 7h").
_Avoid_: Observations, comments

### Billing

**Monthly Fee**:
The amount the Owner set for a Student to pay per month. There are no plans: the Owner types each Student's fee (the academy's usual amounts are only suggestions). A Student without a Monthly Fee is not billed.
_Avoid_: Plan, agreed price, mensalidade (in code/specs), dues, package

**Class Add-on**:
_Superseded ([[0007-teacher-payout-is-a-sheet-filled-by-hand|ADR 0007]])._ A Student who also trains an extra class just has a higher Monthly Fee (e.g. 55 € instead of 45 €).

**Family Contact**:
_Superseded by **Responsible** ([[0004-one-login-per-family-with-profiles|ADR 0004]])._ Formerly the optional member the Owner preferred to reach about a Family's payments.

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

### Finances

**Expense**:
Money the academy spent in a given month (rent, water, electricity, anything else), entered by the Owner as a description and an amount. Each month has its own list of Expenses; a new month starts from the previous month's list, so recurring costs are corrected rather than retyped (in the UI: "Despesa").
_Avoid_: Cost, bill, fixed cost (as a separate kind), gasto

**Monthly Balance**:
How a month went for the academy: money received that month minus that month's Expenses. Money counts in the month it was paid, whatever month it refers to — a January Monthly Fee paid on 5 February counts in February; Seminar payments count on the day the participant paid (in the UI: "Balanço do mês").
_Avoid_: Profit, P&L, result, fechamento

**Teacher Agreement**:
_Superseded by **Payout Sheet** ([[0007-teacher-payout-is-a-sheet-filled-by-hand|ADR 0007]])._ No standing deal is kept in the app; the Owner types each month's amounts.

**Recruited Student**:
_Superseded by **Payout Sheet**._ A Student a teacher brought just gets a bigger Payout Line, typed by the Owner.

**Payout Sheet**:
What the academy passes on to the teachers of one class for one month, as a list the Owner fills by hand — like the spreadsheet the Owner used to send them. One sheet per class name per month, so classes sharing a name (No Gi on Tuesday and Thursday) share a sheet. It lists every Student who checked in to those classes that month, plus any the Owner adds who forgot to check in, each with whether they paid that month and a Payout Line. It starts empty; the Owner types the amounts. While a draft it is only pending; once the Owner confirms it, its total reduces that month's Monthly Balance. The Class Teachers of those classes see it read-only from the draft on — never what any Student pays. How the teachers divide the total is theirs, outside the app (in the UI: "Repasse").
_Avoid_: Agreement, commission, split, revenue share

**Payout Line**:
One Student's row on a Payout Sheet: the amount, typed by the Owner, passed on to the teachers because of that Student that month. Empty means nothing.
_Avoid_: Share, percentage, commission
