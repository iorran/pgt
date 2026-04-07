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

## Out of Scope

- Automatic WhatsApp messages (requires WhatsApp Business API)
- Email notifications for overdue payments
- Payment reminders before due date
- In-app payment processing
