---
title: Payment Notifications Implementation Plan
date: 2026-04-08
tags:
  - plan
  - billing
  - notifications
status: pending
---

# Payment Notifications Implementation Plan

> [!info] Related
> - Spec: [[2026-04-07-payment-notifications-design|Design Spec]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add payment notification system with instructor notification bell (WhatsApp + email), student overdue/upcoming banners, mute toggle, and plan assignment dropdown.

**Architecture:** Extend existing overdue endpoint with phone/mute data, add my-status endpoint for students, add overdue email template, add notification bell dropdown to header, add banners to dashboard.

**Tech Stack:** Fastify, Drizzle ORM, Resend email, React, TanStack Query, Lucide icons, shadcn/ui

---

## File Structure

**New files:**
- `apps/api/src/email/templates/overdue-payment.ts` — email template
- `apps/api/test/payments-notifications.test.ts` — notification API tests
- `apps/web/src/components/notification-bell.tsx` — bell dropdown component
- `apps/web/test/components/notification-bell.test.tsx` — bell tests

**Modified files:**
- `apps/api/src/db/schema/membership.ts` — add notificationsMuted, lastOverdueEmailSentAt
- `apps/api/src/db/schema/index.ts` — no change needed (already exports)
- `apps/api/src/email/email-service.ts` — add sendOverduePayment method
- `apps/api/src/routes/payments.ts` — extend overdue, add my-status, add notify endpoint
- `apps/api/src/routes/students.ts` — add notifications toggle
- `apps/api/test/helpers.ts` — no change needed
- `apps/web/src/components/layout/header.tsx` — add bell component
- `apps/web/src/pages/dashboard.tsx` — add student banners
- `apps/web/src/pages/students/detail.tsx` — plan dropdown
- `apps/web/src/i18n/en.json` — notification keys
- `apps/web/src/i18n/pt-BR.json` — notification keys

---

### Task 1: Schema Changes + Migration

**Files:**
- Modify: `apps/api/src/db/schema/membership.ts`

- [ ] **Step 1: Add columns to studentMembership**

Edit `apps/api/src/db/schema/membership.ts`. Add `boolean` and `timestamp` imports, then add two columns:

```typescript
import { pgTable, uuid, varchar, decimal, integer, boolean, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';
```

Add to `studentMembership` table, after `active`:

```typescript
  notificationsMuted: boolean('notifications_muted').default(false).notNull(),
  lastOverdueEmailSentAt: timestamp('last_overdue_email_sent_at'),
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd apps/api && npx drizzle-kit generate
```

Review the migration. It should add two columns to `student_membership`.

- [ ] **Step 3: Run existing tests**

```bash
cd apps/api && npx vitest run
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/schema/membership.ts apps/api/drizzle/
git commit -m "feat: add notificationsMuted and lastOverdueEmailSentAt to membership schema

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Overdue Email Template + Email Service

**Files:**
- Create: `apps/api/src/email/templates/overdue-payment.ts`
- Modify: `apps/api/src/email/email-service.ts`
- Create: `apps/api/test/email/overdue-payment.test.ts`

- [ ] **Step 1: Write test for email template**

Create `apps/api/test/email/overdue-payment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderOverduePaymentEmail } from '../../src/email/templates/overdue-payment';

describe('renderOverduePaymentEmail', () => {
  it('renders HTML with student name and days overdue', () => {
    const html = renderOverduePaymentEmail({
      studentName: 'João Silva',
      academyName: 'PGT Pontinha',
      daysOverdue: 5,
    });
    expect(html).toContain('João Silva');
    expect(html).toContain('PGT Pontinha');
    expect(html).toContain('5');
    expect(html).toContain('<!DOCTYPE html>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run test/email/overdue-payment.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create the email template**

Create `apps/api/src/email/templates/overdue-payment.ts`:

```typescript
interface OverduePaymentEmailProps {
  studentName: string;
  academyName: string;
  daysOverdue: number;
}

export function renderOverduePaymentEmail({ studentName, academyName, daysOverdue }: OverduePaymentEmailProps): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#141414;border:1px solid #262626;border-radius:8px;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <h1 style="margin:0;font-size:36px;color:#f97316;letter-spacing:2px;">PGT</h1>
              <div style="width:48px;height:3px;background:#f97316;margin:12px auto 0;border-radius:2px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#fafafa;">Lembrete de Pagamento</h2>
              <p style="margin:0 0 16px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Olá <strong style="color:#fafafa;">${studentName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Seu pagamento na <strong style="color:#fafafa;">${academyName}</strong> está <strong style="color:#f97316;">${daysOverdue} dias</strong> atrasado. Por favor, regularize o quanto antes para manter seu acesso às aulas.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #262626;text-align:center;">
              <p style="margin:0;font-size:11px;color:#525252;">PGT — Gestão de Academia BJJ</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 4: Update EmailService**

Edit `apps/api/src/email/email-service.ts` — add import and method:

```typescript
import { EmailProvider } from './provider.js';
import { renderPasswordResetEmail } from './templates/password-reset.js';
import { renderOverduePaymentEmail } from './templates/overdue-payment.js';

export class EmailService {
  constructor(private provider: EmailProvider) {}

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = renderPasswordResetEmail(resetUrl);
    await this.provider.send({
      to: email,
      subject: 'PGT — Recuperação de Senha',
      html,
    });
  }

  async sendOverduePayment(email: string, studentName: string, academyName: string, daysOverdue: number): Promise<void> {
    const html = renderOverduePaymentEmail({ studentName, academyName, daysOverdue });
    await this.provider.send({
      to: email,
      subject: 'PGT — Lembrete de Pagamento',
      html,
    });
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && npx vitest run test/email/
```
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/email/ apps/api/test/email/overdue-payment.test.ts
git commit -m "feat: add overdue payment email template and service method

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: API Endpoints — my-status, extended overdue, notify, mute toggle

**Files:**
- Modify: `apps/api/src/routes/payments.ts`
- Modify: `apps/api/src/routes/students.ts`
- Create: `apps/api/test/payments-notifications.test.ts`

- [ ] **Step 1: Write tests**

Create `apps/api/test/payments-notifications.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestInstructor,
  authHeaders,
  testDb,
} from './helpers';
import { membershipPlan, studentMembership, payment } from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

async function setupOverdueStudent() {
  const acad = await createTestAcademy();
  const instructor = await createTestInstructor(acad.id);
  const student = await createTestUser(acad.id, {
    role: 'student',
    phone: '5511999999999',
  });
  const [plan] = await testDb.insert(membershipPlan).values({
    academyId: acad.id,
    name: 'Monthly',
    price: '150.00',
    frequency: 'monthly',
  }).returning();
  const currentDay = new Date().getDate();
  await testDb.insert(studentMembership).values({
    studentId: student.id,
    planId: plan.id,
    startDate: '2026-01-01',
    dueDay: Math.max(1, currentDay - 3), // 3 days overdue
  });
  return { acad, instructor, student, plan };
}

describe('GET /api/payments/my-status', () => {
  it('returns overdue status when payment is late', async () => {
    const { student } = await setupOverdueStudent();

    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/my-status',
      headers: authHeaders(student),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('overdue');
    expect(body.daysOverdue).toBeGreaterThan(0);
  });

  it('returns ok status when payment is recorded', async () => {
    const { acad, instructor, student } = await setupOverdueStudent();
    const now = new Date();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await testDb.insert(payment).values({
      studentId: student.id,
      academyId: acad.id,
      amount: '150.00',
      paymentDate: now.toISOString().split('T')[0],
      referenceMonth,
      recordedBy: instructor.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/my-status',
      headers: authHeaders(student),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('returns upcoming status before due date', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(acad.id, { role: 'student' });
    const [plan] = await testDb.insert(membershipPlan).values({
      academyId: acad.id,
      name: 'Monthly',
      price: '150.00',
      frequency: 'monthly',
    }).returning();
    const currentDay = new Date().getDate();
    await testDb.insert(studentMembership).values({
      studentId: student.id,
      planId: plan.id,
      startDate: '2026-01-01',
      dueDay: Math.min(28, currentDay + 2), // 2 days from now
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/my-status',
      headers: authHeaders(student),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('upcoming');
    expect(body.daysUntilDue).toBeGreaterThan(0);
  });
});

describe('GET /api/payments/overdue — extended', () => {
  it('includes phone and notificationsMuted in response', async () => {
    const { acad, instructor } = await setupOverdueStudent();

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments/overdue?academyId=${acad.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBe(1);
    expect(body[0].phone).toBe('5511999999999');
    expect(body[0].notificationsMuted).toBe(false);
  });
});

describe('PUT /api/students/:id/notifications', () => {
  it('toggles mute on', async () => {
    const { instructor, student } = await setupOverdueStudent();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/students/${student.id}/notifications`,
      headers: authHeaders(instructor),
      payload: { muted: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().notificationsMuted).toBe(true);
  });

  it('requires instructor role', async () => {
    const { student } = await setupOverdueStudent();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/students/${student.id}/notifications`,
      headers: authHeaders(student),
      payload: { muted: true },
    });
    expect(res.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx vitest run test/payments-notifications.test.ts
```
Expected: FAIL

- [ ] **Step 3: Extend overdue endpoint in payments.ts**

Edit `apps/api/src/routes/payments.ts`. In the `GET /api/payments/overdue` handler, add `phone` and `notificationsMuted` to the select:

Change the select to include:
```typescript
        phone: user.phone,
```

And join `studentMembership` with its `notificationsMuted` field:
```typescript
        notificationsMuted: studentMembership.notificationsMuted,
```

Add these to the `.select({...})` block alongside the existing fields.

- [ ] **Step 4: Add my-status endpoint**

Add to `apps/api/src/routes/payments.ts`, inside `paymentRoutes`:

```typescript
  // Student payment status (for dashboard banners)
  app.get('/api/payments/my-status', { preHandler: [requireAuth] }, async (request) => {
    const studentId = request.user.id;

    // Get active membership
    const [membership] = await db
      .select({ dueDay: studentMembership.dueDay })
      .from(studentMembership)
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));

    if (!membership) {
      return { status: 'ok' };
    }

    const now = new Date();
    const currentDay = now.getDate();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if paid this month
    const [paid] = await db
      .select({ id: payment.id })
      .from(payment)
      .where(and(
        eq(payment.studentId, studentId),
        eq(payment.referenceMonth, referenceMonth),
      ))
      .limit(1);

    if (paid) {
      return { status: 'ok' };
    }

    if (currentDay > membership.dueDay) {
      return { status: 'overdue', daysOverdue: currentDay - membership.dueDay };
    }

    if (currentDay >= membership.dueDay - 3) {
      return { status: 'upcoming', daysUntilDue: membership.dueDay - currentDay };
    }

    return { status: 'ok' };
  });
```

- [ ] **Step 5: Add notify endpoint**

Add to `apps/api/src/routes/payments.ts`:

```typescript
  // Send overdue email to student (instructor only)
  app.post('/api/payments/overdue/:studentId/notify', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    const [student] = await db.select({
      email: user.email,
      name: user.name,
    }).from(user).where(eq(user.id, studentId));

    if (!student) {
      return reply.status(404).send({ error: 'Student not found' });
    }

    // Get academy name
    const { academy } = await import('../db/schema/index.js');
    const [acad] = await db.select({ name: academy.name }).from(academy).where(eq(academy.id, request.academyId));

    const now = new Date();
    const currentDay = now.getDate();
    const [membership] = await db
      .select({ dueDay: studentMembership.dueDay })
      .from(studentMembership)
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));

    const daysOverdue = membership ? currentDay - membership.dueDay : 0;

    await emailService.sendOverduePayment(student.email, student.name, acad?.name || 'PGT', daysOverdue);

    // Update last email sent timestamp
    await db.update(studentMembership)
      .set({ lastOverdueEmailSentAt: now })
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));

    return { sent: true };
  });
```

Add the import at the top of payments.ts:
```typescript
import { emailService } from '../email/index.js';
```

And add `academy` to the existing schema imports if not already there.

- [ ] **Step 6: Add mute toggle to students.ts**

Add to `apps/api/src/routes/students.ts`, inside `studentRoutes`:

```typescript
  // Toggle notification mute (instructor only)
  app.put('/api/students/:id/notifications', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { muted } = request.body as { muted: boolean };

    const [updated] = await db.update(studentMembership)
      .set({ notificationsMuted: muted })
      .where(and(eq(studentMembership.studentId, id), eq(studentMembership.active, true)))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: 'Active membership not found' });
    }

    return updated;
  });
```

Add `studentMembership` to the imports in students.ts if not already there.

- [ ] **Step 7: Run tests**

```bash
cd apps/api && npx vitest run
```
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/payments.ts apps/api/src/routes/students.ts apps/api/test/payments-notifications.test.ts
git commit -m "feat: add payment status, overdue email, and mute toggle endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Translation Keys

**Files:**
- Modify: `apps/web/src/i18n/en.json`
- Modify: `apps/web/src/i18n/pt-BR.json`

- [ ] **Step 1: Add notification keys to both files**

Add a new `notifications` section to `en.json`:
```json
"notifications": {
  "title": "Notifications",
  "noOverdue": "No overdue payments",
  "daysOverdue": "{{days}} days overdue",
  "sendReminder": "Send reminder",
  "sendEmail": "Send email",
  "emailSent": "Email sent",
  "mute": "Mute",
  "unmute": "Unmute"
}
```

Add to `billing` section in `en.json`:
```json
"yourPaymentOverdue": "Your payment is {{days}} days overdue",
"paymentDueSoon": "Your payment is due in {{days}} days"
```

Add a new `notifications` section to `pt-BR.json`:
```json
"notifications": {
  "title": "Notificações",
  "noOverdue": "Nenhum pagamento atrasado",
  "daysOverdue": "{{days}} dias atrasado",
  "sendReminder": "Enviar lembrete",
  "sendEmail": "Enviar email",
  "emailSent": "Email enviado",
  "mute": "Silenciar",
  "unmute": "Ativar notificações"
}
```

Add to `billing` section in `pt-BR.json`:
```json
"yourPaymentOverdue": "Seu pagamento está {{days}} dias atrasado",
"paymentDueSoon": "Seu pagamento vence em {{days}} dias"
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/i18n/
git commit -m "feat: add payment notification translation keys

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Notification Bell Component

**Files:**
- Create: `apps/web/src/components/notification-bell.tsx`
- Create: `apps/web/test/components/notification-bell.test.tsx`
- Modify: `apps/web/src/components/layout/header.tsx`

- [ ] **Step 1: Write tests**

Create `apps/web/test/components/notification-bell.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import { NotificationBell } from '@/components/notification-bell';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
  });

  it('shows badge count for overdue students', async () => {
    mockApi.mockResolvedValue([
      { studentId: 's1', studentName: 'João', planName: 'Monthly', daysOverdue: 3, phone: '5511999', notificationsMuted: false },
      { studentId: 's2', studentName: 'Maria', planName: 'Monthly', daysOverdue: 7, phone: '5511888', notificationsMuted: false },
    ] as any);

    renderWithProviders(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('excludes muted students from badge count', async () => {
    mockApi.mockResolvedValue([
      { studentId: 's1', studentName: 'João', planName: 'Monthly', daysOverdue: 3, phone: '5511999', notificationsMuted: false },
      { studentId: 's2', studentName: 'Maria', planName: 'Monthly', daysOverdue: 7, phone: '5511888', notificationsMuted: true },
    ] as any);

    renderWithProviders(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('hides badge when no overdue students', async () => {
    mockApi.mockResolvedValue([] as any);

    renderWithProviders(<NotificationBell />);
    await waitFor(() => {
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run test/components/notification-bell.test.tsx
```

- [ ] **Step 3: Create NotificationBell component**

Create `apps/web/src/components/notification-bell.tsx`:

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageCircle, Mail, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OverdueStudent {
  studentId: string;
  studentName: string;
  email: string;
  phone: string | null;
  planName: string;
  daysOverdue: number;
  notificationsMuted: boolean;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [emailSentFor, setEmailSentFor] = useState<Set<string>>(new Set());

  const { data: overdueStudents = [] } = useApiQuery<OverdueStudent[]>(
    ['overdue', user?.academyId],
    `/payments/overdue?academyId=${user?.academyId}`,
    !!user?.academyId && user?.role === 'instructor',
  );

  const unmutedCount = overdueStudents.filter(s => !s.notificationsMuted).length;

  const muteMutation = useMutation({
    mutationFn: ({ studentId, muted }: { studentId: string; muted: boolean }) =>
      api(`/students/${studentId}/notifications`, {
        method: 'PUT',
        body: JSON.stringify({ muted }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: (studentId: string) =>
      api(`/payments/overdue/${studentId}/notify`, { method: 'POST' }),
    onSuccess: (_, studentId) => {
      setEmailSentFor(prev => new Set(prev).add(studentId));
    },
  });

  function handleWhatsApp(student: OverdueStudent) {
    if (!student.phone) return;
    const message = t('notifications.overdueMessage', {
      name: student.studentName,
      days: student.daysOverdue,
      defaultValue: `Olá ${student.studentName}, seu pagamento na academia está ${student.daysOverdue} dias atrasado. Por favor, regularize o quanto antes.`,
    });
    window.open(`https://wa.me/${student.phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  if (user?.role !== 'instructor') return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t('notifications.title')}
      >
        <Bell size={20} />
        {unmutedCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unmutedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h3 className="font-heading text-sm uppercase tracking-wider">{t('notifications.title')}</h3>
          </div>

          {overdueStudents.filter(s => !s.notificationsMuted).length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('notifications.noOverdue')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueStudents.filter(s => !s.notificationsMuted).map(student => (
                <div key={student.studentId} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{student.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.planName} &middot; {t('notifications.daysOverdue', { days: student.daysOverdue })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {student.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleWhatsApp(student)}
                      >
                        <MessageCircle size={14} className="mr-1" />
                        {t('notifications.sendReminder')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => emailMutation.mutate(student.studentId)}
                      disabled={emailSentFor.has(student.studentId) || emailMutation.isPending}
                    >
                      <Mail size={14} className="mr-1" />
                      {emailSentFor.has(student.studentId) ? t('notifications.emailSent') : t('notifications.sendEmail')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => muteMutation.mutate({ studentId: student.studentId, muted: true })}
                    >
                      <BellOff size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add bell to header**

Edit `apps/web/src/components/layout/header.tsx`. Add import and component:

```typescript
import { NotificationBell } from '@/components/notification-bell';
```

Add `<NotificationBell />` before the language switcher, inside the flex container:

```tsx
<div className="flex items-center gap-3">
  <NotificationBell />
  <div className="flex items-center gap-1">
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run test/components/notification-bell.test.tsx test/components/header.test.tsx
```
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/notification-bell.tsx apps/web/test/components/notification-bell.test.tsx apps/web/src/components/layout/header.tsx
git commit -m "feat: add notification bell with overdue student dropdown

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Student Dashboard Banners

**Files:**
- Modify: `apps/web/src/pages/dashboard.tsx`
- Modify: `apps/web/test/pages/dashboard.test.tsx`

- [ ] **Step 1: Add test for overdue banner**

Add to `apps/web/test/pages/dashboard.test.tsx`:

```typescript
it('shows overdue banner for student', async () => {
  mockUseSession.mockReturnValue(studentSession);
  mockApi.mockImplementation((path: string) => {
    if (path.includes('my-status')) return Promise.resolve({ status: 'overdue', daysOverdue: 5 });
    return Promise.resolve([] as any);
  });

  renderWithProviders(<DashboardPage />);
  await waitFor(() => {
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });
});

it('shows upcoming payment banner for student', async () => {
  mockUseSession.mockReturnValue(studentSession);
  mockApi.mockImplementation((path: string) => {
    if (path.includes('my-status')) return Promise.resolve({ status: 'upcoming', daysUntilDue: 2 });
    return Promise.resolve([] as any);
  });

  renderWithProviders(<DashboardPage />);
  await waitFor(() => {
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Update dashboard with banners**

Edit `apps/web/src/pages/dashboard.tsx`. Add a query for payment status and banners:

```typescript
const { data: paymentStatus } = useApiQuery<{ status: string; daysOverdue?: number; daysUntilDue?: number }>(
  ['my-payment-status'],
  '/payments/my-status',
  !!user?.id && !isInstructor,
);
```

Add banners after the welcome message, before the academy card:

```tsx
{!isInstructor && paymentStatus?.status === 'overdue' && (
  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
    <p className="text-destructive font-medium text-sm">
      {t('billing.yourPaymentOverdue', { days: paymentStatus.daysOverdue })}
    </p>
  </div>
)}

{!isInstructor && paymentStatus?.status === 'upcoming' && (
  <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
    <p className="text-primary font-medium text-sm">
      {t('billing.paymentDueSoon', { days: paymentStatus.daysUntilDue })}
    </p>
  </div>
)}
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run test/pages/dashboard.test.tsx
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/dashboard.tsx apps/web/test/pages/dashboard.test.tsx
git commit -m "feat: add overdue and upcoming payment banners to student dashboard

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Plan Assignment Dropdown

**Files:**
- Modify: `apps/web/src/pages/students/detail.tsx`

- [ ] **Step 1: Update student detail page**

Read `apps/web/src/pages/students/detail.tsx`. Find the membership assignment form where `planId` is a text input.

Replace the planId text input with a dropdown that fetches plans:

```typescript
const { data: plans = [] } = useApiQuery<any[]>(
  ['plans', user?.academyId],
  `/membership-plans?academyId=${user?.academyId}`,
  !!user?.academyId,
);
```

Replace the planId field (currently a text Input) with a select:

```tsx
<form.Field name="planId">
  {(field) => (
    <div className="space-y-2">
      <Label>{t('students.planId')}</Label>
      <select
        value={field.state.value}
        onChange={e => field.handleChange(e.target.value)}
        required
        className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
      >
        <option value="">--</option>
        {plans.map((p: any) => (
          <option key={p.id} value={p.id}>
            {p.name} — {Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </option>
        ))}
      </select>
    </div>
  )}
</form.Field>
```

- [ ] **Step 2: Run tests**

```bash
cd apps/web && npx vitest run
```
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/students/detail.tsx
git commit -m "feat: replace plan text input with dropdown picker on student detail

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd apps/api && npx vitest run && cd ../web && npx vitest run
```
Expected: ALL PASS

- [ ] **Step 2: Commit any fixes**
