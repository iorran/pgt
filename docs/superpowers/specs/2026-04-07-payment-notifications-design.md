---
title: Payment Notifications & Student Plan UX
date: 2026-04-07
tags:
  - spec
  - billing
  - notifications
  - whatsapp
status: approved
---

# Payment Notifications & Student Plan UX

> [!info] Related
> - Existing overdue billing page at `/billing`
> - [[backlog|Backlog]] for future enhancements

## Overview

Add a notification system for overdue payments with two channels: in-app banner for students and a notification center (bell dropdown) for instructors with one-tap WhatsApp messaging. Also fix the student plan assignment UX.

## Components

### 1. Notification Bell (Header)

Bell icon with red badge in the app header, visible to instructors only.

**Badge:** Shows count of overdue students excluding muted ones. Hidden when count is 0.

**Dropdown panel** (opens on click):
- List of overdue students showing: name, plan name, days overdue
- WhatsApp button per student — opens `wa.me/{phone}?text={pre-filled reminder message}`. The message is a friendly payment reminder in Portuguese with the student's name and days overdue.
- Mute button per student — toggles `notificationsMuted` flag. Muted students disappear from the list and badge count.
- Empty state when no overdue students (or all muted).

**Data source:** Uses the existing `GET /api/payments/overdue` endpoint, extended to include student phone number and mute status.

### 2. Student Overdue Banner (Dashboard)

When a student with an overdue payment logs in, a banner appears at the top of the dashboard page.

- Shows: "Seu pagamento está X dias atrasado" / "Your payment is X days overdue"
- Non-dismissable — disappears only when payment is recorded
- Only shown to students (not instructors)
- Uses the existing overdue detection logic: current day > dueDay and no payment recorded for current month

**Data source:** New lightweight endpoint `GET /api/payments/my-status` that checks if the logged-in student is overdue.

### 3. Mute Toggle (Database)

Add `notifications_muted` boolean column to `student_membership` table, defaulting to `false`.

**API:** Add `PUT /api/students/:id/notifications` endpoint (instructor-only) to toggle the mute flag.

**Behavior:**
- Muted students are excluded from the notification bell count and dropdown list
- Muted students still appear on the overdue billing page (`/billing`) — billing data is separate from notifications
- Students still see their own overdue banner regardless of mute status (mute only affects instructor notifications)

### 4. Plan Assignment Dropdown

Replace the raw `planId` text input in the student detail page (`/students/:id`) with a dropdown that fetches available plans via the existing `GET /api/membership-plans?academyId=X` endpoint.

Shows plan name and price in the dropdown options.

## API Changes

### Modified endpoints

**`GET /api/payments/overdue`** — extend response to include:
- `phone` (student's phone number, for WhatsApp link)
- `notificationsMuted` (boolean, from studentMembership)

### New endpoints

**`GET /api/payments/my-status`** — requires auth, returns overdue status for the logged-in student:
- Response: `{ overdue: boolean, daysOverdue: number }` or `{ overdue: false }`
- Checks if student has active membership, current day > dueDay, and no payment for current reference month

**`PUT /api/students/:id/notifications`** — instructor-only, toggles `notificationsMuted`:
- Body: `{ muted: boolean }`
- Updates `student_membership.notifications_muted`

## Database Changes

### student_membership table — add column

```
notifications_muted  boolean  not null  default false
```

Migration required.

## Files to Create/Modify

**API — new/modified:**
- `apps/api/src/db/schema/membership.ts` — add `notificationsMuted` column
- `apps/api/src/routes/payments.ts` — extend overdue endpoint, add my-status endpoint
- `apps/api/src/routes/students.ts` — add notifications toggle endpoint
- DB migration

**Frontend — new/modified:**
- `apps/web/src/components/layout/header.tsx` — add notification bell with dropdown
- `apps/web/src/pages/dashboard.tsx` — add overdue banner for students
- `apps/web/src/pages/students/detail.tsx` — plan dropdown instead of text input
- `apps/web/src/i18n/en.json` — notification translation keys
- `apps/web/src/i18n/pt-BR.json` — notification translation keys
- Tests for all modified components

## Translation Keys

```
notifications.title: "Notificações" / "Notifications"
notifications.noOverdue: "Nenhum pagamento atrasado" / "No overdue payments"
notifications.daysOverdue: "{{days}} dias atrasado" / "{{days}} days overdue"
notifications.sendReminder: "Enviar lembrete" / "Send reminder"
notifications.mute: "Silenciar" / "Mute"
notifications.unmute: "Ativar notificações" / "Unmute"
notifications.overdueMessage: "Olá {{name}}, seu pagamento na academia está {{days}} dias atrasado. Por favor, regularize o quanto antes." / "Hi {{name}}, your academy payment is {{days}} days overdue. Please settle it as soon as possible."
billing.yourPaymentOverdue: "Seu pagamento está {{days}} dias atrasado" / "Your payment is {{days}} days overdue"
```

### 5. Email Notifications for Overdue Payments

When the overdue detection runs (via the `/api/payments/overdue` endpoint or a scheduled check), send an email to students who are overdue and not muted.

- Uses the existing Resend email service (`apps/api/src/email/index.ts`)
- New email template: friendly overdue payment reminder with student name, academy name, and days overdue
- Email sent once when a student first becomes overdue (not repeatedly). Track with a `lastOverdueEmailSentAt` timestamp on `student_membership`.
- Instructor can trigger a manual email resend from the notification bell dropdown (button next to WhatsApp)

**API:** Add `POST /api/payments/overdue/:studentId/notify` — instructor-only, sends overdue email to the student.

### 6. Payment Reminder Before Due Date (In-App, Student Only)

Show an in-app reminder banner on the student's dashboard 3 days before their due date.

- Banner: "Seu pagamento vence em X dias" / "Your payment is due in X days"
- Shows when: current day >= dueDay - 3 AND current day < dueDay AND payment not yet recorded for current month
- Non-dismissable — disappears after payment or after due date (then switches to overdue banner if unpaid)
- Uses the same `GET /api/payments/my-status` endpoint, extended to return `{ status: 'ok' | 'upcoming' | 'overdue', daysUntilDue?: number, daysOverdue?: number }`

## Database Changes (Updated)

### student_membership table — add columns

```
notifications_muted          boolean    not null  default false
last_overdue_email_sent_at   timestamp  nullable
```

## Files to Create/Modify (Updated)

**API — new/modified:**
- `apps/api/src/db/schema/membership.ts` — add `notificationsMuted` and `lastOverdueEmailSentAt` columns
- `apps/api/src/routes/payments.ts` — extend overdue endpoint, add my-status endpoint, add notify endpoint
- `apps/api/src/routes/students.ts` — add notifications toggle endpoint
- `apps/api/src/email/templates/overdue-payment.ts` — new email template
- `apps/api/src/email/index.ts` — add sendOverduePaymentReminder method
- DB migration

**Frontend — new/modified:**
- `apps/web/src/components/layout/header.tsx` — add notification bell with dropdown
- `apps/web/src/pages/dashboard.tsx` — add overdue banner + upcoming payment banner for students
- `apps/web/src/pages/students/detail.tsx` — plan dropdown instead of text input
- `apps/web/src/i18n/en.json` — notification translation keys
- `apps/web/src/i18n/pt-BR.json` — notification translation keys
- Tests for all modified components

## Translation Keys (Updated)

```
notifications.title: "Notificações" / "Notifications"
notifications.noOverdue: "Nenhum pagamento atrasado" / "No overdue payments"
notifications.daysOverdue: "{{days}} dias atrasado" / "{{days}} days overdue"
notifications.sendReminder: "Enviar lembrete" / "Send reminder"
notifications.sendEmail: "Enviar email" / "Send email"
notifications.emailSent: "Email enviado" / "Email sent"
notifications.mute: "Silenciar" / "Mute"
notifications.unmute: "Ativar notificações" / "Unmute"
notifications.overdueMessage: "Olá {{name}}, seu pagamento na academia está {{days}} dias atrasado. Por favor, regularize o quanto antes." / "Hi {{name}}, your academy payment is {{days}} days overdue. Please settle it as soon as possible."
billing.yourPaymentOverdue: "Seu pagamento está {{days}} dias atrasado" / "Your payment is {{days}} days overdue"
billing.paymentDueSoon: "Seu pagamento vence em {{days}} dias" / "Your payment is due in {{days}} days"
```

## Out of Scope

- Automatic WhatsApp messages (requires WhatsApp Business API)
- In-app payment processing
- Scheduled/cron-based automatic email sending (emails triggered manually by instructor or on overdue detection)
