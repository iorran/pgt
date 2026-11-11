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
An extra 10 € a month an academy Student pays to also train No Gi with its Payout Teacher; 5 € of it is that teacher's, 5 € the academy's. Owed every month while the Owner has the Student marked and stops when the mark is removed; check-ins never set it, they only flag marked Students who didn't attend that month (in the UI: "Acréscimo").
_Avoid_: Extra fee, surcharge, second plan, upgrade

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

**Payout Teacher**:
A Class Teacher other than the Owner (today: the No Gi teacher) who gets part of the money from two kinds of Students: academy Students with a Class Add-on (their share of the add-on), and Recruited Students (half of what they pay).
_Avoid_: Partner, associate, owner of the student

**Recruited Student**:
A Student brought to the academy by a Payout Teacher (in the UI: "Angariado por"). Half of what they pay each month is that teacher's — e.g. 22,50 € of a 45 € Monthly Fee.
_Avoid_: Teacher's student (ambiguous), referral, own student

**Teacher Payout**:
What the academy passes on to one Payout Teacher for one month: the add-on share of every Student with a Class Add-on that paid that month, plus half of what each of their Recruited Students paid that month. The app works it out; the Owner can correct the amount before closing the month. Reduces that month's Monthly Balance (in the UI: "Repasse").
_Avoid_: Commission, split, revenue share, per-student payout
