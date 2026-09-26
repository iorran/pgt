# Families: paying together

Date: 2026-09-26
Status: Implemented — families + no plans / modalities ([[0002-no-plans-monthly-fee-per-student|ADR 0002]])
Glossary: [[CONTEXT|Glossary]] · Decision: [[0001-family-payments-as-per-member-rows|ADR 0001]]

## Problem

Parents and their kids often train at the academy, but the parents pay for everyone. Today every Student is billed and tracked alone: the overdue list shows each kid separately, and recording one household's transfer means paying each member one by one. Discounts are given informally (the spreadsheet has 18 adults on 35 € instead of 45 €, siblings on reduced prices), and months a student didn't train are tracked in free-text notes.

## Goal

The Owner can group Students into a **Family** that pays together, record one **Family Payment** that settles whole months for every member, and see one card per Family on the overdue list. Pricing stays per Student, with overrides where the Owner wants them.

## Decisions (from the grilling session)

| # | Decision |
|---|---|
| 1 | No instructor access; Owner is the only staff role. |
| 2 | ~~Plans~~ — **revised (ADR 0002):** there are no plans. Every Student has their own **Monthly Fee**, typed by the Owner; the usual amounts (45 / 65 / 60 / 35 €) are one-tap suggestions only. What a Student trains is recorded as **Modalities** (owner-maintained list) plus a free **Training Note**; informational only. |
| 3 | ~~Agreed Price~~ — **revised:** removed; discounts are simply a lower Monthly Fee. |
| 4 | **Monthly Fee** = the amount set on the Student. No fee → not billed. Existing students keep their current price (plan price, or agreed price if set). |
| 5 | **Family Agreed Price**: optional fixed monthly total for a Family, replacing the sum of members' Monthly Fees. When membership changes while one is set, the app flags "membros mudaram, rever o preço acordado"; it never recalculates it silently. |
| 6 | **Family Fee** = Family Agreed Price if set, else sum of members' Monthly Fees (excluding Waived Months). |
| 7 | A Family has no payer entity. Optional **Family Contact** = a member the Owner prefers to message; otherwise any member. Contact phones live on Students (a kid's phone is usually the parent's). |
| 8 | **Family Payment** settles whole months for every member (never partial by amount). Owner picks months (pre-selected: oldest unpaid) and amount (pre-filled: Family Fee × months), both editable. |
| 9 | Paying one member alone stays possible (individual payment); the Family then shows that month as partly paid. |
| 10 | **Waived Month**: Owner marks a month a Student does not owe (didn't train, injury, holidays). Works for any Student. Default is that everyone owes every month. A waived member drops out of the Family Fee sum; a Family Agreed Price is not recalculated (Owner edits the amount at payment time if wanted). |
| 11 | A Student belongs to **at most one** Family. Shared custody: Student sits in one Family; the other parent paying is recorded as an individual payment. |
| 12 | Overdue list shows **one card per Family** (members not repeated), with months owed, total, "Registrar pagamento da família" and WhatsApp (Family Contact, else first member with a phone). A Family is listed while any member owes a non-waived month. |
| 13 | Owner names the Family (surnames differ; not derived). |
| 14 | Management: new **Famílias** tab under Alunos (Alunos · Pendentes · Famílias) + a "Família" line on each student's page. Removing a member or deleting a Family never touches payment history. |
| 15 | Students see nothing new; notifications and the student's own overdue banner are unchanged (a Family Payment clears them for all members). |
| 16 | Existing families are not auto-created. The Famílias tab shows **Possíveis famílias**: Students sharing a phone number, each one tap to review/create or dismiss. |
| 17 | Storage: per-member payment rows linked to a family-payment record ([[0001-family-payments-as-per-member-rows|ADR 0001]]). |

## Scenarios (acceptance)

1. **Silva family** (Bia 35 €, Leo 35 €; no agreed price) owes Aug + Sep. Overdue list: one card "Família Silva · 2 meses · 140 €". Owner records a Family Payment for Aug + Sep of 140 € → both kids paid for both months, card disappears, both kids' banners clear.
2. **Family Agreed Price** 100 € for Carlos (45) + 2 kids (35, 35). Family Payment for Sep of 100 € → rows 39.13 / 30.43 / 30.44, family total exact.
3. **Waived Month**: Owner waives Oct for Leo. Silva Family Fee for Oct = 35 € (Bia only); Leo is not overdue for Oct.
4. **Individual payment inside a Family**: Carlos pays only his own Sep. Family card shows Sep as 1 of 3 paid; remaining members still owed.
5. **Member leaves**: Leo removed from Silva family with a Family Agreed Price set → warning to review the agreed price; Leo's past payments unchanged; Leo appears as his own card if he later owes.
6. **Possible families**: two Students share phone 934 232 146 → suggestion listed; Owner creates "Família Stefan" or dismisses; nothing is created automatically.
7. **Second family blocked**: adding Leo to another Family is refused while he belongs to one.

## Design sketch

### Data (new migration)

- `family` — id, academy_id, name, contact_student_id (nullable), agreed_price (nullable decimal), members_changed_at (for the review warning), created_at.
- `user.family_id` (nullable FK) — enforces "at most one Family" by construction.
- `student_membership.agreed_price` (nullable decimal) — the Student's Agreed Price.
- `waived_month` — student_id, reference_month (YYYY-MM), reason (optional text), created_by; unique (student_id, reference_month).
- `family_payment` — id, family_id, total_amount, payment_date, months (YYYY-MM[]), recorded_by, created_at.
- `payment.family_payment_id` (nullable FK) — per-member rows created by a Family Payment.
- Dismissed family suggestions: stored per academy (phone number dismissed), so dismissals persist.

### API

- CRUD `/api/families` (owner): create with name + member ids (+ optional contact, agreed price), add/remove member, delete.
- `POST /api/families/:id/payments` — months + amount → family_payment + per-member payment rows (share split per ADR 0001), skipping members with a Waived Month for that month.
- `GET /api/families/suggestions` + `POST .../suggestions/dismiss`.
- `PUT /api/students/:id/membership` accepts `agreedPrice`.
- `POST/DELETE /api/students/:id/waived-months/:month`.
- Overdue computation: skip Waived Months; use Monthly Fee (agreed price aware); group family members into one record.
- `/api/payments/my-status`: skip Waived Months (student view otherwise unchanged).

### Web

- Alunos → **Famílias** tab: list, create/edit dialog (name, member search limited to Students without a Family, contact, agreed price), Possíveis famílias section.
- Student detail: "Família" line; Agreed Price field on the membership; waive/unwaive month action.
- Financeiro → Inadimplentes: family cards + Family Payment dialog (months pre-selected, amount pre-filled, both editable).
- Planos: unchanged UI; plans become real modality plans once the client's list is known (see open items).

## Testing (TDD — tests first)

- API: Family Fee (sum, waived member excluded, agreed price wins); Family Payment creates correct rows and shares summing exactly to the total; waived months excluded from overdue and my-status; overdue groups family members into one record; at-most-one-family enforced; suggestions by shared phone, dismissal persists.
- Web: Famílias tab create/edit; overdue family card and payment dialog pre-fills; student detail family line, agreed price, waive month; review warning after membership change.

## Open items

- ~~Real plan list from the client~~ — resolved: client wants no plans (ADR 0002). His price list (45 / 65 / 60 / 35 €) becomes fee suggestions.
- Prod data: the current seed/CSV is likely not the final prod import; families are built via Possíveis famílias either way.

## Non-goals

- Instructor access / multi-staff roles.
- Parent logins or a family-facing billing view (Family Contact is a member, not an account).
- In-app payments.
- Automatic family creation.

## API contract (implementation)

Money is a decimal string with 2 places (`"45.00"`). Months are `YYYY-MM`. All routes are owner-only and academy-scoped unless noted. `404` for another academy's ids.

### Billing rules (shared)
- **Monthly Fee** = the Student's fee (active membership). No active membership / no fee → not billed. *(Revised: was `agreed_price ?? plan.price`.)*
- A month is **owed** by a Student when: it's between membership start and the current month, the due day has passed (current month) or it's past, it is not a Waived Month, the Monthly Fee > 0, and there's no payment row for it.
- **Family Fee (month)** = `family.agreed_price ?? Σ Monthly Fee of members not waived that month`.
- **Family Payment split** (ADR 0001): the total is divided across the selected months in proportion to what each month charges (sum of the charged members' Monthly Fees; remainder cents on the last month), so paying exactly what is owed gives every member exactly their Monthly Fee. Within a month, the month's amount is split across members not waived that month, weighted by Monthly Fee (equal weights if all fees are 0); remainder cents on the last member. Rows always sum exactly to the total.

### Families
- `GET /api/families` → `Family[]` (excludes deleted)
  `Family = { id, name, contactStudentId: string|null, agreedPrice: string|null, priceReviewNeeded: boolean, familyFee: string /* current month */, members: { id, name, phone: string|null, belt, monthlyFee: string|null }[] }`
- `GET /api/families/:id` → `Family`
- `POST /api/families` `{ name, memberIds: string[] (≥1), contactStudentId?, agreedPrice?: string|null }` → `201 Family`. `409 { error: 'STUDENT_IN_FAMILY', studentIds }` if any member already belongs to a Family. `400` if contact is not a member.
- `PUT /api/families/:id` `{ name?, contactStudentId?: string|null, agreedPrice?: string|null }` → `Family`. Sending `agreedPrice` (even unchanged) clears `priceReviewNeeded`.
- `POST /api/families/:id/members` `{ studentId }` → `Family` (`409 STUDENT_IN_FAMILY`). `DELETE /api/families/:id/members/:studentId` → `Family` (clears contact if it was them). Either sets `priceReviewNeeded` when `agreedPrice` is set.
- `DELETE /api/families/:id` → `204`; soft delete (`deleted_at`), members' `family_id` cleared, payments untouched.
- `GET /api/families/:id/billing` → `{ owedMonths: { month, fee: string, members: { studentId, status: 'owed'|'paid'|'waived'|'not-billed' }[] }[], suggestedMonths: string[] /* all owed, oldest first */, suggestedAmount: string /* Σ fee of suggestedMonths */ }`. A month appears when any member owes it.
- `POST /api/families/:id/payments` `{ months: string[] (≥1), amount: string, paymentDate?: 'YYYY-MM-DD' (default today) }` → `201 { familyPayment, payments: Payment[] }`. `400` if a month has no billable member.
- `GET /api/families/suggestions` → `{ phone, students: { id, name }[] }[]` — Students of the academy without a Family sharing the same phone (digits only, ≥2 students), excluding dismissed phones.
- `POST /api/families/suggestions/dismiss` `{ phone }` → `204`.

### Students
- `GET /api/students` and `GET /api/students/:id` rows gain `familyId: string|null`, `familyName: string|null`, `agreedPrice: string|null`, `planPrice: string|null`, `monthlyFee: string|null`.
- `PUT /api/students/:id/membership` accepts only `{ planId?, dueDay?, startDate?, agreedPrice?: string|null }` (whitelisted).
- `GET /api/students/:id/waived-months` → `{ referenceMonth, reason: string|null }[]`
- `POST /api/students/:id/waived-months` `{ month, reason? }` → `201` (idempotent). `DELETE /api/students/:id/waived-months/:month` → `204`.

### Payments
- `GET /api/payments/overdue` → `OverdueItem[]`, sorted by `daysOverdue` desc. Family members never appear as student items.
  - `{ kind: 'student', studentId, studentName, email, belt, phone, notificationsMuted, planName, dueDay, daysOverdue, missedMonths, referenceMonth, amountDue: string }`
  - `{ kind: 'family', familyId, familyName, members: { studentId, name }[], phone: string|null /* contact's, else first member with one */, daysOverdue, missedMonths, amountDue: string }`
- `GET /api/payments/my-status` (student): Waived Months are not owed; otherwise unchanged.
- `POST /api/payments/quick/:studentId`: amount = Monthly Fee (agreed price aware).

## Revision: no plans, modalities (2026-09-26)

Client feedback after implementation: no plans in the app; the Owner sets each Student's price and records what they train. See [[0002-no-plans-monthly-fee-per-student|ADR 0002]].

- **Data:** `student_membership.monthly_fee` (decimal, required for billing) replaces `plan_id` + `agreed_price`; `membership_plan` is dropped after copying each student's effective price. `modality` (academy_id, name, unique per academy) and `student_modality` (student_id, modality_id); `user.training_note` (text).
- **API:** `GET /api/students` / `/:id` return `monthlyFee`, `modalities: {id,name}[]`, `trainingNote` (drop `planName`, `planId`, `planPrice`, `agreedPrice`). `PUT /api/students/:id/membership` accepts `{ monthlyFee, dueDay?, startDate? }` and creates the membership if missing. `PUT /api/students/:id/training` `{ modalityIds, trainingNote }`. `GET/POST/PUT/DELETE /api/modalities` (owner; delete only when unused, else 409). Membership-plan routes removed. Overdue/family items drop `planName`.
- **Web:** Planos tab removed; student detail: Monthly Fee field with suggestion chips (45/65/60/35 €), Modalities multi-select + Training Note; students list shows modalities and allows filtering by modality; Settings: manage Modalities; payments form pre-fills the student's Monthly Fee.
- **Seed:** default modalities Jiu-Jitsu, MMA, Kids, Funcional, Feminino; roster import sets Monthly Fee from the sheet and tags modalities from the "TURMA // MODALIDAD" column (best effort), putting the raw text in the Training Note.

### Revised API contract (binding for implementation)
Migrations 0010 (adds `student_membership.monthly_fee` backfilled from agreed/plan price, `modality`, `student_modality`, `user.training_note`, default modalities per academy) and 0011 (drops `membership_plan`, `plan_id`, `agreed_price`, `plan_frequency`) are written and applied locally.

- `GET /api/modalities` (any member of the academy) → `{ id, name, studentCount: number }[]` sorted by name.
- `POST /api/modalities` (owner) `{ name }` → `201 { id, name, studentCount: 0 }`; `409 { error: 'MODALITY_EXISTS' }` (case-insensitive, trimmed).
- `PUT /api/modalities/:id` (owner) `{ name }` → `{ id, name, studentCount }`; `409 MODALITY_EXISTS`.
- `DELETE /api/modalities/:id` (owner) → `204`; `409 { error: 'MODALITY_IN_USE', studentCount }` when any student has it.
- `GET /api/students` rows: `{ id, name, email, belt, phone, dateOfBirth, dueDay: number|null, monthlyFee: string|null, modalities: { id, name }[], trainingNote: string|null, familyId, familyName }`. Optional query `?modalityId=` filters.
- `GET /api/students/:id`: same fields plus `image, createdAt, membershipStartDate: string|null`.
- `PUT /api/students/:id/membership` (owner) `{ monthlyFee: string (≥ 0), dueDay?: 1–28, startDate?: YYYY-MM-DD }` → membership. Creates the active membership if none (defaults: dueDay 8, startDate = first day of next month). `400` on invalid fee.
- `PUT /api/students/:id/training` (owner) `{ modalityIds: string[], trainingNote: string|null }` → `{ modalities, trainingNote }`; `404` if a modality belongs to another academy.
- Removed: `/api/membership-plans*`, `POST /api/students/:id/membership`, fields `planName`, `planId`, `planPrice`, `agreedPrice` everywhere (students, overdue items, families members keep `monthlyFee`).
- Payments form / quick pay / family billing use `monthlyFee`.
